import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({
    description: 'Role of the message sender',
    enum: ['system', 'user', 'assistant'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @ApiProperty({
    description: 'Content of the message',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ChatRequestDto {
  @ApiProperty({
    description: 'User message content',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Conversation history',
    type: [ChatMessageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];

  @ApiPropertyOptional({
    description: 'Current workspace context',
  })
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiPropertyOptional({
    description: 'Current project context',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Session ID for context tracking',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Current Organization ID',
  })
  @IsOptional()
  @IsString()
  currentOrganizationId?: string;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'AI response message',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Action to execute if detected',
  })
  action?: {
    name: string;
    parameters: Record<string, any>;
  };

  @ApiProperty({
    description: 'Success status',
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Error message if any',
  })
  error?: string;
}
