import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { CreateUserDto } from './../src/modules/users/dto/create-user.dto';
import { UpdateUserDto } from './../src/modules/users/dto/update-user.dto';
import { ChangePasswordDto } from './../src/modules/auth/dto/change-password.dto';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let adminUser: any;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create an admin user for testing
    const plainPassword = 'AdminPassword123!';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    adminUser = await prismaService.user.create({
      data: {
        email: `admin-test-${Date.now()}@example.com`,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Tester',
        username: `admin_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: adminUser.id, email: adminUser.email, role: adminUser.role };
    accessToken = jwtService.sign(payload);
  }, 10000);

  afterAll(async () => {
    if (prismaService) {
      // Find all test users
      const testUsers = await prismaService.user.findMany({
        where: {
          email: { contains: '-test-' },
        },
        select: { id: true },
      });

      const userIds = testUsers.map((u) => u.id);

      if (userIds.length > 0) {
        // Delete organizations owned by these users first to avoid foreign key violations
        await prismaService.organization.deleteMany({
          where: {
            ownerId: { in: userIds },
          },
        });

        // Cleanup all test users created in this spec
        await prismaService.user.deleteMany({
          where: {
            id: { in: userIds },
          },
        });
      }
    }
    await app.close();
  });

  let createdUserId: string;

  describe('/users (POST)', () => {
    it('should create a new user', () => {
      const createUserDto: CreateUserDto = {
        email: `new-user-test-${Date.now()}@example.com`,
        password: 'NewUserPassword123!',
        firstName: 'New',
        lastName: 'User',
        username: `new_user_tester_${Date.now()}`,
        role: Role.MEMBER,
      };

      return request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createUserDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toBe(createUserDto.email);
          createdUserId = res.body.id;
        });
    });
  });

  describe('/users (GET)', () => {
    it('should retrieve all users', () => {
      return request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });

    it('should retrieve a user by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(createdUserId);
        });
    });
  });

  describe('/users/:id (PATCH)', () => {
    it('should update a user', () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'UpdatedName',
        lastName: 'UpdatedLastName',
      };

      return request(app.getHttpServer())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateUserDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.firstName).toBe(updateUserDto.firstName);
        });
    });
  });

  describe('/users/change-password (POST)', () => {
    it('should change current user password', () => {
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'AdminPassword123!',
        newPassword: 'NewAdminPassword123!',
        confirmPassword: 'NewAdminPassword123!',
      };

      return request(app.getHttpServer())
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changePasswordDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('/users/exists (GET)', () => {
    it('should check if users exist', () => {
      return request(app.getHttpServer())
        .get('/api/users/exists')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.exists).toBe(true);
        });
    });
  });

  describe('/users/:id (DELETE)', () => {
    it('should delete a user', () => {
      return request(app.getHttpServer())
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should return 404 when getting deleted user', () => {
      return request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
