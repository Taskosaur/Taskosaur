import { Prisma } from '@prisma/client';
import { RequestContextService } from '../common/request-context.service';

// System user ID for fallback operations
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// Models that should have createdBy/updatedBy fields automatically set
const AUDITABLE_MODELS = [
  'User',
  'Organization',
  'OrganizationMember',
  'Workspace',
  'WorkspaceMember',
  'Project',
  'ProjectMember',
  'Task',
  'TaskDependency',
  'TaskLabel',
  'TaskWatcher',
  'TaskComment',
  'TaskAttachment',
  'TimeEntry',
  'Workflow',
  'TaskStatus',
  'StatusTransition',
  'Sprint',
  'Label',
  'CustomField',
  'Notification',
  'ActivityLog',
  'AutomationRule',
  'RuleExecution',
];

// Fields that should be excluded from automatic updatedBy setting
const EXCLUDED_UPDATE_FIELDS = ['createdAt', 'updatedAt', 'createdBy'];

export function createAuditMiddleware(): any {
  return async (params, next) => {
    let currentUserId = RequestContextService.getCurrentUserId();

    // Use system user as fallback for operations without user context
    if (!currentUserId) {
      currentUserId = SYSTEM_USER_ID;
    }

    const modelName = params.model;

    // Only apply to auditable models
    if (!modelName || !AUDITABLE_MODELS.includes(modelName)) {
      return next(params);
    }

    // Handle CREATE operations
    if (params.action === 'create') {
      if (params.args.data) {
        // Set createdBy if not already set and field exists
        if (params.args.data.createdBy === undefined) {
          params.args.data.createdBy = currentUserId;
        }

        // Set updatedBy if not already set and field exists (for consistency)
        if (params.args.data.updatedBy === undefined) {
          // Don't set updatedBy for User model on creation to avoid self-reference issues
          if (modelName !== 'User') {
            params.args.data.updatedBy = currentUserId;
          }
        }
      }
    }

    // Handle UPDATE operations
    if (params.action === 'update' || params.action === 'updateMany') {
      if (params.args.data) {
        // Check if this is a meaningful update (not just timestamp updates)
        const dataKeys = Object.keys(params.args.data);
        const hasMeaningfulUpdate = dataKeys.some((key) => !EXCLUDED_UPDATE_FIELDS.includes(key));

        // Set updatedBy if this is a meaningful update and field is not already set
        if (hasMeaningfulUpdate && params.args.data.updatedBy === undefined) {
          params.args.data.updatedBy = currentUserId;
        }
      }
    }

    // Handle UPSERT operations
    if (params.action === 'upsert') {
      // For create case
      if (params.args.create) {
        if (params.args.create.createdBy === undefined) {
          params.args.create.createdBy = currentUserId;
        }
        if (params.args.create.updatedBy === undefined && modelName !== 'User') {
          params.args.create.updatedBy = currentUserId;
        }
      }

      // For update case
      if (params.args.update) {
        const dataKeys = Object.keys(params.args.update);
        const hasMeaningfulUpdate = dataKeys.some((key) => !EXCLUDED_UPDATE_FIELDS.includes(key));

        if (hasMeaningfulUpdate && params.args.update.updatedBy === undefined) {
          params.args.update.updatedBy = currentUserId;
        }
      }
    }

    // Handle createMany operations
    if (params.action === 'createMany' && params.args.data) {
      if (Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((item) => ({
          ...item,
          createdBy: item.createdBy ?? currentUserId,
          ...(modelName !== 'User' && {
            updatedBy: item.updatedBy ?? currentUserId,
          }),
        }));
      }
    }

    return next(params);
  };
}
