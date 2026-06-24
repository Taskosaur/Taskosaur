import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ValidateJiraCredentialsDto } from './validate-jira-credentials.dto';

export class ValidateJiraProjectStatusesDto extends ValidateJiraCredentialsDto {
  @ApiProperty({
    description: 'Your Jira project key, e.g. PROJ',
    example: 'PROJ',
  })
  @IsString()
  @IsNotEmpty()
  jiraProjectKey: string;
}
