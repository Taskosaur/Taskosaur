import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { StorageService } from '../storage/storage.service';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    if (!createUserDto.email) {
      throw new BadRequestException('Email is required');
    }

    const existingUser = await this.prisma.user.findFirst({
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

    if (!createUserDto.password) {
      throw new BadRequestException('Password is required');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        username: finalUsername,
        avatar: createUserDto.avatar,
        bio: createUserDto.bio,
        mobileNumber: createUserDto.mobileNumber,
        timezone: createUserDto.timezone,
        language: createUserDto.language,
        role: createUserDto.role || Role.MEMBER,
      },
    });

    const userWithoutPassword: Omit<typeof user, 'password'> = Object.assign({}, user);
    delete (userWithoutPassword as any).password;
    return userWithoutPassword;
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    return this.prisma.user.findMany({
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
        defaultOrganizationId: true,
        source: true,
        externalId: true,
        externalProvider: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        deletedBy: true,
      },
    });
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
        lastLoginAt: true,
        emailVerified: true,
        refreshToken: true,
        preferences: true,
        onboardInfo: true,
        resetToken: true,
        resetTokenExpiry: true,
        defaultOrganizationId: true,
        source: true,
        externalId: true,
        externalProvider: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        deletedBy: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getPublicProfile(identifier: string, requesterId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier,
    );
    const user = await this.prisma.user.findFirst({
      where: isUuid
        ? { OR: [{ id: identifier }, { username: identifier }] }
        : { username: identifier },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        mobileNumber: true,
        bio: true,
        timezone: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    if (requester.role !== Role.SUPER_ADMIN && user.id !== requesterId) {
      const isSharedOrg = await this.prisma.organizationMember.findFirst({
        where: {
          userId: user.id,
          organization: {
            members: {
              some: { userId: requesterId },
            },
          },
        },
      });

      if (!isSharedOrg) {
        throw new ForbiddenException(
          'Profile access not allowed. You must belong to the same organization.',
        );
      }
    }

    let avatarUrl: string | null = null;
    if (user.avatar) {
      if (this.storageService.isUsingS3()) {
        avatarUrl = await this.storageService.getFileUrl(user.avatar);
      } else {
        avatarUrl = user.avatar;
      }
    }

    return { ...user, avatar: avatarUrl };
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

    const { password, ...updateData } = updateUserDto;
    if (password) {
      console.warn('Password update skipped in update(). Use changePassword() instead.');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    let avatarUrl: string | null = null;
    if (user.avatar) {
      if (this.storageService.isUsingS3()) {
        avatarUrl = await this.storageService.getFileUrl(user.avatar);
      } else {
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

    const isMatch = await bcrypt.compare(changePasswordDto.currentPassword, userPassword as string);
    if (!isMatch) {
      throw new BadRequestException('Current password is not correct');
    }

    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      userPassword as string,
    );
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, BCRYPT_SALT_ROUNDS);

    await this.updatePassword(userId, hashedPassword);

    return { success: true, message: 'Password changed successfully' };
  }
}
