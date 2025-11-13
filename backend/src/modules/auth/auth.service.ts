import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtPayload } from './strategies/jwt.strategy';
import { SYSTEM_USER_ID } from '../../common/constants';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    // Prevent system user from authenticating
    if (user && user.id === SYSTEM_USER_ID) {
      throw new UnauthorizedException('System user cannot be used for authentication');
    }

    if (
      user &&
      user.password &&
      user.status === 'ACTIVE' && // Only active users can login
      (await bcrypt.compare(password, user.password))
    ) {
      const result: Omit<typeof user, 'password'> = Object.assign({}, user);
      delete (result as any).password;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
    });

    // Update refresh token in database
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username || undefined,
        role: user.role,
        avatar: user.avatar || undefined,
        bio: user.bio || undefined,
        mobileNumber: user.mobileNumber || undefined,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const baseUsername = registerDto.email.split('@')[0].toLowerCase();
    let finalUsername = baseUsername;
    let counter = 1;
    while (await this.usersService.findByUsername(finalUsername)) {
      finalUsername = `${baseUsername}${counter}`;
      counter++;
    }
    registerDto.username = finalUsername;
    const user = await this.usersService.create(registerDto);

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
    });

    // Update refresh token in database
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar || undefined,
        bio: user.bio || undefined,
        mobileNumber: user.mobileNumber || undefined,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const decoded = this.jwtService.verify(refreshToken);

      // Type guard to ensure decoded payload has required properties
      if (!decoded || typeof decoded !== 'object' || !('sub' in decoded)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload = decoded as JwtPayload;
      const user = await this.usersService.findOne(payload.sub);

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
      });

      // Update refresh token in database
      await this.usersService.updateRefreshToken(user.id, newRefreshToken);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username || undefined,
          role: user.role,
          avatar: user.avatar || undefined,
        },
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  /**
   * Generate and send password reset token to user's email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        return {
          message: 'If an account with that email exists, a password reset link has been sent.',
        };
      }
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24);
      const hashedResetToken = await bcrypt.hash(resetToken, 10);
      await this.usersService.updateResetToken(user.id, hashedResetToken, resetTokenExpiry);
      const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}`;
      await this.emailService.sendPasswordResetEmail(user.email, {
        userName: user.firstName,
        resetToken: resetToken, // Pass the plain token (not hashed)
        resetUrl: resetUrl,
      });
      return {
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    } catch (error: unknown) {
      console.error(
        'Error in forgotPassword:',
        error instanceof Error ? error.message : String(error),
      );
      return {
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }
  }

  /**
   * Verify if reset token is valid and not expired
   */
  async verifyResetToken(token: string): Promise<{ isValid: boolean; user?: any }> {
    try {
      if (!token || token.trim() === '') {
        return { isValid: false };
      }

      // Find all users with active reset tokens
      const users = await this.usersService.findAllUsersWithResetTokens();
      let validUser: any = null;

      // Check each user's hashed token (since we hash tokens before storing)
      for (const user of users) {
        const resetToken = user.resetToken;
        if (resetToken !== null && (await bcrypt.compare(token, resetToken))) {
          // Check if token is not expired
          if (user.resetTokenExpiry && user.resetTokenExpiry > new Date()) {
            validUser = user;
            break;
          }
        }
      }

      if (!validUser) {
        return { isValid: false };
      }

      // Check if token is expired
      if (!validUser.resetTokenExpiry || new Date() > validUser.resetTokenExpiry) {
        // Clean up expired token
        await this.usersService.clearResetToken(validUser.id as string);
        return { isValid: false };
      }
      return {
        isValid: true,
        user: {
          id: validUser.id,
          email: validUser.email,
          firstName: validUser.firstName,
          lastName: validUser.lastName,
        },
      };
    } catch (error) {
      console.error('Error verifying reset token:', error);
      return { isValid: false };
    }
  }

  /**
   * Reset user password using valid reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      if (!token || token.trim() === '') {
        throw new BadRequestException('Invalid reset token');
      }

      // Validate password strength
      if (!newPassword || newPassword.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters long');
      }

      // Additional password validation
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        throw new BadRequestException(
          'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        );
      }

      // Find all users with active reset tokens
      const users = await this.usersService.findAllUsersWithResetTokens();
      let validUser: any = null;

      // Check each user's hashed token
      for (const user of users) {
        const resetToken = user.resetToken;
        if (resetToken !== null && (await bcrypt.compare(token, resetToken))) {
          // Check if token is not expired
          if (user.resetTokenExpiry && user.resetTokenExpiry > new Date()) {
            validUser = user;
            break;
          }
        }
      }

      if (!validUser) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Check if token is expired (double check)
      if (!validUser.resetTokenExpiry || new Date() > validUser.resetTokenExpiry) {
        // Clean up expired token
        await this.usersService.clearResetToken(validUser.id as string);
        throw new BadRequestException('Reset token has expired');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update user password and clear reset token in a transaction
      await this.prisma.$transaction(async (prisma) => {
        // Update password
        await prisma.user.update({
          where: { id: validUser.id },
          data: {
            password: hashedPassword,
            updatedAt: new Date(),
          },
        });

        // Clear reset token
        await prisma.user.update({
          where: { id: validUser.id },
          data: {
            resetToken: null,
            resetTokenExpiry: null,
          },
        });

        // Invalidate all refresh tokens for security
        await prisma.user.update({
          where: { id: validUser.id },
          data: {
            refreshToken: null,
          },
        });
      });

      // Send password reset confirmation email
      await this.emailService.sendPasswordResetConfirmationEmail(validUser.email as string, {
        userName: validUser.firstName as string,
        resetTime: new Date().toLocaleString(),
      });

      return { message: 'Password has been successfully reset' };
    } catch (error: unknown) {
      console.error(
        'Error in resetPassword:',
        error instanceof Error ? error.message : String(error),
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to reset password');
    }
  }
}
