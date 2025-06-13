import { Injectable } from '@angular/core';
import AgoraRTC, { 
  IAgoraRTCClient, 
  ILocalTrack, 
  ILocalVideoTrack, 
  ILocalAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  UID,
  ScreenVideoTrackInitConfig,
  CameraVideoTrackInitConfig
} from 'agora-rtc-sdk-ng';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AgoraService {
  private client: IAgoraRTCClient;
  private localVideoTrack: ILocalVideoTrack | null = null;
  private localAudioTrack: ILocalAudioTrack | null = null;
  private localScreenTrack: ILocalVideoTrack | any = null;
  private remoteUsers: any[] = [];
  
  // Observable for remote users updates
  private remoteUsersSubject = new BehaviorSubject<any[]>([]);
  public remoteUsers$ = this.remoteUsersSubject.asObservable();
  
  // Replace with your Agora App ID
  private readonly APP_ID = '4075aaf382874071b318f6cfb80d8d98';

  constructor() {
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    this.setupClientEvents();
  }

  private setupClientEvents() {
    this.client.on('user-published', async (user, mediaType) => {
      await this.client.subscribe(user, mediaType);
      console.log('User published:', user.uid, mediaType);
      
      const existingUser = this.remoteUsers.find(u => u.uid === user.uid);
      if (existingUser) {
        if (mediaType === 'video') {
          existingUser.videoTrack = user.videoTrack;
        } else if (mediaType === 'audio') {
          existingUser.audioTrack = user.audioTrack;
          // IMPORTANT: Play audio immediately when received
          if (user.audioTrack) {
            user.audioTrack.play();
          }
        }
      } else {
        const newUser = {
          uid: user.uid,
          videoTrack: mediaType === 'video' ? user.videoTrack : null,
          audioTrack: mediaType === 'audio' ? user.audioTrack : null
        };
        this.remoteUsers.push(newUser);
        
        // IMPORTANT: Play audio immediately for new users
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }
      }
      
      // Notify subscribers about the update
      this.remoteUsersSubject.next([...this.remoteUsers]);
    });

    this.client.on('user-unpublished', (user, mediaType) => {
      console.log('User unpublished:', user.uid, mediaType);
      const existingUser = this.remoteUsers.find(u => u.uid === user.uid);
      if (existingUser) {
        if (mediaType === 'video') {
          // Stop the video track if it exists
          if (existingUser.videoTrack) {
            existingUser.videoTrack.stop();
          }
          existingUser.videoTrack = null;
        } else if (mediaType === 'audio') {
          // Stop the audio track if it exists
          if (existingUser.audioTrack) {
            existingUser.audioTrack.stop();
          }
          existingUser.audioTrack = null;
        }
      }
      
      // Notify subscribers about the update
      this.remoteUsersSubject.next([...this.remoteUsers]);
    });

    this.client.on('user-left', (user) => {
      console.log('User left:', user.uid);
      this.remoteUsers = this.remoteUsers.filter(u => u.uid !== user.uid);
      // Notify subscribers about the update
      this.remoteUsersSubject.next([...this.remoteUsers]);
    });
  }

  async joinChannel(channel: string, uid: UID, token?: string) {
    try {
      await this.client.join(this.APP_ID, channel, token || null, uid);
      console.log('Joined channel successfully');
      
      // Create local tracks
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      this.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      
      // Publish local tracks
      await this.client.publish([this.localAudioTrack, this.localVideoTrack]);
      console.log('Published local tracks');
      
      return {
        audioTrack: this.localAudioTrack,
        videoTrack: this.localVideoTrack
      };
    } catch (error) {
      console.error('Failed to join channel:', error);
      throw error;
    }
  }

  async leaveChannel() {
    try {
      // Stop and clean up local tracks
      if (this.localVideoTrack) {
        this.localVideoTrack.stop();
        this.localVideoTrack.close();
        this.localVideoTrack = null;
      }
      
      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }

      if (this.localScreenTrack) {
        this.localScreenTrack.stop();
        this.localScreenTrack.close();
        this.localScreenTrack = null;
      }
      
      // Leave channel
      await this.client.leave();
      console.log('Left channel successfully');
      
      this.remoteUsers = [];
      this.remoteUsersSubject.next([]);
    } catch (error) {
      console.error('Failed to leave channel:', error);
      throw error;
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (this.localAudioTrack) {
      const enabled = this.localAudioTrack.enabled;
      await this.localAudioTrack.setEnabled(!enabled);
      return !enabled;
    }
    return false;
  }

  async toggleCamera(): Promise<boolean> {
    if (this.localVideoTrack) {
      const enabled = this.localVideoTrack.enabled;
      await this.localVideoTrack.setEnabled(!enabled);
      return !enabled;
    }
    return false;
  }

  // Device detection methods
  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  private isIOS(): boolean {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // Check if screen share is supported (updated logic)
  isScreenShareSupported(): boolean {
    // Desktop browsers - use native getDisplayMedia
    if (!this.isMobile() && 'getDisplayMedia' in navigator.mediaDevices) {
      return true;
    }
    
    // Mobile browsers - always return true as we'll handle it differently
    if (this.isMobile()) {
      return true;
    }
    
    return false;
  }

  // Get screen share capability info
  getScreenShareCapability(): { supported: boolean; method: string; requiresPermission: boolean } {
    if (!this.isMobile() && 'getDisplayMedia' in navigator.mediaDevices) {
      return { supported: true, method: 'native', requiresPermission: true };
    }
    
    if (this.isMobile()) {
      return { supported: true, method: 'mobile-alternative', requiresPermission: true };
    }
    
    return { supported: false, method: 'none', requiresPermission: false };
  }

  async startScreenShare(): Promise<ILocalVideoTrack | null> {
    try {
      const capability = this.getScreenShareCapability();
      
      if (!capability.supported) {
        throw new Error('Screen sharing is not supported on this device');
      }

      // Unpublish current video track
      if (this.localVideoTrack) {
        await this.client.unpublish(this.localVideoTrack);
      }

      let screenTrack: ILocalVideoTrack | any = null;

      if (capability.method === 'native') {
        // Desktop: Use native screen sharing
        screenTrack = await this.startDesktopScreenShare();
      } else if (capability.method === 'mobile-alternative') {
        // Mobile: Use alternative approaches
        screenTrack = await this.startMobileScreenShare();
      }

      if (screenTrack) {
        this.localScreenTrack = screenTrack;
        await this.client.publish(screenTrack);
        return screenTrack;
      } else {
        // If screen share fails, republish camera
        if (this.localVideoTrack) {
          await this.client.publish(this.localVideoTrack);
        }
        return null;
      }
    } catch (error) {
      console.error('Failed to start screen share:', error);
      
      // If screen share fails, republish camera
      if (this.localVideoTrack) {
        try {
          await this.client.publish(this.localVideoTrack);
        } catch (republishError) {
          console.error('Failed to republish camera:', republishError);
        }
      }
      
      return null;
    }
  }

  private async startDesktopScreenShare(): Promise<ILocalVideoTrack | any> {
    const screenConfig: ScreenVideoTrackInitConfig = {
      encoderConfig: '1080p_1',
      optimizationMode: 'detail'
    };
    
    return await AgoraRTC.createScreenVideoTrack(screenConfig);
  }

  private async startMobileScreenShare(): Promise<ILocalVideoTrack | any> {
    try {
      // Method 1: Try native getDisplayMedia first (some mobile browsers support it)
      if ('getDisplayMedia' in navigator.mediaDevices) {
        try {
          const screenConfig: ScreenVideoTrackInitConfig = {
            encoderConfig: '720p_1', // Lower resolution for mobile
            optimizationMode: 'motion'
          };
          
          const screenTrack = await AgoraRTC.createScreenVideoTrack(screenConfig);
          console.log('Mobile screen share successful with native method');
          return screenTrack;
        } catch (nativeError) {
          console.log('Native mobile screen share failed, trying alternatives:', nativeError);
        }
      }

      // Method 2: Use camera with rear camera for mobile screen recording simulation
      if (this.isMobile()) {
        try {
          // Try to get rear camera which can be used to show screen content
          const cameraConfig = {
            encoderConfig: '720p_1',
            facingMode: 'environment' // Use rear camera
          };
          
          const cameraTrack = await AgoraRTC.createCameraVideoTrack(cameraConfig as CameraVideoTrackInitConfig);
          console.log('Using rear camera as screen share alternative');
          return cameraTrack;
        } catch (cameraError) {
          console.log('Rear camera method failed:', cameraError);
        }
      }

      // Method 3: Manual media stream creation for advanced cases
      if (this.isAndroid()) {
        return await this.tryAndroidScreenShare();
      }

      throw new Error('No suitable mobile screen sharing method available');
    } catch (error) {
      console.error('All mobile screen share methods failed:', error);
      return null;
    }
  }

  private async tryAndroidScreenShare(): Promise<ILocalVideoTrack | null> {
    try {
      // For Android, we can try to use MediaRecorder API or Canvas-based approaches
      // This is a fallback method that captures the current viewport
      
      // Check if we can access screen capture API (Android Chrome 72+)
      if ((navigator as any).mediaDevices && (navigator as any).mediaDevices.getDisplayMedia) {
        const stream = await (navigator as any).mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          }
        });
        
        // Create custom track from the stream
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          // Convert to Agora track
          const customTrack = AgoraRTC.createCustomVideoTrack({
            mediaStreamTrack: videoTrack,
            // encoderConfig: '720p_1'
          });
          
          return customTrack;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Android screen share failed:', error);
      return null;
    }
  }

  async stopScreenShare(): Promise<void> {
    try {
      if (this.localScreenTrack) {
        await this.client.unpublish(this.localScreenTrack);
        this.localScreenTrack.stop();
        this.localScreenTrack.close();
        this.localScreenTrack = null;
      }

      if (this.localVideoTrack) {
        await this.client.publish(this.localVideoTrack);
      }
    } catch (error) {
      console.error('Failed to stop screen share:', error);
      throw error;
    }
  }

  // Method to show mobile screen sharing instructions
  getMobileScreenShareInstructions(): string {
    if (this.isIOS()) {
      return 'For iOS: Screen recording will use the rear camera. Point your device at the screen you want to share, or use Control Center screen recording if supported by your browser.';
    } else if (this.isAndroid()) {
      return 'For Android: Your browser may prompt for screen recording permission. If not available, the rear camera will be used as an alternative.';
    }
    return 'Mobile screen sharing will attempt multiple methods. Follow any browser prompts for permissions.';
  }

  // Check if user needs special instructions
  needsMobileInstructions(): boolean {
    return this.isMobile();
  }

  getRemoteUsers() {
    return this.remoteUsers;
  }

  getLocalTracks() {
    return {
      audioTrack: this.localAudioTrack,
      videoTrack: this.localVideoTrack,
      screenTrack: this.localScreenTrack
    };
  }
}
