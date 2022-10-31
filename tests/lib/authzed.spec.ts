import { AuthZed } from '../../src/lib/authzed';

const schema = `
definition quizizz/quiz {
  relation owner: quizizz/user
  relation reader: quizizz/user

  permission read = owner + reader
}

definition quizizz/user {}
`.trim();

describe('AuthZed Wrapper', () => {
  const client = new AuthZed({
    token: 'quizizz',
    host: '127.0.0.1:50052',
  });
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
    const accessors = await client.listAccesorsForResource({
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
});
