import { IsArray, IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportTrelloBoardsDto {
  @ApiProperty({ description: 'Array of Trello Board IDs to import', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Matches(/^[0-9a-f]{24}$/i, {
    each: true,
    message: 'Each board ID must be a valid 24-character Trello board ID',
  })
  boardIds: string[];
}
