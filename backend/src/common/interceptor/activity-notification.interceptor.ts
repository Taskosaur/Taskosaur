// src/common/interceptors/activity-notification.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { Reflector } from '@nestjs/core';
import { NotificationType, NotificationPriority } from '@prisma/client';
import { ActivityLogService } from 'src/modules/activity-log/activity-log.service';

@Injectable()
export class ActivityNotificationInterceptor implements NestInterceptor {
  constructor(
    private activityLogService: ActivityLogService,
    private notificationsService: NotificationsService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    const activityConfig = this.reflector.get('activity-log', handler);
    const notificationConfig = this.reflector.get('notification-config', handler);

    if (!activityConfig && !notificationConfig) {
      return next.handle();
    }

    const userId = request.user?.id;
    const organizationId =
      request.user?.currentOrganizationId || request.headers['x-organization-id'];
    const originalData = {
      ...request.body,
      ...request.params,
      ...request.query,
    };

    return next.handle().pipe(
      tap((result) => {
        // Fire and forget: don't await, don't block the response
        void (async () => {
          try {
            // Handle activity logging
            if (userId && activityConfig) {
              await this.logActivity(
                activityConfig,
                userId as string,
                organizationId as string | undefined,
                originalData,
                result,
                activityConfig.entityIdName as string | string[] | undefined,
              );
            }

            // Handle notifications
            if (notificationConfig) {
              await this.sendNotification(
                notificationConfig,
                request.user,
                organizationId as string | undefined,
                originalData,
                result,
              );
            }
          } catch (error) {
            console.error('Error in activity/notification interceptor:', error);
          }
        })();
      }),
    );
  }

  private async logActivity(
    config: any,
    userId: string,
    organizationId: string | undefined,
    oldValue: any,
    newValue: any,
    entityIdName?: string | string[],
  ) {
    let finalOrganizationId = organizationId;

    // Handle entityId extraction for both single string and array of strings
    let entityId: any;

    if (entityIdName) {
      if (Array.isArray(entityIdName)) {
        // Try each field name in the array until we find a non-null value
        for (const fieldName of entityIdName) {
          const value = newValue?.[fieldName] || oldValue?.[fieldName];
          if (value) {
            entityId = value;
            break;
          }
        }
      } else {
        // Single field name
        entityId = newValue?.[entityIdName] || oldValue?.[entityIdName];
      }
    }

    // Fallback to id if entityId not found
    if (!entityId) {
      entityId = newValue?.id || oldValue?.id;
    }

    // Get organization ID if not provided
    if (!finalOrganizationId) {
      if (entityId) {
        finalOrganizationId = await this.activityLogService.getOrganizationIdFromEntity(
          config.entityType as string,
          entityId as string,
        );
      }
    }

    await this.activityLogService.logActivity({
      type: config.type,
      description: config.description,
      entityType: config.entityType,
      entityId: entityId,
      userId,
      organizationId: finalOrganizationId,
      oldValue: config.includeOldValue ? oldValue : undefined,
      newValue: config.includeNewValue ? newValue : undefined,
    });
  }

  private async sendNotification(
    config: any,
    user: any,
    organizationId: string | undefined,
    requestData: any,
    responseData: any,
  ) {
    let finalOrganizationId = organizationId;

    if (!finalOrganizationId) {
      const entityId = responseData?.id || config.entityId;
      if (entityId) {
        finalOrganizationId = await this.activityLogService.getOrganizationIdFromEntity(
          config.entityType as string,
          entityId as string,
        );
      }
    }

    const notifyUserIds = await this.getNotificationRecipients(
      config,
      user,
      requestData,
      responseData,
    );

    if (notifyUserIds.length === 0) {
      return;
    }
    for (const notifyUserId of notifyUserIds) {
      try {
        await this.notificationsService.createNotification({
          title: config.title || this.generateTitle(config.type as NotificationType),
          message:
            config.message ||
            this.generateMessage(config.type as NotificationType, user, responseData),
          type: config.type as NotificationType,
          userId: notifyUserId,
          organizationId: finalOrganizationId,
          entityType: config.entityType,
          entityId: responseData?.id || (config.entityId as string),
          actionUrl:
            config.actionUrl ||
            this.generateActionUrl(config.entityType as string, responseData.id as string),
          createdBy: user.id as string,
          priority: config.priority || NotificationPriority.MEDIUM,
        });
      } catch (error) {
        console.error(`❌ Failed to create notification for user ${notifyUserId}:`, error);
      }
    }
  }

  // ✅ Updated to handle all notification types
  private async getNotificationRecipients(
    config: any,
    user: any,
    requestData: any,
    responseData: any,
  ): Promise<string[]> {
    const recipients: string[] = [];
    switch (config.type) {
      // ✅ Task-related notifications
      case NotificationType.TASK_ASSIGNED: {
        // Handle multiple assignees from requestData or responseData
        const assigneeIds =
          requestData.assigneeIds ||
          (requestData.assignees
            ? (requestData.assignees as Array<{ id: string }>).map((a) => a.id)
            : undefined) ||
          (responseData.assignees
            ? (responseData.assignees as Array<{ id: string }>).map((a) => a.id)
            : undefined) ||
          responseData.assigneeIds ||
          [];

        if (Array.isArray(assigneeIds)) {
          recipients.push(...(assigneeIds as string[]));
        }
        break;
      }

      case NotificationType.TASK_STATUS_CHANGED: {
        const taskId = responseData.id || config.entityId;
        if (taskId) {
          const taskParticipants = await this.getTaskParticipants(taskId as string);
          recipients.push(...taskParticipants.filter((id) => id !== user.id));
        }
        break;
      }

      case NotificationType.TASK_COMMENTED: {
        const commentTaskId = responseData.taskId || requestData.taskId;
        if (commentTaskId) {
          const commentTaskParticipants = await this.getTaskParticipants(commentTaskId as string);
          recipients.push(...commentTaskParticipants.filter((id) => id !== user.id));
        }
        break;
      }

      case NotificationType.TASK_DUE_SOON: {
        const dueTaskId = responseData.id || config.entityId;
        if (dueTaskId) {
          const dueTaskParticipants = await this.getTaskParticipants(dueTaskId as string);
          recipients.push(...dueTaskParticipants);
        }
        break;
      }

      // ✅ Project-related notifications
      case NotificationType.PROJECT_CREATED: {
        const workspaceId = requestData.workspaceId || responseData.workspaceId;
        if (workspaceId) {
          const workspaceMembers = await this.getWorkspaceMembers(workspaceId as string);
          recipients.push(...workspaceMembers.filter((id) => id !== user.id));
        }
        break;
      }

      case NotificationType.PROJECT_UPDATED: {
        const projectId = responseData.id || config.entityId;
        if (projectId) {
          const projectMembers = await this.getProjectMembers(projectId as string);
          recipients.push(...projectMembers.filter((id) => id !== user.id));
        }
        break;
      }

      // ✅ Workspace-related notifications
      case NotificationType.WORKSPACE_INVITED: {
        // Notify the invited user
        const invitedUserId = requestData.userId || requestData.invitedUserId;
        if (invitedUserId) {
          recipients.push(invitedUserId as string);
        }
        break;
      }

      // ✅ User mention notifications
      case NotificationType.MENTION: {
        const mentionedUserIds = requestData.mentionedUsers || [];
        if (Array.isArray(mentionedUserIds)) {
          recipients.push(...(mentionedUserIds as string[]).filter((id) => id !== user.id));
        } else if (mentionedUserIds) {
          recipients.push(mentionedUserIds as string);
        }
        break;
      }

      // ✅ System notifications
      case NotificationType.SYSTEM: {
        // System notifications can be sent to specific users or all organization members
        if (config.notifyUserId) {
          recipients.push(config.notifyUserId as string);
        } else if (config.notifyAllOrgMembers) {
          const orgMembers = await this.getOrganizationMembers(config.organizationId as string);
          recipients.push(...orgMembers.filter((id) => id !== user.id));
        }
        break;
      }

      // ✅ Default case for custom notifications
      default:
        if (config.notifyUserId) {
          recipients.push(config.notifyUserId as string);
        } else if (config.notifyUserIds && Array.isArray(config.notifyUserIds)) {
          recipients.push(...(config.notifyUserIds as string[]));
        }
        break;
    }

    // Filter unique recipients
    const uniqueRecipients = [...new Set(recipients)].filter((id) => {
      if (!id) return false;

      // Always send notifications for assignments and invitations
      const notificationType = config.type as NotificationType;
      if (
        notificationType === NotificationType.TASK_ASSIGNED ||
        notificationType === NotificationType.WORKSPACE_INVITED ||
        notificationType === NotificationType.MENTION ||
        notificationType === NotificationType.TASK_DUE_SOON
      ) {
        return true;
      }

      // For other types, exclude the action performer
      return id !== user.id;
    });

    return uniqueRecipients;
  }

  // ✅ Helper methods for getting participants/members
  private async getTaskParticipants(taskId: string): Promise<string[]> {
    if (!taskId) return [];
    try {
      return await this.activityLogService.getTaskParticipants(taskId);
    } catch (error) {
      console.error('Error getting task participants:', error);
      return [];
    }
  }

  private async getWorkspaceMembers(workspaceId: string): Promise<string[]> {
    if (!workspaceId) return [];
    try {
      return await this.activityLogService.getWorkspaceMembers(workspaceId);
    } catch (error) {
      console.error('Error getting workspace members:', error);
      return [];
    }
  }

  private async getProjectMembers(projectId: string): Promise<string[]> {
    if (!projectId) return [];
    try {
      const members = await this.activityLogService.getPrisma().projectMember.findMany({
        where: { projectId },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    } catch (error) {
      console.error('Error getting project members:', error);
      return [];
    }
  }

  private async getOrganizationMembers(organizationId: string): Promise<string[]> {
    if (!organizationId) return [];
    try {
      const members = await this.activityLogService.getPrisma().organizationMember.findMany({
        where: { organizationId },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    } catch (error) {
      console.error('Error getting organization members:', error);
      return [];
    }
  }

  // ✅ Updated title generation for all types
  private generateTitle(type: NotificationType): string {
    switch (type) {
      case NotificationType.TASK_ASSIGNED:
        return 'Task Assigned';
      case NotificationType.TASK_STATUS_CHANGED:
        return 'Task Status Updated';
      case NotificationType.TASK_COMMENTED:
        return 'New Comment';
      case NotificationType.TASK_DUE_SOON:
        return 'Task Due Soon';
      case NotificationType.PROJECT_CREATED:
        return 'New Project Created';
      case NotificationType.PROJECT_UPDATED:
        return 'Project Updated';
      case NotificationType.WORKSPACE_INVITED:
        return 'Workspace Invitation';
      case NotificationType.MENTION:
        return 'You were mentioned';
      case NotificationType.SYSTEM:
        return 'System Notification';
      default:
        return 'Notification';
    }
  }

  // ✅ Updated message generation for all types
  private generateMessage(type: NotificationType, user: any, data: any): any {
    const userName = `${user.firstName} ${user.lastName}`;

    switch (type) {
      case NotificationType.TASK_ASSIGNED:
        return `You have been assigned to task "${data.title}"`;
      case NotificationType.TASK_STATUS_CHANGED:
        return `${userName} updated the status of task "${data.title}"`;
      case NotificationType.TASK_COMMENTED:
        return `${userName} commented on task "${data.title}"`;
      case NotificationType.TASK_DUE_SOON:
        return `Task "${data.title}" is due soon`;
      case NotificationType.PROJECT_CREATED:
        return `${userName} created a new project "${data.name}"`;
      case NotificationType.PROJECT_UPDATED:
        return `${userName} updated project "${data.name}"`;
      case NotificationType.WORKSPACE_INVITED:
        return `${userName} invited you to join workspace "${data.name}"`;
      case NotificationType.MENTION:
        return `${userName} mentioned you in a comment`;
      case NotificationType.SYSTEM:
        return data.message || 'System notification';
      default:
        return `${userName} performed an action`;
    }
  }

  // ✅ Updated action URL generation for all types
  private generateActionUrl(entityType: string, entityId: string): string {
    if (!entityId) return '/';

    switch (entityType.toLowerCase()) {
      case 'task':
        return `/tasks/${entityId}`;
      case 'project':
        return `/projects/${entityId}`;
      case 'workspace':
        return `/workspaces/${entityId}`;
      case 'taskcomment':
        return `/tasks/${entityId}#comments`;
      case 'user':
        return `/users/${entityId}`;
      case 'organization':
        return `/organizations/${entityId}`;
      default:
        return '/';
    }
  }
}
