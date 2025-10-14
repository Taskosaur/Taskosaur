import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { Role as OrganizationRole } from '@prisma/client';


export class UpdateOrganizationMemberDto {
  @ApiPropertyOptional({
    description: 'Role of the user within the organization',
    enum: OrganizationRole,
    example: OrganizationRole.MANAGER,
  })
  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole;

  @ApiPropertyOptional({
    description: 'Whether this organization is the default for the user',
    example: false,
    type: Boolean,
  })
  @IsBoolean()
  @IsOptional()
  isDefault: boolean = false; // default value
}
