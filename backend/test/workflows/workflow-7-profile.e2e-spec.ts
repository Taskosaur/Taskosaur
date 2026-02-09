import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * Workflow 7: Profile & User Management
 * 
 * This test covers user profile operations:
 * 1. View current profile
 * 2. Update profile details
 * 3. Change password
 * 4. Verify updated profile
 * 
 * Note: Avatar upload is not tested as the endpoint may not be implemented.
 * The workflow focuses on profile viewing and updating.
 */
describe('Workflow 7: Profile & User Management (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prismaService: PrismaService;

  let user: any;
  let accessToken: string;
  let userId: string;
  let currentPassword: string;
  let newPassword: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);

    // Setup passwords
    currentPassword = 'CurrentPassword123!';
    newPassword = 'NewPassword456!';
  });

  afterAll(async () => {
    if (prismaService && user) {
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('Profile Management', () => {
    it('Step 0: Setup user via registration API', async () => {
      const email = `profile-test-${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: currentPassword,
          firstName: 'Profile',
          lastName: 'User',
          username: `profile_user_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);

      user = response.body.user;
      userId = user.id;
      accessToken = response.body.access_token;
    });

    it('Step 1: View current profile via auth endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('email', user.email);
      expect(response.body).toHaveProperty('firstName', 'Profile');
      expect(response.body).toHaveProperty('lastName', 'User');
    });

    it('Step 2: Get user by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('email', user.email);
    });

    it('Step 3: Update profile details', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Profile',
        })
        .expect(HttpStatus.OK);

      expect(response.body.firstName).toBe('Updated');
      expect(response.body.lastName).toBe('Profile');
    });

    it('Step 4: Verify updated profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.firstName).toBe('Updated');
      expect(response.body.lastName).toBe('Profile');
    });

    it('Step 5: Change password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: newPassword,
          confirmPassword: newPassword,
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('Step 6: Verify old password no longer works', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: currentPassword,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('Step 7: Verify new password works', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: newPassword,
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.firstName).toBe('Updated');
    });

    it('Step 8: List all users', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(response.body)).toBe(true);
      const foundUser = response.body.find((u: any) => u.id === userId);
      expect(foundUser).toBeDefined();
      expect(foundUser.firstName).toBe('Updated');
    });
  });
});
