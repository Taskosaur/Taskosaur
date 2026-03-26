import { ApiProperty } from '@nestjs/swagger';

export class UserStatusResponseDto {
  @ApiProperty({ description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  userId: string;

  @ApiProperty({
    description: 'Whether the user is currently online',
    example: true,
  })
  isOnline: boolean;

  @ApiProperty({
    description: 'Last seen timestamp in ISO 8601 format',
    example: '2024-01-15T10:30:00.000Z',
    required: false,
  })
  lastSeen?: string;
}

export class BulkUserStatusResponseDto {
  @ApiProperty({
    description: 'Map of user IDs to their status',
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        isOnline: { type: 'boolean' },
        lastSeen: { type: 'string', format: 'date-time' },
      },
    },
    example: {
      '123e4567-e89b-12d3-a456-426614174000': {
        isOnline: true,
        lastSeen: '2024-01-15T10:30:00.000Z',
      },
      '123e4567-e89b-12d3-a456-426614174001': {
        isOnline: false,
        lastSeen: '2024-01-14T08:00:00.000Z',
      },
    },
  })
  status: Record<string, { isOnline: boolean; lastSeen?: string }>;
}

export class UserTypingEventDto {
  @ApiProperty({ description: 'Task ID where user is typing' })
  taskId: string;

  @ApiProperty({ description: 'User ID who is typing' })
  userId: string;

  @ApiProperty({ description: 'User display name' })
  userName: string;

  @ApiProperty({ description: 'User avatar URL', required: false })
  userAvatar?: string;
}
