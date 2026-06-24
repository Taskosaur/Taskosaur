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

describe('TrelloSyncController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let trelloApiService: TrelloApiService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;

  const validBoardId = '5e9f8f8f8f8f8f8f8f8f8f8f';

  const mockBoard = {
    id: validBoardId,
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
        email: `trello-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Trello',
        lastName: 'Tester',
        username: `trello_tester_${Date.now()}`,
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

    // Create Task Status
    await prismaService.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#ff0000',
        position: 1,
        workflowId: workflowId,
        category: 'TODO',
      },
    });

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Trello Project',
        slug: `trello-project-${Date.now()}`,
        workspaceId: workspace.id,
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.MEDIUM,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: user.id,
        workflowId: workflow.id,
        color: '#000000',
      },
    });
    projectId = project.id;

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

    // Add user as Project Member (OWNER)
    await prismaService.projectMember.create({
      data: {
        projectId: projectId,
        userId: user.id,
        role: Role.OWNER,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.trelloSync.deleteMany({ where: { projectId } });
    await prismaService.projectMember.deleteMany({ where: { projectId } });
    await prismaService.task.deleteMany({ where: { projectId } });
    await prismaService.project.delete({ where: { id: projectId } });
    await prismaService.taskStatus.deleteMany({ where: { workflowId } });
    await prismaService.workflow.delete({ where: { id: workflowId } });
    await prismaService.workspaceMember.deleteMany({ where: { workspaceId } });
    await prismaService.workspace.delete({ where: { id: workspaceId } });
    await prismaService.organizationMember.deleteMany({ where: { organizationId } });
    await prismaService.organization.delete({ where: { id: organizationId } });
    await prismaService.user.delete({ where: { id: user.id } });
    await app.close();
  });

  describe('Pre-connection validation', () => {
    it('should validate credentials and list boards', () => {
      return request(app.getHttpServer())
        .post('/api/trello-sync/validate/boards')
        .send({ apiKey: 'valid-key', token: 'valid-token' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockBoard.id);
        });
    });

    it('should validate credentials and list lists', () => {
      return request(app.getHttpServer())
        .post('/api/trello-sync/validate/lists')
        .send({ boardId: validBoardId, apiKey: 'valid-key', token: 'valid-token' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockList.id);
        });
    });

    it('should return 400 for invalid credentials', () => {
      jest.spyOn(trelloApiService, 'validateCredentials').mockResolvedValueOnce(false);
      return request(app.getHttpServer())
        .post('/api/trello-sync/validate/boards')
        .send({ apiKey: 'invalid-key', token: 'invalid-token' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Connection and Management', () => {
    it('should connect a project to Trello', async () => {
      const status = await prismaService.taskStatus.findFirst({
        where: { workflowId },
      });
      const statusId = status!.id;

      const connectDto = {
        projectId,
        trelloBoardId: validBoardId,
        trelloApiKey: 'my-api-key',
        trelloToken: 'my-token',
        syncInterval: 30,
        statusMappings: { 'list-123': statusId },
      };

      return request(app.getHttpServer())
        .post('/api/trello-sync/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(connectDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.projectId).toBe(projectId);
          expect(res.body.trelloBoardId).toBe(validBoardId);
          expect(res.body.hasApiKey).toBe(true);
          expect(res.body.hasToken).toBe(true);
        });
    });

    it('should return 409 when connecting an already connected project', () => {
      const connectDto = {
        projectId,
        trelloBoardId: validBoardId,
        trelloApiKey: 'my-api-key',
        trelloToken: 'my-token',
      };

      return request(app.getHttpServer())
        .post('/api/trello-sync/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(connectDto)
        .expect(HttpStatus.CONFLICT);
    });

    it('should get sync status for a project', () => {
      return request(app.getHttpServer())
        .get(`/api/trello-sync/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.projectId).toBe(projectId);
          expect(res.body.trelloBoardId).toBe(validBoardId);
        });
    });

    it('should update sync configuration', () => {
      const updateDto = {
        syncInterval: 60,
        syncEnabled: false,
      };

      return request(app.getHttpServer())
        .patch(`/api/trello-sync/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.syncInterval).toBe(60);
          expect(res.body.syncEnabled).toBe(false);
        });
    });

    it('should list boards using stored credentials', () => {
      return request(app.getHttpServer())
        .get(`/api/trello-sync/${projectId}/boards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockBoard.id);
        });
    });

    it('should list lists for the connected board', () => {
      return request(app.getHttpServer())
        .get(`/api/trello-sync/${projectId}/lists`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockList.id);
        });
    });
  });

  describe('Sync execution', () => {
    it('should trigger a manual sync', () => {
      return request(app.getHttpServer())
        .post(`/api/trello-sync/${projectId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.cardsProcessed).toBeGreaterThan(0);
        });
    });

    it('should verify that sync created tasks in the database', async () => {
      const tasks = await prismaService.task.findMany({
        where: { projectId },
      });
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].trelloCardId).toBe(mockCard.id);
    });
  });

  describe('Disconnection', () => {
    it('should disconnect Trello sync', () => {
      return request(app.getHttpServer())
        .delete(`/api/trello-sync/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toContain('successfully');
        });
    });

    it('should return 404 when getting status of disconnected project', () => {
      return request(app.getHttpServer())
        .get(`/api/trello-sync/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
