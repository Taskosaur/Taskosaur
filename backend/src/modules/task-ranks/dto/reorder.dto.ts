import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ScopeType, ViewType } from '@prisma/client';

export class ReorderDto {
  @IsEnum(ScopeType)
  scopeType: ScopeType;

  @IsUUID()
  scopeId: string;

  @IsEnum(ViewType)
  viewType: ViewType;

  @IsOptional()
  @IsString()
  afterTaskId: string | null;

  @IsOptional()
  @IsString()
  beforeTaskId: string | null;
}
