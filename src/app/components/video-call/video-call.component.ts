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
  template: `
    <div class="min-h-screen bg-gray-900 flex">
      <div
        class="fixed bottom-0.5 right-0.5 pr- text-[10px] leading-[10px] font-mono text-blue-400/5"
      >
        Polawala
      </div>

      <!-- Main Video Area -->
      <div class="flex-1 p-4 min-h-screen" [class.pr-[340px]]="isChatOpen">
        <div class="h-full flex flex-col">
          <!-- Header -->
          <div
            class="flex justify-between md:items-center mb-6 px-4 py-3 rounded-lg bg-white/5 backdrop-blur-md border border-white/10 shadow-lg"
          >
            <!-- Left: Channel name and username -->
            <div>
              <h1
                class="text-xl md:text-2xl font-semibold text-white tracking-wide"
              >
                {{ channelName }}
              </h1>
              <p class="text-gray-300 text-sm">{{ username }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs text-gray-400"
                  >{{ userCount }} participant(s)</span
                >
                <span
                  *ngIf="connectionStatus === 'Connected'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="icon icon-tabler icons-tabler-filled icon-tabler-point"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path
                      d="M12 7a5 5 0 1 1 -4.995 5.217l-.005 -.217l.005 -.217a5 5 0 0 1 4.995 -4.783z"
                    />
                  </svg>
                  {{ connectionStatus }}
                </span>
              </div>
            </div>

            <!-- Right: Controls -->
            <div
              class="flex flex-col xs:flex-row md:flex-row items-end xs:items-center md:items-center gap-2 md:gap-3"
            >
              <!-- Chat Toggle Button -->
              <button
                (click)="toggleChat()"
                class="inline-flex items-center gap-1 md:gap-2 md:px-4 px-2 md:py-2 py-1 rounded-full transition duration-200 ease-out relative"
                [class]="
                  isChatOpen
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 text-white'
                "
                title="Toggle Chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="icon icon-tabler icons-tabler-outline icon-tabler-message-circle max-md:max-w-3 max-md:max-h-3"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1" />
                </svg>
                <span
                  class="md:text-[14px] md:leading-[14px] text-[11px] leading-[11px]"
                >
                  Chat
                </span>
                <!-- Unread message indicator -->
                <span
                  *ngIf="unreadMessageCount > 0 && !isChatOpen"
                  class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center min-w-5"
                >
                  {{ unreadMessageCount > 99 ? "99+" : unreadMessageCount }}
                </span>
              </button>

              <!-- Invite Button -->
              <button
                (click)="shareInvite()"
                class="inline-flex items-center md:gap-2 gap-1 md:px-4 px-2 md:py-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition duration-200 ease-out"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="icon icon-tabler icons-tabler-outline icon-tabler-user-plus text-white max-md:max-w-3 max-md:max-h-3"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
                  <path d="M16 19h6" />
                  <path d="M19 16v6" />
                  <path d="M6 21v-2a4 4 0 0 1 4 -4h4" />
                </svg>
                <span
                  class="md:text-[14px] md:leading-[14px] text-[11px] leading-[11px]"
                >
                  Invite
                </span>
              </button>
            </div>
          </div>

          <!-- Video Grid -->
          <div
            class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 md:max-h-[calc(100vh-206px)] max-h-fit"
          >
            <!-- Local Video -->
            <div
              class="video-container bg-gray-800 relative max-md:aspect-video w-full"
            >
              <video
                #localVideo
                class="video-element"
                autoplay
                muted
                playsinline
              ></video>
              <div
                class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm"
              >
                You {{ !isVideoEnabled ? "(Camera Off)" : "" }}
                {{ isScreenSharing ? "(Screen Sharing)" : "" }}
              </div>
            </div>

            <!-- Remote Video -->
            <div
              class="video-container bg-gray-800 relative max-md:aspect-video w-full"
            >
              <video
                #remoteVideo
                class="video-element"
                autoplay
                playsinline
              ></video>
              <div
                class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm"
              >
                {{
                  remoteUserConnected ? "Remote User" : "Waiting for user..."
                }}
              </div>
              <div
                *ngIf="!remoteUserConnected"
                class="absolute inset-0 flex items-center justify-center"
              >
                <div class="text-center">
                  <div
                    class="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <svg
                      class="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
                  </div>
                  <p class="text-gray-400">
                    Waiting for another user to join...
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex justify-center gap-4 flex-wrap">
            <button
              (click)="toggleMicrophone()"
              [class]="
                isMicEnabled
                  ? 'control-btn bg-gray-600 text-white'
                  : 'control-btn bg-red-500 text-white'
              "
              title="Toggle Microphone"
            >
              <svg
                *ngIf="isMicEnabled"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-microphone"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                  d="M9 2m0 3a3 3 0 0 1 3 -3h0a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3h0a3 3 0 0 1 -3 -3z"
                />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <path d="M8 21l8 0" />
                <path d="M12 17l0 4" />
              </svg>
              <svg
                *ngIf="!isMicEnabled"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-microphone-off"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M3 3l18 18" />
                <path
                  d="M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -.13 .874m-2 2a3 3 0 0 1 -3.87 -2.872v-1"
                />
                <path
                  d="M5 10a7 7 0 0 0 10.846 5.85m2 -2a6.967 6.967 0 0 0 1.152 -3.85"
                />
                <path d="M8 21l8 0" />
                <path d="M12 17l0 4" />
              </svg>
            </button>

            <button
              (click)="toggleCamera()"
              [class]="
                isVideoEnabled
                  ? 'control-btn bg-gray-600 text-white'
                  : 'control-btn bg-red-500 text-white'
              "
              title="Toggle Camera"
            >
              <svg
                *ngIf="isVideoEnabled"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-video"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                  d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z"
                />
                <path
                  d="M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"
                />
              </svg>
              <svg
                *ngIf="!isVideoEnabled"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-video-off"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M3 3l18 18" />
                <path
                  d="M15 11v-1l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -.675 .946"
                />
                <path
                  d="M10 6h3a2 2 0 0 1 2 2v3m0 4v1a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2h1"
                />
              </svg>
            </button>

            <button
              (click)="endCall()"
              class="control-btn bg-red-500 text-white"
              title="End Call"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-phone"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                  d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"
                />
              </svg>
            </button>

            <button
              (click)="toggleScreenShare()"
              [disabled]="!isScreenShareSupported"
              [class]="getScreenShareButtonClass()"
              [title]="getScreenShareTooltip()"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-screen-share"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                  d="M21 12v3a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1h9"
                />
                <path d="M7 20l10 0" />
                <path d="M9 16l0 4" />
                <path d="M15 16l0 4" />
                <path d="M17 4h4v4" />
                <path d="M16 9l5 -5" />
              </svg>
            </button>

            <button
              *ngIf="isCameraSwitchSupported"
              (click)="switchCamera()"
              [disabled]="!isVideoEnabled || isScreenSharing"
              [class]="getCameraSwitchButtonClass()"
              [title]="getCameraSwitchTooltip()"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-camera-rotate"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                  d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"
                />
                <path
                  d="M11.245 15.904a3 3 0 0 0 3.755 -2.904m-2.25 -2.905a3 3 0 0 0 -3.75 2.905"
                />
                <path d="M14 13h2v2" />
                <path d="M10 13h-2v-2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Chat Panel -->
      <div
        class="fixed right-0 top-0 h-full w-80 bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50"
        [class.translate-x-0]="isChatOpen"
        [class.translate-x-full]="!isChatOpen"
      >
        <div class="flex flex-col h-full">
          <!-- Chat Header -->
          <div
            class="flex items-center justify-between p-4 bg-gray-700 border-b border-gray-600"
          >
            <div>
              <h3 class="text-lg font-semibold text-white">Chat</h3>
              <p class="text-sm text-gray-300">
                {{ userCount }} participant(s)
              </p>
            </div>
            <button
              (click)="toggleChat()"
              class="p-2 text-gray-400 hover:text-white transition-colors"
              title="Close Chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <!-- Chat Messages -->
          <div class="flex-1 overflow-y-auto p-4 space-y-3" #chatMessages>
            <!-- System Messages -->
            <div
              *ngFor="let notification of notifications"
              class="text-center text-sm text-gray-400 py-2 px-3 bg-gray-700/50 rounded-lg mx-2"
            >
              {{ notification }}
            </div>

            <!-- Chat Messages -->
            <div
              *ngFor="let message of messages; trackBy: trackByMessageId"
              class="flex"
              [class.justify-end]="message.isOwn"
              [class.justify-start]="!message.isOwn"
            >
              <div
                class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg break-words"
                [class]="
                  message.isOwn
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-600 text-white rounded-bl-none'
                "
              >
                <div
                  *ngIf="!message.isOwn"
                  class="text-xs text-gray-300 mb-1 font-medium"
                >
                  {{ message.username }}
                </div>
                <div class="text-sm">{{ message.message }}</div>
                <div
                  class="text-xs mt-1 opacity-70"
                  [class.text-blue-200]="message.isOwn"
                  [class.text-gray-300]="!message.isOwn"
                >
                  {{ formatMessageTime(message.timestamp) }}
                </div>
              </div>
            </div>

            <!-- Typing Indicators -->
            <div *ngIf="typingUsers.length > 0" class="flex justify-start">
              <div
                class="bg-gray-600 text-white px-4 py-2 rounded-lg rounded-bl-none text-sm"
              >
                <div class="flex items-center space-x-2">
                  <div class="flex space-x-1">
                    <div
                      class="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                    ></div>
                    <div
                      class="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                      style="animation-delay: 0.1s"
                    ></div>
                    <div
                      class="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                      style="animation-delay: 0.2s"
                    ></div>
                  </div>
                  <span class="text-xs text-gray-300">
                    {{ getTypingUsersText() }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Chat Input -->
          <div class="p-4 bg-gray-700 border-t border-gray-600">
            <div class="flex space-x-2">
              <input
                #chatInput
                [(ngModel)]="newMessage"
                (keyup.enter)="sendMessage()"
                (keyup)="onTyping()"
                (blur)="stopTyping()"
                placeholder="Type a message..."
                class="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg border border-gray-500 focus:outline-none focus:border-blue-500 placeholder-gray-400"
                maxlength="500"
              />
              <button
                (click)="sendMessage()"
                [disabled]="!newMessage.trim() || !isConnectedToChat"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Send Message"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            </div>
            <div class="text-xs text-gray-400 mt-1">
              {{ newMessage.length }}/500
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Overlay for Mobile -->
      <div
        *ngIf="isChatOpen"
        class="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        (click)="toggleChat()"
      ></div>
    </div>
  `,
  styles: [
    `
      .video-container {
        border-radius: 12px;
        overflow: hidden;
        min-height: 300px;
      }

      .video-element {
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: #1f2937;
      }

      .control-btn {
        @apply w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105;
      }

      .control-btn:disabled {
        @apply opacity-50 cursor-not-allowed;
      }

      .control-btn:disabled:hover {
        @apply scale-100;
      }

      .fade-in {
        animation: fadeIn 0.3s ease-in;
      }

      @media (max-width: 768px) {
        .video-container {
          max-height: 300px;
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Custom scrollbar for chat */
      .overflow-y-auto::-webkit-scrollbar {
        width: 6px;
      }

      .overflow-y-auto::-webkit-scrollbar-track {
        background: #374151;
      }

      .overflow-y-auto::-webkit-scrollbar-thumb {
        background: #6b7280;
        border-radius: 3px;
      }

      .overflow-y-auto::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }

      /* Animate bounce for typing indicator */
      @keyframes bounce {
        0%,
        80%,
        100% {
          transform: scale(0);
        }
        40% {
          transform: scale(1);
        }
      }

      .animate-bounce {
        animation: bounce 1.5s infinite;
      }
    `,
  ],
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
