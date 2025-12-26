import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiProperty({
    description: 'Stop recurrence for this task',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  stopRecurrence?: boolean;
}
