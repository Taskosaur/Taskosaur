import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '../queue/decorators/inject-queue.decorator';
import { IQueue } from '../queue/interfaces/queue.interface';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import {
  AutomationRule,
  RuleExecution,
  TriggerType,
  ActionType,
  TaskPriority,
} from '@prisma/client';
import { EventsGateway } from '../../gateway/events.gateway';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    @InjectQueue('automation') private automationQueue: IQueue,
  ) {}

  create(createAutomationRuleDto: CreateAutomationRuleDto): Promise<AutomationRule> {
    return this.prisma.automationRule.create({
      data: createAutomationRuleDto,
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  findAll(
    organizationId?: string,
    workspaceId?: string,
    projectId?: string,
  ): Promise<AutomationRule[]> {
    const where: any = {};

    if (projectId) {
      where.projectId = projectId;
    } else if (workspaceId) {
      where.workspaceId = workspaceId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.prisma.automationRule.findMany({
      where,
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<AutomationRule> {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, name: true, slug: true },
        },
        executions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            triggeredBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    return rule;
  }

  async update(id: string, updateData: Partial<CreateAutomationRuleDto>): Promise<AutomationRule> {
    await this.findOne(id); // Ensure it exists

    return this.prisma.automationRule.update({
      where: { id },
      data: updateData,
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Ensure it exists

    await this.prisma.automationRule.delete({
      where: { id },
    });
  }

  async toggleStatus(id: string): Promise<AutomationRule> {
    const rule = await this.findOne(id);
    const newStatus = rule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    return this.prisma.automationRule.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  // Automation execution methods
  async executeRule(
    rule: AutomationRule,
    triggerData: any,
    triggeredById?: string,
  ): Promise<RuleExecution> {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | null = null;
    let actionResult: any = null;

    try {
      // Execute the action based on the rule configuration
      actionResult = await this.performAction(rule, triggerData);
      success = true;

      // Update rule execution count
      await this.prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          executionCount: { increment: 1 },
          lastExecuted: new Date(),
        },
      });
    } catch (error) {
      console.error(error);
      success = false;
      errorMessage = error.message;
    }

    const executionTime = Date.now() - startTime;

    // Record the execution
    const execution = await this.prisma.ruleExecution.create({
      data: {
        ruleId: rule.id,
        success,
        errorMessage,
        executionTime,
        triggerData,
        actionResult,
        triggeredById,
        createdBy: triggeredById || rule.createdBy,
      },
    });

    return execution;
  }

  private async performAction(rule: AutomationRule, triggerData: any): Promise<any> {
    const { actionType, actionConfig } = rule;

    if (!actionConfig) {
      throw new Error('Action configuration is required');
    }

    const config = actionConfig as any;

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
          rule.createdBy || '',
        );

      case ActionType.CHANGE_PRIORITY:
        return this.changePriority(triggerData.taskId as string, config.priority as TaskPriority);

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

    // Send real-time notification
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

    return { taskId, assigneeIds, success: true };
  }

  private async changeTaskStatus(taskId: string, statusId: string): Promise<any> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { statusId },
      include: {
        project: { select: { id: true } },
        status: { select: { id: true, name: true, color: true } },
      },
    });

    // Send real-time notification
    this.eventsGateway.emitTaskStatusChanged(task.project.id, taskId, {
      statusId,
      status: task.status,
    });

    return { taskId, statusId, success: true };
  }

  private async addLabel(taskId: string, labelId: string): Promise<any> {
    // Get the task to find who created it for audit purposes
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { createdBy: true },
    });

    const taskLabel = await this.prisma.taskLabel.create({
      data: {
        taskId,
        labelId,
        createdBy: task?.createdBy || '',
      },
      include: {
        label: { select: { id: true, name: true, color: true } },
      },
    });

    return { taskId, labelId, label: taskLabel.label, success: true };
  }

  private sendNotification(userId: string, message: string, triggerData: any): any {
    // Send real-time notification via WebSocket
    this.eventsGateway.emitNotification(userId, {
      type: 'automation',
      message,
      data: triggerData,
    });

    return { userId, message, success: true };
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
        task: { select: { project: { select: { id: true } } } },
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Send real-time notification
    this.eventsGateway.emitCommentAdded(comment.task.project.id, taskId, comment);

    return { taskId, commentId: comment.id, success: true };
  }

  private async changePriority(taskId: string, priority: TaskPriority): Promise<any> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { priority },
      include: { project: { select: { id: true } } },
    });

    this.eventsGateway.emitTaskUpdated(task.project.id, taskId, { priority });

    return { taskId, priority, success: true };
  }

  private async setDueDate(taskId: string, dueDate: string): Promise<any> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { dueDate: new Date(dueDate) },
      include: { project: { select: { id: true } } },
    });

    this.eventsGateway.emitTaskUpdated(task.project.id, taskId, { dueDate });

    return { taskId, dueDate, success: true };
  }

  // Event handlers for triggering automation
  async handleTaskCreated(task: any): Promise<void> {
    const rules = await this.getActiveRules(TriggerType.TASK_CREATED, task.projectId as string);

    for (const rule of rules) {
      if (this.checkTriggerConditions(rule, task)) {
        await this.queueRuleExecution(
          rule.id,
          TriggerType.TASK_CREATED,
          { taskId: task.id, task },
          task.reporterId as string,
        );
      }
    }
  }

  async handleTaskUpdated(taskId: string, updates: any, userId: string): Promise<void> {
    const rules = await this.getActiveRules(TriggerType.TASK_UPDATED);

    for (const rule of rules) {
      if (this.checkTriggerConditions(rule, { taskId, updates })) {
        await this.queueRuleExecution(
          rule.id,
          TriggerType.TASK_UPDATED,
          { taskId, updates },
          userId,
        );
      }
    }
  }

  async handleTaskStatusChanged(taskId: string, statusChange: any, userId: string): Promise<void> {
    const rules = await this.getActiveRules(TriggerType.TASK_STATUS_CHANGED);

    for (const rule of rules) {
      if (this.checkTriggerConditions(rule, { taskId, statusChange })) {
        await this.queueRuleExecution(
          rule.id,
          TriggerType.TASK_STATUS_CHANGED,
          { taskId, statusChange },
          userId,
        );
      }
    }
  }

  async handleTaskAssigned(taskId: string, assigneeId: string, userId: string): Promise<void> {
    const rules = await this.getActiveRules(TriggerType.TASK_ASSIGNED);

    for (const rule of rules) {
      if (this.checkTriggerConditions(rule, { taskId, assigneeId })) {
        await this.queueRuleExecution(
          rule.id,
          TriggerType.TASK_ASSIGNED,
          { taskId, assigneeId },
          userId,
        );
      }
    }
  }

  private async queueRuleExecution(
    ruleId: string,
    triggerType: TriggerType,
    triggerData: any,
    triggeredById?: string,
  ): Promise<void> {
    try {
      await this.automationQueue.add(
        'execute-rule',
        {
          ruleId,
          triggerType,
          triggerData,
          triggeredById,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      );

      this.logger.log(`Queued automation rule ${ruleId} for trigger ${triggerType}`);
    } catch (error) {
      this.logger.error(`Failed to queue automation rule ${ruleId}:`, error);
    }
  }

  private getActiveRules(triggerType: TriggerType, projectId?: string): Promise<AutomationRule[]> {
    const where: any = {
      status: 'ACTIVE',
      triggerType,
    };

    if (projectId) {
      where.OR = [
        { projectId },
        { projectId: null }, // Global rules
      ];
    }

    return this.prisma.automationRule.findMany({ where });
  }

  private checkTriggerConditions(rule: AutomationRule, data: any): boolean {
    if (!rule.triggerConfig) return true;

    const config = rule.triggerConfig as any;

    // Check task type condition
    if (config.taskType && data.task?.type !== config.taskType) {
      return false;
    }

    // Check priority condition
    if (config.priority && data.task?.priority !== config.priority) {
      return false;
    }

    // Check project condition
    if (config.projectId && data.task?.projectId !== config.projectId) {
      return false;
    }

    // Check assignee condition
    if (config.assigneeId && data.task?.assigneeId !== config.assigneeId) {
      return false;
    }

    return true;
  }

  async getExecutionStats(ruleId: string): Promise<any> {
    const [rule, executions] = await Promise.all([
      this.findOne(ruleId),
      this.prisma.ruleExecution.findMany({
        where: { ruleId },
        select: {
          success: true,
          executionTime: true,
          createdAt: true,
        },
      }),
    ]);

    const successCount = executions.filter((e) => e.success).length;
    const failureCount = executions.length - successCount;
    const avgExecutionTime =
      executions.length > 0
        ? executions.reduce((sum, e) => sum + e.executionTime, 0) / executions.length
        : 0;

    return {
      ruleId,
      ruleName: rule.name,
      totalExecutions: executions.length,
      successCount,
      failureCount,
      successRate: executions.length > 0 ? (successCount / executions.length) * 100 : 0,
      avgExecutionTime,
      lastExecuted: rule.lastExecuted,
    };
  }
}
