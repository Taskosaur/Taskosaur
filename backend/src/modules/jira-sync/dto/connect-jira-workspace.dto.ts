import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConnectJiraWorkspaceDto {
  @ApiProperty({
    description: 'Your Jira site URL (Atlassian Cloud)',
    example: 'https://yourorg.atlassian.net',
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  jiraSiteUrl: string;

  @ApiProperty({
    description: 'Your Atlassian account email address',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  jiraEmail: string;

  @ApiProperty({
    description: 'Your Jira API Token',
    example: 'ATATT3xFfGF0...',
  })
  @IsString()
  @IsNotEmpty()
  jiraApiToken: string;
}
