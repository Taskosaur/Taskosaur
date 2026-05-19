import { IsArray, IsString, ArrayNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JiraProjectImportDto {
  @ApiProperty({ example: 'PROJ' })
  @IsString()
  key: string;

  @ApiProperty({ required: false, example: { '10001': 'uuid-of-todo' } })
  @IsObject()
  @IsOptional()
  statusMappings?: Record<string, string>;
}

export class ImportJiraProjectsDto {
  @ApiProperty({
    description: 'Array of Jira project keys to import, optionally with mappings',
    example: ['PROJ', { key: 'BACKEND', statusMappings: { '10000': '...' } }],
  })
  @IsArray()
  @ArrayNotEmpty()
  projects: (string | { key: string; statusMappings?: Record<string, string> })[];
}
