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
    watchEventListeners;
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
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aHplZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvYXV0aHplZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx3REFBMkM7QUFDM0MsOERBQXlGO0FBZW5FLCtGQWZLLHFCQUFnQixPQWVQO0FBZHBDLDBEQUFpRjtBQWlCL0MsNEdBakJ6QixpQ0FBNEIsT0FpQndCO0FBZDdELHNDQUFtRDtBQStIbkQsTUFBYSxPQUFPO0lBQ1YsT0FBTyxDQUFrQztJQUN6QyxNQUFNLENBQVU7SUFDaEIsbUJBQW1CLENBQWlCO0lBRTVDLFlBQ0UsTUFBMkIsRUFDM0IsRUFDRSxNQUFNLEdBR1A7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFFLENBQUMsU0FBUyxDQUN6QixNQUFNLENBQUMsS0FBSyxFQUNaLE1BQU0sQ0FBQyxJQUFJLEVBQ1gscUJBQWdCLENBQUMsOEJBQThCLENBQ2hELENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sSUFBSSxJQUFJLHNCQUFhLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0lBRUQscUJBQXFCLENBQ25CLE9BQVU7UUFFVixJQUNFLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDcEIsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssaUJBQWlCLEVBQzlDO1lBQ0EsT0FBTztnQkFDTCxXQUFXLEVBQUU7b0JBQ1gsZUFBZSxFQUFFLElBQUk7b0JBQ3JCLFNBQVMsRUFBRSxpQkFBaUI7aUJBQzdCO2FBQ0YsQ0FBQztTQUNIO1FBRUQsSUFBSSxXQUFXLEdBQW1DLElBQUksQ0FBQztRQUV2RCxRQUFRLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFO1lBQ2hDLEtBQUssbUJBQW1CO2dCQUN0QixXQUFXLEdBQUc7b0JBQ1osV0FBVyxFQUFFO3dCQUNYLGNBQWMsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLFFBQVE7d0JBQzVDLFNBQVMsRUFBRSxnQkFBZ0I7cUJBQzVCO2lC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