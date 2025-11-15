import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { S3Service } from '../storage/s3.service';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UsersService {
  usersService: any;
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private storageService: StorageService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const baseUsername = createUserDto.email.split('@')[0].toLowerCase();
    let finalUsername = baseUsername;
    let counter = 1;
    while (
      await this.prisma.user.findUnique({
        where: { username: finalUsername },
      })
    ) {
      finalUsername = `${baseUsername}${counter}`;
      counter++;
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        username: finalUsername,
        password: hashedPassword,
      },
    });

    const userWithoutPassword: Omit<typeof user, 'password'> = Object.assign({}, user);
    delete (userWithoutPassword as any).password;
    return userWithoutPassword;
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        mobileNumber: true,
        timezone: true,
        language: true,
        role: true,
        status: true,
        lastLoginAt: true,
        emailVerified: true,
        refreshToken: true,
        preferences: true,
        onboardInfo: true,
        resetToken: true,
        resetTokenExpiry: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  }

  async findOne(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        mobileNumber: true,
        timezone: true,
        language: true,
        role: true,
        status: true,
        password: true,
        lastLoginAt: true,
        emailVerified: true,
        refreshToken: true,
        preferences: true,
        onboardInfo: true,
        resetToken: true,
        resetTokenExpiry: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const userWithoutPassword: Omit<typeof user, 'password'> = Object.assign({}, user);
    delete (userWithoutPassword as any).password;
    return { ...userWithoutPassword };
  }

  async getUserPassword(id: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        password: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.password;
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (emailExists) {
        throw new ConflictException('Email already taken');
      }
    }

    if (updateUserDto.username && updateUserDto.username !== existingUser.username) {
      const usernameExists = await this.prisma.user.findUnique({
        where: { username: updateUserDto.username },
      });

      if (usernameExists) {
        throw new ConflictException('Username already taken');
      }
    }

    const updateData = { ...updateUserDto };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });
    let avatarUrl: string | null = null;
    if (user.avatar) {
      // Check if using S3 or local storage
      if (this.storageService.isUsingS3()) {
        avatarUrl = await this.storageService.getFileUrl(user.avatar);
      } else {
        // For local storage, user.avatar already contains the relative path
        avatarUrl = user.avatar;
      }
    }

    const userWithoutPassword: Omit<typeof user, 'password'> = Object.assign({}, user);
    delete (userWithoutPassword as any).password;
    return { ...userWithoutPassword, avatar: avatarUrl };
  }

  async remove(id: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }

  // Password reset related methods
  findByResetToken(resetToken: string) {
    return this.prisma.user.findUnique({
      where: { resetToken },
    });
  }

  async updateResetToken(
    userId: string,
    resetToken: string | null,
    resetTokenExpiry: Date | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });
  }

  findAllUsersWithResetTokens() {
    return this.prisma.user.findMany({
      where: {
        resetToken: { not: null },
        resetTokenExpiry: { gte: new Date() },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        resetToken: true,
        resetTokenExpiry: true,
      },
    });
  }
  async clearResetToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }
  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
  }
  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken,
      },
    });
  }

  async checkUsersExist(): Promise<boolean> {
    const count = await this.prisma.user.count();
    return count > 0;
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const userPassword = await this.getUserPassword(userId);
    if (userPassword === null) {
      throw new BadRequestException('User not found');
    }

    const isMatch = await bcrypt.compare(changePasswordDto.currentPassword, userPassword);
    if (!isMatch) {
      throw new BadRequestException('Current password is not correct');
    }

    const isSamePassword = await bcrypt.compare(changePasswordDto.newPassword, userPassword);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(changePasswordDto.newPassword)) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      );
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

    await this.updatePassword(userId, hashedPassword);

    return { success: true, message: 'Password changed successfully' };
  }
}
