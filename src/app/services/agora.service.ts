import { Injectable } from '@angular/core';
import AgoraRTC, { 
  IAgoraRTCClient, 
  ILocalTrack, 
  ILocalVideoTrack, 
  ILocalAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  UID,
  ScreenVideoTrackInitConfig
} from 'agora-rtc-sdk-ng';

@Injectable({
  providedIn: 'root'
})
export class AgoraService {
  private client: IAgoraRTCClient;
  private localVideoTrack: ILocalVideoTrack | null = null;
  private localAudioTrack: ILocalAudioTrack | null = null;
  private localScreenTrack: ILocalVideoTrack | any = null;
  private remoteUsers: any[] = [];
  
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
        }
      } else {
        this.remoteUsers.push({
          uid: user.uid,
          videoTrack: mediaType === 'video' ? user.videoTrack : null,
          audioTrack: mediaType === 'audio' ? user.audioTrack : null
        });
      }
    });

    this.client.on('user-unpublished', (user, mediaType) => {
      console.log('User unpublished:', user.uid, mediaType);
      const existingUser = this.remoteUsers.find(u => u.uid === user.uid);
      if (existingUser) {
        if (mediaType === 'video') {
          existingUser.videoTrack = null;
        } else if (mediaType === 'audio') {
          existingUser.audioTrack = null;
        }
      }
    });

    this.client.on('user-left', (user) => {
      console.log('User left:', user.uid);
      this.remoteUsers = this.remoteUsers.filter(u => u.uid !== user.uid);
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

  async startScreenShare(): Promise<ILocalVideoTrack | null> {
    try {
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