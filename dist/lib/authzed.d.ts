/// <reference types="node" />
/// <reference types="node" />
import { Readable } from 'stream';
import { v1 } from '@authzed/authzed-node';
import { ClientSecurity as AZClientSecurity } from '@authzed/authzed-node/dist/src/util';
import { RelationshipUpdate_Operation } from '@authzed/authzed-node/dist/src/v1';
import { EventEmitter } from 'node:events';
import { ILogger } from '../logger';
declare type AuthZedClientParams = {
    host: string;
    token: string;
    security: AZClientSecurity;
};
declare type ZedToken = v1.ZedToken;
declare type RelationshipUpdate = v1.RelationshipUpdate;
export { AZClientSecurity as ClientSecurity, ZedToken, RelationshipUpdate, RelationshipUpdate_Operation as RelationshipUpdateOperation, };
export declare type PartialMessage<T extends object> = {
    [K in keyof T]?: PartialField<T[K]>;
};
declare type PartialField<T> = T extends Date | Uint8Array | bigint | boolean | string | number ? T : T extends Array<infer U> ? Array<PartialField<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<PartialField<U>> : T extends {
    oneofKind: string;
} ? T : T extends {
    oneofKind: undefined;
} ? T : T extends object ? PartialMessage<T> : T;
export declare type Consistency = {
    type: 'minimum-latency';
} | {
    type: 'at-least-as-fresh';
    zedToken: v1.ZedToken;
} | {
    type: 'fully-consistent';
};
declare type CreateRelationParams = {
    relation: string;
    resource: {
        id: string;
        type: string;
    };
    subject: {
        id: string;
        type: string;
        subRelation?: string;
    };
};
declare type CheckPermissionParams = {
    permission: string;
    resource: {
        id: string;
        type: string;
    };
    accessor: {
        id: string;
        type: string;
        subRelation?: string;
    };
    consistency?: Consistency;
};
declare type ListResourcesAccessorCanAccessParams = {
    resourceType: string;
    accessor: {
        id: string;
        type: string;
        subRelation?: string;
    };
    permission: string;
    consistency?: Consistency;
};
declare type ListAccessorsForResourceParams = {
    resource: {
        id: string;
        type: string;
    };
    subjectType: string;
    subjectRelation?: string;
    permission: string;
    consistency?: Consistency;
};
declare type ListResourcesAccessorCanAccessResponse = {
    resourceId: string;
    zedToken?: string;
}[];
declare type ListAccessorsForResourceResponse = {
    accessorId: string;
    zedToken?: string;
}[];
declare type RegisterWatchEventListenerParams = {
    emitter: EventEmitter;
    watchFromToken?: ZedToken;
    objectTypes?: string[];
};
export declare class AuthZed {
    private _client;
    private logger;
    private watchEventListeners;
    constructor(params: AuthZedClientParams, { logger, }: {
        logger?: ILogger;
    });
    _getConsistencyParams<T extends {
        consistency?: Consistency;
    }>(request: T): PartialMessage<v1.Consistency>;
    _handleDataStream<T>(stream: Readable): Promise<T[]>;
    getClient(): ReturnType<typeof v1.NewClient>;
    writeSchema(schema: string): Promise<boolean>;
    readSchema(): Promise<string>;
    addRelations({ relations, }: {
        relations: CreateRelationParams[];
    }): Promise<v1.ZedToken>;
    checkPermission(params: CheckPermissionParams): Promise<boolean>;
    listResourcesAccessorCanAccess(params: ListResourcesAccessorCanAccessParams): Promise<ListResourcesAccessorCanAccessResponse>;
    listAccessorsForResource(params: ListAccessorsForResourceParams): Promise<ListAccessorsForResourceResponse>;
    registerWatchEventListener(params: RegisterWatchEventListenerParams): void;
}
