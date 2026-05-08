import { IsNotEmpty, IsArray, IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignLabelDto {
  @ApiProperty({
    description: 'ID of the task to assign the label to',
    example: '123e4567-e89b-12d3-a456-426614174999',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({
    description: 'ID of the label to assign to the task',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID('4')
  @IsNotEmpty()
  labelId: string;
}

export class AssignMultipleLabelsDto {
  @ApiProperty({
    description: 'ID of the task to assign the labels to',
    example: '123e4567-e89b-12d3-a456-426614174999',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({
    description: 'Array of label IDs to assign to the task',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    type: [String],
    format: 'uuid',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  labelIds: string[];
}
