import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTaskLabelDto {
  @ApiProperty({
    description: 'ID of the task to assign the label to',
    example: '123e4567-e89b-12d3-a456-426614174999',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({
    description: 'ID of the label to assign to the task',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  labelId: string;

  @ApiProperty({
    description: 'ID of the user performing the label assignment',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
