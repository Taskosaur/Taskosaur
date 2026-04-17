import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { OidcService } from './oidc.service';

describe('OidcService', () => {
  let service: OidcService;
  let oidcClientCallback: jest.Mock;

  const baseConfig = {
    enabled: true,
    providerName: 'Test SSO',
    issuerUrl: 'https://issuer.example.com',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    redirectUri: 'https://app.example.com/api/auth/oidc/callback',
  };

  const mockUser = {
    id: 'user-id',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'MEMBER',
    username: 'alice',
    avatar: null,
    status: 'ACTIVE',
    refreshToken: null,
  };

  const prismaMock = {
    user: {
      update: jest.fn().mockResolvedValue(mockUser),
    },
  };

  const settingsMock = {
    get: jest.fn(),
  };

  const jwtMock = {
    sign: jest.fn().mockReturnValue('signed-token'),
  };

  const configMock = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback ?? 'test-value'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OidcService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SettingsService, useValue: settingsMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<OidcService>(OidcService);

    oidcClientCallback = jest.fn().mockResolvedValue({
      claims: () => ({
        email: mockUser.email,
        email_verified: true,
        given_name: mockUser.firstName,
        family_name: mockUser.lastName,
        sub: 'external-id-123',
      }),
    });

    jest.spyOn(service as any, 'getClient').mockResolvedValue({
      callback: oidcClientCallback,
    });

    jest.spyOn(service, 'getOidcConfig').mockResolvedValue(baseConfig);

    jest.spyOn(service as any, 'findOrCreateSsoUser').mockResolvedValue(mockUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCallback iss parameter forwarding (RFC 9207)', () => {
    it('forwards iss to openid-client when provided', async () => {
      await service.handleCallback(
        'auth-code',
        'state-123',
        'state-123',
        'nonce-xyz',
        'https://issuer.example.com',
      );

      expect(oidcClientCallback).toHaveBeenCalledTimes(1);
      const [, params] = oidcClientCallback.mock.calls[0];
      expect(params).toEqual({
        code: 'auth-code',
        state: 'state-123',
        iss: 'https://issuer.example.com',
      });
    });

    it('omits iss when not provided (backwards compatible)', async () => {
      await service.handleCallback('auth-code', 'state-123', 'state-123', 'nonce-xyz');

      expect(oidcClientCallback).toHaveBeenCalledTimes(1);
      const [, params] = oidcClientCallback.mock.calls[0];
      expect(params).toEqual({ code: 'auth-code', state: 'state-123' });
      expect(params).not.toHaveProperty('iss');
    });

    it('omits iss when passed as empty string', async () => {
      await service.handleCallback('auth-code', 'state-123', 'state-123', 'nonce-xyz', '');

      expect(oidcClientCallback).toHaveBeenCalledTimes(1);
      const [, params] = oidcClientCallback.mock.calls[0];
      expect(params).not.toHaveProperty('iss');
    });
  });
});
