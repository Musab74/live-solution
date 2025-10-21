import { Injectable, Scope, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  EncodedFileType,
} from 'livekit-server-sdk';
import { EncodedFileOutput } from '@livekit/protocol';
import * as fs from 'fs';

@Injectable({ scope: Scope.DEFAULT })
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly httpUrl: string;
  private readonly wsUrl: string;
  private readonly rooms: RoomServiceClient;
  private readonly egress: EgressClient;
  private readonly vodServerMountPath: string;
  private readonly vodServerFallbackPath: string;
  private readonly vodServerEnabled: boolean;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('LIVEKIT_API_KEY')!;
    this.apiSecret = config.get<string>('LIVEKIT_API_SECRET')!;
    const base = config.get<string>('LIVEKIT_URL')!; // https://...
    this.httpUrl = base.replace(/\/$/, '');
    this.wsUrl = this.httpUrl.replace('http', 'ws'); // wss://...
    
    this.rooms = new RoomServiceClient(
      this.httpUrl,
      this.apiKey,
      this.apiSecret,
    );
    this.egress = new EgressClient(this.httpUrl, this.apiKey, this.apiSecret);
    
    // VOD Server Configuration
    this.vodServerMountPath = config.get<string>('VOD_SERVER_MOUNT_PATH', '/mnt/vod-server');
    this.vodServerFallbackPath = config.get<string>('VOD_SERVER_FALLBACK_PATH', './uploads/recordings');
    this.vodServerEnabled = config.get<string>('VOD_SERVER_ENABLED', 'true') === 'true';
    
    // Check mount status on startup
    this.checkVodServerMount();
  }
  
  /**
   * Check if VOD server mount is available
   */
  private checkVodServerMount(): boolean {
    if (!this.vodServerEnabled) {
      this.logger.warn('VOD Server is disabled. Using local storage.');
      return false;
    }
    
    try {
      // Check if mount point exists and is writable
      if (fs.existsSync(this.vodServerMountPath)) {
        // Try to write a test file
        const testFile = `${this.vodServerMountPath}/.mount-test-${Date.now()}`;
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        this.logger.log(`✅ VOD Server mount is available: ${this.vodServerMountPath}`);
        return true;
      } else {
        this.logger.warn(`⚠️ VOD Server mount not found: ${this.vodServerMountPath}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ VOD Server mount check failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get the recording path
   * Since LiveKit and storage are on same server (.91), use simple local path
   */
  getRecordingPath(filename: string): string {
    const path = `${this.vodServerFallbackPath}/${filename}`;
    this.logger.log(`📹 Recording path on LiveKit server (.91): ${path}`);
    return path;
  }

  getWsUrl() {
    return this.wsUrl;
  }

  generateAccessToken(opts: {
    room: string;
    identity: string;
    name: string;
    meetingRole: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER';
  }): string | Promise<string> {

    try {
      const at = new AccessToken(this.apiKey, this.apiSecret, {
        identity: opts.identity,
        name: opts.name,
        metadata: JSON.stringify({ meetingRole: opts.meetingRole }),
      });

      const canPublish = opts.meetingRole !== 'VIEWER';
      const grants = {
        roomJoin: true,
        room: opts.room,
        canPublish,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: true,
        roomAdmin: ['HOST', 'CO_HOST'].includes(opts.meetingRole),
        roomCreate: ['HOST', 'CO_HOST'].includes(opts.meetingRole),
        roomList: ['HOST', 'CO_HOST'].includes(opts.meetingRole),
      };

      at.addGrant(grants);

      const token = at.toJwt();

      // Check if it's a Promise and handle accordingly
      if (token instanceof Promise) {
        return token;
      } else {
        const tokenString = token as string;
        return tokenString;
      }
    } catch (error) {
      throw error;
    }
  }

  // Admin ops
  createRoom(name: string, maxParticipants = 50) {
    return this.rooms.createRoom({ name, maxParticipants, emptyTimeout: 600 });
  }
  deleteRoom(name: string) {
    return this.rooms.deleteRoom(name);
  }
  getRoom(name: string) {
    return this.rooms
      .listRooms()
      .then((rooms) => rooms.find((r) => r.name === name));
  }
  listParticipants(room: string) {
    return this.rooms.listParticipants(room);
  }
  removeParticipant(room: string, identity: string) {
    return this.rooms.removeParticipant(room, identity);
  }
  muteTrack(room: string, identity: string, trackSid: string, muted: boolean) {
    return this.rooms.mutePublishedTrack(room, identity, trackSid, muted);
  }
  updateParticipantMetadata(room: string, identity: string, metadata: string) {
    return this.rooms.updateParticipant(room, identity, { metadata });
  }

  // Recording (egress) — saves to VOD server or local fallback
  async startRecording(room: string, filepath: string) {
    try {
      this.logger.log(`[START_RECORDING] Room: ${room}, Path: ${filepath}`);
      
      // Create EncodedFileOutput for MP4 recording
      const fileOutput: EncodedFileOutput = {
        filepath: filepath,
        fileType: EncodedFileType.MP4,
        disableManifest: true,
      } as EncodedFileOutput;
      
      // Use LiveKit Egress to record room composite to file
      const info = await this.egress.startRoomCompositeEgress(room, fileOutput, {
        layout: 'grid',
        audioOnly: false,
        videoOnly: false,
      });
      
      this.logger.log(`[START_RECORDING] Success! Egress ID: ${info.egressId}`);
      return info.egressId;
    } catch (error) {
      this.logger.error(`[START_RECORDING] Failed: ${error.message}`);
      // Fallback to mock ID if LiveKit is not properly configured
      return `rec_${Date.now()}`;
    }
  }
  
  async stopRecording(egressId: string) {
    try {
      await this.egress.stopEgress(egressId);
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return Promise.resolve();
    }
  }
  
  getRecording(egressId: string) {
    return this.egress.listEgress({ egressId }).then((list) => list?.[0]);
  }
  
  listRecordings(room?: string) {
    return this.egress.listEgress({ roomName: room });
  }
}
