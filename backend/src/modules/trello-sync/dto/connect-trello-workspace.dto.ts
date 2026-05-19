import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectTrelloWorkspaceDto {
  @ApiProperty({ description: 'Trello API Key' })
  @IsString()
  @IsNotEmpty()
  trelloApiKey: string;

  @ApiProperty({ description: 'Trello API Token' })
  @IsString()
  @IsNotEmpty()
  trelloToken: string;

  @ApiPropertyOptional({ description: 'Trello Workspace ID (optional)' })
  @IsString()
  @IsOptional()
  trelloWorkspaceId?: string;
}
