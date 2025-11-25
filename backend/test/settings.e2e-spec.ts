import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { SetSettingDto } from './../src/modules/settings/dto/settings.dto';

describe('SettingsController (e2e)', () => {
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
        email: `settings-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Settings',
        lastName: 'Tester',
        username: `settings_tester_${Date.now()}`,
        role: Role.OWNER, // Assuming OWNER might be needed for some settings
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.settings.deleteMany({ where: { key: { startsWith: 'e2e_test_' } } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  const testSettingKey = `e2e_test_setting_${Date.now()}`;
  const setSettingDto: SetSettingDto = {
    key: testSettingKey,
    value: 'test-value',
    description: 'E2E Test Setting',
    category: 'TEST',
    isEncrypted: false,
  };

  describe('/settings (POST)', () => {
    it('should create or update a setting', () => {
      return request(app.getHttpServer())
        .post('/api/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(setSettingDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.message).toBe('Setting updated successfully');
        });
    });
  });

  describe('/settings/:key (GET)', () => {
    it('should retrieve the setting', () => {
      return request(app.getHttpServer())
        .get(`/api/settings/${testSettingKey}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.key).toBe(testSettingKey);
          expect(res.body.value).toBe(setSettingDto.value);
        });
    });

    it('should return default value if setting not found', () => {
      const nonExistentKey = 'non_existent_key';
      const defaultValue = 'default_value';
      return request(app.getHttpServer())
        .get(`/api/settings/${nonExistentKey}`)
        .query({ defaultValue })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.key).toBe(nonExistentKey);
          expect(res.body.value).toBe(defaultValue);
        });
    });
  });

  describe('/settings (GET)', () => {
    it('should list all settings', () => {
      return request(app.getHttpServer())
        .get('/api/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const setting = res.body.find((s: any) => s.key === testSettingKey);
          expect(setting).toBeDefined();
          expect(setting.value).toBe(setSettingDto.value);
        });
    });

    it('should filter settings by category', () => {
      return request(app.getHttpServer())
        .get('/api/settings')
        .query({ category: 'TEST' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const setting = res.body.find((s: any) => s.key === testSettingKey);
          expect(setting).toBeDefined();
        });
    });
  });

  describe('/settings/:key (DELETE)', () => {
    it('should delete the setting', () => {
      return request(app.getHttpServer())
        .delete(`/api/settings/${testSettingKey}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toBe('Setting deleted successfully');
        });
    });

    it('should verify setting is deleted', () => {
      return request(app.getHttpServer())
        .get(`/api/settings/${testSettingKey}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
            // The controller returns { key, value: null } or similar if not found but no default provided?
            // Actually service.get returns null if not found and no default.
            // Controller returns { key, value }
            expect(res.body.value).toBeNull(); 
        });
    });
  });
});
