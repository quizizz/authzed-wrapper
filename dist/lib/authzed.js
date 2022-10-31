"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthZed = void 0;
const logger_1 = require("../logger");
const authzed_node_1 = require("@authzed/authzed-node");
const util_1 = require("@authzed/authzed-node/dist/src/util");
const v1_1 = require("@authzed/authzed-node/dist/src/v1");
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
    async listAccesorsForResource(params) {
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
}
exports.AuthZed = AuthZed;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aHplZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvYXV0aHplZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxzQ0FBbUQ7QUFDbkQsd0RBQTJDO0FBQzNDLDhEQUFxRTtBQUNyRSwwREFBaUY7QUFnSGpGLE1BQWEsT0FBTztJQUNWLE9BQU8sQ0FBa0M7SUFDekMsTUFBTSxDQUFVO0lBRXhCLFlBQ0UsTUFBMkIsRUFDM0IsRUFDRSxNQUFNLEdBR1A7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFFLENBQUMsU0FBUyxDQUN6QixNQUFNLENBQUMsS0FBSyxFQUNaLE1BQU0sQ0FBQyxJQUFJLEVBQ1gscUJBQWMsQ0FBQyw4QkFBOEIsQ0FDOUMsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxJQUFJLElBQUksc0JBQWEsRUFBRSxDQUFDO0lBQzlDLENBQUM7SUFFRCxxQkFBcUIsQ0FDbkIsT0FBVTtRQUVWLElBQ0UsQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNwQixPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksS0FBSyxpQkFBaUIsRUFDOUM7WUFDQSxPQUFPO2dCQUNMLFdBQVcsRUFBRTtvQkFDWCxlQUFlLEVBQUUsSUFBSTtvQkFDckIsU0FBUyxFQUFFLGlCQUFpQjtpQkFDN0I7YUFDRixDQUFDO1NBQ0g7UUFFRCxJQUFJLFdBQVcsR0FBbUMsSUFBSSxDQUFDO1FBRXZELFFBQVEsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUU7WUFDaEMsS0FBSyxtQkFBbUI7Z0JBQ3RCLFdBQVcsR0FBRztvQkFDWixXQUFXLEVBQUU7d0JBQ1gsY0FBYyxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsUUFBUTt3QkFDNUMsU0FBUyxFQUFFLGdCQUFnQjtxQkFDNUI7aUJBQ0YsQ0FBQztnQkFDRixNQUFNO1lBQ1IsS0FBSyxrQkFBa0I7Z0JBQ3JCLFdBQVcsR0FBRztvQkFDWixXQUFXLEVBQUU7d0JB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