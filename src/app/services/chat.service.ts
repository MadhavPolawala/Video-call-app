import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { io, Socket } from "socket.io-client";

export interface ChatMessage {
  id: string | number;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  isOwn?: boolean;
  roomId?: string;
}

export interface RoomUser {
  userId?: string;
  username: string;
  joinedAt: Date;
  isActive?: boolean;
}

export interface TypingUser {
  username: string;
  isTyping: boolean;
}

export interface RoomInfo {
  roomId: string;
  userCount: number;
  maxUsers: number;
  createdAt: Date;
  isFull: boolean;
}

@Injectable({
  providedIn: "root",
})
export class ChatService {
  private socket: Socket;
  private readonly SERVER_URL = "https://node-chat-socket-khd7.onrender.com";

  // Observables for real-time updates
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private roomUsersSubject = new BehaviorSubject<RoomUser[]>([]);
  private userCountSubject = new BehaviorSubject<number>(0);
  private typingUsersSubject = new BehaviorSubject<TypingUser[]>([]);
  private notificationsSubject = new BehaviorSubject<string>("");
  private roomInfoSubject = new BehaviorSubject<RoomInfo | null>(null);
  private errorSubject = new BehaviorSubject<string>("");

  public messages$ = this.messagesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public roomUsers$ = this.roomUsersSubject.asObservable();
  public userCount$ = this.userCountSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();
  public notifications$ = this.notificationsSubject.asObservable();
  public roomInfo$ = this.roomInfoSubject.asObservable();
  public errors$ = this.errorSubject.asObservable();

  private currentUserId: string = "";
  private currentUsername: string = "";
  private currentRoomId: string = "";
  private messages: ChatMessage[] = [];
  private typingTimeout: any;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.socket = io(this.SERVER_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    // Connection events
    this.socket.on("connect", () => {
      console.log("Connected to chat server");
      this.connectionStatusSubject.next(true);
      this.reconnectAttempts = 0;
      this.notificationsSubject.next("Connected to chat server");
    });

    this.socket.on("disconnect", (reason: string) => {
      console.log("Disconnected from chat server:", reason);
      this.connectionStatusSubject.next(false);
      this.notificationsSubject.next("Disconnected from chat server");
    });

    this.socket.on("connect_error", (error: any) => {
      console.error("Connection error:", error);
      this.connectionStatusSubject.next(false);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.errorSubject.next(
          "Failed to connect to chat server. Please refresh and try again."
        );
      }
    });

    this.socket.on("reconnect", (attemptNumber: number) => {
      console.log("Reconnected to server after", attemptNumber, "attempts");
      this.notificationsSubject.next("Reconnected to chat server");
    });

    // Chat message events
    this.socket.on("new-message", (message: ChatMessage) => {
      message.isOwn = message.userId === this.currentUserId;
      message.timestamp = new Date(message.timestamp);

      this.messages.push(message);
      this.messagesSubject.next([...this.messages]);
    });

    this.socket.on("previous-messages", (messages: ChatMessage[]) => {
      this.messages = messages.map((msg) => ({
        ...msg,
        isOwn: msg.userId === this.currentUserId,
        timestamp: new Date(msg.timestamp),
      }));
      this.messagesSubject.next([...this.messages]);
    });

    // User events
    this.socket.on(
      "user-joined",
      (data: {
        userId: string;
        username: string;
        message: string;
        userCount: number;
      }) => {
        this.notificationsSubject.next(data.message);
        this.userCountSubject.next(data.userCount);
      }
    );

    this.socket.on(
      "user-left",
      (data: {
        userId: string;
        username: string;
        message: string;
        userCount: number;
      }) => {
        this.notificationsSubject.next(data.message);
        this.userCountSubject.next(data.userCount);
      }
    );

    this.socket.on(
      "room-users",
      (data: { users: RoomUser[]; totalUsers: number; maxUsers: number }) => {
        this.roomUsersSubject.next(data.users);
        this.userCountSubject.next(data.totalUsers);

        // Update room info
        const currentRoomInfo = this.roomInfoSubject.value;
        if (currentRoomInfo) {
          this.roomInfoSubject.next({
            ...currentRoomInfo,
            userCount: data.totalUsers,
            maxUsers: data.maxUsers,
          });
        }
      }
    );

    this.socket.on("user-count-updated", (count: number) => {
      this.userCountSubject.next(count);
    });

    // Room events
    this.socket.on("welcome", (data: { message: string; roomInfo: any }) => {
      this.notificationsSubject.next(data.message);
      this.roomInfoSubject.next({
        roomId: data.roomInfo.roomId,
        userCount: data.roomInfo.userCount,
        maxUsers: data.roomInfo.maxUsers,
        createdAt: new Date(data.roomInfo.createdAt),
        isFull: data.roomInfo.userCount >= data.roomInfo.maxUsers,
      });
    });

    this.socket.on(
      "room-full",
      (data: { message: string; maxUsers: number }) => {
        this.errorSubject.next(
          `Room is full (${data.maxUsers} users maximum). Please try again later.`
        );
      }
    );

    this.socket.on("room-closed", (data: { message: string }) => {
      this.errorSubject.next(data.message);
      this.disconnect();
    });

    this.socket.on("server-shutdown", (data: { message: string }) => {
      this.notificationsSubject.next(data.message);
    });

    // Typing events
    this.socket.on("user-typing", (data: TypingUser) => {
      const currentTypingUsers = this.typingUsersSubject.value;
      const existingIndex = currentTypingUsers.findIndex(
        (user) => user.username === data.username
      );

      if (data.isTyping) {
        if (existingIndex === -1) {
          this.typingUsersSubject.next([...currentTypingUsers, data]);
        }
      } else {
        if (existingIndex !== -1) {
          const updatedUsers = currentTypingUsers.filter(
            (user) => user.username !== data.username
          );
          this.typingUsersSubject.next(updatedUsers);
        }
      }
    });

    // User status events (for future features)
    this.socket.on(
      "user-status-updated",
      (data: { userId: string; username: string; status: any }) => {
        console.log("User status updated:", data);
        // Handle user status updates (mute/unmute, video on/off, etc.)
      }
    );

    // Error handling
    this.socket.on("error", (error: { message: string }) => {
      console.error("Chat error:", error.message);
      this.errorSubject.next(error.message);
    });
  }

  // Connect to chat server and join room
  joinRoom(roomId: string, username: string, userId?: string): void {
    this.currentRoomId = roomId;
    this.currentUsername = username;
    this.currentUserId = userId || this.generateUserId();

    if (!this.socket.connected) {
      this.socket.connect();
    }

    // Wait for connection before joining room
    if (this.socket.connected) {
      this.emitJoinRoom();
    } else {
      this.socket.once("connect", () => {
        this.emitJoinRoom();
      });
    }
  }

  private emitJoinRoom(): void {
    this.socket.emit("join-room", {
      roomId: this.currentRoomId,
      username: this.currentUsername,
      userId: this.currentUserId,
    });
  }

  // Check if room exists and get info
  getRoomInfo(roomId: string): void {
    if (this.socket.connected) {
      this.socket.emit("get-room-info", { roomId });

      this.socket.once("room-info", (data: any) => {
        if (data.exists) {
          this.roomInfoSubject.next({
            roomId: data.roomId,
            userCount: data.userCount,
            maxUsers: data.maxUsers,
            createdAt: new Date(data.createdAt),
            isFull: data.isFull,
          });
        } else {
          this.roomInfoSubject.next(null);
        }
      });
    }
  }

  // Create a new room
  createRoom(roomId: string, username: string, maxUsers: number = 10): void {
    if (this.socket.connected) {
      this.socket.emit("create-room", {
        roomId,
        username,
        userId: this.generateUserId(),
        maxUsers,
      });

      this.socket.once("room-created", (data: any) => {
        this.notificationsSubject.next(data.message);
        // Auto-join the created room
        this.joinRoom(roomId, username);
      });
    }
  }

  // Send a chat message
  sendMessage(message: string): void {
    if (!message.trim() || !this.socket.connected) {
      return;
    }

    this.socket.emit("send-message", {
      roomId: this.currentRoomId,
      message: message.trim(),
      username: this.currentUsername,
      userId: this.currentUserId,
    });
  }

  // Typing indicators
  startTyping(): void {
    if (this.currentRoomId && this.socket.connected) {
      this.socket.emit("typing-start", {
        roomId: this.currentRoomId,
        username: this.currentUsername,
      });

      // Clear previous timeout
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      // Stop typing after 3 seconds of inactivity
      this.typingTimeout = setTimeout(() => {
        this.stopTyping();
      }, 3000);
    }
  }

  stopTyping(): void {
    if (this.currentRoomId && this.socket.connected) {
      this.socket.emit("typing-stop", {
        roomId: this.currentRoomId,
        username: this.currentUsername,
      });
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  // Update user status (for future features like mute/video indicators)
  updateUserStatus(status: any): void {
    if (this.currentRoomId && this.socket.connected) {
      this.socket.emit("update-user-status", {
        roomId: this.currentRoomId,
        userId: this.currentUserId,
        status: status,
      });
    }
  }

  // Leave the current room
  leaveRoom(): void {
    if (this.socket.connected) {
      this.socket.emit("leave-room");
    }

    this.clearState();
  }

  // Disconnect from chat server
  disconnect(): void {
    this.stopTyping();

    if (this.socket.connected) {
      this.socket.disconnect();
    }

    this.clearState();
    this.connectionStatusSubject.next(false);
  }

  // Clear all state
  private clearState(): void {
    this.messages = [];
    this.messagesSubject.next([]);
    this.roomUsersSubject.next([]);
    this.userCountSubject.next(0);
    this.typingUsersSubject.next([]);
    this.roomInfoSubject.next(null);

    this.currentRoomId = "";
    this.currentUsername = "";
    this.currentUserId = "";
  }

  // Clear all messages
  clearMessages(): void {
    this.messages = [];
    this.messagesSubject.next([]);
  }

  // Get current connection status
  isConnected(): boolean {
    return this.socket.connected;
  }

  // Get current room info
  getCurrentRoom(): { roomId: string; username: string; userId: string } {
    return {
      roomId: this.currentRoomId,
      username: this.currentUsername,
      userId: this.currentUserId,
    };
  }

  // Generate a unique user ID
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get messages as array (for compatibility)
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  // Method for backward compatibility
  public sendMessageOld(message: string): void {
    this.sendMessage(message);
  }

  // Utility method to clear errors
  clearErrors(): void {
    this.errorSubject.next("");
  }

  // Force reconnection
  forceReconnect(): void {
    this.socket.disconnect();
    this.socket.connect();
  }

  // Get connection statistics
  getConnectionStats(): any {
    return {
      connected: this.socket.connected,
      id: this.socket.id,
      transport: this.socket.io.engine?.transport?.name,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }
}
