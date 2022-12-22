"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthZed = exports.RelationshipUpdateOperation = exports.ClientSecurity = void 0;
const authzed_node_1 = require("@authzed/authzed-node");
const util_1 = require("@authzed/authzed-node/dist/src/util");
Object.defineProperty(exports, "ClientSecurity", { enumerable: true, get: function () { return util_1.ClientSecurity; } });
const v1_1 = require("@authzed/authzed-node/dist/src/v1");
Object.defineProperty(exports, "RelationshipUpdateOperation", { enumerable: true, get: function () { return v1_1.RelationshipUpdate_Operation; } });
const logger_1 = require("../logger");
class AuthZed {
    _client;
    logger;
    constructor(params, { logger, }) {
        this._client = authzed_node_1.v1.NewClient(params.token, params.host, util_1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS);
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
            this._client.writeRelationships(updateRelationsRequest, {}, (err, res) => {
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
            this._client.deleteRelationships(deleteRelationshipsRequest, {}, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(res.deletedAt);
            });
        });
    }
    addRelations({ relations = [], }) {
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
            this._client.writeRelationships(addRelationRequest, {}, (err, res) => {
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
        const stream = this._client.readRelationships(request);
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
            this._client.checkPermission(checkPermissionRequest, {}, (err, res) => {
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
        const stream = this._client.lookupResources(lookupResourcesRequest);
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
        const stream = this._client.lookupSubjects(lookupSubjectsRequest);
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
        }, params.grpcOptions || undefined);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aHplZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvYXV0aHplZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx3REFBMkM7QUFDM0MsOERBQXlGO0FBaUJuRSwrRkFqQksscUJBQWdCLE9BaUJQO0FBaEJwQywwREFBZ0g7QUFtQjlHLDRHQW5CdUMsaUNBQTJCLE9BbUJ2QztBQWY3QixzQ0FBbUQ7QUEwTG5ELE1BQWEsT0FBTztJQUNWLE9BQU8sQ0FBa0M7SUFDekMsTUFBTSxDQUFVO0lBRXhCLFlBQ0UsTUFBMkIsRUFDM0IsRUFDRSxNQUFNLEdBR1A7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFFLENBQUMsU0FBUyxDQUN6QixNQUFNLENBQUMsS0FBSyxFQUNaLE1BQU0sQ0FBQyxJQUFJLEVBQ1gscUJBQWdCLENBQUMsOEJBQThCLENBQ2hELENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sSUFBSSxJQUFJLHNCQUFhLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0lBRUQscUJBQXFCLENBQ25CLE9BQVU7UUFFVixJQUNFLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDcEIsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssaUJBQWlCLEVBQzlDO1lBQ0EsT0FBTztnQkFDTCxXQUFXLEVBQUU7b0JBQ1gsZUFBZSxFQUFFLElBQUk7b0JBQ3JCLFNBQVMsRUFBRSxpQkFBaUI7aUJBQzdCO2FBQ0YsQ0FBQztTQUNIO1FBRUQsSUFBSSxXQUFXLEdBQW1DLElBQUksQ0FBQztRQUV2RCxRQUFRLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFO1lBQ2hDLEtBQUssbUJBQW1CO2dCQUN0QixXQUFXLEdBQUc7b0JBQ1osV0FBVyxFQUFFO3dCQUNYLGNBQWMsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLFFBQVE7d0JBQzVDLFNBQVMsRUFBRSxnQkFBZ0I7cUJBQzVCO2lCQUNGLENBQUM7Z0JBQ0Ys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