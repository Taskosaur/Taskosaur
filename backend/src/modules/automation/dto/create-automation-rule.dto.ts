import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TriggerType, ActionType, RuleStatus } from '@prisma/client';

export class CreateAutomationRuleDto {
  @ApiProperty({
    description: 'Name of the automation rule',
    example: 'Auto-assign high priority bugs to senior developers',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of what this rule does',
    example: 'Automatically assigns high priority bug tasks to senior developers when created',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Type of event that triggers this rule',
    enum: TriggerType,
    example: TriggerType.TASK_CREATED,
  })
  @IsEnum(TriggerType)
  triggerType: TriggerType;

  @ApiProperty({
    description: 'Configuration for the trigger conditions',
    example: {
      taskType: 'BUG',
      priority: 'HIGH',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  triggerConfig?: any;

  @ApiProperty({
    description: 'Type of action to perform when triggered',
    enum: ActionType,
    example: ActionType.ASSIGN_TASK,
  })
  @IsEnum(ActionType)
  actionType: ActionType;

  @ApiProperty({
    description: 'Configuration for the action to perform',
    example: {
      assigneeId: '123e4567-e89b-12d3-a456-426614174001',
      notificationMessage: 'High priority bug assigned to you',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  actionConfig?: any;

  @ApiProperty({
    description: 'Organization ID to scope this rule',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({
    description: 'Workspace ID to scope this rule',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;

  @ApiProperty({
    description: 'Project ID to scope this rule',
    example: '123e4567-e89b-12d3-a456-426614174002',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    description: 'ID of the user creating this rule',
    example: '123e4567-e89b-12d3-a456-426614174003',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  createdBy: string;

  @ApiProperty({
    description: 'Status of the rule',
    enum: RuleStatus,
    example: RuleStatus.ACTIVE,
    required: false,
    default: RuleStatus.ACTIVE,
  })
  @IsEnum(RuleStatus)
  @IsOptional()
  status?: RuleStatus;
}
