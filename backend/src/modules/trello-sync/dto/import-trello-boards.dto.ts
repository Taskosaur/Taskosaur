import { IsArray, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportTrelloBoardsDto {
  @ApiProperty({ description: 'Array of Trello Board IDs to import', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  boardIds: string[];
}
