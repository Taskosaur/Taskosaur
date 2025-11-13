import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTaskWatcherDto {
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;
}

export class WatchTaskDto {
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;
}

export class UnwatchTaskDto {
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
