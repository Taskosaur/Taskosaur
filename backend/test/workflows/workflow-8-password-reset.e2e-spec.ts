import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import { EmailService } from './../../src/modules/email/email.service';

/**
 * Workflow 8: Password Reset Flow
 * 
 * This test covers the password reset process:
 * 1. Request password reset
 * 2. Attempt login with old password (should fail)
 * 3. Reset password with token
 * 4. Login with new password (should succeed)
 * 5. Verify old token is invalid
 * 
 * Note: Email sending is mocked in test environment to capture the reset token
 */
describe('Workflow 8: Password Reset Flow (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prismaService: PrismaService;

  let user: any;
  let userEmail: string;
  let oldPassword: string;
  let newPassword: string;
  let resetToken: string;

  // Mock to capture the reset token sent via email
  let capturedResetToken: string | null = null;

  beforeAll(async () => {
    const mockEmailService = {
      sendPasswordResetEmail: jest.fn(
        async (email: string, data: { userName: string; resetToken: string; resetUrl: string }) => {
          capturedResetToken = data.resetToken;
          return Promise.resolve();
        },
      ),
      sendPasswordResetConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (prismaService && user) {
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('Password Reset Flow', () => {
    it('Step 0: Setup user via registration API', async () => {
      userEmail = `reset-test-${Date.now()}@example.com`;
      oldPassword = 'OldPassword123!';
      newPassword = 'NewPassword456!';

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: userEmail,
          password: oldPassword,
          firstName: 'Reset',
          lastName: 'Test',
          username: `reset_test_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);

      user = response.body.user;
    });

    it('Step 1: Request password reset', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({
          email: userEmail,
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('reset');

      // The reset token was captured by our mocked email service
      expect(capturedResetToken).toBeTruthy();
      resetToken = capturedResetToken as string;

      // Verify the user has a reset token stored (hashed version)
      const updatedUser = await prismaService.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.resetToken).toBeDefined();
      expect(updatedUser?.resetTokenExpiry).toBeDefined();
    });

    it('Step 2: Verify reset token is valid', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auth/verify-reset-token/${resetToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('valid', true);
      // VerifyResetTokenResponseDto does not return email
      // expect(response.body).toHaveProperty('email', userEmail);
    });

    it('Step 3: Attempt login with old password (should succeed before reset)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: userEmail,
          password: oldPassword,
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('access_token');
    });

    it('Step 4: Reset password with token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword,
          confirmPassword: newPassword,
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('Step 5: Attempt login with old password (should fail)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: userEmail,
          password: oldPassword,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('Step 6: Login with new password (should succeed)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: userEmail,
          password: newPassword,
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userEmail);
    });

    it('Step 7: Verify old reset token is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'AnotherPassword789!',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('message');
    });

    it('Step 8: Verify cannot reuse same token', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auth/verify-reset-token/${resetToken}`)
        .expect(HttpStatus.OK);
      
      expect(response.body).toHaveProperty('valid', false);
    });
  });
});
