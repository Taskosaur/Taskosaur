import { ApiProperty } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

export class User {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  mobileNumber?: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  username?: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ required: false })
  avatar?: string;

  @ApiProperty({ required: false })
  bio?: string;

  @ApiProperty({ default: 'UTC' })
  timezone: string;

  @ApiProperty({ default: 'en' })
  language: string;

  @ApiProperty({ enum: Role, default: Role.MEMBER })
  role: Role;

  @ApiProperty({ enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ required: false })
  lastLoginAt?: Date;

  @ApiProperty({ default: false })
  emailVerified: boolean;

  @ApiProperty({ required: false })
  preferences?: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
