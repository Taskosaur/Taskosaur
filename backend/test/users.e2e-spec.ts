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
  let memberUser: any;
  let memberToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create a SUPER_ADMIN user for testing (needed for /users routes)
    const plainPassword = 'AdminPassword123!';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    adminUser = await prismaService.user.create({
      data: {
        email: `admin-test-${Date.now()}@example.com`,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Tester',
        username: `admin_tester_${Date.now()}`,
        role: Role.SUPER_ADMIN,
      },
    });

    // Create a regular MEMBER user for negative tests
    memberUser = await prismaService.user.create({
      data: {
        email: `member-test-${Date.now()}@example.com`,
        password: hashedPassword,
        firstName: 'Member',
        lastName: 'Tester',
        username: `member_tester_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate tokens
    accessToken = jwtService.sign({ sub: adminUser.id, email: adminUser.email, role: adminUser.role });
    memberToken = jwtService.sign({ sub: memberUser.id, email: memberUser.email, role: memberUser.role });
  }, 10000);

  afterAll(async () => {
    if (prismaService) {
      // Cleanup all test users created in this spec
      await prismaService.user.deleteMany({
        where: {
          email: { contains: '-test-' },
        },
      });
    }
    await app.close();
  });

  let createdUserId: string;

  describe('/users (POST)', () => {
    it('should create a new user (Admin)', () => {
      const createUserDto: CreateUserDto = {
        email: `new-user-test-${Date.now()}@example.com`,
        password: 'NewUserPassword123!',
        firstName: 'New',
        lastName: 'User',
        username: `new_user_tester_${Date.now()}`,
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

    it('should fail to create a user if not SUPER_ADMIN', async () => {
      const createUserDto: CreateUserDto = {
        email: `fail-user-test-${Date.now()}@example.com`,
        password: 'Password123!',
        firstName: 'Fail',
        lastName: 'User',
        username: `fail_user_tester_${Date.now()}`,
      };

      return request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(createUserDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/users (GET)', () => {
    it('should retrieve all users (Admin)', () => {
      return request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });

    it('should fail to retrieve all users if not SUPER_ADMIN', () => {
      return request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should retrieve a user by ID (Admin)', () => {
      return request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(createdUserId);
        });
    });

    it('should fail to retrieve another user by ID if not SUPER_ADMIN', () => {
      return request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/users/:id (PATCH)', () => {
    it('should update a user (Admin)', () => {
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

    it('should allow a user to update their own profile but NOT their role', async () => {
      // Successful profile update
      await request(app.getHttpServer())
        .patch(`/api/users/${memberUser.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ firstName: 'SelfUpdated' })
        .expect(HttpStatus.OK);

      // Forbidden role update
      await request(app.getHttpServer())
        .patch(`/api/users/${memberUser.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ role: Role.SUPER_ADMIN })
        .expect(HttpStatus.FORBIDDEN);
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
    it('should delete a user (Admin)', () => {
      return request(app.getHttpServer())
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should fail to delete a user if not SUPER_ADMIN', () => {
      return request(app.getHttpServer())
        .delete(`/api/users/${memberUser.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 404 when getting deleted user', () => {
      return request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
