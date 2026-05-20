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

  @ApiProperty({
    description: 'Success status',
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Error message if any',
  })
  error?: string;
}

export class TestConnectionDto {
  @ApiProperty({
    description: 'API key to test',
  })
  @IsString()
  apiKey: string;

  @ApiProperty({
    description: 'Model to use for testing',
  })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({
    description: 'API URL to test',
  })
  @IsString()
  // @IsUrl()
  @IsNotEmpty()
  apiUrl: string;
}

export class TestConnectionResponseDto {
  @ApiProperty({
    description: 'Success status',
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Success or error message',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Error details if any',
  })
  error?: string;
}

export class GenerateDescriptionDto {
  @ApiProperty({
    description: 'Task title to generate description for',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Task type (TASK, BUG, EPIC, STORY, SUBTASK)',
  })
  @IsOptional()
  @IsString()
  taskType?: string;
}

export class GenerateDescriptionResponseDto {
  @ApiProperty({
    description: 'Generated description',
  })
  description: string;

  @ApiProperty({
    description: 'Success status',
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Error message if any',
  })
  error?: string;
}

export class CreateConversationDto {
  @ApiPropertyOptional({
    description: 'Title of the conversation',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Session ID',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;
}

export class RenameConversationDto {
  @ApiProperty({
    description: 'New title of the conversation',
  })
  @IsString()
  @IsNotEmpty()
  title: string;
}

export class UpdateMessagesDto {
  @ApiProperty({
    type: [ChatMessageDto],
    description: 'List of messages in the conversation',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}
