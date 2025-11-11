import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
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
import { SeederModule } from './seeder/seeder.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { ActivityNotificationInterceptor } from './common/interceptor/activity-notification.interceptor';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { S3Module } from './modules/storage/s3.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { TaskLabelsModule } from './modules/task-label/task-labels.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { InboxModule } from './modules/inbox/inbox.module';

import { PublicModule } from './modules/public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      cache: true,
    }),
    RouterModule.register([
      {
        path: 'api',
        children: [
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
          SearchModule,
          AutomationModule,
          GanttModule,
          ActivityLogModule,
          NotificationsModule,
          S3Module,
          InvitationsModule,
          TaskLabelsModule,
          SettingsModule,
          AiChatModule,
          InboxModule,
          PublicModule,
        ],
      },
    ]),
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
    SeederModule,
    ActivityLogModule,
    NotificationsModule,
    S3Module,
    InvitationsModule,
    TaskLabelsModule,
    SettingsModule,
    AiChatModule,
    InboxModule,
    PublicModule,
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
