import { IsEnum, IsOptional } from 'class-validator';
import { Role as WorkspaceRole } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkspaceMemberDto } from './create-workspace-member.dto';

export class UpdateWorkspaceMemberDto extends PartialType(CreateWorkspaceMemberDto) {
  @IsEnum(WorkspaceRole)
  @IsOptional()
  role?: WorkspaceRole;
}
