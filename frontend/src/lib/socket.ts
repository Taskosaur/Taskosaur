import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;
  private connected = false;

  connect(token: string, eventsNamespace = "/events") {
    if (this.socket?.connected) {
      console.log("[SocketService] Socket already connected");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const socketUrl = apiUrl.replace("/api", "");

    console.log("[SocketService] Connecting to:", `${socketUrl}${eventsNamespace}`);

    this.socket = io(`${socketUrl}${eventsNamespace}`, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on("connect", () => {
      console.log("[SocketService] Socket connected:", this.socket?.id);
      this.connected = true;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[SocketService] Socket disconnected:", reason);
      this.connected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("[SocketService] Connection error:", error);
      this.connected = false;
    });

    // Listen for user status events and dispatch to window
    this.socket.on("user:online", (data) => {
      console.log("[SocketService] User online event:", data);
      window.dispatchEvent(new CustomEvent("user:online", { detail: data }));
    });

    this.socket.on("user:offline", (data) => {
      console.log("[SocketService] User offline event:", data);
      window.dispatchEvent(new CustomEvent("user:offline", { detail: data }));
    });

    // Listen for other real-time events
    this.socket.on("connected", (data) => {
      console.log("[SocketService] Connected to socket:", data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  // Join a room
  joinRoom(room: string) {
    if (this.socket) {
      this.socket.emit(`join:${room}`, { [`${room}Id`]: room });
    }
  }

  // Leave a room
  leaveRoom(room: string) {
    if (this.socket) {
      this.socket.emit(`leave:${room}`, { [`${room}Id`]: room });
    }
  }

  // Subscribe to events
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Unsubscribe from events
  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Emit events
  emit(event: string, ...args: any[]) {
    if (this.socket) {
      this.socket.emit(event, ...args);
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Hook helper for React
export const initializeSocket = (token: string) => {
  socketService.connect(token);
};

export const disconnectSocket = () => {
  socketService.disconnect();
};

export const getSocket = () => socketService.getSocket();
