import { Prisma } from '@prisma/client';
import { RequestContextService } from '../common/request-context.service';

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

// Type guard to check if value is a record
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createAuditExtension() {
  return Prisma.defineExtension({
    name: 'audit',
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          const currentUserId = RequestContextService.getCurrentUserId();
          const hasUser = Boolean(currentUserId);
          const modelName = model;

          if (!modelName || !AUDITABLE_MODELS.includes(modelName)) {
            return query(args);
          }

          if (operation === 'create' && hasUser) {
            if (args.data && isRecord(args.data)) {
              const data = args.data as Record<string, unknown>;

              if (data.createdBy === undefined) {
                data.createdBy = currentUserId;
              }

              if (data.updatedBy === undefined && modelName !== 'User') {
                data.updatedBy = currentUserId;
              }
            }
          }

          if ((operation === 'update' || operation === 'updateMany') && hasUser) {
            if (args.data && isRecord(args.data)) {
              const data = args.data as Record<string, unknown>;

              const dataKeys = Object.keys(data);
              const hasMeaningfulUpdate = dataKeys.some(
                (key: string) => !EXCLUDED_UPDATE_FIELDS.includes(key),
              );

              if (hasMeaningfulUpdate && data.updatedBy === undefined) {
                data.updatedBy = currentUserId;
              }
            }
          }

          if (operation === 'upsert' && hasUser) {
            if (args.create && isRecord(args.create)) {
              const createData = args.create as Record<string, unknown>;

              if (createData.createdBy === undefined) {
                createData.createdBy = currentUserId;
              }

              if (createData.updatedBy === undefined && modelName !== 'User') {
                createData.updatedBy = currentUserId;
              }
            }

            if (args.update && isRecord(args.update)) {
              const updateData = args.update as Record<string, unknown>;

              const dataKeys = Object.keys(updateData);
              const hasMeaningfulUpdate = dataKeys.some(
                (key: string) => !EXCLUDED_UPDATE_FIELDS.includes(key),
              );

              if (hasMeaningfulUpdate && updateData.updatedBy === undefined) {
                updateData.updatedBy = currentUserId;
              }
            }
          }

          if (operation === 'createMany' && hasUser && args.data) {
            if (Array.isArray(args.data)) {
              const originalData = args.data;
              args.data = originalData.map((item: unknown) => {
                if (!isRecord(item)) return item;

                return {
                  ...item,
                  createdBy: item.createdBy ?? currentUserId,
                  ...(modelName !== 'User' && {
                    updatedBy: item.updatedBy ?? currentUserId,
                  }),
                };
              }) as typeof originalData;
            }
          }

          return query(args);
        },
      },
    },
  });
}
