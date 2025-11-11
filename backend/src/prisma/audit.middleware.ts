import { Prisma } from '@prisma/client';
import { RequestContextService } from '../common/request-context.service';

// System user ID for fallback operations
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// Models that should have createdBy/updatedBy fields automatically set
const AUDITABLE_MODELS = [
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

export function createAuditExtension() {
  return Prisma.defineExtension({
    name: 'audit',
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          let currentUserId = RequestContextService.getCurrentUserId();

          // Use system user as fallback for operations without user context
          if (!currentUserId) {
            currentUserId = SYSTEM_USER_ID;
          }

          const modelName = model;

          // Only apply to auditable models
          if (!modelName || !AUDITABLE_MODELS.includes(modelName)) {
            return query(args);
          }

          // Handle CREATE operations
          if (operation === 'create') {
            if (args.data) {
              const data = args.data as any;
              // Set createdBy if not already set and field exists
              if (data.createdBy === undefined) {
                data.createdBy = currentUserId;
              }

              // Set updatedBy if not already set and field exists (for consistency)
              if (data.updatedBy === undefined) {
                // Don't set updatedBy for User model on creation to avoid self-reference issues
                if (modelName !== 'User') {
                  data.updatedBy = currentUserId;
                }
              }
            }
          }

          // Handle UPDATE operations
          if (operation === 'update' || operation === 'updateMany') {
            if (args.data) {
              const data = args.data as any;
              // Check if this is a meaningful update (not just timestamp updates)
              const dataKeys = Object.keys(data);
              const hasMeaningfulUpdate = dataKeys.some(
                (key: string) => !EXCLUDED_UPDATE_FIELDS.includes(key),
              );

              // Set updatedBy if this is a meaningful update and field is not already set
              if (hasMeaningfulUpdate && data.updatedBy === undefined) {
                data.updatedBy = currentUserId;
              }
            }
          }

          // Handle UPSERT operations
          if (operation === 'upsert') {
            // For create case
            if (args.create) {
              const createData = args.create as any;
              if (createData.createdBy === undefined) {
                createData.createdBy = currentUserId;
              }
              if (createData.updatedBy === undefined && modelName !== 'User') {
                createData.updatedBy = currentUserId;
              }
            }

            // For update case
            if (args.update) {
              const updateData = args.update as any;
              const dataKeys = Object.keys(updateData);
              const hasMeaningfulUpdate = dataKeys.some(
                (key: string) => !EXCLUDED_UPDATE_FIELDS.includes(key),
              );

              if (hasMeaningfulUpdate && updateData.updatedBy === undefined) {
                updateData.updatedBy = currentUserId;
              }
            }
          }

          // Handle createMany operations
          if (operation === 'createMany' && args.data) {
            const data = args.data as any;
            if (Array.isArray(data)) {
              args.data = data.map((item: any) => ({
                ...item,
                createdBy: item.createdBy ?? currentUserId,
                ...(modelName !== 'User' && {
                  updatedBy: item.updatedBy ?? currentUserId,
                }),
              })) as any;
            }
          }

          return query(args);
        },
      },
    },
  });
}
