import { IsString, IsNotEmpty, IsEnum, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role as OrganizationRole } from '@prisma/client';

export class CreateOrganizationMemberDto {
  @ApiProperty({
    description: 'ID of the user to add to the organization',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'ID of the organization',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({
    description: 'Role to assign to the member',
    enum: OrganizationRole,
    example: OrganizationRole.MEMBER,
    required: false,
    default: OrganizationRole.MEMBER,
  })
  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole;

  @IsString()
  @IsOptional()
  createdBy?: string;
}

export class InviteOrganizationMemberDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'new.user@acme.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'ID of the organization to invite the user to',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({
    description: 'Role to assign to the invited member',
    enum: OrganizationRole,
    example: OrganizationRole.MEMBER,
    required: false,
    default: OrganizationRole.MEMBER,
  })
  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole;
}
