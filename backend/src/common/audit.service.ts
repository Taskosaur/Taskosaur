import { Injectable } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

// System user ID for fallback operations
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AuditService {
  /**
   * Get audit data for creation operations
   * @param overrides Optional overrides for createdBy/updatedBy
   * @returns Object with createdBy and optionally updatedBy
   */
  getCreateAuditData(overrides: { createdBy?: string; updatedBy?: string } = {}) {
    const currentUserId = RequestContextService.getCurrentUserId();

    return {
      createdBy: overrides.createdBy || currentUserId || SYSTEM_USER_ID,
      ...(overrides.updatedBy !== undefined && {
        updatedBy: overrides.updatedBy,
      }),
    };
  }

  /**
   * Get audit data for update operations
   * @param overrides Optional override for updatedBy
   * @returns Object with updatedBy
   */
  getUpdateAuditData(overrides: { updatedBy?: string } = {}) {
    const currentUserId = RequestContextService.getCurrentUserId();

    return {
      updatedBy: overrides.updatedBy || currentUserId || SYSTEM_USER_ID,
    };
  }

  /**
   * Get current user ID from request context
   * @returns Current user ID or empty string if not available
   */
  getCurrentUserId(): string {
    return RequestContextService.getCurrentUserId() || SYSTEM_USER_ID;
  }

  /**
   * Get current user from request context
   * @returns Current user object or undefined if not available
   */
  getCurrentUser() {
    return RequestContextService.getCurrentUser();
  }

  /**
   * Check if we have user context
   * @returns True if user context is available
   */
  hasUserContext(): boolean {
    return !!RequestContextService.getCurrentUserId();
  }

  /**
   * Execute a function with a specific user context (useful for system operations)
   * @param userId User ID to set in context
   * @param callback Function to execute
   * @returns Result of the callback
   */
  runWithUserContext<T>(userId: string, callback: () => T): T {
    return RequestContextService.run({ userId }, callback);
  }

  /**
   * Execute a function with full user context (useful for system operations)
   * @param user Full user object to set in context
   * @param callback Function to execute
   * @returns Result of the callback
   */
  runWithFullUserContext<T>(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    },
    callback: () => T,
  ): T {
    return RequestContextService.run({ user }, callback);
  }

  /**
   * Execute a function with system user context
   * @param callback Function to execute
   * @returns Result of the callback
   */
  runAsSystem<T>(callback: () => T): T {
    return RequestContextService.run({ userId: SYSTEM_USER_ID }, callback);
  }

  /**
   * Get the system user ID
   * @returns System user ID constant
   */
  getSystemUserId(): string {
    return SYSTEM_USER_ID;
  }

  /**
   * Check if the current user is the system user
   * @returns True if current user is system user
   */
  isSystemUser(): boolean {
    const currentUserId = RequestContextService.getCurrentUserId();
    return currentUserId === SYSTEM_USER_ID;
  }

  /**
   * Check if a specific user ID is the system user
   * @param userId User ID to check
   * @returns True if the user ID is the system user
   */
  isSystemUserId(userId: string): boolean {
    return userId === SYSTEM_USER_ID;
  }
}
