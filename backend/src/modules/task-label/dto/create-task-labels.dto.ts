import { IsUUID, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTaskLabelDto {
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
