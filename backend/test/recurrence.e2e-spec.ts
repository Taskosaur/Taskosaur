import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { RecurrenceType, RecurrenceEndType } from './../src/modules/tasks/dto/recurrence-config.dto';

describe('RecurrenceService (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let statusId: string;
  let workflowId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create a test user
    user = await prismaService.user.create({
      data: {
        email: `recurrence-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Recurrence',
        lastName: 'Tester',
        username: `recurrence_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Recurrence Org ${Date.now()}`,
        slug: `recurrence-org-${Date.now()}`,
        ownerId: user.id,
      },
    });
    organizationId = organization.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Recurrence Workspace ${Date.now()}`,
        slug: `recurrence-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Add user as Organization Member (OWNER)
    await prismaService.organizationMember.create({
      data: {
        organizationId: organizationId,
        userId: user.id,
        role: Role.OWNER,
      },
    });

    // Create Workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: `Recurrence Workflow ${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workflowId = workflow.id;

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Recurrence Project',
        slug: `recurrence-project-${Date.now()}`,
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

    // Add user as Project Member (OWNER)
    await prismaService.projectMember.create({
      data: {
        projectId: projectId,
        userId: user.id,
        role: Role.OWNER,
      },
    });

    // Create Status
    const status = await prismaService.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#ff0000',
        position: 1,
        workflowId: workflow.id,
        category: 'TODO',
      },
    });
    statusId = status.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.task.deleteMany({ where: { projectId } });
      await prismaService.taskStatus.deleteMany({ where: { workflowId } });
      await prismaService.project.deleteMany({ where: { id: projectId } });
      await prismaService.workflow.deleteMany({ where: { id: workflowId } });
      await prismaService.workspace.deleteMany({ where: { id: workspaceId } });
      await prismaService.organization.deleteMany({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('Recurrence Operations', () => {
    let taskId: string;

    beforeEach(async () => {
      
      const task = await prismaService.task.create({
        data: {
          title: `Recurrence Task ${Date.now()}`,
          projectId: projectId,
          statusId: statusId,
          taskNumber: Math.floor(Math.random() * 10000),
          slug: `REC-${Date.now()}`,
          createdBy: user.id,
          dueDate: new Date().toISOString(),
          
          assignees: {
            connect: [{ id: user.id }]
          }
        },
      });
      taskId = task.id;
    });

    it('should add DAILY recurrence to a task', () => {
      const recurrenceConfig = {
        recurrenceType: RecurrenceType.DAILY,
        interval: 1,
        endType: RecurrenceEndType.NEVER,
      };

      return request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(recurrenceConfig)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.recurrenceType).toBe(RecurrenceType.DAILY);
          
          expect(res.body.interval).toBe(1);
          
          
        });
    });

    it('should add WEEKLY recurrence to a task with days of week', () => {
      const recurrenceConfig = {
        recurrenceType: RecurrenceType.WEEKLY,
        interval: 2,
        daysOfWeek: [1, 3, 5], 
        endType: RecurrenceEndType.AFTER_OCCURRENCES,
        occurrenceCount: 10,
      };

      return request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(recurrenceConfig)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.recurrenceType).toBe(RecurrenceType.WEEKLY);
          expect(res.body.interval).toBe(2);
          expect(res.body.daysOfWeek).toEqual([1, 3, 5]);
        });
    });

    it('should add MONTHLY recurrence to a task', () => {
      const recurrenceConfig = {
        recurrenceType: RecurrenceType.MONTHLY,
        interval: 1,
        dayOfMonth: 15,
        endType: RecurrenceEndType.ON_DATE,
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(), 
      };

      return request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(recurrenceConfig)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.recurrenceType).toBe(RecurrenceType.MONTHLY);
          expect(res.body.dayOfMonth).toBe(15);
        });
    });

    it('should update existing recurrence', async () => {
      
      await request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recurrenceType: RecurrenceType.DAILY,
          interval: 1,
          endType: RecurrenceEndType.NEVER,
        });

      
      const updateConfig = {
        recurrenceType: RecurrenceType.WEEKLY,
        interval: 1,
        daysOfWeek: [0, 6], 
        endType: RecurrenceEndType.NEVER,
      };

      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateConfig)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.recurrenceType).toBe(RecurrenceType.WEEKLY);
          expect(res.body.daysOfWeek).toEqual([0, 6]);
        });
    });

    it('should complete occurrence and generate next task', async () => {
        
        await request(app.getHttpServer())
          .post(`/api/tasks/${taskId}/recurrence`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            recurrenceType: RecurrenceType.DAILY,
            interval: 1,
            endType: RecurrenceEndType.NEVER,
          });
  
        
        
        
        
        const completeRes = await request(app.getHttpServer())
          .post(`/api/tasks/${taskId}/complete-occurrence`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect((res) => {
             
             if (res.status !== 200 && res.status !== 201) {
                 throw new Error(`Expected 200 or 201, got ${res.status} ${JSON.stringify(res.body)}`);
             }
          });
          
        
        expect(completeRes.body).toHaveProperty('completedTask');
        expect(completeRes.body).toHaveProperty('nextTask');
        
        const nextTask = completeRes.body.nextTask;
        expect(nextTask.id).not.toBe(taskId);
        expect(nextTask.projectId).toBe(projectId);
        
        
        
        
        
        const originalDueDate = new Date();
        const nextDueDate = new Date(nextTask.dueDate);
        expect(nextDueDate.getTime()).toBeGreaterThan(originalDueDate.getTime());
      });

    it('should stop recurrence', async () => {
      
      await request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recurrenceType: RecurrenceType.DAILY,
          interval: 1,
          endType: RecurrenceEndType.NEVER,
        });

      
      await request(app.getHttpServer())
        .delete(`/api/tasks/${taskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          
          expect(res.body.isRecurring).toBe(false);
        });
    });

    it('should get recurring tasks for project', async () => {
       
       await request(app.getHttpServer())
       .post(`/api/tasks/${taskId}/recurrence`)
       .set('Authorization', `Bearer ${accessToken}`)
       .send({
         recurrenceType: RecurrenceType.DAILY,
         interval: 1,
         endType: RecurrenceEndType.NEVER,
       });

       return request(app.getHttpServer())
        .get(`/api/tasks/recurring/project/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            const task = res.body.find((t: any) => t.id === taskId);
            expect(task).toBeDefined();
            expect(task.isRecurring).toBe(true);
        });
    });
  });
});