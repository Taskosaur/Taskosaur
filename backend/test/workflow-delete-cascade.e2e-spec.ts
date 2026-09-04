import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

/**
 * DELETE /workflows/:id could destroy tasks without saying so.
 *
 * The database cascades workflows -> task_statuses -> tasks. A project pointing
 * at the workflow is refused by the database itself, because
 * projects.workflow_id is RESTRICT, and that showed up as a raw 500 rather than
 * data loss.
 *
 * The case that actually destroyed data is the one where nothing appears to
 * reference the workflow any more. Changing a project's workflow is allowed
 * (UpdateProjectDto extends PartialType(CreateProjectDto), so workflowId is
 * settable) and it leaves the project's existing tasks on the old workflow's
 * statuses. Deleting that now-unreferenced workflow then cascaded straight
 * through to those tasks and returned success. Confirmed directly against the
 * database before this guard existed: the task count went from 1 to 0.
 *
 * The route is reachable by any organization member; there is no role check on
 * it, so this was not limited to administrators.
 */
describe('Workflow delete must not destroy tasks (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const stamp = `${Date.now()}`;
  let ownerId: string;
  let memberId: string;
  let ownerToken: string;
  let memberToken: string;
  let organizationId: string;
  let workflowId: string;
  let statusId: string;
  let projectId: string;
  let taskIds: string[] = [];
  const createdUserIds: string[] = [];

  const token = (user: { id: string; email: string; role: Role }) =>
    jwt.sign({ sub: user.id, email: user.email, role: user.role });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  // Rebuilt per test: the whole point is that one of these calls may delete it.
  beforeEach(async () => {
    const owner = await prisma.user.create({
      data: {
        email: `wfdel-owner-${stamp}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        password: 'x',
        firstName: 'WF',
        lastName: 'Owner',
        role: Role.MEMBER,
      },
    });
    const member = await prisma.user.create({
      data: {
        email: `wfdel-member-${stamp}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        password: 'x',
        firstName: 'WF',
        lastName: 'Member',
        role: Role.MEMBER,
      },
    });
    ownerId = owner.id;
    memberId = member.id;
    createdUserIds.push(owner.id, member.id);
    ownerToken = token(owner);
    memberToken = token(member);

    const org = await prisma.organization.create({
      data: {
        name: `WFDel Org ${stamp}`,
        slug: `wfdel-org-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
        ownerId: owner.id,
      },
    });
    organizationId = org.id;
    await prisma.organizationMember.create({
      data: { userId: owner.id, organizationId, role: Role.OWNER },
    });
    await prisma.organizationMember.create({
      data: { userId: member.id, organizationId, role: Role.MEMBER },
    });

    const workflow = await prisma.workflow.create({
      data: { name: `WFDel Flow ${stamp}`, organizationId, isDefault: false },
    });
    workflowId = workflow.id;

    const status = await prisma.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#ff0000',
        position: 1,
        workflowId,
        category: 'TODO',
      },
    });
    statusId = status.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `WFDel Ws ${stamp}`,
        slug: `wfdel-ws-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
        organizationId,
      },
    });
    const project = await prisma.project.create({
      data: {
        name: 'WFDel Project',
        slug: `wfdel-proj-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
        workspaceId: workspace.id,
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.MEDIUM,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: owner.id,
        workflowId,
        color: '#000000',
      },
    });
    projectId = project.id;

    taskIds = [];
    for (let i = 1; i <= 3; i++) {
      const task = await prisma.task.create({
        data: {
          title: `Task that must survive ${i}`,
          projectId,
          statusId,
          createdBy: owner.id,
          taskNumber: i,
          slug: `WFD-${i}-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
        },
      });
      taskIds.push(task.id);
    }
  });

  afterAll(async () => {
    // Organizations reference their owner, so they go first; removing them
    // takes the workspaces, projects, workflows and tasks under them with it.
    await prisma.organization.deleteMany({
      where: { ownerId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  const surviving = () =>
    prisma.task.count({ where: { id: { in: taskIds } } });

  it('refuses to delete a workflow that still has tasks in it', async () => {
    expect(await surviving()).toBe(3);

    await request(app.getHttpServer())
      .delete(`/api/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(HttpStatus.CONFLICT);

    expect(await surviving()).toBe(3);
    expect(await prisma.taskStatus.count({ where: { id: statusId } })).toBe(1);
    expect(await prisma.workflow.count({ where: { id: workflowId } })).toBe(1);
  });

  it('names what is in the way instead of failing blankly', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(HttpStatus.CONFLICT);
    const body = JSON.stringify(res.body);
    expect(body).toMatch(/3 tasks/);
    expect(body).toMatch(/1 project/);
  });

  it('keeps the tasks of a project that has moved to another workflow', async () => {
    // The path that actually destroyed data. Repointing the project leaves its
    // tasks behind on this workflow's statuses, so nothing obvious references
    // the workflow any more and the cascade had a clear run at the tasks.
    const other = await prisma.workflow.create({
      data: { name: `WFDel Other ${stamp}`, organizationId, isDefault: false },
    });
    await prisma.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#00ff00',
        position: 1,
        workflowId: other.id,
        category: 'TODO',
      },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { workflowId: other.id },
    });

    // Nothing points at the old workflow now, but its statuses still hold tasks.
    expect(await prisma.project.count({ where: { workflowId } })).toBe(0);
    expect(await surviving()).toBe(3);

    const res = await request(app.getHttpServer())
      .delete(`/api/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(HttpStatus.CONFLICT);
    expect(await surviving()).toBe(3);
  });

  it('refuses for an ordinary member too, and destroys nothing', async () => {
    // No role check on this route, so a plain member reaches the same code.
    await request(app.getHttpServer())
      .delete(`/api/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(HttpStatus.CONFLICT);

    expect(await surviving()).toBe(3);
  });

  it('refuses while a project still points at the workflow, even with no tasks', async () => {
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    taskIds = [];

    const res = await request(app.getHttpServer())
      .delete(`/api/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Previously a raw 500 from the foreign key. It is a refusal either way,
    // but the caller should be told which, and why.
    expect(res.status).toBe(HttpStatus.CONFLICT);
    expect(JSON.stringify(res.body)).toMatch(/project/i);
    expect(await prisma.workflow.count({ where: { id: workflowId } })).toBe(1);
  });

  it('allows the delete once nothing depends on the workflow', async () => {
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    taskIds = [];
    await prisma.project.delete({ where: { id: projectId } });

    await request(app.getHttpServer())
      .delete(`/api/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect((res) => {
        if (res.status !== HttpStatus.OK && res.status !== HttpStatus.NO_CONTENT) {
          throw new Error(`Expected the delete to be allowed, got ${res.status}`);
        }
      });

    expect(await prisma.workflow.count({ where: { id: workflowId } })).toBe(0);
  });
});
