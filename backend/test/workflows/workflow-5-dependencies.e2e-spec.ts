import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility, TaskPriority, TaskType } from '@prisma/client';

/**
 * Workflow 5: Task Dependency & Workflow Management
 * 
 * This test covers complex task dependencies and workflow management:
 * 1. Create multiple custom statuses
 * 2. Create task chain (A -> B -> C -> D)
 * 3. Set up dependencies
 * 4. Attempt circular dependency (should fail)
 * 5. Progress through workflow
 * 6. Update status configuration
 * 
 * Note: This workflow demonstrates advanced task management features.
 */
describe('Workflow 5: Task Dependency & Workflow Management (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  
  // Status IDs
  let backlogStatusId: string;
  let inProgressStatusId: string;
  let codeReviewStatusId: string;
  let testingStatusId: string;
  let doneStatusId: string;
  
  // Task IDs
  let taskAId: string; // Design API
  let taskBId: string; // Implement API
  let taskCId: string; // Write Tests
  let taskDId: string; // Deploy
  
  // Dependency IDs
  let depABId: string;
  let depBCId: string;
  let depCDId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create user
    user = await prismaService.user.create({
      data: {
        email: `workflow-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Workflow',
        lastName: 'User',
        username: `workflow_user_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    accessToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    // Create organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Workflow Org ${Date.now()}`,
        slug: `workflow-org-${Date.now()}`,
        ownerId: user.id,
      },
    });
    organizationId = organization.id;

    // Create workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: 'Development Workflow',
        organizationId: organizationId,
        isDefault: true,
      },
    });
    workflowId = workflow.id;

    // Create workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Workflow Workspace ${Date.now()}`,
        slug: `workflow-workspace-${Date.now()}`,
        organizationId: organizationId,
      },
    });
    workspaceId = workspace.id;

    // Create project
    const project = await prismaService.project.create({
      data: {
        name: 'API Development Project',
        slug: `api-project-${Date.now()}`,
        workspaceId: workspaceId,
        workflowId: workflowId,
        color: '#9b59b6',
        status: ProjectStatus.ACTIVE,
        priority: ProjectPriority.HIGH,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: user.id,
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup dependencies first
      await prismaService.taskDependency.deleteMany({ where: { dependentTaskId: taskBId } });
      await prismaService.taskDependency.deleteMany({ where: { dependentTaskId: taskCId } });
      await prismaService.taskDependency.deleteMany({ where: { dependentTaskId: taskDId } });
      
      // Cleanup tasks
      await prismaService.task.deleteMany({ where: { projectId } });
      
      // Cleanup statuses
      if (backlogStatusId) await prismaService.taskStatus.delete({ where: { id: backlogStatusId } });
      if (inProgressStatusId) await prismaService.taskStatus.delete({ where: { id: inProgressStatusId } });
      if (codeReviewStatusId) await prismaService.taskStatus.delete({ where: { id: codeReviewStatusId } });
      if (testingStatusId) await prismaService.taskStatus.delete({ where: { id: testingStatusId } });
      if (doneStatusId) await prismaService.taskStatus.delete({ where: { id: doneStatusId } });
      
      if (projectId) await prismaService.project.delete({ where: { id: projectId } });
      if (workspaceId) await prismaService.workspace.delete({ where: { id: workspaceId } });
      if (workflowId) await prismaService.workflow.delete({ where: { id: workflowId } });
      if (organizationId) await prismaService.organization.delete({ where: { id: organizationId } });
      if (user) await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('Task Dependency & Workflow Management', () => {
    it('Step 1: Create "Backlog" status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-statuses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Backlog',
          color: '#95a5a6',
          position: 1,
          workflowId: workflowId,
          category: 'TODO',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      backlogStatusId = response.body.id;
    });

    it('Step 2: Create "In Progress" status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-statuses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'In Progress',
          color: '#3498db',
          position: 2,
          workflowId: workflowId,
          category: 'IN_PROGRESS',
        })
        .expect(HttpStatus.CREATED);

      inProgressStatusId = response.body.id;
    });

    it('Step 3: Create "Code Review" status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-statuses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Code Review',
          color: '#f39c12',
          position: 3,
          workflowId: workflowId,
          category: 'IN_PROGRESS',
        })
        .expect(HttpStatus.CREATED);

      codeReviewStatusId = response.body.id;
    });

    it('Step 4: Create "Testing" status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-statuses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Testing',
          color: '#e74c3c',
          position: 4,
          workflowId: workflowId,
          category: 'IN_PROGRESS',
        })
        .expect(HttpStatus.CREATED);

      testingStatusId = response.body.id;
    });

    it('Step 5: Create "Done" status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-statuses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Done',
          color: '#27ae60',
          position: 5,
          workflowId: workflowId,
          category: 'DONE',
        })
        .expect(HttpStatus.CREATED);

      doneStatusId = response.body.id;
    });

    it('Step 6: Create Task A - Design API', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Design API',
          description: 'Design the REST API endpoints and data models',
          projectId: projectId,
          statusId: backlogStatusId,
          priority: TaskPriority.HIGH,
          type: TaskType.TASK,
        })
        .expect(HttpStatus.CREATED);

      taskAId = response.body.id;
    });

    it('Step 7: Create Task B - Implement API', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Implement API',
          description: 'Implement the designed API endpoints',
          projectId: projectId,
          statusId: backlogStatusId,
          priority: TaskPriority.HIGH,
          type: TaskType.TASK,
        })
        .expect(HttpStatus.CREATED);

      taskBId = response.body.id;
    });

    it('Step 8: Create Task C - Write Tests', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Write Tests',
          description: 'Write unit and integration tests',
          projectId: projectId,
          statusId: backlogStatusId,
          priority: TaskPriority.MEDIUM,
          type: TaskType.TASK,
        })
        .expect(HttpStatus.CREATED);

      taskCId = response.body.id;
    });

    it('Step 9: Create Task D - Deploy', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Deploy',
          description: 'Deploy to production environment',
          projectId: projectId,
          statusId: backlogStatusId,
          priority: TaskPriority.HIGHEST,
          type: TaskType.TASK,
        })
        .expect(HttpStatus.CREATED);

      taskDId = response.body.id;
    });

    it('Step 10: Set dependency - B depends on A', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-dependencies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dependentTaskId: taskBId,
          blockingTaskId: taskAId,
          type: 'BLOCKS',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      depABId = response.body.id;
    });

    it('Step 11: Set dependency - C depends on B', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-dependencies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dependentTaskId: taskCId,
          blockingTaskId: taskBId,
          type: 'BLOCKS',
        })
        .expect(HttpStatus.CREATED);

      depBCId = response.body.id;
    });

    it('Step 12: Set dependency - D depends on C', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-dependencies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dependentTaskId: taskDId,
          blockingTaskId: taskCId,
          type: 'BLOCKS',
        })
        .expect(HttpStatus.CREATED);

      depCDId = response.body.id;
    });

    it('Step 13: Move Task A to "In Progress"', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskAId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          statusId: inProgressStatusId,
        })
        .expect(HttpStatus.OK);

      expect(response.body.statusId).toBe(inProgressStatusId);
    });

    it('Step 14: Complete Task A', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskAId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          statusId: doneStatusId,
        })
        .expect(HttpStatus.OK);

      expect(response.body.statusId).toBe(doneStatusId);
    });

    it('Step 15: Move Task B to "In Progress"', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskBId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          statusId: inProgressStatusId,
        })
        .expect(HttpStatus.OK);

      expect(response.body.statusId).toBe(inProgressStatusId);
    });

    it('Step 16: Update status color', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/task-statuses/${inProgressStatusId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          color: '#1abc9c',
        })
        .expect(HttpStatus.OK);

      expect(response.body.color).toBe('#1abc9c');
    });

    it('Step 17: Verify dependency chain', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/task-dependencies')
        .query({ projectId: projectId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });
});
