import { PartialType } from '@nestjs/swagger';
import { CreateTaskDependencyDto } from './create-task-dependency.dto';

export class UpdateTaskDependencyDto extends PartialType(CreateTaskDependencyDto) {}
