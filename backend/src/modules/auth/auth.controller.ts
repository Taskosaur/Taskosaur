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
  ParseUUIDPipe,
} from '@nestjs/common';
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
  ) {}

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
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
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
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
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
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
  })
  async logout(@CurrentUser() user: any): Promise<{ message: string }> {
    await this.authService.logout(user.id as string);
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
  async setupSuperAdmin(@Body() setupAdminDto: SetupAdminDto): Promise<AuthResponseDto> {
    return this.setupService.setupSuperAdmin(setupAdminDto);
  }
}
