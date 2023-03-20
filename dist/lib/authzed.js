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
            this._client.writeRelationships(updateRelationsRequest, params.grpcOptions ?? {}, (err, res) => {
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
            this._client.deleteRelationships(deleteRelationshipsRequest, params.grpcOptions ?? {}, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(res.deletedAt);
            });
        });
    }
    addRelations({ relations = [], grpcOptions = {}, }) {
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
            this._client.writeRelationships(addRelationRequest, grpcOptions, (err, res) => {
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
        const stream = this._client.readRelationships(request, params.grpcOptions ?? {});
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
            this._client.checkPermission(checkPermissionRequest, params.grpcOptions ?? {}, (err, res) => {
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
        const stream = this._client.lookupResources(lookupResourcesRequest, params.grpcOptions ?? {});
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
        const stream = this._client.lookupSubjects(lookupSubjectsRequest, params.grpcOptions ?? {});
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
        }, params.grpcOptions ?? {});
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aHplZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvYXV0aHplZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx3REFBMkM7QUFDM0MsOERBQXlGO0FBaUJuRSwrRkFqQksscUJBQWdCLE9BaUJQO0FBaEJwQywwREFBZ0g7QUFtQjlHLDRHQW5CdUMsaUNBQTJCLE9BbUJ2QztBQWY3QixzQ0FBbUQ7QUFnTW5ELE1BQWEsT0FBTztJQUNWLE9BQU8sQ0FBa0M7SUFDekMsTUFBTSxDQUFVO0lBRXhCLFlBQ0UsTUFBMkIsRUFDM0IsRUFDRSxNQUFNLEdBR1A7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFFLENBQUMsU0FBUyxDQUN6QixNQUFNLENBQUMsS0FBSyxFQUNaLE1BQU0sQ0FBQyxJQUFJLEVBQ1gsTUFBTSxDQUFDLFFBQVEsSUFBSSxxQkFBZ0IsQ0FBQyw4QkFBOEIsQ0FDbkUsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxJQUFJLElBQUksc0JBQWEsRUFBRSxDQUFDO0lBQzlDLENBQUM7SUFFRCxxQkFBcUIsQ0FDbkIsT0FBVTtRQUVWLElBQ0UsQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNwQixPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksS0FBSyxpQkFBaUIsRUFDOUM7WUFDQSxPQUFPO2dCQUNMLFdBQVcsRUFBRTtvQkFDWCxlQUFlLEVBQUUsSUFBSTtvQkFDckIsU0FBUyxFQUFFLGlCQUFpQjtpQkFDN0I7YUFDRixDQUFDO1NBQ0g7UUFFRCxJQUFJLFdBQVcsR0FBbUMsSUFBSSxDQUFDO1FBRXZELFFBQVEsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUU7WUFDaEMsS0FBSyxtQkFBbUI7Z0JBQ3RCLFdBQVcsR0FBRztvQkFDWixXQUFXLEVBQUU7d0JBQ1gsY0FBYyxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsUUFBUTt3QkFDNUMsU0FBUyxFQUFFLGdCQUFnQjtxQkFD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