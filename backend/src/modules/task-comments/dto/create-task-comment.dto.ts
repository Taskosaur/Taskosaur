import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskCommentDto {
  @ApiProperty({
    description: 'Comment content (supports markdown)',
    example:
      'I think we should also consider adding rate limiting to the authentication endpoints. @john.doe what do you think?',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'ID of the task this comment belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({
    description: 'ID of the parent comment (for replies)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  parentCommentId?: string;
}
