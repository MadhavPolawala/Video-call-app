import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgoraService } from '../../services/agora.service';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { ILocalVideoTrack, ILocalAudioTrack } from 'agora-rtc-sdk-ng';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-900 flex">
      <!-- Main Video Area -->
      <div class="flex-1 p-4 min-h-screen">
        <div class="h-full flex flex-col">
          <!-- Header -->
          <div class="flex justify-between items-center mb-6">
            <div>
              <h1 class="text-2xl font-bold text-white">{{ channelName }}</h1>
              <p class="text-gray-400">{{ username }}</p>
            </div>
            <div class="text-white">
              <span class="text-sm">{{ connectionStatus }}</span>
            </div>
          </div>

          <!-- Video Grid -->
          <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 h-[calc(100%-150px)]">
            <!-- Local Video -->
            <div class="video-container bg-gray-800 relative">
              <video 
                #localVideo 
                class="video-element" 
                autoplay 
                muted 
                playsinline>
              </video>
              <div class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm">
                You {{ !isVideoEnabled ? '(Camera Off)' : '' }} {{ isScreenSharing ? '(Screen Sharing)' : '' }}
                {{ getCurrentCameraLabel() }}
              </div>
              <!-- Camera Switch Button (overlay on video) -->
              <button
                *ngIf="isCameraSwitchSupported && isVideoEnabled && !isScreenSharing"
                (click)="switchCamera()"
                class="absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center transition-all duration-200"
                title="Switch Camera"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                </svg>
              </button>
            </div>

            <!-- Remote Video -->
            <div class="video-container bg-gray-800 relative">
              <video 
                #remoteVideo 
                class="video-element" 
                autoplay 
                playsinline>
              </video>
              <div class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm">
                {{ remoteUserConnected ? 'Remote User' : 'Waiting for user...' }}
              </div>
              <div *ngIf="!remoteUserConnected" class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <div class="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                  </div>
                  <p class="text-gray-400">Waiting for another user to join...</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex justify-center space-x-4">
            <button
              (click)="toggleMicrophone()"
              [class]="isMicEnabled ? 'control-btn bg-gray-600 text-white' : 'control-btn bg-red-500 text-white'"
              title="Toggle Microphone"
            >
              <svg *ngIf="isMicEnabled" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
              <svg *ngIf="!isMicEnabled" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-3a1 1 0 011-1h1m0 0V9a2 2 0 012-2h2m0 0V6a2 2 0 012-2h2a2 2 0 012 2v1m2 5v3a1 1 0 01-1 1h-1.586l-2.707-2.707A1 1 0 0012 12h-1a3 3 0 01-3-3V8a1 1 0 011-1h1m0 0V6a2 2 0 012-2h1a2 2 0 012 2v1m0 0h3"></path>
              </svg>
            </button>

            <button
              (click)="toggleCamera()"
              [class]="isVideoEnabled ? 'control-btn bg-gray-600 text-white' : 'control-btn bg-red-500 text-white'"
              title="Toggle Camera"
            >
              <svg *ngIf="isVideoEnabled" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <svg *ngIf="!isVideoEnabled" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 17.75M6 17.25l2.364-2.364m8 0L18 17.25M6 17.25v-1.5M18 17.25v-1.5m0 0V15M6 15.75v-1.5m12 1.5v-1.5m0 0V13.5M6 14.25v-1.5"></path>
              </svg>
            </button>

            <!-- Camera Switch Button (in controls) -->
            <button
              *ngIf="isCameraSwitchSupported"
              (click)="switchCamera()"
              [disabled]="!isVideoEnabled || isScreenSharing"
              [class]="getCameraSwitchButtonClass()"
              [title]="getCameraSwitchTooltip()"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </button>

            <button
              (click)="toggleScreenShare()"
              [disabled]="!isScreenShareSupported"
              [class]="getScreenShareButtonClass()"
              [title]="getScreenShareTooltip()"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </button>

            <button
              (click)="endCall()"
              class="control-btn bg-red-500 text-white"
              title="End Call"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 7v10a2 2 0 002 2h4l3-3h5a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Chat Sidebar -->
      <!-- <div class="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div class="p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-800">Chat</h2>
        </div>

        <div class="flex-1 overflow-y-auto p-4" #chatContainer>
          <div *ngFor="let message of messages" 
               [class]="'chat-message fade-in ' + (message.isOwn ? 'own' : 'other')">
            <div class="text-xs text-gray-500 mb-1">
              {{ message.username }} • {{ message.timestamp | date:'short' }}
            </div>
            <div>{{ message.message }}</div>
          </div>
          <div *ngIf="messages.length === 0" class="text-center text-gray-500 mt-8">
            <p>No messages yet</p>
            <p class="text-sm">Start a conversation...</p>
          </div>
        </div>

        <div class="p-4 border-t border-gray-200">
          <form (ngSubmit)="sendMessage()" class="flex space-x-2">
            <input
              type="text"
              [(ngModel)]="currentMessage"
              name="message"
              placeholder="Type a message..."
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
            <button
              type="submit"
              [disabled]="!currentMessage.trim()"
              class="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg transition-colors duration-200"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
              </svg>
            </button>
          </form>
        </div>
      </div> -->
    </div>
  `,
  styles: [`
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
    
    .chat-message {
      @apply mb-4 p-3 rounded-lg max-w-xs;
    }
    
    .chat-message.own {
      @apply bg-blue-500 text-white ml-auto;
    }
    
    .chat-message.other {
      @apply bg-gray-100 text-gray-800;
    }
    
    .fade-in {
      animation: fadeIn 0.3s ease-in;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class VideoCallComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('chatContainer') chatContainer!: ElementRef<HTMLDivElement>;

  username = '';
  channelName = '';
  connectionStatus = 'Connecting...';
  
  isMicEnabled = true;
  isVideoEnabled = true;
  isScreenSharing = false;
  isScreenShareSupported = false;
  isCameraSwitchSupported = false;
  remoteUserConnected = false;
  
  messages: ChatMessage[] = [];
  currentMessage = '';

  private localVideoTrack: ILocalVideoTrack | null = null;
  private localAudioTrack: ILocalAudioTrack | null = null;
  private remoteUsersSubscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private agoraService: AgoraService,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    // Check if screen share is supported
    this.isScreenShareSupported = this.agoraService.isScreenShareSupported();
    
    // Check if camera switch is supported
    this.isCameraSwitchSupported = this.agoraService.isCameraSwitchSupported();

    this.route.queryParams.subscribe(params => {
      this.username = params['username'] || '';
      this.channelName = params['channel'] || '';
      
      if (!this.username || !this.channelName) {
        this.router.navigate(['/']);
        return;
      }
      
      this.initializeCall();
    });

    this.chatService.messages$.subscribe(messages => {
      this.messages = messages;
      setTimeout(() => this.scrollToBottom(), 100);
    });

    // Subscribe to remote users updates
    this.remoteUsersSubscription = this.agoraService.remoteUsers$.subscribe(remoteUsers => {
      this.updateRemoteVideo(remoteUsers);
    });
  }

  ngAfterViewInit() {
    // ViewChild elements are now available
  }

  ngOnDestroy() {
    this.leaveCall();
    if (this.remoteUsersSubscription) {
      this.remoteUsersSubscription.unsubscribe();
    }
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
      
      this.connectionStatus = 'Connected';
      
      // Check camera switch support again after initialization
      this.isCameraSwitchSupported = this.agoraService.isCameraSwitchSupported();
      
    } catch (error) {
      console.error('Failed to initialize call:', error);
      this.connectionStatus = 'Connection failed';
    }
  }

  private updateRemoteVideo(remoteUsers: any[]) {
    if (remoteUsers.length > 0) {
      this.remoteUserConnected = true;
      const remoteUser = remoteUsers[0];
      
      // Handle video track updates
      if (remoteUser.videoTrack && this.remoteVideoRef) {
        // Stop any existing video first
        const videoElement = this.remoteVideoRef.nativeElement;
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
        
        // Play the new video track
        remoteUser.videoTrack.play(videoElement);
      } else if (!remoteUser.videoTrack && this.remoteVideoRef) {
        // Clear video when remote user turns off camera
        const videoElement = this.remoteVideoRef.nativeElement;
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
      }
      
      // Audio is automatically handled in the service now
    } else {
      this.remoteUserConnected = false;
      // Clear remote video when no users
      if (this.remoteVideoRef) {
        const videoElement = this.remoteVideoRef.nativeElement;
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
      }
    }
  }

  async toggleMicrophone() {
    this.isMicEnabled = await this.agoraService.toggleMicrophone();
  }

  async toggleCamera() {
    this.isVideoEnabled = await this.agoraService.toggleCamera();
  }

  // Switch camera between front and rear
  async switchCamera() {
    try {
      const newVideoTrack = await this.agoraService.switchCamera();
      if (newVideoTrack && this.localVideoRef) {
        // Update the local video element with the new track
        this.localVideoTrack = newVideoTrack;
        newVideoTrack.play(this.localVideoRef.nativeElement);
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
      // You might want to show a user-friendly error message here
    }
  }

  // Get current camera label for display
  getCurrentCameraLabel(): string {
    if (!this.isCameraSwitchSupported || this.isScreenSharing) {
      return '';
    }
    
    const facingMode = this.agoraService.getCurrentFacingMode();
    return facingMode === 'user' ? '(Front Camera)' : '(Rear Camera)';
  }

  // Get camera switch button class
  getCameraSwitchButtonClass(): string {
    if (!this.isVideoEnabled || this.isScreenSharing) {
      return 'control-btn bg-gray-400 text-gray-600 cursor-not-allowed';
    }
    return 'control-btn bg-gray-600 text-white hover:bg-gray-500';
  }

  // Get camera switch tooltip
  getCameraSwitchTooltip(): string {
    if (!this.isVideoEnabled) {
      return 'Enable camera to switch';
    }
    if (this.isScreenSharing) {
      return 'Stop screen sharing to switch camera';
    }
    const currentMode = this.agoraService.getCurrentFacingMode();
    return currentMode === 'user' ? 'Switch to Rear Camera' : 'Switch to Front Camera';
  }

  async toggleScreenShare() {
    if (!this.isScreenShareSupported) {
      alert('Screen sharing is not supported on this device');
      return;
    }

    if (this.isScreenSharing) {
      await this.agoraService.stopScreenShare();
      this.isScreenSharing = false;
      
      // Restore camera video
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
        alert('Failed to start screen sharing. Please try again.');
      }
    }
  }

  getScreenShareButtonClass(): string {
    if (!this.isScreenShareSupported) {
      return 'control-btn bg-gray-400 text-gray-600 cursor-not-allowed';
    }
    return this.isScreenSharing 
      ? 'control-btn bg-blue-500 text-white' 
      : 'control-btn bg-gray-600 text-white';
  }

  getScreenShareTooltip(): string {
    if (!this.isScreenShareSupported) {
      return 'Screen sharing not supported on this device';
    }
    return this.isScreenSharing ? 'Stop Screen Share' : 'Start Screen Share';
  }

  async endCall() {
    await this.leaveCall();
    this.router.navigate(['/']);
  }

  private async leaveCall() {
    try {
      await this.agoraService.leaveChannel();
      this.chatService.clearMessages();
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  }

  sendMessage() {
    if (this.currentMessage.trim()) {
      this.chatService.sendMessage(this.currentMessage);
      this.currentMessage = '';
    }
  }

  private scrollToBottom() {
    if (this.chatContainer) {
      const element = this.chatContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
}
