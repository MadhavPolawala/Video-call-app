import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AgoraService } from "../../services/agora.service";
import {
  ChatService,
  ChatMessage,
  RoomUser,
  TypingUser,
} from "../../services/chat.service";
import { ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { Subscription } from "rxjs";

@Component({
  selector: "app-video-call",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./video-call.component.html",
  styleUrl: "./video-call.component.css",
})
export class VideoCallComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("localVideo") localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild("remoteVideo") remoteVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild("chatMessages") chatMessagesRef!: ElementRef<HTMLDivElement>;
  @ViewChild("chatInput") chatInputRef!: ElementRef<HTMLInputElement>;

  // Video call properties
  username = "";
  channelName = "";
  connectionStatus = "Connecting...";
  isMicEnabled = true;
  isVideoEnabled = true;
  isScreenSharing = false;
  isScreenShareSupported = false;
  isCameraSwitchSupported = false;
  remoteUserConnected = false;

  private localVideoTrack: ILocalVideoTrack | null = null;
  private localAudioTrack: ILocalAudioTrack | null = null;
  private remoteUsersSubscription: Subscription | null = null;

  // Chat properties
  isChatOpen = false;
  newMessage = "";
  messages: ChatMessage[] = [];
  notifications: string[] = [];
  typingUsers: TypingUser[] = [];
  userCount = 0;
  isConnectedToChat = false;
  unreadMessageCount = 0;

  private chatSubscriptions: Subscription[] = [];
  private userId = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private agoraService: AgoraService,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    this.isScreenShareSupported = this.agoraService.isScreenShareSupported();
    this.isCameraSwitchSupported = this.agoraService.isCameraSwitchSupported();

    this.route.queryParams.subscribe((params) => {
      this.username = params["username"] || "";
      this.channelName = params["channel"] || "";

      if (!this.username || !this.channelName) {
        this.router.navigate(["/"]);
        return;
      }

      this.initializeCall();
      this.initializeChat();
    });

    this.remoteUsersSubscription = this.agoraService.remoteUsers$.subscribe(
      (remoteUsers) => {
        this.updateRemoteVideo(remoteUsers);
      }
    );
  }

  ngAfterViewInit() {
    // ViewChild elements are now available
  }

  ngOnDestroy() {
    this.leaveCall();
    this.disconnectChat();
    if (this.remoteUsersSubscription) {
      this.remoteUsersSubscription.unsubscribe();
    }
    this.chatSubscriptions.forEach((sub) => sub.unsubscribe());
  }

  private async initializeCall() {
    try {
      const uid = Math.floor(Math.random() * 10000);
      const tracks = await this.agoraService.joinChannel(this.channelName, uid);

      this.localVideoTrack = tracks.videoTrack;
      this.localAudioTrack = tracks.audioTrack;

      if (this.localVideoTrack && this.localVideoRef) {
        this.localVideoTrack.play(this.localVideoRef.nativeElement);
      }

      this.connectionStatus = "Connected";
      this.isCameraSwitchSupported =
        this.agoraService.isCameraSwitchSupported();
    } catch (error) {
      console.error("Failed to initialize call:", error);
      this.connectionStatus = "Connection failed";
    }
  }

  private initializeChat() {
    this.userId = this.generateUserId();

    // Subscribe to chat observables
    const messagesSubscription = this.chatService.messages$.subscribe(
      (messages) => {
        const previousCount = this.messages.length;
        this.messages = messages;

        // Count unread messages if chat is closed
        if (!this.isChatOpen && messages.length > previousCount) {
          const newMessages = messages.slice(previousCount);
          const unreadMessages = newMessages.filter((msg) => !msg.isOwn);
          this.unreadMessageCount += unreadMessages.length;
        }

        // Auto scroll to bottom when new messages arrive
        setTimeout(() => this.scrollToBottom(), 100);
      }
    );

    const connectionSubscription = this.chatService.connectionStatus$.subscribe(
      (isConnected) => {
        this.isConnectedToChat = isConnected;
      }
    );

    const userCountSubscription = this.chatService.userCount$.subscribe(
      (count) => {
        this.userCount = count;
      }
    );

    const typingSubscription = this.chatService.typingUsers$.subscribe(
      (users) => {
        this.typingUsers = users;
        setTimeout(() => this.scrollToBottom(), 100);
      }
    );

    const notificationsSubscription = this.chatService.notifications$.subscribe(
      (notification) => {
        if (notification) {
          this.notifications.push(notification);
          // Keep only last 10 notifications
          if (this.notifications.length > 10) {
            this.notifications = this.notifications.slice(-10);
          }
          setTimeout(() => this.scrollToBottom(), 100);
        }
      }
    );

    this.chatSubscriptions.push(
      messagesSubscription,
      connectionSubscription,
      userCountSubscription,
      typingSubscription,
      notificationsSubscription
    );

    // Join the chat room
    this.chatService.joinRoom(this.channelName, this.username, this.userId);
  }

  private disconnectChat() {
    this.chatService.disconnect();
    this.chatSubscriptions.forEach((sub) => sub.unsubscribe());
    this.chatSubscriptions = [];
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  shareInvite() {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("username", "Guest");
    const shareUrl = currentUrl.toString();

    const text = `Join my video call: ${shareUrl}`;

    if (navigator.share) {
      navigator
        .share({
          title: "Video Call",
          text: text,
          url: shareUrl,
        })
        .catch((err) => console.log("Share failed:", err));
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Link copied! You can share it on WhatsApp or anywhere else.");
    }
  }

  private updateRemoteVideo(remoteUsers: any[]) {
    if (remoteUsers.length > 0) {
      this.remoteUserConnected = true;
      const remoteUser = remoteUsers[0];

      if (remoteUser.videoTrack && this.remoteVideoRef) {
        const videoElement = this.remoteVideoRef.nativeElement;
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
        remoteUser.videoTrack.play(videoElement);
      } else if (!remoteUser.videoTrack && this.remoteVideoRef) {
        const videoElement = this.remoteVideoRef.nativeElement;
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
      }
    } else {
      this.remoteUserConnected = false;
      if (this.remoteVideoRef) {
        const videoElement = this.remoteVideoRef.nativeElement;
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
      }
    }
  }

  // Chat Methods
  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
    if (this.isChatOpen) {
      this.unreadMessageCount = 0;
      setTimeout(() => {
        this.scrollToBottom();
        if (this.chatInputRef) {
          this.chatInputRef.nativeElement.focus();
        }
      }, 300);
    }
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.isConnectedToChat) {
      return;
    }

    this.chatService.sendMessage(this.newMessage.trim());
    this.newMessage = "";
    this.chatService.stopTyping();

    setTimeout(() => this.scrollToBottom(), 100);
  }

  onTyping() {
    if (this.newMessage.trim()) {
      this.chatService.startTyping();
    } else {
      this.chatService.stopTyping();
    }
  }

  stopTyping() {
    this.chatService.stopTyping();
  }

  private scrollToBottom() {
    if (this.chatMessagesRef) {
      const element = this.chatMessagesRef.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  trackByMessageId(index: number, message: ChatMessage): any {
    return message.id;
  }

  formatMessageTime(timestamp: Date): string {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor(
      (now.getTime() - messageTime.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      // 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      return (
        messageTime.toLocaleDateString() +
        " " +
        messageTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  }

  getTypingUsersText(): string {
    if (this.typingUsers.length === 0) return "";
    if (this.typingUsers.length === 1) {
      return `${this.typingUsers[0].username} is typing...`;
    } else if (this.typingUsers.length === 2) {
      return `${this.typingUsers[0].username} and ${this.typingUsers[1].username} are typing...`;
    } else {
      return `${this.typingUsers.length} people are typing...`;
    }
  }

  // Video Control Methods
  async toggleMicrophone() {
    this.isMicEnabled = await this.agoraService.toggleMicrophone();
  }

  async toggleCamera() {
    this.isVideoEnabled = await this.agoraService.toggleCamera();
  }

  async switchCamera() {
    try {
      const newVideoTrack = await this.agoraService.switchCamera();
      if (newVideoTrack && this.localVideoRef) {
        this.localVideoTrack = newVideoTrack;
        newVideoTrack.play(this.localVideoRef.nativeElement);
      }
    } catch (error) {
      console.error("Failed to switch camera:", error);
    }
  }

  getCurrentCameraLabel(): string {
    if (!this.isCameraSwitchSupported || this.isScreenSharing) {
      return "";
    }
    const facingMode = this.agoraService.getCurrentFacingMode();
    return facingMode === "user" ? "(Front Camera)" : "(Rear Camera)";
  }

  getCameraSwitchButtonClass(): string {
    if (!this.isVideoEnabled || this.isScreenSharing) {
      return "control-btn bg-gray-400 text-gray-600 cursor-not-allowed";
    }
    return "control-btn bg-gray-600 text-white hover:bg-gray-500";
  }

  getCameraSwitchTooltip(): string {
    if (!this.isVideoEnabled) {
      return "Enable camera to switch";
    }
    if (this.isScreenSharing) {
      return "Stop screen sharing to switch camera";
    }
    return "Switch camera";
  }

  async toggleScreenShare() {
    if (!this.isScreenShareSupported) {
      alert("Screen sharing is not supported on this device");
      return;
    }

    if (this.isScreenSharing) {
      await this.agoraService.stopScreenShare();
      this.isScreenSharing = false;

      if (this.localVideoTrack && this.localVideoRef) {
        this.localVideoTrack.play(this.localVideoRef.nativeElement);
      }
    } else {
      const screenTrack = await this.agoraService.startScreenShare();
      if (screenTrack) {
        this.isScreenSharing = true;
        if (this.localVideoRef) {
          screenTrack.play(this.localVideoRef.nativeElement);
        }
      } else {
        alert("Failed to start screen sharing. Please try again.");
      }
    }
  }

  getScreenShareButtonClass(): string {
    if (!this.isScreenShareSupported) {
      return "control-btn bg-gray-400 text-gray-600 cursor-not-allowed";
    }
    return this.isScreenSharing
      ? "control-btn bg-blue-500 text-white"
      : "control-btn bg-gray-600 text-white";
  }

  getScreenShareTooltip(): string {
    if (!this.isScreenShareSupported) {
      return "Screen sharing not supported on this device";
    }
    return this.isScreenSharing ? "Stop Screen Share" : "Start Screen Share";
  }

  async endCall() {
    await this.leaveCall();
    this.router.navigate(["/"]);
  }

  private async leaveCall() {
    try {
      await this.agoraService.leaveChannel();
    } catch (error) {
      console.error("Error leaving call:", error);
    }
  }
}
