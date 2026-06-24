import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateTrelloBoardsDto {
  @ApiProperty({ description: 'Your personal Trello API Key' })
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiProperty({ description: 'Your personal Trello Token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
