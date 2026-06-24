import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsObject,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ConnectTrelloDto {
  @ApiProperty({
    description: 'Taskosaur project ID to link with Trello',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'Trello Board ID to sync from',
    example: '5e9f8f8f8f8f8f8f8f8f8f8f',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-f]{24}$/i, {
    message: 'trelloBoardId must be a valid 24-character Trello board ID',
  })
  trelloBoardId: string;

  @ApiProperty({
    description: 'Your personal Trello API Key. Get it at https://trello.com/power-ups/admin',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  })
  @IsString()
  @IsNotEmpty()
  trelloApiKey: string;

  @ApiProperty({
    description:
      'Your personal Trello Token. Generate via https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=YOUR_KEY',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  })
  @IsString()
  @IsNotEmpty()
  trelloToken: string;

  @ApiPropertyOptional({
    description: 'How often to sync in minutes (default: 15)',
    example: 15,
    default: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  @Type(() => Number)
  syncInterval?: number;

  @ApiPropertyOptional({
    description: 'Map Trello list IDs to Taskosaur status IDs',
    example: { '5e9f8f8f8f8f8f8f8f8f8f8f': 'status-uuid-here' },
  })
  @IsOptional()
  @IsObject()
  statusMappings?: Record<string, string>;
}
