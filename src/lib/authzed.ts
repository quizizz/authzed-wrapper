import { Readable } from 'stream';
import { v1 } from '@authzed/authzed-node';
import { ClientSecurity as AZClientSecurity } from '@authzed/authzed-node/dist/src/util';
import { RelationshipUpdate_Operation } from '@authzed/authzed-node/dist/src/v1';
import { EventEmitter } from 'node:events';

import { ConsoleLogger, ILogger } from '../logger';

type AuthZedClientParams = {
  host: string;
  token: string;
  security: AZClientSecurity;
};

type ZedToken = v1.ZedToken;
type RelationshipUpdate = v1.RelationshipUpdate;
export {
  AZClientSecurity as ClientSecurity,
  ZedToken,
  RelationshipUpdate,
  RelationshipUpdate_Operation as RelationshipUpdateOperation,
};

export declare type PartialMessage<T extends object> = {
  [K in keyof T]?: PartialField<T[K]>;
};

declare type PartialField<T> = T extends
  | Date
  | Uint8Array
  | bigint
  | boolean
  | string
  | number
  ? T
  : T extends Array<infer U>
  ? Array<PartialField<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<PartialField<U>>
  : T extends {
      oneofKind: string;
    }
  ? T
  : T extends {
      oneofKind: undefined;
    }
  ? T
  : T extends object
  ? PartialMessage<T>
  : T;

export type Consistency =
  | {
      type: 'minimum-latency';
    }
  | {
      type: 'at-least-as-fresh';
      zedToken: v1.ZedToken;
    }
  | {
      type: 'fully-consistent';
    };

type CreateRelationParams = {
  relation: string;
  resource: {
    id: string;
    type: string;
  };
  subject: {
    id: string;
    type: string;
    // used for defining a sub-relation on the subject, e.g. group:123#members
    subRelation?: string;
  };
};

type CheckPermissionParams = {
  permission: string;
  resource: {
    id: string;
    type: string;
  };
  accessor: {
    id: string;
    type: string;

    // used for defining a sub-relation on the subject, e.g. group:123#members
    subRelation?: string;
  };
  consistency?: Consistency;
};

type ListResourcesAccessorCanAccessParams = {
  resourceType: string;
  accessor: {
    id: string;
    type: string;

    // used for defining a sub-relation on the subject, e.g. group:123#members
    subRelation?: string;
  };
  permission: string;
  consistency?: Consistency;
};

type ListAccessorsForResourceParams = {
  resource: {
    id: string;
    type: string;
  };
  subjectType: string;
  subjectRelation?: string;
  permission: string;
  consistency?: Consistency;
};

type ListResourcesAccessorCanAccessResponse = {
  resourceId: string;
  zedToken?: string;
}[];

type ListAccessorsForResourceResponse = {
  accessorId: string;
  zedToken?: string;
}[];

type RegisterWatchEventListenerParams = {
  emitter: EventEmitter;
  watchFromToken?: ZedToken;
  objectTypes?: string[];
};

export class AuthZed {
  private _client: ReturnType<typeof v1.NewClient>;
  private logger: ILogger;
  private watchEventListeners: EventEmitter[];

  constructor(
    params: AuthZedClientParams,
    {
      logger,
    }: {
      logger?: ILogger;
    },
  ) {
    this._client = v1.NewClient(
      params.token,
      params.host,
      AZClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
    );
    this.logger = logger || new ConsoleLogger();
  }

  _getConsistencyParams<T extends { consistency?: Consistency }>(
    request: T,
  ): PartialMessage<v1.Consistency> {
    if (
      !request.consistency ||
      request.consistency.type === 'minimum-latency'
    ) {
      return {
        requirement: {
          minimizeLatency: true,
          oneofKind: 'minimizeLatency',
        },
      };
    }

    let consistency: PartialMessage<v1.Consistency> = null;

    switch (request.consistency.type) {
      case 'at-least-as-fresh':
        consistency = {
          requirement: {
            atLeastAsFresh: request.consistency.zedToken,
            oneofKind: 'atLeastAsFresh',
          },
        };
        break;
      case 'fully-consistent':
        consistency = {
          requirement: {
            fullyConsistent: true,
            oneofKind: 'fullyConsistent',
          },
        };
        break;
      default:
        consistency = {
          requirement: {
            minimizeLatency: true,
            oneofKind: 'minimizeLatency',
          },
        };
    }

    return consistency;
  }

  _handleDataStream<T>(stream: Readable): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const accumulator: T[] = [];

      stream.on('data', (chunk: T) => {
        accumulator.push(chunk);
      });

      stream.on('end', () => {
        resolve(accumulator);
      });

      stream.on('close', () => {
        resolve(accumulator);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  getClient(): ReturnType<typeof v1.NewClient> {
    return this._client;
  }

  writeSchema(schema: string): Promise<boolean> {
    const writeSchemaRequest = v1.WriteSchemaRequest.create({
      schema,
    });

    this.logger.infoj({
      msg: 'Writing schema to SpiceDB',
      schema,
    });

    return new Promise((resolve, reject) => {
      this._client.writeSchema(writeSchemaRequest, {}, (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(true);
      });
    });
  }

  readSchema(): Promise<string> {
    const readSchemaRequest = v1.ReadSchemaRequest.create();

    return new Promise((resolve, reject) => {
      this._client.readSchema(readSchemaRequest, {}, (err, resp) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(resp.schemaText);
      });
    });
  }

  addRelations({
    relations = [],
  }: {
    relations: CreateRelationParams[];
  }): Promise<v1.ZedToken> {
    const updates = relations.map((relation) => {
      const subject = v1.SubjectReference.create({
        object: {
          objectId: relation.subject.id,
          objectType: relation.subject.type,
        },
        optionalRelation: relation.subject.subRelation,
      });

      const object = v1.ObjectReference.create({
        objectId: relation.resource.id,
        objectType: relation.resource.type,
      });

      return {
        relationship: {
          relation: relation.relation,
          subject,
          resource: object,
        },
        operation: RelationshipUpdate_Operation.TOUCH,
      };
    });

    this.logger.debugj({
      msg: 'Creating relations in SpiceDB',
      updates,
    });

    const addRelationRequest = v1.WriteRelationshipsRequest.create({
      updates,
    });

    return new Promise((resolve, reject) => {
      this._client.writeRelationships(addRelationRequest, {}, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(res.writtenAt);
      });
    });
  }

  checkPermission(params: CheckPermissionParams): Promise<boolean> {
    const resource = v1.ObjectReference.create({
      objectId: params.resource.id,
      objectType: params.resource.type,
    });

    const subject = v1.SubjectReference.create({
      object: {
        objectId: params.accessor.id,
        objectType: params.accessor.type,
      },
      optionalRelation: params.accessor.subRelation,
    });

    const checkPermParams = {
      permission: params.permission,
      resource,
      subject,
      consistency: this._getConsistencyParams(params),
    };

    this.logger.debugj({
      msg: 'Checking for permissions',
      params: checkPermParams,
    });

    const checkPermissionRequest =
      v1.CheckPermissionRequest.create(checkPermParams);

    return new Promise((resolve, reject) => {
      this._client.checkPermission(checkPermissionRequest, {}, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        const hasPermissions =
          res.permissionship ===
          v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;

        resolve(hasPermissions);
      });
    });
  }

  async listResourcesAccessorCanAccess(
    params: ListResourcesAccessorCanAccessParams,
  ): Promise<ListResourcesAccessorCanAccessResponse> {
    const lookupRequestParams = {
      resourceObjectType: params.resourceType,
      subject: v1.SubjectReference.create({
        object: {
          objectId: params.accessor.id,
          objectType: params.accessor.type,
        },
        optionalRelation: params.accessor.subRelation ?? undefined,
      }),
      permission: params.permission,
      consistency: this._getConsistencyParams(params),
    };

    const lookupResourcesRequest =
      v1.LookupResourcesRequest.create(lookupRequestParams);

    this.logger.debugj({
      msg: 'Listing resources for accessor',
      lookupResourcesRequest,
    });

    const stream = this._client.lookupResources(lookupResourcesRequest);
    const resources = await this._handleDataStream<v1.LookupResourcesResponse>(
      stream,
    );

    const response = resources.map((resource) => ({
      resourceId: resource.resourceObjectId,
      zedToken: resource.lookedUpAt.token,
    }));

    return response;
  }

  async listAccessorsForResource(
    params: ListAccessorsForResourceParams,
  ): Promise<ListAccessorsForResourceResponse> {
    const lookupSubjectsRequest = v1.LookupSubjectsRequest.create({
      subjectObjectType: params.subjectType,
      resource: v1.ObjectReference.create({
        objectId: params.resource.id,
        objectType: params.resource.type,
      }),
      permission: params.permission,
      optionalSubjectRelation: params.subjectRelation ?? undefined,
      consistency: this._getConsistencyParams(params),
    });

    const stream = this._client.lookupSubjects(lookupSubjectsRequest);
    const response = await this._handleDataStream<v1.LookupSubjectsResponse>(
      stream,
    );

    const accessors = response.map((response) => ({
      accessorId: response.subjectObjectId,
      zedToken: response.lookedUpAt.token,
    }));

    return accessors;
  }

  registerWatchEventListener(params: RegisterWatchEventListenerParams): void {
    const watchStream = this._client.watch({
      optionalStartCursor: params.watchFromToken,
      optionalObjectTypes: params.objectTypes ?? [],
    });

    this.logger.debugj({
      msg: 'Registered watch listener',
      params,
    });

    const emitter = params.emitter;

    watchStream.on('data', (watchEvent: v1.WatchResponse) => {
      this.logger.debugj({
        msg: 'Got watch data',
        watchEvent,
      });
      emitter.emit('data', {
        eventName: 'RelationshipUpdate',
        data: {
          zedToken: watchEvent.changesThrough,
          updates: watchEvent.updates,
        },
      });
    });

    watchStream.on('close', () => emitter.emit('close'));
    watchStream.on('end', () => emitter.emit('end'));
    watchStream.on('error', (err) => emitter.emit('error', err));
  }
}
