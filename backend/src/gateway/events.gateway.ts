import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedUsers = new Map<string, string[]>(); // userId -> socketIds[]

  constructor(private jwtService: JwtService) {}

  afterInit() {
    this.logger.log('EventsGateway initialized on /events namespace');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token = client.handshake.auth.token || client.handshake.query.token;

      if (!token) {
        this.logger.warn(`Client ${client.id} attempted to connect without token`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token as string);
      client.userId = payload.sub;

      if (!client.userId) {
        this.logger.warn(`Client ${client.id} connected with invalid token payload (no sub)`);
        client.emit('error', { message: 'Invalid token payload' });
        client.disconnect();
        return;
      }

      // Track user connections
      let userSockets = this.connectedUsers.get(client.userId);
      if (!userSockets) {
        userSockets = [];
      }
      const wasOffline = userSockets.length === 0;
      userSockets.push(client.id);
      this.connectedUsers.set(client.userId, userSockets);

      this.logger.log(`User ${client.userId} connected with socket ${client.id}`);

      // Join user to their personal room
      await client.join(`user:${client.userId}`);

      // Emit connection confirmation
      client.emit('connected', {
        userId: client.userId,
        socketId: client.id,
        timestamp: new Date().toISOString(),
      });

      // Broadcast user:online event if this is their first connection
      if (wasOffline) {
        this.server.emit('user:online', {
          userId: client.userId,
          isOnline: true,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Authentication failed for socket ${client.id}: ${error.message}`);
      client.emit('error', { message: 'Authentication failed', details: error.message });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    try {
      if (client.userId) {
        // Remove socket from user's connections
        const userSockets = this.connectedUsers.get(client.userId) || [];
        const updatedSockets = userSockets.filter((socketId) => socketId !== client.id);

        if (updatedSockets.length === 0) {
          this.connectedUsers.delete(client.userId);

          // Broadcast user:offline event when user has no more connections
          this.server.emit('user:offline', {
            userId: client.userId,
            isOnline: false,
            lastSeen: new Date().toISOString(),
          });
        } else {
          this.connectedUsers.set(client.userId, updatedSockets);
        }

        this.logger.log(`User ${client.userId} disconnected socket ${client.id}`);
      }

      // Clean up room memberships
      const roomsToLeave: string[] = [];

      if (client.organizationId) {
        roomsToLeave.push(`org:${client.organizationId}`);
      }
      if (client.workspaceId) {
        roomsToLeave.push(`workspace:${client.workspaceId}`);
      }
      if (client.projectId) {
        roomsToLeave.push(`project:${client.projectId}`);
      }

      // Leave all rooms the client was part of
      for (const room of roomsToLeave) {
        await client.leave(room);
      }

      // Leave personal room
      if (client.userId) {
        await client.leave(`user:${client.userId}`);
      }
    } catch (error) {
      this.logger.error(`Error handling disconnect for socket ${client.id}: ${error.message}`);
    }
  }

  // Join organization room
  @SubscribeMessage('join:organization')
  async joinOrganization(
    @MessageBody() data: { organizationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!data.organizationId) {
        client.emit('error', { message: 'Organization ID is required' });
        return;
      }

      client.organizationId = data.organizationId;
      await client.join(`org:${data.organizationId}`);
      client.emit('joined:organization', { organizationId: data.organizationId });
      this.logger.log(`User ${client.userId} joined organization ${data.organizationId}`);
    } catch (error) {
      this.logger.error(`Error joining organization: ${error.message}`);
      client.emit('error', { message: 'Failed to join organization', details: error.message });
    }
  }

  // Join workspace room
  @SubscribeMessage('join:workspace')
  async joinWorkspace(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!data.workspaceId) {
        client.emit('error', { message: 'Workspace ID is required' });
        return;
      }

      client.workspaceId = data.workspaceId;
      await client.join(`workspace:${data.workspaceId}`);
      client.emit('joined:workspace', { workspaceId: data.workspaceId });
      this.logger.log(`User ${client.userId} joined workspace ${data.workspaceId}`);
    } catch (error) {
      this.logger.error(`Error joining workspace: ${error.message}`);
      client.emit('error', { message: 'Failed to join workspace', details: error.message });
    }
  }

  // Join project room
  @SubscribeMessage('join:project')
  async joinProject(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!data.projectId) {
        client.emit('error', { message: 'Project ID is required' });
        return;
      }

      client.projectId = data.projectId;
      await client.join(`project:${data.projectId}`);
      client.emit('joined:project', { projectId: data.projectId });
      this.logger.log(`User ${client.userId} joined project ${data.projectId}`);
    } catch (error) {
      this.logger.error(`Error joining project: ${error.message}`);
      client.emit('error', { message: 'Failed to join project', details: error.message });
    }
  }

  // Join task room for task-specific updates
  @SubscribeMessage('join:task')
  async joinTask(
    @MessageBody() data: { taskId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!data.taskId) {
        client.emit('error', { message: 'Task ID is required' });
        return;
      }

      await client.join(`task:${data.taskId}`);
      client.emit('joined:task', { taskId: data.taskId });
      this.logger.log(`User ${client.userId} joined task ${data.taskId}`);
    } catch (error) {
      this.logger.error(`Error joining task: ${error.message}`);
      client.emit('error', { message: 'Failed to join task', details: error.message });
    }
  }

  // Leave rooms
  @SubscribeMessage('leave:organization')
  async leaveOrganization(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      if (!client.organizationId) {
        client.emit('error', { message: 'Not joined to any organization' });
        return;
      }

      await client.leave(`org:${client.organizationId}`);
      const organizationId = client.organizationId;
      client.organizationId = undefined;
      client.emit('left:organization', { organizationId });
      this.logger.log(`User ${client.userId} left organization ${organizationId}`);
    } catch (error) {
      this.logger.error(`Error leaving organization: ${error.message}`);
      client.emit('error', { message: 'Failed to leave organization', details: error.message });
    }
  }

  @SubscribeMessage('leave:workspace')
  async leaveWorkspace(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      if (!client.workspaceId) {
        client.emit('error', { message: 'Not joined to any workspace' });
        return;
      }

      await client.leave(`workspace:${client.workspaceId}`);
      const workspaceId = client.workspaceId;
      client.workspaceId = undefined;
      client.emit('left:workspace', { workspaceId });
      this.logger.log(`User ${client.userId} left workspace ${workspaceId}`);
    } catch (error) {
      this.logger.error(`Error leaving workspace: ${error.message}`);
      client.emit('error', { message: 'Failed to leave workspace', details: error.message });
    }
  }

  @SubscribeMessage('leave:project')
  async leaveProject(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      if (!client.projectId) {
        client.emit('error', { message: 'Not joined to any project' });
        return;
      }

      await client.leave(`project:${client.projectId}`);
      const projectId = client.projectId;
      client.projectId = undefined;
      client.emit('left:project', { projectId });
      this.logger.log(`User ${client.userId} left project ${projectId}`);
    } catch (error) {
      this.logger.error(`Error leaving project: ${error.message}`);
      client.emit('error', { message: 'Failed to leave project', details: error.message });
    }
  }

  @SubscribeMessage('leave:task')
  async leaveTask(
    @MessageBody() data: { taskId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!data.taskId) {
        client.emit('error', { message: 'Task ID is required' });
        return;
      }

      await client.leave(`task:${data.taskId}`);
      client.emit('left:task', { taskId: data.taskId });
      this.logger.log(`User ${client.userId} left task ${data.taskId}`);
    } catch (error) {
      this.logger.error(`Error leaving task: ${error.message}`);
      client.emit('error', { message: 'Failed to leave task', details: error.message });
    }
  }

  // Real-time event broadcasting methods

  // Task events
  emitTaskCreated(projectId: string, task: any) {
    this.server.to(`project:${projectId}`).emit('task:created', {
      event: 'task:created',
      data: task,
      timestamp: new Date().toISOString(),
    });
  }

  emitTaskUpdated(projectId: string, taskId: string, updates: any) {
    this.server.to(`project:${projectId}`).emit('task:updated', {
      event: 'task:updated',
      data: { taskId, updates },
      timestamp: new Date().toISOString(),
    });

    // Also emit to task-specific room
    this.server.to(`task:${taskId}`).emit('task:updated', {
      event: 'task:updated',
      data: { taskId, updates },
      timestamp: new Date().toISOString(),
    });
  }

  emitTaskDeleted(projectId: string, taskId: string) {
    this.server.to(`project:${projectId}`).emit('task:deleted', {
      event: 'task:deleted',
      data: { taskId },
      timestamp: new Date().toISOString(),
    });
  }

  emitTaskStatusChanged(projectId: string, taskId: string, statusChange: any) {
    this.server.to(`project:${projectId}`).emit('task:status_changed', {
      event: 'task:status_changed',
      data: { taskId, statusChange },
      timestamp: new Date().toISOString(),
    });
  }

  emitTaskAssigned(projectId: string, taskId: string, assignment: any) {
    this.server.to(`project:${projectId}`).emit('task:assigned', {
      event: 'task:assigned',
      data: { taskId, assignment },
      timestamp: new Date().toISOString(),
    });

    // Also notify the assigned user directly
    if (assignment.assigneeId) {
      this.server.to(`user:${assignment.assigneeId}`).emit('task:assigned', {
        event: 'task:assigned',
        data: { taskId, assignment },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Comment events
  emitCommentAdded(projectId: string, taskId: string, comment: any) {
    this.server.to(`project:${projectId}`).emit('comment:added', {
      event: 'comment:added',
      data: { taskId, comment },
      timestamp: new Date().toISOString(),
    });

    this.server.to(`task:${taskId}`).emit('comment:added', {
      event: 'comment:added',
      data: { taskId, comment },
      timestamp: new Date().toISOString(),
    });
  }

  // Time tracking events
  emitTimeEntryStarted(projectId: string, taskId: string, timeEntry: any) {
    this.server.to(`project:${projectId}`).emit('time:started', {
      event: 'time:started',
      data: { taskId, timeEntry },
      timestamp: new Date().toISOString(),
    });
  }

  emitTimeEntryStopped(projectId: string, taskId: string, timeEntry: any) {
    this.server.to(`project:${projectId}`).emit('time:stopped', {
      event: 'time:stopped',
      data: { taskId, timeEntry },
      timestamp: new Date().toISOString(),
    });
  }

  // Project events
  emitProjectUpdated(workspaceId: string, projectId: string, updates: any) {
    this.server.to(`workspace:${workspaceId}`).emit('project:updated', {
      event: 'project:updated',
      data: { projectId, updates },
      timestamp: new Date().toISOString(),
    });
  }

  // Sprint events
  emitSprintStarted(projectId: string, sprint: any) {
    this.server.to(`project:${projectId}`).emit('sprint:started', {
      event: 'sprint:started',
      data: sprint,
      timestamp: new Date().toISOString(),
    });
  }

  emitSprintCompleted(projectId: string, sprint: any) {
    this.server.to(`project:${projectId}`).emit('sprint:completed', {
      event: 'sprint:completed',
      data: sprint,
      timestamp: new Date().toISOString(),
    });
  }

  // Notification events
  emitNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', {
      event: 'notification',
      data: notification,
      timestamp: new Date().toISOString(),
    });
  }

  // Typing indicators for comments
  emitUserTyping(taskId: string, user: any) {
    this.server.to(`task:${taskId}`).emit('user:typing', {
      event: 'user:typing',
      data: { taskId, user },
      timestamp: new Date().toISOString(),
    });
  }

  emitUserStoppedTyping(taskId: string, user: any) {
    this.server.to(`task:${taskId}`).emit('user:stopped_typing', {
      event: 'user:stopped_typing',
      data: { taskId, user },
      timestamp: new Date().toISOString(),
    });
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get all online users in a room
  getOnlineUsersInRoom(room: string): string[] {
    const clients = this.server.sockets.adapter.rooms.get(room);
    if (!clients) return [];

    const onlineUsers: string[] = [];
    for (const socketId of clients) {
      const socket = this.server.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (socket?.userId) {
        onlineUsers.push(socket.userId);
      }
    }
    return [...new Set(onlineUsers)]; // Remove duplicates
  }
}
