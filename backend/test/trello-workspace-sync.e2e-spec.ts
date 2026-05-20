import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  Role,
  ProjectStatus,
  ProjectPriority,
  ProjectVisibility,
  SyncStatus,
} from '@prisma/client';
import { TrelloApiService } from '../src/modules/trello-sync/trello-api.service';

describe('TrelloWorkspaceController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let trelloApiService: TrelloApiService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let workflowId: string;

  const mockBoard = {
    id: 'board-123',
    name: 'Test Board',
    desc: 'Description',
    url: 'http://trello.com/b/board-123',
    closed: false,
  };

  const mockList = {
    id: 'list-123',
    name: 'To Do',
    closed: false,
    pos: 1,
  };

  const mockCard = {
    id: 'card-123',
    name: 'Card 1',
    desc: 'Card Description',
    due: null,
    closed: false,
    idList: 'list-123',
    labels: [],
    url: 'http://trello.com/c/card-123',
    dateLastActivity: new Date().toISOString(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TrelloApiService)
      .useValue({
        validateCredentials: jest.fn().mockResolvedValue(true),
        getBoards: jest.fn().mockResolvedValue([mockBoard]),
        getLists: jest.fn().mockResolvedValue([mockList]),
        getCards: jest.fn().mockResolvedValue([mockCard]),
        getCardsBatch: jest.fn().mockImplementation(async function* () {
          yield [mockCard];
        }),
        getCard: jest.fn().mockResolvedValue(mockCard),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    trelloApiService = app.get<TrelloApiService>(TrelloApiService);

    // Create a test user
    user = await prismaService.user.create({
      data: {
        email: `trello-ws-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Trello',
        lastName: 'WS Tester',
        username: `trello_ws_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Trello Org ${Date.now()}`,
        slug: `trello-org-${Date.now()}`,
        ownerId: user.id,
      },
    });
    organizationId = organization.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Trello Workspace ${Date.now()}`,
        slug: `trello-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Create Workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: `Trello Workflow ${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workflowId = workflow.id;

    // Add user as Organization Member (OWNER)
    await prismaService.organizationMember.create({
      data: {
        organizationId: organizationId,
        userId: user.id,
        role: Role.OWNER,
      },
    });

    // Add user to workspace
    await prismaService.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspaceId,
        role: Role.OWNER,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.trelloSync.deleteMany({ where: { workspaceId } });
    await prismaService.workspaceMember.deleteMany({ where: { workspaceId } });
    await prismaService.projectMember.deleteMany({
      where: { project: { workspaceId } },
    });
    await prismaService.task.deleteMany({
      where: { project: { workspaceId } },
    });
    await prismaService.project.deleteMany({ where: { workspaceId } });
    await prismaService.workspace.delete({ where: { id: workspaceId } });
    await prismaService.organizationMember.deleteMany({ where: { organizationId } });
    await prismaService.organization.delete({ where: { id: organizationId } });
    await prismaService.user.delete({ where: { id: user.id } });
    await app.close();
  });

  describe('Connection and Management', () => {
    it('should connect a workspace to Trello', async () => {
      const connectDto = {
        trelloWorkspaceId: 'trello-ws-123',
        trelloApiKey: 'my-api-key',
        trelloToken: 'my-token',
      };

      return request(app.getHttpServer())
        .post(`/api/workspaces/${workspaceId}/trello-sync/connect`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(connectDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.workspaceId).toBe(workspaceId);
          expect(res.body.trelloWorkspaceId).toBe('trello-ws-123');
          expect(res.body.hasApiKey).toBe(true);
          expect(res.body.hasToken).toBe(true);
        });
    });

    it('should get sync status for a workspace', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/trello-sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.workspaceId).toBe(workspaceId);
          expect(res.body.trelloWorkspaceId).toBe('trello-ws-123');
        });
    });

    it('should update workspace sync configuration', () => {
      const updateDto = {
        trelloApiKey: 'updated-key',
        trelloToken: 'updated-token',
      };

      return request(app.getHttpServer())
        .patch(`/api/workspaces/${workspaceId}/trello-sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.hasApiKey).toBe(true);
          expect(res.body.hasToken).toBe(true);
        });
    });
  });

  describe('Board Operations', () => {
    it('should list available Trello boards for the workspace', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/trello-sync/boards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockBoard.id);
        });
    });

    it('should import selected boards as projects', async () => {
      const importDto = {
        boardIds: [mockBoard.id],
      };

      return request(app.getHttpServer())
        .post(`/api/workspaces/${workspaceId}/trello-sync/import`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(importDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.importedProjectsCount).toBe(1);
          expect(res.body.projectIds.length).toBe(1);
        });
    });

    it('should list synced projects in the workspace', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/trello-sync/projects`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].name).toBe(mockBoard.name);
        });
    });

    it('should trigger sync for all projects in the workspace', () => {
      return request(app.getHttpServer())
        .post(`/api/workspaces/${workspaceId}/trello-sync/sync-all`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.total).toBeGreaterThan(0);
          expect(res.body.successCount).toBeGreaterThan(0);
        });
    });
  });

  describe('Disconnection', () => {
    it('should disconnect workspace Trello sync', () => {
      return request(app.getHttpServer())
        .delete(`/api/workspaces/${workspaceId}/trello-sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toContain('successfully');
        });
    });

    it('should return 404 when getting status after disconnection', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/trello-sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
