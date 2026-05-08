import { IsNotEmpty, IsUUID, IsString } from 'class-validator';

export class CreateTaskWatcherDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;
}

export class WatchTaskDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;
}

export class UnwatchTaskDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
