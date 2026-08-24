import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Query,
  Res,
  Req,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, RefreshTokenDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetTokenResponseDto } from './dto/verify-reset-token.dto';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SetupService } from './services/setup.service';
import { AccessControlService, AccessResult } from 'src/common/access-control.utils';
import { SettingsService } from '../settings/settings.service';
import { encryptCookieValue, decryptCookieValue } from 'src/common/cookie-crypto.utils';
import { OidcService } from './services/oidc.service';
export enum ScopeType {
  ORGANIZATION = 'organization',
  WORKSPACE = 'workspace',
  PROJECT = 'project',
  TASK = 'task',
}
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly setupService: SetupService,
    private readonly accessControlService: AccessControlService,
    private readonly settingsService: SettingsService,
    private readonly oidcService: OidcService,
    private readonly configService: ConfigService,
  ) {}

  private getEncryptionSecret(): string {
    return this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const encrypted = encryptCookieValue(refreshToken, this.getEncryptionSecret());
    res.cookie('refresh_token', encrypted, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', { path: '/' });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto);
    this.setRefreshTokenCookie(res, result.refresh_token);
    return result;
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Registration successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists',
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);
    this.setRefreshTokenCookie(res, result.refresh_token);
    return result;
  }

  @Public()
  @Get('registration-status')
  @ApiOperation({ summary: 'Check if user registration is enabled and org creation settings' })
  @ApiResponse({ status: 200, description: 'Registration and org creation status' })
  async getRegistrationStatus() {
    const [registrationValue, allowOrgCreation, defaultOrgId] = await Promise.all([
      this.settingsService.get('registration_enabled'),
      this.settingsService.get('allow_org_creation'),
      this.settingsService.get('default_organization_id'),
    ]);
    return {
      enabled: registrationValue !== 'false',
      allowOrgCreation: allowOrgCreation !== 'false',
      hasDefaultOrganization: !!defaultOrgId,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    // Read refresh token from httpOnly cookie first, fallback to POST body
    let token = '';
    const encryptedCookie = req.cookies?.refresh_token;
    if (encryptedCookie) {
      token = decryptCookieValue(String(encryptedCookie), this.getEncryptionSecret()) || '';
    }
    if (!token) {
      token = String(refreshTokenDto.refresh_token || '');
    }
    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const result = await this.authService.refreshToken(token);
    this.setRefreshTokenCookie(res, result.refresh_token);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
  })
  async logout(
    @CurrentUser() user: { id: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id);
    this.clearRefreshTokenCookie(res);
    return { message: 'Logout successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  getProfile(@CurrentUser() user: any): any {
    return user;
  }
  @UseGuards(JwtAuthGuard)
  @Get('access-control')
  @ApiOperation({ summary: 'Get user access for a specific resource' })
  @ApiQuery({
    name: 'scope',
    enum: ScopeType,
    description: 'The scope type (organization, workspace, project, task)',
    required: true,
  })
  @ApiQuery({
    name: 'id',
    description: 'The UUID of the resource',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Access information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        isElevated: { type: 'boolean' },
        role: {
          type: 'string',
          enum: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'MEMBER', 'VIEWER'],
        },
        canChange: { type: 'boolean' },
        userId: { type: 'string' },
        scopeId: { type: 'string' },
        scopeType: { type: 'string' },
      },
    },
  })
  async getResourceAccess(
    @Query('scope') scope: ScopeType,
    @Query('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ): Promise<AccessResult> {
    return this.accessControlService.getResourceAccess(scope, id, user.id as string);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Password reset instructions sent to your email',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto.email);
    return {
      success: true,
      message: 'Password reset instructions sent to your email',
    };
  }

  @Public()
  @Get('verify-reset-token/:token')
  @ApiOperation({ summary: 'Verify password reset token' })
  @ApiResponse({
    status: 200,
    description: 'Token verification result',
    type: VerifyResetTokenResponseDto,
  })
  async verifyResetToken(@Param('token') token: string): Promise<VerifyResetTokenResponseDto> {
    const { isValid } = await this.authService.verifyResetToken(token);
    return {
      valid: isValid,
      message: isValid ? 'Token is valid' : 'Invalid or expired token',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password with token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Password has been reset successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid token or password validation failed',
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    // Validate that passwords match
    if (resetPasswordDto.password !== resetPasswordDto.confirmPassword) {
      throw new Error('Passwords do not match');
    }

    await this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.password);
    return {
      success: true,
      message: 'Password has been reset successfully',
    };
  }

  @Public()
  @Get('setup/required')
  @ApiOperation({ summary: 'Check if system setup is required' })
  @ApiResponse({
    status: 200,
    description: 'Setup requirement status',
    schema: {
      type: 'object',
      properties: {
        required: { type: 'boolean' },
        canSetup: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async isSetupRequired() {
    const required = await this.setupService.isSetupRequired();
    const { canSetup, message } = await this.setupService.validateSetupState();
    return { required, canSetup, message };
  }

  @Public()
  @Post('setup')
  @ApiOperation({ summary: 'Setup super admin user (first-time setup only)' })
  @ApiBody({ type: SetupAdminDto })
  @ApiResponse({
    status: 201,
    description: 'Super admin created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            username: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Setup already completed or in progress',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid setup data',
  })
  async setupSuperAdmin(
    @Body() setupAdminDto: SetupAdminDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.setupService.setupSuperAdmin(setupAdminDto);
    this.setRefreshTokenCookie(res, result.refresh_token);
    return result;
  }

  // ─── SSO / OIDC ──────────────────────────────────────────────────

  @Public()
  @Get('oidc/config')
  @ApiOperation({ summary: 'Check if SSO/OIDC is enabled' })
  async getOidcConfig() {
    return this.oidcService.isConfigured();
  }

  @Public()
  @Get('oidc/login')
  @ApiOperation({ summary: 'Redirect to OIDC provider for login' })
  async oidcLogin(@Res() res: Response) {
    const { url, state, nonce } = await this.oidcService.getAuthorizationUrl();

    // Store state and nonce in secure httpOnly cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOpts = {
      httpOnly: true,
      maxAge: 600000,
      sameSite: 'strict' as const,
      secure: isProduction,
    };
    res.cookie('oidc_state', state, cookieOpts);
    res.cookie('oidc_nonce', nonce, cookieOpts);

    return res.redirect(url);
  }

  @Public()
  @Get('oidc/callback')
  @ApiOperation({ summary: 'Handle OIDC provider callback' })
  async oidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('iss') iss: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const storedState = String(req.cookies?.oidc_state || '');
      const storedNonce = String(req.cookies?.oidc_nonce || '');

      if (!code || !state || !storedState || !storedNonce) {
        return res.redirect('/login?error=sso_invalid_state');
      }

      const authResult = await this.oidcService.handleCallback(
        code,
        state,
        storedState,
        storedNonce,
        iss,
      );

      // Clear OIDC cookies
      res.clearCookie('oidc_state');
      res.clearCookie('oidc_nonce');

      // Store tokens in short-lived httpOnly cookie for secure exchange
      const isProd = process.env.NODE_ENV === 'production';
      const encryptedSso = encryptCookieValue(
        JSON.stringify(authResult),
        this.getEncryptionSecret(),
      );
      res.cookie('sso_auth', encryptedSso, {
        httpOnly: true,
        maxAge: 60000,
        sameSite: 'strict',
        secure: isProd,
      });

      return res.redirect('/login?sso=callback');
    } catch (error: unknown) {
      res.clearCookie('oidc_state');
      res.clearCookie('oidc_nonce');
      const message = error instanceof Error ? error.message : 'SSO authentication failed';
      return res.redirect(`/login?error=sso_failed&message=${encodeURIComponent(message)}`);
    }
  }

  @Public()
  @Post('oidc/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange SSO cookie for tokens' })
  oidcExchange(@Req() req: Request, @Res() res: Response) {
    const encryptedSso = String(req.cookies?.sso_auth || '');
    if (!encryptedSso) {
      return res.status(401).json({ message: 'No SSO session found' });
    }

    try {
      const decryptedSso = decryptCookieValue(encryptedSso, this.getEncryptionSecret());
      if (!decryptedSso) {
        res.clearCookie('sso_auth');
        return res.status(401).json({ message: 'Invalid SSO session' });
      }
      const authResult = JSON.parse(decryptedSso) as Record<string, unknown>;
      res.clearCookie('sso_auth');

      // Set refresh token as httpOnly cookie
      if (authResult.refresh_token && typeof authResult.refresh_token === 'string') {
        this.setRefreshTokenCookie(res, authResult.refresh_token);
      }

      return res.json(authResult);
    } catch {
      res.clearCookie('sso_auth');
      return res.status(401).json({ message: 'Invalid SSO session' });
    }
  }
}
