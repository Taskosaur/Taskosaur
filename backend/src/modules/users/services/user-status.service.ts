import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventsGateway } from '../../../gateway/events.gateway';

export interface UserStatusInfo {
  isOnline: boolean;
  lastSeen?: string;
  socketCount?: number;
}

/**
 * Service to manage user online status
 * Integrates with EventsGateway to track WebSocket connections
 */
@Injectable()
export class UserStatusService implements OnModuleInit {
  private readonly logger = new Logger(UserStatusService.name);
  private eventsGateway?: EventsGateway;
  private userLastSeen = new Map<string, string>(); // userId -> ISO timestamp

  constructor() {}

  onModuleInit() {
    // EventsGateway will be set via setter injection to avoid circular dependency
  }

  setEventsGateway(gateway: EventsGateway) {
    this.eventsGateway = gateway;
    this.logger.log('EventsGateway connected to UserStatusService');
  }

  /**
   * Check if a user is currently online
   */
  isUserOnline(userId: string): boolean {
    if (!this.eventsGateway) {
      this.logger.warn('EventsGateway not initialized');
      return false;
    }
    return this.eventsGateway.isUserOnline(userId);
  }

  /**
   * Get detailed status information for a user
   */
  getUserStatus(userId: string): UserStatusInfo {
    const isOnline = this.isUserOnline(userId);
    const lastSeen = this.userLastSeen.get(userId) || new Date().toISOString();

    return {
      isOnline,
      lastSeen,
    };
  }

  /**
   * Get status for multiple users at once
   */
  getUsersStatus(userIds: string[]): Map<string, UserStatusInfo> {
    const statusMap = new Map<string, UserStatusInfo>();

    for (const userId of userIds) {
      statusMap.set(userId, this.getUserStatus(userId));
    }

    return statusMap;
  }

  /**
   * Update last seen timestamp for a user
   */
  updateLastSeen(userId: string): void {
    const timestamp = new Date().toISOString();
    this.userLastSeen.set(userId, timestamp);
    this.logger.debug(`User ${userId} last seen: ${timestamp}`);
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): string[] {
    if (!this.eventsGateway) {
      return [];
    }
    // This would require a new method in EventsGateway to get all connected user IDs
    return [];
  }

  /**
   * Get online users in a specific room (project, workspace, etc.)
   */
  getOnlineUsersInRoom(room: string): string[] {
    if (!this.eventsGateway) {
      return [];
    }
    return this.eventsGateway.getOnlineUsersInRoom(room);
  }

  /**
   * Clean up old lastSeen entries (older than 24 hours)
   */
  cleanupOldEntries(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [userId, timestamp] of this.userLastSeen.entries()) {
      const entryTime = new Date(timestamp).getTime();
      if (now - entryTime > maxAge) {
        this.userLastSeen.delete(userId);
        this.logger.debug(`Cleaned up old lastSeen for user ${userId}`);
      }
    }
  }
}
