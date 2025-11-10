import { IsString, IsNotEmpty, IsEnum, IsInt, IsHexColor, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StatusCategory } from '@prisma/client';

export class CreateTaskStatusDto {
  @ApiProperty({
    description: 'The name of the task status',
    example: 'In Progress',
    minLength: 1,
    maxLength: 50,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The color of the task status in hexadecimal format',
    example: '#FFA500',
    format: 'hex-color',
    pattern: '^#[0-9A-Fa-f]{6}$',
    required: true,
  })
  @IsHexColor()
  @IsNotEmpty()
  color: string;

  @ApiProperty({
    description: 'The category of the task status',
    example: StatusCategory.IN_PROGRESS,
    enum: StatusCategory,
    enumName: 'StatusCategory',
    required: true,
  })
  @IsEnum(StatusCategory)
  @IsNotEmpty()
  category: StatusCategory;

  @ApiProperty({
    description: 'The position of the status in the workflow (used for ordering)',
    example: 2,
    minimum: 0,
    type: 'integer',
    required: true,
  })
  @IsInt()
  @IsNotEmpty()
  position: number;

  @ApiProperty({
    description: 'The unique identifier of the workflow this task status belongs to',
    example: 'd0f5e6c7-4567-8901-2cde-f01234567890',
    format: 'uuid',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  workflowId: string;
}
export class CreateTaskStatusFromProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  @IsNotEmpty()
  projectId: string;
}
