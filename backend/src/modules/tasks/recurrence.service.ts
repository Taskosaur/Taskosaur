import { Injectable } from '@nestjs/common';
import {
  RecurrenceConfigDto,
  RecurrenceType as DtoRecurrenceType,
  RecurrenceEndType as DtoRecurrenceEndType,
} from './dto/recurrence-config.dto';
import { RecurrenceType, RecurrenceEndType } from '@prisma/client';

@Injectable()
export class RecurrenceService {
  /**
   * Calculate the next occurrence date based on recurrence configuration
   */
  calculateNextOccurrence(
    currentDate: Date,
    recurrenceConfig:
      | RecurrenceConfigDto
      | {
          recurrenceType: RecurrenceType | DtoRecurrenceType;
          interval: number;
          daysOfWeek?: number[];
          dayOfMonth?: number | null;
          monthOfYear?: number | null;
        },
  ): Date {
    const nextDate = new Date(currentDate);

    switch (recurrenceConfig.recurrenceType) {
      case RecurrenceType.DAILY:
      case DtoRecurrenceType.DAILY:
        nextDate.setDate(nextDate.getDate() + recurrenceConfig.interval);
        break;

      case RecurrenceType.WEEKLY:
      case DtoRecurrenceType.WEEKLY:
        if (recurrenceConfig.daysOfWeek && recurrenceConfig.daysOfWeek.length > 0) {
          // Find the next occurrence considering both interval and daysOfWeek
          const sortedDays = [...recurrenceConfig.daysOfWeek].sort((a, b) => a - b);
          const currentDayOfWeek = currentDate.getDay();
          const interval = recurrenceConfig.interval || 1;

          const nextDayInWeek = sortedDays.find((day) => day > currentDayOfWeek);

          if (nextDayInWeek !== undefined) {
            nextDate.setDate(nextDate.getDate() + (nextDayInWeek - currentDayOfWeek));
          } else {
            const daysUntilEndOfWeek = 7 - currentDayOfWeek;
            const firstDayNextCycle = sortedDays[0];
            nextDate.setDate(
              nextDate.getDate() + daysUntilEndOfWeek + 7 * (interval - 1) + firstDayNextCycle,
            );
          }
        } else {
          // No specific days set, just use interval weeks
          nextDate.setDate(nextDate.getDate() + 7 * recurrenceConfig.interval);
        }
        break;

      case RecurrenceType.MONTHLY:
      case DtoRecurrenceType.MONTHLY: {
        const targetMonth = nextDate.getMonth() + recurrenceConfig.interval;
        nextDate.setDate(1);
        nextDate.setMonth(targetMonth);
        const dayToSet = recurrenceConfig.dayOfMonth || currentDate.getDate();
        nextDate.setDate(Math.min(dayToSet, this.getDaysInMonth(nextDate)));
        break;
      }

      case RecurrenceType.QUARTERLY:
      case DtoRecurrenceType.QUARTERLY: {
        const targetMonth = nextDate.getMonth() + 3 * recurrenceConfig.interval;
        nextDate.setDate(1);
        nextDate.setMonth(targetMonth);
        const dayToSet = recurrenceConfig.dayOfMonth || currentDate.getDate();
        nextDate.setDate(Math.min(dayToSet, this.getDaysInMonth(nextDate)));
        break;
      }

      case RecurrenceType.YEARLY:
      case DtoRecurrenceType.YEARLY: {
        nextDate.setDate(1);
        nextDate.setFullYear(nextDate.getFullYear() + recurrenceConfig.interval);
        if (recurrenceConfig.monthOfYear) {
          nextDate.setMonth(recurrenceConfig.monthOfYear - 1);
        }
        const dayToSet = recurrenceConfig.dayOfMonth || currentDate.getDate();
        nextDate.setDate(Math.min(dayToSet, this.getDaysInMonth(nextDate)));
        break;
      }

      case RecurrenceType.CUSTOM:
      case DtoRecurrenceType.CUSTOM:
        // For custom, use interval as days
        nextDate.setDate(nextDate.getDate() + recurrenceConfig.interval);
        break;
    }

    return nextDate;
  }

  /**
   * Check if we should generate the next task instance
   * @param nextOccurrence The next scheduled occurrence date
   * @param leadTimeDays Number of days before occurrence to generate task
   */
  shouldGenerateNextInstance(nextOccurrence: Date, leadTimeDays: number = 1): boolean {
    const now = new Date();
    const leadTime = new Date(nextOccurrence);
    leadTime.setDate(leadTime.getDate() - leadTimeDays);

    return now >= leadTime;
  }

  /**
   * Check if recurrence has reached its end condition
   */
  isRecurrenceComplete(recurringTask: {
    endType: RecurrenceEndType | DtoRecurrenceEndType;
    endDate?: Date | null;
    occurrenceCount?: number | null;
    currentOccurrence: number;
  }): boolean {
    const endTypeStr = String(recurringTask.endType);

    if (endTypeStr === 'NEVER') {
      return false;
    }

    if (endTypeStr === 'ON_DATE') {
      if (!recurringTask.endDate) return false;
      return new Date() >= new Date(recurringTask.endDate);
    }

    if (endTypeStr === 'AFTER_OCCURRENCES') {
      if (!recurringTask.occurrenceCount) return false;
      return recurringTask.currentOccurrence >= recurringTask.occurrenceCount;
    }

    return false;
  }

  /**
   * Get the number of days in a month
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Format recurrence for display (e.g., "Every 2 weeks on Monday, Wednesday")
   */
  formatRecurrence(recurrenceConfig: {
    recurrenceType: RecurrenceType | DtoRecurrenceType;
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number | null;
  }): string {
    const intervalText = recurrenceConfig.interval === 1 ? '' : `${recurrenceConfig.interval} `;
    const daysOfWeekNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    const recTypeStr = String(recurrenceConfig.recurrenceType);

    if (recTypeStr === 'DAILY') {
      return `Every ${intervalText}day${recurrenceConfig.interval > 1 ? 's' : ''}`;
    }

    if (recTypeStr === 'WEEKLY') {
      const days = recurrenceConfig.daysOfWeek?.map((d) => daysOfWeekNames[d]).join(', ') || '';
      return `Every ${intervalText}week${recurrenceConfig.interval > 1 ? 's' : ''}${days ? ` on ${days}` : ''}`;
    }

    if (recTypeStr === 'MONTHLY') {
      const dayOfMonth = recurrenceConfig.dayOfMonth
        ? ` on day ${recurrenceConfig.dayOfMonth}`
        : '';
      return `Every ${intervalText}month${recurrenceConfig.interval > 1 ? 's' : ''}${dayOfMonth}`;
    }

    if (recTypeStr === 'QUARTERLY') {
      return `Every ${intervalText}quarter${recurrenceConfig.interval > 1 ? 's' : ''}`;
    }

    if (recTypeStr === 'YEARLY') {
      return `Every ${intervalText}year${recurrenceConfig.interval > 1 ? 's' : ''}`;
    }

    if (recTypeStr === 'CUSTOM') {
      return `Every ${recurrenceConfig.interval} days`;
    }

    return 'Unknown recurrence';
  }
}
