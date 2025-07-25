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
  username: string;
  joinedAt: Date;
}

export interface TypingUser {
  username: string;
  isTyping: boolean;
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

  public messages$ = this.messagesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public roomUsers$ = this.roomUsersSubject.asObservable();
  public userCount$ = this.userCountSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();
  public notifications$ = this.notificationsSubject.asObservable();

  private currentUserId: string = "";
  private currentUsername: string = "";
  private currentRoomId: string = "";
  private messages: ChatMessage[] = [];
  private typingTimeout: any;

  constructor() {
    this.socket = io(this.SERVER_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    // Connection events
    this.socket.on("connect", () => {
      console.log("Connected to chat server");
      this.connectionStatusSubject.next(true);
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from chat server");
      this.connectionStatusSubject.next(false);
    });

    this.socket.on("connect_error", (error: any) => {
      console.error("Connection error:", error);
      this.connectionStatusSubject.next(false);
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
      (data: { userId: string; username: string; message: string }) => {
        this.notificationsSubject.next(data.message);
      }
    );

    this.socket.on(
      "user-left",
      (data: { userId: string; username: string; message: string }) => {
        this.notificationsSubject.next(data.message);
      }
    );

    this.socket.on(
      "room-users",
      (data: { users: RoomUser[]; totalUsers: number }) => {
        this.roomUsersSubject.next(data.users);
        this.userCountSubject.next(data.totalUsers);
      }
    );

    this.socket.on("user-count-updated", (count: number) => {
      this.userCountSubject.next(count);
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

    // Error handling
    this.socket.on("error", (error: { message: string }) => {
      console.error("Chat error:", error.message);
      this.notificationsSubject.next(`Error: ${error.message}`);
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

    this.socket.emit("join-room", {
      roomId: this.currentRoomId,
      username: this.currentUsername,
      userId: this.currentUserId,
    });
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

  // Leave the current room
  leaveRoom(): void {
    if (this.socket.connected) {
      this.socket.emit("leave-room");
    }

    this.clearMessages();
    this.roomUsersSubject.next([]);
    this.userCountSubject.next(0);
    this.typingUsersSubject.next([]);

    this.currentRoomId = "";
    this.currentUsername = "";
    this.currentUserId = "";
  }

  // Disconnect from chat server
  disconnect(): void {
    this.stopTyping();

    if (this.socket.connected) {
      this.socket.disconnect();
    }

    this.clearMessages();
    this.connectionStatusSubject.next(false);
    this.roomUsersSubject.next([]);
    this.userCountSubject.next(0);
    this.typingUsersSubject.next([]);
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
}
