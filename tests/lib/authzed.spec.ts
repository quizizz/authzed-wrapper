import { ClientSecurity } from '@authzed/authzed-node/dist/src/util';
import {
  RelationshipUpdate,
  RelationshipUpdate_Operation,
} from '@authzed/authzed-node/dist/src/v1';
import { EventEmitter } from 'node:stream';
import {
  AuthZed,
  RelationshipUpdateOperation,
  ZedToken,
} from '../../src/lib/authzed';

const schema = `
definition quizizz/quiz {
  relation owner: quizizz/user
  relation reader: quizizz/user

  permission read = owner + reader
}

definition quizizz/user {}
`.trim();

describe('AuthZed Wrapper', () => {
  const client = new AuthZed(
    {
      token: 'quizizz',
      host: '127.0.0.1:50051',
      security: ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
    },
    {},
  );
  it('creates the schema correctly', async () => {
    await expect(client.writeSchema(schema)).resolves.toBe(true);
  });

  it('creates a relation successfully', async () => {
    const resp = await client.addRelations({
      relations: [
        {
          relation: 'owner',
          resource: {
            id: 'quiz_1',
            type: 'quizizz/quiz',
          },
          subject: {
            id: 'user_1',
            type: 'quizizz/user',
          },
        },
      ],
    });

    expect(resp).toBeTruthy();
  });

  it('performs permission checks correctly', async () => {
    const zedToken = await client.addRelations({
      relations: [
        {
          relation: 'owner',
          resource: {
            id: 'quiz_2',
            type: 'quizizz/quiz',
          },
          subject: {
            id: 'user_2',
            type: 'quizizz/user',
          },
        },
        {
          relation: 'reader',
          resource: {
            id: 'quiz_1',
            type: 'quizizz/quiz',
          },
          subject: {
            id: 'user_2',
            type: 'quizizz/user',
          },
        },
      ],
    });

    const [userTwoCanReadQuiz, userOneCanReadQuiz] = await Promise.all([
      client.checkPermission({
        accessor: {
          id: 'user_2',
          type: 'quizizz/user',
        },
        permission: 'read',
        resource: {
          id: 'quiz_2',
          type: 'quizizz/quiz',
        },
        consistency: {
          type: 'at-least-as-fresh',
          zedToken,
        },
      }),
      client.checkPermission({
        accessor: {
          id: 'user_1',
          type: 'quizizz/user',
        },
        permission: 'read',
        resource: {
          id: 'quiz_2',
          type: 'quizizz/quiz',
        },
      }),
    ]);

    expect(userTwoCanReadQuiz).toBe(true);
    expect(userOneCanReadQuiz).toBe(false);
  });

  it('lists all resources that a particular user has permissions to access correctly', async () => {
    const resources = await client.listResourcesAccessorCanAccess({
      accessor: {
        id: 'user_2',
        type: 'quizizz/user',
      },
      resourceType: 'quizizz/quiz',
      permission: 'read',
      consistency: {
        type: 'fully-consistent',
      },
    });

    expect(resources.length).toBeGreaterThan(0);
  });

  it('lists all users that have a permission to a particular resource', async () => {
    const accessors = await client.listAccessorsForResource({
      resource: {
        id: 'quiz_2',
        type: 'quizizz/quiz',
      },
      permission: 'read',
      subjectType: 'quizizz/user',
      consistency: {
        type: 'fully-consistent',
      },
    });

    expect(accessors.length).toBeGreaterThan(0);
  });

  it('receives watch events correctly', async () => {
    const emitter = new EventEmitter({
      captureRejections: true,
    });

    client.registerWatchEventListener({
      emitter,
    });

    const updates: { updates: RelationshipUpdate[]; zedToken: ZedToken }[] = [];

    emitter.on('data', (event) => {
      updates.push(event);
    });

    await client.addRelations({
      relations: [
        {
          relation: 'owner',
          resource: {
            id: 'quiz_1',
            type: 'quizizz/quiz',
          },
          subject: {
            id: 'user_1',
            type: 'quizizz/user',
          },
        },
      ],
    });

    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].updates[0]).toMatchObject({
      operation: RelationshipUpdateOperation.TOUCH,
    });
  });
});
