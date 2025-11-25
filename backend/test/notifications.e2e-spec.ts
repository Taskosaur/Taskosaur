import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, NotificationType, NotificationPriority } from '@prisma/client';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let notificationId: string;

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
        email: `notif-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Notification',
        lastName: 'Tester',
        username: `notif_user_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);
  });

  afterAll(async () => {
    if (prismaService) {
      await prismaService.notification.deleteMany({
        where: { userId: user.id },
      });
      await prismaService.user.delete({
        where: { id: user.id },
      });
    }
    await app.close();
  });

  describe('Setup', () => {
    it('should seed a notification', async () => {
      const notification = await prismaService.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.TASK_ASSIGNED,
          title: 'Test Notification',
          message: 'You have been assigned a task',
          priority: NotificationPriority.MEDIUM,
          isRead: false,
        },
      });
      notificationId = notification.id;
      expect(notificationId).toBeDefined();
    });
  });

  describe('/notifications (GET)', () => {
    it('should retrieve user notifications', () => {
      return request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('notifications');
          expect(Array.isArray(res.body.notifications)).toBe(true);
          expect(res.body.notifications.length).toBeGreaterThan(0);
          expect(res.body.notifications[0].id).toBe(notificationId);
        });
    });
  });

  describe('/notifications/:id/read (PATCH)', () => {
    it('should mark notification as read', () => {
      return request(app.getHttpServer())
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toBe('Notification marked as read');
        });
    });

    it('should verify notification is read', async () => {
      const notification = await prismaService.notification.findUnique({
        where: { id: notificationId },
      });
      expect(notification).toBeDefined();
      expect(notification?.isRead).toBe(true);
    });
  });

  describe('/notifications/mark-all-read (PATCH)', () => {
    beforeAll(async () => {
      // Create another unread notification
      await prismaService.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.MENTION,
          title: 'Another Notification',
          message: 'You were mentioned',
          priority: NotificationPriority.HIGH,
          isRead: false,
        },
      });
    });

    it('should mark all notifications as read', () => {
      return request(app.getHttpServer())
        .patch('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toBe('All notifications marked as read');
        });
    });

    it('should verify all notifications are read', async () => {
      const count = await prismaService.notification.count({
        where: {
          userId: user.id,
          isRead: false,
        },
      });
      expect(count).toBe(0);
    });
  });
});
