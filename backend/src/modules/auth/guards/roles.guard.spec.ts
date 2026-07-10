import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from 'src/common/decorator/roles.decorator';
import { SCOPE_KEY } from 'src/common/decorator/scope.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Unit tests for RolesGuard, focused on the rule that the authorized scope is
// taken from the URL path and never overridden by the request body.

type Meta = {
  [IS_PUBLIC_KEY]?: boolean;
  [ROLES_KEY]?: string[];
  [SCOPE_KEY]?: { type: string; idParam: string } | undefined;
};

function makeReflector(meta: Meta): Reflector {
  return {
    getAllAndOverride: (key: string) => (meta as Record<string, unknown>)[key],
  } as unknown as Reflector;
}

function makeContext(req: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const UUID_A = '11111111-1111-1111-1111-111111111111'; // acting user
const WS_VICTIM = '22222222-2222-2222-2222-222222222222';
const WS_ATTACKER = '33333333-3333-3333-3333-333333333333';
const ORG = '44444444-4444-4444-4444-444444444444';

describe('RolesGuard scope resolution', () => {
  it('does not let the request body override the path-addressed scope', async () => {
    // The route addresses WS_VICTIM in the path; the attacker smuggles a
    // workspace they manage (WS_ATTACKER) in the body. The guard must authorize
    // against the path (WS_VICTIM), where the attacker has no role.
    const workspaceMember = {
      findUnique: jest.fn(async ({ where }: any) => {
        // Only WS_ATTACKER would grant a role; WS_VICTIM has none.
        if (where.userId_workspaceId.workspaceId === WS_ATTACKER) {
          return { role: 'MANAGER' };
        }
        return null;
      }),
    };
    const prisma = { workspaceMember } as any;
    const guard = new RolesGuard(
      makeReflector({
        [IS_PUBLIC_KEY]: false,
        [ROLES_KEY]: ['MANAGER'],
        [SCOPE_KEY]: { type: 'WORKSPACE', idParam: 'id' },
      }),
      prisma,
    );

    const ctx = makeContext({
      user: { id: UUID_A, role: 'MEMBER' },
      method: 'PATCH',
      params: { id: WS_VICTIM },
      query: {},
      body: { id: WS_ATTACKER, name: 'pwned' },
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    // It must have checked the victim workspace, and never authorized on the
    // attacker's workspace from the body.
    const checkedWorkspaceIds = workspaceMember.findUnique.mock.calls.map(
      (c: any) => c[0].where.userId_workspaceId.workspaceId,
    );
    expect(checkedWorkspaceIds).toContain(WS_VICTIM);
    expect(checkedWorkspaceIds).not.toContain(WS_ATTACKER);
  });

  it('authorizes normally when the scope id is a path param', async () => {
    const workspaceMember = {
      findUnique: jest.fn(async ({ where }: any) =>
        where.userId_workspaceId.workspaceId === WS_VICTIM ? { role: 'MANAGER' } : null,
      ),
    };
    const guard = new RolesGuard(
      makeReflector({
        [IS_PUBLIC_KEY]: false,
        [ROLES_KEY]: ['MANAGER'],
        [SCOPE_KEY]: { type: 'WORKSPACE', idParam: 'id' },
      }),
      { workspaceMember } as any,
    );
    const ctx = makeContext({
      user: { id: UUID_A, role: 'MEMBER' },
      method: 'PATCH',
      params: { id: WS_VICTIM },
      query: {},
      body: {},
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('still resolves a body-supplied scope when there is no path param (create in parent)', async () => {
    // A create route (POST, no path id) that legitimately carries the scope id
    // in the body must keep working: the guard and the handler read the same
    // body field, so they agree on the target.
    const organizationMember = {
      findUnique: jest.fn(async ({ where }: any) =>
        where.userId_organizationId.organizationId === ORG ? { role: 'MEMBER' } : null,
      ),
    };
    const guard = new RolesGuard(
      makeReflector({
        [IS_PUBLIC_KEY]: false,
        [ROLES_KEY]: ['MEMBER'],
        [SCOPE_KEY]: { type: 'ORGANIZATION', idParam: 'organizationId' },
      }),
      { organizationMember } as any,
    );
    const ctx = makeContext({
      user: { id: UUID_A, role: 'MEMBER' },
      method: 'POST',
      params: {},
      query: {},
      body: { organizationId: ORG, name: 'New Workspace' },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

describe('RolesGuard PUBLIC project bypass', () => {
  const slug = 'public-proj';
  const projectId = '55555555-5555-5555-5555-555555555555';

  function guardFor(method: string, roles: string[]) {
    const prisma = {
      project: {
        findUnique: jest.fn(async () => ({ id: projectId, visibility: 'PUBLIC' })),
      },
      // No membership for the acting user.
      projectMember: { findUnique: jest.fn(async () => null) },
    } as any;
    const guard = new RolesGuard(
      makeReflector({
        [IS_PUBLIC_KEY]: false,
        [ROLES_KEY]: roles,
        [SCOPE_KEY]: { type: 'PROJECT', idParam: 'slug' },
      }),
      prisma,
    );
    const ctx = makeContext({
      user: { id: UUID_A, role: 'MEMBER' },
      method,
      params: { slug },
      query: {},
      body: {},
    });
    return { guard, ctx };
  }

  it('grants a viewer-level read on a public project', async () => {
    const { guard, ctx } = guardFor('GET', ['VIEWER']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('does not grant a write on a public project to a non-member', async () => {
    const { guard, ctx } = guardFor('PATCH', ['MANAGER']);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not grant a viewer read when the route requires more than VIEWER', async () => {
    const { guard, ctx } = guardFor('GET', ['MANAGER']);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
