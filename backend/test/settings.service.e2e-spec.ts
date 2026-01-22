import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { Role } from '@prisma/client';

describe('SettingsService (e2e)', () => {
  let settingsService: SettingsService;
  let prismaService: PrismaService;
  let user: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();

    settingsService = app.get<SettingsService>(SettingsService);
    prismaService = app.get<PrismaService>(PrismaService);

    // Create a test user
    user = await prismaService.user.create({
      data: {
        email: `settings-service-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'SettingsService',
        lastName: 'Tester',
        username: `settings_service_tester_${Date.now()}`,
        role: Role.MEMBER,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.user.delete({ where: { id: user.id } });
  });

  describe('Global Settings', () => {
    const globalKey = 'e2e_test_global_setting';
    const globalValue = 'global_value';

    it('should set and get a global setting', async () => {
      await settingsService.set(globalKey, globalValue);
      const value = await settingsService.get(globalKey);
      expect(value).toBe(globalValue);
    });

    it('should delete a global setting', async () => {
      await settingsService.set(globalKey, globalValue);
      await settingsService.delete(globalKey);
      const value = await settingsService.get(globalKey);
      expect(value).toBeNull();
    });
  });

  describe('User-Specific Settings', () => {
    const userKey = 'e2e_test_user_setting';
    const userValue = 'user_value';

    it('should set and get a user-specific setting', async () => {
      await settingsService.set(userKey, userValue, user.id);
      const value = await settingsService.get(userKey, user.id);
      expect(value).toBe(userValue);
    });

    it('should return null for a non-existent user setting', async () => {
      const value = await settingsService.get('non_existent_key', user.id);
      expect(value).toBeNull();
    });

    it('should delete a user-specific setting', async () => {
      await settingsService.set(userKey, userValue, user.id);
      await settingsService.delete(userKey, user.id);
      const value = await settingsService.get(userKey, user.id);
      expect(value).toBeNull();
    });
  });

  describe('Settings Fallback', () => {
    const fallbackKey = 'e2e_test_fallback_setting';
    const globalValue = 'global_fallback_value';
    const userValue = 'user_fallback_value';

    beforeEach(async () => {
      // Ensure the setting is clean before each test in this block
      await settingsService.delete(fallbackKey, user.id);
      await settingsService.delete(fallbackKey);
    });

    it('should return global setting when user-specific setting does not exist', async () => {
      await settingsService.set(fallbackKey, globalValue); // Global
      const value = await settingsService.get(fallbackKey, user.id);
      expect(value).toBe(globalValue);
    });

    it('should prioritize user-specific setting over global setting', async () => {
      await settingsService.set(fallbackKey, globalValue); // Global
      await settingsService.set(fallbackKey, userValue, user.id); // User-specific
      const value = await settingsService.get(fallbackKey, user.id);
      expect(value).toBe(userValue);
    });
  });
});
