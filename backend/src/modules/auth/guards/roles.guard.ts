// roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role as PrismaRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ROLE_RANK } from 'src/common/decorator/role-order';
import { ROLES_KEY } from 'src/common/decorator/roles.decorator';
import { SCOPE_KEY, ScopeType } from 'src/common/decorator/scope.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.id) throw new ForbiddenException('Unauthenticated');

    // SUPER_ADMIN has unrestricted access to all endpoints
    if (user.role === 'SUPER_ADMIN') return true;

    const requiredRoles = this.reflector.getAllAndOverride<PrismaRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;
    const scopeMeta = this.reflector.getAllAndOverride<{
      type: ScopeType;
      idParam: string;
    }>(SCOPE_KEY, [ctx.getHandler(), ctx.getClass()]);
    const params = {
      ...(req.params ?? {}),
      ...(req.query ?? {}),
      ...(req.body ?? {}),
    };
    const { type, idParam } = scopeMeta ?? inferScopeFromParams(params as Record<string, string>);

    if (!type) throw new ForbiddenException('Scope not specified');

    const scopeId = params[idParam];
    if (!scopeId) throw new ForbiddenException('Scope id missing');

    let resolvedScopeId = scopeId;
    if (type === 'PROJECT' && idParam === 'slug') {
      const project = await this.prisma.project.findUnique({
        where: { slug: scopeId },
        select: { id: true, visibility: true },
      });
      if (!project) throw new NotFoundException('Project not found');
      resolvedScopeId = project.id;
      if (project.visibility === 'PUBLIC') {
        return true;
      }
    }
    const memberRole = await this.getMemberRole(type, user.id as string, resolvedScopeId as string);
    if (!memberRole) throw new ForbiddenException('Not a member of this scope');
    const ok = requiredRoles.some((r) => ROLE_RANK[memberRole] >= ROLE_RANK[r]);
    if (!ok) throw new ForbiddenException('Insufficient role');

    return true;
  }

  private async getMemberRole(type: ScopeType, userId: string, scopeId: string) {
    switch (type) {
      case 'ORGANIZATION': {
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(userId) || !uuidRegex.test(scopeId)) {
          return null;
        }
        const m = await this.prisma.organizationMember.findUnique({
          where: { userId_organizationId: { userId, organizationId: scopeId } },
          select: { role: true },
        });
        return m?.role ?? null;
      }
      case 'WORKSPACE': {
        const m = await this.prisma.workspaceMember.findUnique({
          where: { userId_workspaceId: { userId, workspaceId: scopeId } },
          select: { role: true },
        });
        return m?.role ?? null;
      }
      case 'PROJECT': {
        const m = await this.prisma.projectMember.findUnique({
          where: { userId_projectId: { userId, projectId: scopeId } },
          select: { role: true },
        });
        return m?.role ?? null;
      }
      default:
        return null;
    }
  }
}
function inferScopeFromParams(params: Record<string, string>): {
  type: ScopeType | undefined;
  idParam: string;
} {
  if (params.organizationId) return { type: 'ORGANIZATION' as const, idParam: 'organizationId' };
  if (params.workspaceId) return { type: 'WORKSPACE' as const, idParam: 'workspaceId' };
  if (params.projectId) return { type: 'PROJECT' as const, idParam: 'projectId' };
  if (params.id && params.slug) return { type: 'PROJECT' as const, idParam: 'slug' };
  if (params.id) return { type: 'PROJECT' as const, idParam: 'id' };
  return { type: undefined, idParam: '' };
}
