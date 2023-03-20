"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthZed = exports.RelationshipUpdateOperation = exports.ClientSecurity = void 0;
const authzed_node_1 = require("@authzed/authzed-node");
const util_1 = require("@authzed/authzed-node/dist/src/util");
Object.defineProperty(exports, "ClientSecurity", { enumerable: true, get: function () { return util_1.ClientSecurity; } });
const v1_1 = require("@authzed/authzed-node/dist/src/v1");
Object.defineProperty(exports, "RelationshipUpdateOperation", { enumerable: true, get: function () { return v1_1.RelationshipUpdate_Operation; } });
const grpc = __importStar(require("@grpc/grpc-js"));
const logger_1 = require("../logger");
class AuthZed {
    _client;
    logger;
    constructor(params, { logger, }) {
        this._client = authzed_node_1.v1.NewClient(params.token, params.host, params.security ?? util_1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS);
        this.logger = logger || new logger_1.ConsoleLogger();
    }
    _getConsistencyParams(request) {
        if (!request.consistency ||
            request.consistency.type === 'minimum-latency') {
            return {
                requirement: {
                    minimizeLatency: true,
                    oneofKind: 'minimizeLatency',
                },
            };
        }
        let consistency = null;
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
    _handleDataStream(stream) {
        return new Promise((resolve, reject) => {
            const accumulator = [];
            stream.on('data', (chunk) => {
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
    getClient() {
        return this._client;
    }
    writeSchema(schema) {
        const writeSchemaRequest = authzed_node_1.v1.WriteSchemaRequest.create({
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
    readSchema() {
        const readSchemaRequest = authzed_node_1.v1.ReadSchemaRequest.create();
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
    updateRelations(params) {
        const updates = params.updates.map((update) => {
            const subject = authzed_node_1.v1.SubjectReference.create({
                object: {
                    objectId: update.accessor.id,
                    objectType: update.accessor.type,
                },
                optionalRelation: update.accessor.subRelation,
            });
            const object = authzed_node_1.v1.ObjectReference.create({
                objectId: update.resource.id,
                objectType: update.resource.type,
            });
            return {
                relationship: {
                    relation: update.relation,
                    subject,
                    resource: object,
                },
                operation: update.operation,
            };
        });
        this.logger.debugj({
            msg: 'Updating relations in SpiceDB',
            updates,
        });
        const updateRelationsRequest = authzed_node_1.v1.WriteRelationshipsRequest.create({
            updates,
        });
        return new Promise((resolve, reject) => {
            this._client.writeRelationships(updateRelationsRequest, params.grpcMetadata || new grpc.Metadata(), params.grpcOptions || {}, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(res.writtenAt);
            });
        });
    }
    deleteRelations(params) {
        const { resource, subject, relation } = params;
        const deleteRelationshipsRequest = authzed_node_1.v1.DeleteRelationshipsRequest.create({
            relationshipFilter: {
                resourceType: resource.type,
                optionalRelation: relation,
                optionalResourceId: resource.id,
                optionalSubjectFilter: subject
                    ? authzed_node_1.v1.SubjectFilter.create({
                        optionalRelation: authzed_node_1.v1.SubjectFilter_RelationFilter.create({
                            relation: subject.subRelation,
                        }),
                        optionalSubjectId: subject.id,
                        subjectType: subject.type,
                    })
                    : undefined,
            },
        });
        this.logger.debugj({
            msg: 'Deleting relations in SpiceDB',
            data: deleteRelationshipsRequest,
        });
        return new Promise((resolve, reject) => {
            this._client.deleteRelationships(deleteRelationshipsRequest, params.grpcMetadata || new grpc.Metadata(), params.grpcOptions || {}, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(res.deletedAt);
            });
        });
    }
    addRelations({ relations = [], grpcOptions = {}, grpcMetadata = null, }) {
        const updates = relations.map((relation) => {
            const subject = authzed_node_1.v1.SubjectReference.create({
                object: {
                    objectId: relation.subject.id,
                    objectType: relation.subject.type,
                },
                optionalRelation: relation.subject.subRelation,
            });
            const object = authzed_node_1.v1.ObjectReference.create({
                objectId: relation.resource.id,
                objectType: relation.resource.type,
            });
            return {
                relationship: {
                    relation: relation.relation,
                    subject,
                    resource: object,
                },
                operation: v1_1.RelationshipUpdate_Operation.TOUCH,
            };
        });
        this.logger.debugj({
            msg: 'Creating relations in SpiceDB',
            updates,
        });
        const addRelationRequest = authzed_node_1.v1.WriteRelationshipsRequest.create({
            updates,
        });
        return new Promise((resolve, reject) => {
            this._client.writeRelationships(addRelationRequest, grpcMetadata || new grpc.Metadata(), grpcOptions || {}, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(res.writtenAt);
            });
        });
    }
    async readRelationships(params) {
        const subjectFilter = {};
        if (params.subject?.id) {
            subjectFilter.optionalSubjectId = params.subject.id;
        }
        if (params.subject?.type) {
            subjectFilter.subjectType = params.subject.type;
        }
        if (params.subject?.subRelation) {
            subjectFilter.optionalRelation = {
                relation: params.subject.subRelation,
            };
        }
        const request = authzed_node_1.v1.ReadRelationshipsRequest.create({
            consistency: this._getConsistencyParams(params),
            relationshipFilter: {
                optionalRelation: params.relation,
                optionalResourceId: params.resource.id,
                resourceType: params.resource.type,
                optionalSubjectFilter: params.subject ? subjectFilter : undefined,
            },
        });
        this.logger.debugj({
            msg: 'Reading relationships',
            params: request.relationshipFilter.optionalSubjectFilter,
        });
        const stream = this._client.readRelationships(request, params.grpcMetadata || new grpc.Metadata(), params.grpcOptions || {});
        const relationships = await this._handleDataStream(stream);
        const result = relationships.map((result) => ({
            zedToken: result.readAt,
            resource: {
                type: result.relationship.resource.objectType,
                id: result.relationship.resource.objectId,
            },
            subject: {
                subRelation: result.relationship.subject.optionalRelation,
                id: result.relationship.subject.object.objectId,
                type: result.relationship.subject.object.objectType,
            },
            relation: result.relationship.relation,
        }));
        return result;
    }
    checkPermission(params) {
        const resource = authzed_node_1.v1.ObjectReference.create({
            objectId: params.resource.id,
            objectType: params.resource.type,
        });
        const subject = authzed_node_1.v1.SubjectReference.create({
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
        const checkPermissionRequest = authzed_node_1.v1.CheckPermissionRequest.create(checkPermParams);
        return new Promise((resolve, reject) => {
            this._client.checkPermission(checkPermissionRequest, params.grpcMetadata || new grpc.Metadata(), params.grpcOptions || {}, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                const hasPermissions = res.permissionship ===
                    authzed_node_1.v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
                resolve(hasPermissions);
            });
        });
    }
    async listResourcesAccessorCanAccess(params) {
        const lookupRequestParams = {
            resourceObjectType: params.resourceType,
            subject: authzed_node_1.v1.SubjectReference.create({
                object: {
                    objectId: params.accessor.id,
                    objectType: params.accessor.type,
                },
                optionalRelation: params.accessor.subRelation ?? undefined,
            }),
            permission: params.permission,
            consistency: this._getConsistencyParams(params),
        };
        const lookupResourcesRequest = authzed_node_1.v1.LookupResourcesRequest.create(lookupRequestParams);
        this.logger.debugj({
            msg: 'Listing resources for accessor',
            lookupResourcesRequest,
        });
        const stream = this._client.lookupResources(lookupResourcesRequest, params.grpcMetadata || new grpc.Metadata(), params.grpcOptions || {});
        const resources = await this._handleDataStream(stream);
        const response = resources.map((resource) => ({
            resourceId: resource.resourceObjectId,
            zedToken: resource.lookedUpAt.token,
        }));
        return response;
    }
    async listAccessorsForResource(params) {
        const lookupSubjectsRequest = authzed_node_1.v1.LookupSubjectsRequest.create({
            subjectObjectType: params.subjectType,
            resource: authzed_node_1.v1.ObjectReference.create({
                objectId: params.resource.id,
                objectType: params.resource.type,
            }),
            permission: params.permission,
            optionalSubjectRelation: params.subjectRelation ?? undefined,
            consistency: this._getConsistencyParams(params),
        });
        const stream = this._client.lookupSubjects(lookupSubjectsRequest, params.grpcMetadata || new grpc.Metadata(), params.grpcOptions || {});
        const response = await this._handleDataStream(stream);
        const accessors = response.map((response) => ({
            accessorId: response.subjectObjectId,
            zedToken: response.lookedUpAt.token,
        }));
        return accessors;
    }
    registerWatchEventListener(params) {
        const watchStream = this._client.watch({
            optionalStartCursor: params.watchFromToken,
            optionalObjectTypes: params.objectTypes ?? [],
        }, params.grpcMetadata || new grpc.Metadata(), params.grpcOptions || {});
        this.logger.debugj({
            msg: 'Registered watch listener',
            params,
        });
        const emitter = params.emitter;
        watchStream.on('data', (watchEvent) => {
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
exports.AuthZed = AuthZed;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aHplZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvYXV0aHplZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHdEQUEyQztBQUMzQyw4REFBeUY7QUFpQm5FLCtGQWpCSyxxQkFBZ0IsT0FpQlA7QUFoQnBDLDBEQUFnSDtBQW1COUcsNEdBbkJ1QyxpQ0FBMkIsT0FtQnZDO0FBakI3QixvREFBc0M7QUFFdEMsc0NBQW1EO0FBdU1uRCxNQUFhLE9BQU87SUFDVixPQUFPLENBQWtDO0lBQ3pDLE1BQU0sQ0FBVTtJQUV4QixZQUNFLE1BQTJCLEVBQzNCLEVBQ0UsTUFBTSxHQUdQO1FBRUQsSUFBSSxDQUFDLE9BQU8sR0FBRyxpQkFBRSxDQUFDLFNBQVMsQ0FDekIsTUFBTSxDQUFDLEtBQUssRUFDWixNQUFNLENBQUMsSUFBSSxFQUNYLE1BQU0sQ0FBQyxRQUFRLElBQUkscUJBQWdCLENBQUMsOEJBQThCLENBQ25FLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sSUFBSSxJQUFJLHNCQUFhLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0lBRUQscUJBQXFCLENBQ25CLE9BQVU7UUFFVixJQUNFLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDcEIsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssaUJBQWlCLEVBQzlDO1lBQ0EsT0FBTztnQkFDTCxXQUFXLEVBQUU7b0JBQ1gsZUFBZSxFQUFFLElBQUk7b0JBQ3JCLFNBQVMsRUFBRSxpQkFBaUI7aUJBQzdCO2FBQ0YsQ0FBQztTQUNIO1FBRUQsSUFBSSxXQUFXLEdBQW1DLElBQUksQ0FBQztRQUV2RCxRQUFRLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFO1lBQ2hDLEtBQUssbUJBQW1CO2dCQUN0QixXQUFXLEdBQUc7b0JBQ1osV0FBVyxFQUFFO3dCQUNYLGNBQWMsRUFBRSxPQUFPLENBQUMsV0FBVyxD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