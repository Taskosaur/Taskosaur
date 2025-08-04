import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { TaskStatusesModule } from './modules/task-statuses/task-statuses.module';
import { SprintsModule } from './modules/sprints/sprints.module';
import { LabelsModule } from './modules/labels/labels.module';
import { TaskCommentsModule } from './modules/task-comments/task-comments.module';
import { TimeEntriesModule } from './modules/time-entries/time-entries.module';
import { OrganizationMembersModule } from './modules/organization-members/organization-members.module';
import { WorkspaceMembersModule } from './modules/workspace-members/workspace-members.module';
import { ProjectMembersModule } from './modules/project-members/project-members.module';
import { TaskWatchersModule } from './modules/task-watchers/task-watchers.module';
import { TaskAttachmentsModule } from './modules/task-attachments/task-attachments.module';
import { TaskDependenciesModule } from './modules/task-dependencies/task-dependencies.module';
import { GatewayModule } from './gateway/gateway.module';
import { SearchModule } from './modules/search/search.module';
import { AutomationModule } from './modules/automation/automation.module';
import { GanttModule } from './modules/gantt/gantt.module';
import { QueueModule } from './modules/queue/queue.module';
import { SeederModule } from './seeder/seeder.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { ActivityNotificationInterceptor } from './common/interceptor/activity-notification.interceptor';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { S3Module } from './modules/s3/s3.module';
// import { EmailModule } from './modules/email/email.module';
// import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      cache: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    WorkflowsModule,
    TaskStatusesModule,
    SprintsModule,
    LabelsModule,
    TaskCommentsModule,
    TimeEntriesModule,
    OrganizationMembersModule,
    WorkspaceMembersModule,
    ProjectMembersModule,
    TaskWatchersModule,
    TaskAttachmentsModule,
    TaskDependenciesModule,
    GatewayModule,
    SearchModule,
    AutomationModule,
    GanttModule,
    QueueModule,
    SeederModule,
    ActivityLogModule,
    NotificationsModule,
    S3Module
    // EmailModule,
    // SchedulerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityNotificationInterceptor,
    },
  ],
})
export class AppModule {}
