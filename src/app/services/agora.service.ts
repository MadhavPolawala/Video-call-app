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
  private currentFacingMode: 'user' | 'environment' = 'user'; // Track current camera
  private availableCameras: MediaDeviceInfo[] = [];
  
  // Observable for remote users updates
  private remoteUsersSubject = new BehaviorSubject<any[]>([]);
  public remoteUsers$ = this.remoteUsersSubject.asObservable();
  
  // Replace with your Agora App ID
  private readonly APP_ID = '4075aaf382874071b318f6cfb80d8d98';

  constructor() {
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    this.setupClientEvents();
    this.getAvailableCameras();
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

  // Get available cameras on the device
  private async getAvailableCameras() {
    try {
      const devices = await AgoraRTC.getDevices();
      this.availableCameras = devices.filter(device => device.kind === 'videoinput');
      console.log('Available cameras:', this.availableCameras);
    } catch (error) {
      console.error('Failed to get available cameras:', error);
    }
  }

  // Check if camera switching is supported (multiple cameras available)
  public isCameraSwitchSupported(): boolean {
    return this.availableCameras.length > 1;
  }

  // Get current facing mode
  public getCurrentFacingMode(): 'user' | 'environment' {
    return this.currentFacingMode;
  }

  async joinChannel(channel: string, uid: UID, token?: string) {
    try {
      await this.client.join(this.APP_ID, channel, token || null, uid);
      console.log('Joined channel successfully');
      
      // Create local tracks
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      this.localVideoTrack = await this.createCameraVideoTrack();
      
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

  // Create camera video track with specified facing mode
  private async createCameraVideoTrack(): Promise<ILocalVideoTrack> {
    const config: CameraVideoTrackInitConfig = {
      facingMode: this.currentFacingMode,
      encoderConfig: {
        width: 640,
        height: 480,
        frameRate: 30,
        bitrateMax: 1000,
        bitrateMin: 300
      }
    };

    try {
      return await AgoraRTC.createCameraVideoTrack(config);
    } catch (error) {
      console.error('Failed to create camera track with facing mode, trying default:', error);
      // Fallback to default camera if facing mode fails
      return await AgoraRTC.createCameraVideoTrack();
    }
  }

  // Switch between front and rear camera
  async switchCamera(): Promise<ILocalVideoTrack | null> {
    try {
      if (!this.isCameraSwitchSupported()) {
        console.warn('Camera switching not supported - only one camera available');
        return null;
      }

      // Toggle facing mode
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
      
      // Stop current video track
      if (this.localVideoTrack) {
        await this.client.unpublish(this.localVideoTrack);
        this.localVideoTrack.stop();
        this.localVideoTrack.close();
      }

      // Create new video track with switched camera
      this.localVideoTrack = await this.createCameraVideoTrack();
      
      // Publish the new video track
      await this.client.publish(this.localVideoTrack);
      
      console.log('Camera switched to:', this.currentFacingMode);
      return this.localVideoTrack;
      
    } catch (error) {
      console.error('Failed to switch camera:', error);
      
      // Try to restore previous camera on error
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
      try {
        this.localVideoTrack = await this.createCameraVideoTrack();
        await this.client.publish(this.localVideoTrack);
      } catch (restoreError) {
        console.error('Failed to restore camera:', restoreError);
      }
      
      return null;
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

  // Check if screen share is supported (not on mobile)
  isScreenShareSupported(): boolean {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return !isMobile && 'getDisplayMedia' in navigator.mediaDevices;
  }

  async startScreenShare(): Promise<ILocalVideoTrack | null> {
    try {
      // Check if screen share is supported
      if (!this.isScreenShareSupported()) {
        throw new Error('Screen sharing is not supported on this device');
      }

      if (this.localVideoTrack) {
        await this.client.unpublish(this.localVideoTrack);
      }

      // Fixed: Added required config parameter
      const screenConfig: ScreenVideoTrackInitConfig = {
        encoderConfig: '1080p_1', // Adjust based on your needs
        optimizationMode: 'detail' // 'detail' or 'motion'
      };
      
      this.localScreenTrack = await AgoraRTC.createScreenVideoTrack(screenConfig);
      await this.client.publish(this.localScreenTrack);
      
      return this.localScreenTrack;
    } catch (error) {
      console.error('Failed to start screen share:', error);
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
