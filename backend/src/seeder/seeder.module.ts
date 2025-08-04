import { Module } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemUserSeederService } from './system-user.seeder.service';
import { UsersSeederService } from './users.seeder.service';
import { OrganizationsSeederService } from './organizations.seeder.service';
import { WorkspacesSeederService } from './workspaces.seeder.service';
import { ProjectsSeederService } from './projects.seeder.service';
import { WorkflowSeederService } from './workflow.seeder';
import { TaskStatusSeederService } from './taskstatus.seeder.service';
import { TasksSeederService } from './tasks.seeder.service';
import { SprintsSeederService } from './sprints.seeder.service';
import { LabelsSeederService } from './labels.seeder.service';
import { TaskCommentsSeederService } from './task-comments.seeder.service';
import { TaskDependenciesSeederService } from './task-dependencies.seeder.service';
import { TaskWatchersSeederService } from './task-watchers.seeder.service';
import { TimeEntriesSeederService } from './time-entries.seeder.service';

@Module({
  imports: [PrismaModule],
  providers: [
    SeederService,
    SystemUserSeederService,
    UsersSeederService,
    OrganizationsSeederService,
    WorkspacesSeederService,
    ProjectsSeederService,
    WorkflowSeederService,
    TaskStatusSeederService,
    TasksSeederService,
    SprintsSeederService,
    LabelsSeederService,
    TaskCommentsSeederService,
    TaskDependenciesSeederService,
    TaskWatchersSeederService,
    TimeEntriesSeederService,
  ],
  exports: [SeederService],
})
export class SeederModule {}
