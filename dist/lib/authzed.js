"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthZed = void 0;
const logger_1 = require("../logger");
const authzed_node_1 = require("@authzed/authzed-node");
const util_1 = require("@authzed/authzed-node/dist/src/util");
const v1_1 = require("@authzed/authzed-node/dist/src/v1");
class AuthZed {
    _client;
    constructor(params) {
        this._client = authzed_node_1.v1.NewClient(params.token, params.host, util_1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS);
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
    writeSchema(schema) {
        const writeSchemaRequest = authzed_node_1.v1.WriteSchemaRequest.create({
            schema,
        });
        logger_1.logger.infoj({
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
        logger_1.logger.debugj({
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
        logger_1.logger.debugj({
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
        logger_1.logger.debugj({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aHplZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvYXV0aHplZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxzQ0FBbUM7QUFDbkMsd0RBQTJDO0FBQzNDLDhEQUFxRTtBQUNyRSwwREFBaUY7QUErR2pGLE1BQWEsT0FBTztJQUNWLE9BQU8sQ0FBa0M7SUFFakQsWUFBWSxNQUEyQjtRQUNyQyxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFFLENBQUMsU0FBUyxDQUN6QixNQUFNLENBQUMsS0FBSyxFQUNaLE1BQU0sQ0FBQyxJQUFJLEVBQ1gscUJBQWMsQ0FBQyw4QkFBOEIsQ0FDOUMsQ0FBQztJQUNKLENBQUM7SUFFRCxxQkFBcUIsQ0FDbkIsT0FBVTtRQUVWLElBQ0UsQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNwQixPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksS0FBSyxpQkFBaUIsRUFDOUM7WUFDQSxPQUFPO2dCQUNMLFdBQVcsRUFBRTtvQkFDWCxlQUFlLEVBQUUsSUFBSTtvQkFDckIsU0FBUyxFQUFFLGlCQUFpQjtpQkFDN0I7YUFDRixDQUFDO1NBQ0g7UUFFRCxJQUFJLFdBQVcsR0FBbUMsSUFBSSxDQUFDO1FBRXZELFFBQVEsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUU7WUFDaEMsS0FBSyxtQkFBbUI7Z0JBQ3RCLFdBQVcsR0FBRztvQkFDWixXQUFXLEVBQUU7d0JBQ1gsY0FBYyxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsUUFBUTt3QkFDNUMsU0FBUyxFQUFFLGdCQUFnQjtxQkFDNUI7aUJBQ0YsQ0FBQztnQkFDRixNQUFNO1lBQ1IsS0FBSyxrQkFBa0I7Z0JBQ3JCLFdBQVcsR0FBRztvQkFDWixXQUFXLEVBQUU7d0JBQ1gsZUFBZSxFQUFFLElBQUk7d0JBQ3JCLFNBQVMsRUFBRSxpQkFBaUI7cUJBQzdCO2lCQUNGLENBQUM7Z0JBQ0YsTUFBTTtZQUNSO2dCQUNFLFdBQVcsR0FBRztv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