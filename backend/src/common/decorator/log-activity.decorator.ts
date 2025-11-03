// src/common/decorators/log-activity.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { ActivityType } from '@prisma/client';

export interface ActivityLogConfig {
  type: ActivityType;
  entityType: string;
  description: string;
  includeOldValue?: boolean;
  includeNewValue?: boolean;
  entityIdName?: string | string[];
}

export const LogActivity = (config: ActivityLogConfig) => SetMetadata('activity-log', config);
