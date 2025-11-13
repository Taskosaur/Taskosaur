import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../gateway/events.gateway';
import { ActionType, TriggerType } from '@prisma/client';
import { QueueProcessor } from '../queue/decorators/queue-processor.decorator';
import { IJob } from '../queue/interfaces/job.interface';

interface AutomationJobData {
  ruleId: string;
  triggerType: TriggerType;
  triggerData: any;
  triggeredById?: string;
}

@QueueProcessor('automation')
export class AutomationProcessor {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async process(job: IJob<AutomationJobData>) {
    return this.handleRuleExecution(job);
  }

  async handleRuleExecution(job: IJob<AutomationJobData>) {
    const { ruleId, triggerType, triggerData, triggeredById } = job.data;
    const startTime = Date.now();
    let rule: any = null;

    try {
      this.logger.log(`Executing automation rule ${ruleId} for trigger ${triggerType}`);

      // Get the rule details
      rule = await this.prisma.automationRule.findUnique({
        where: { id: ruleId },
      });

      if (!rule || rule.status !== 'ACTIVE') {
        this.logger.warn(`Rule ${ruleId} not found or inactive`);
        return { success: false, error: 'Rule not found or inactive' };
      }

      // Check if rule conditions are met
      if (!this.evaluateConditions(rule, triggerData)) {
        this.logger.debug(`Rule ${ruleId} conditions not met, skipping execution`);
        return { success: true, skipped: true };
      }

      // Execute the action
      const actionResult = await this.performAction(rule, triggerData);

      // Record successful execution
      const executionTime = Date.now() - startTime;
      await this.prisma.ruleExecution.create({
        data: {
          ruleId,
          triggerData,
          actionResult,
          success: true,
          executionTime,
          triggeredById,
          createdBy: triggeredById || rule.createdBy,
        },
      });

      this.logger.log(`Rule ${ruleId} executed successfully in ${executionTime}ms`);
      return { success: true, executionTime, result: actionResult };
    } catch (error) {
      console.error(error);
      const executionTime = Date.now() - startTime;

      // Record failed execution
      await this.prisma.ruleExecution.create({
        data: {
          ruleId,
          triggerData,
          actionResult: null as any,
          success: false,
          executionTime,
          errorMessage: error.message,
          triggeredById,
          createdBy: triggeredById || rule?.createdBy || '',
        },
      });

      this.logger.error(`Rule ${ruleId} execution failed:`, error);
      throw error;
    }
  }

  private evaluateConditions(rule: any, triggerData: any): boolean {
    if (!rule.conditions || Object.keys(rule.conditions as object).length === 0) {
      return true; // No conditions means always execute
    }

    const conditions = rule.conditions;

    // Evaluate each condition
    for (const [field, condition] of Object.entries(conditions as object)) {
      const value = this.getNestedValue(triggerData, field);

      if (!this.evaluateCondition(value, condition)) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(value: any, condition: any): boolean {
    if (typeof condition === 'object' && condition !== null) {
      // Handle complex conditions like { equals: "value" }, { in: ["val1", "val2"] }
      if ('equals' in condition) {
        return value === condition.equals;
      }
      if ('in' in condition) {
        return Array.isArray(condition.in) && (condition.in as unknown[]).includes(value);
      }
      if ('not' in condition) {
        return value !== condition.not;
      }
      if ('contains' in condition) {
        return typeof value === 'string' && value.includes(condition.contains as string);
      }
    }

    // Simple equality check
    return value === condition;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key): any => current?.[key], obj);
  }

  private async performAction(rule: any, triggerData: any): Promise<any> {
    const { actionType, actionConfig } = rule;

    if (!actionConfig) {
      throw new Error('Action configuration is required');
    }

    const config = actionConfig;

    switch (actionType) {
      case ActionType.ASSIGN_TASK:
        return this.assignTask(triggerData.taskId as string, config.assigneeId as string[]);

      case ActionType.CHANGE_STATUS:
        return this.changeTaskStatus(triggerData.taskId as string, config.statusId as string);

      case ActionType.ADD_LABEL:
        return this.addLabel(triggerData.taskId as string, config.labelId as string);

      case ActionType.SEND_NOTIFICATION:
        return this.sendNotification(
          config.userId as string,
          config.message as string,
          triggerData,
        );

      case ActionType.ADD_COMMENT:
        return this.addComment(
          triggerData.taskId as string,
          config.content as string,
          rule.createdBy as string,
        );

      case ActionType.CHANGE_PRIORITY:
        return this.changePriority(triggerData.taskId as string, config.priority as string);

      case ActionType.SET_DUE_DATE:
        return this.setDueDate(triggerData.taskId as string, config.dueDate as string);

      default:
        throw new Error(`Unsupported action type: ${actionType}`);
    }
  }

  private async assignTask(taskId: string, assigneeIds: string[]): Promise<any> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        assignees: {
          set: assigneeIds.map((id) => ({ id })), // Replace all assignees with new ones
        },
      },
      include: {
        project: { select: { id: true } },
        assignees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Send real-time notification to each assignee
    task.assignees.forEach((assignee) => {
      this.eventsGateway.emitTaskAssigned(task.project.id, taskId, {
        assigneeId: assignee.id,
        assignee: {
          id: assignee.id,
          firstName: assignee.firstName,
          lastName: assignee.lastName,
          email: assignee.email,
          avatar: assignee.avatar,
        },
      });
    });

    return {
      success: true,
      taskId,
      assigneeIds, // Return array instead of single ID
      assignees: task.assignees, // Include full assignee data
    };
  }

  private async changeTaskStatus(taskId: string, statusId: string): Promise<any> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { statusId },
      include: {
        project: { select: { id: true } },
        status: { select: { id: true, name: true } },
      },
    });

    // Send real-time notification
    this.eventsGateway.emitTaskStatusChanged(task.project.id, taskId, {
      statusId,
      status: task.status,
    });

    return { success: true, taskId, statusId, statusName: task.status.name };
  }

  private async addLabel(taskId: string, labelId: string): Promise<any> {
    // Get the task to find who created it for audit purposes
    const taskInfo = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { createdBy: true },
    });

    await this.prisma.taskLabel.create({
      data: {
        taskId,
        labelId,
        createdBy: taskInfo?.createdBy || '',
      },
    });

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true } } },
    });

    // Send real-time notification
    this.eventsGateway.emitTaskUpdated(task!.project.id, taskId, {
      labelAdded: labelId,
    });

    return { success: true, taskId, labelId };
  }

  private async sendNotification(userId: string, message: string, triggerData: any): Promise<any> {
    await this.prisma.notification.create({
      data: {
        userId,
        title: 'Automation Notification',
        message,
        type: 'TASK_ASSIGNED' as any,
        createdBy: userId,
        // metadata: triggerData, // Remove this until we add metadata to Notification model
      },
    });

    // Send real-time notification
    this.eventsGateway.emitNotification(userId, {
      type: 'automation',
      message,
      data: triggerData,
    });

    return { success: true, userId, message };
  }

  private async addComment(taskId: string, content: string, authorId: string): Promise<any> {
    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        content,
        authorId,
        createdBy: authorId,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        task: { include: { project: { select: { id: true } } } },
      },
    });

    // Send real-time notification
    this.eventsGateway.emitCommentAdded(comment.task.project.id, taskId, {
      commentId: comment.id,
      content: comment.content,
      author: comment.author,
    });

    return { success: true, taskId, commentId: comment.id };
  }

  private async changePriority(taskId: string, priority: string): Promise<any> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { priority: priority as any },
      include: {
        project: { select: { id: true } },
      },
    });

    // Send real-time notification
    this.eventsGateway.emitTaskUpdated(task.project.id, taskId, {
      priority,
    });

    return { success: true, taskId, priority };
  }

  private async setDueDate(taskId: string, dueDate: string): Promise<any> {
    const dueDateObj = new Date(dueDate);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { dueDate: dueDateObj },
      include: {
        project: { select: { id: true } },
      },
    });

    // Send real-time notification
    this.eventsGateway.emitTaskUpdated(task.project.id, taskId, {
      dueDate: dueDateObj,
    });

    return { success: true, taskId, dueDate: dueDateObj };
  }
}
