import { IsString, IsNotEmpty, IsUrl, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ConnectJiraDto {
  @ApiProperty({
    description: 'Taskosaur project ID to link with Jira',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'Your Jira site URL (Atlassian Cloud)',
    example: 'https://yourorg.atlassian.net',
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  jiraSiteUrl: string;

  @ApiProperty({
    description: 'The Jira project key to sync from',
    example: 'PROJ',
  })
  @IsString()
  @IsNotEmpty()
  jiraProjectKey: string;

  @ApiProperty({
    description: 'Your Atlassian account email address',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  jiraEmail: string;

  @ApiProperty({
    description:
      'Your Jira API Token. Generate at https://id.atlassian.com/manage-profile/security/api-tokens',
    example: 'ATATT3xFfGF0...',
  })
  @IsString()
  @IsNotEmpty()
  jiraApiToken: string;

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
    description: 'Map Jira status IDs to Taskosaur status IDs',
    example: { '10001': 'status-uuid-here' },
  })
  @IsOptional()
  statusMappings?: Record<string, string>;
}
