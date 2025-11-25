import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

describe('S3Controller (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;

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
        email: `s3-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'S3',
        lastName: 'Tester',
        username: `s3_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/s3/presigned-put-url (GET)', () => {
    it('should get a presigned PUT URL', () => {
      const testKey = `test-uploads/${Date.now()}/test-file.pdf`;
      
      return request(app.getHttpServer())
        .get('/api/s3/presigned-put-url')
        .query({ key: testKey })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('url');
          expect(typeof res.body.url).toBe('string');
          // URL should contain the key or be a valid URL
          expect(res.body.url.length).toBeGreaterThan(0);
        });
    });
  });

  describe('/s3/presigned-get-url (GET)', () => {
    it('should get a presigned GET URL', () => {
      const testKey = `test-downloads/${Date.now()}/test-file.pdf`;
      
      return request(app.getHttpServer())
        .get('/api/s3/presigned-get-url')
        .query({ key: testKey })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('url');
          expect(typeof res.body.url).toBe('string');
          expect(res.body.url.length).toBeGreaterThan(0);
        });
    });
  });

  describe('Authentication', () => {
    it('should return 401 without authentication', () => {
      const testKey = `test-uploads/${Date.now()}/test-file.pdf`;
      
      return request(app.getHttpServer())
        .get('/api/s3/presigned-put-url')
        .query({ key: testKey })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
