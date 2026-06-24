import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateTrelloListsDto {
  @ApiProperty({
    description: 'Trello Board ID to list lists from',
    example: '5e9f8f8f8f8f8f8f8f8f8f8f',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-f]{24}$/i, { message: 'boardId must be a valid 24-character Trello board ID' })
  boardId: string;

  @ApiProperty({ description: 'Your personal Trello API Key' })
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiProperty({ description: 'Your personal Trello Token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
