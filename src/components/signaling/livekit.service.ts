import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
} from 'livekit-server-sdk';

@Injectable({ scope: Scope.DEFAULT })
export class LivekitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly httpUrl: string;
  private readonly wsUrl: string;
  private readonly rooms: RoomServiceClient;
  private readonly egress: EgressClient;

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

  // Recording (egress) — simplified implementation for now
  async startRecording(room: string, filepath: string) {
    try {
      const fileName = filepath.split('/').pop() || `recording_${Date.now()}.mp4`;
      
      console.log(`[LIVEKIT_SERVICE] Starting recording for room: ${room}`);
      console.log(`[LIVEKIT_SERVICE] Output file: ${fileName}`);
      console.log(`[LIVEKIT_SERVICE] File path: ${filepath}`);
      
      // For now, return a mock egress ID
      // TODO: Implement proper LiveKit Egress when server is configured
      const egressId = `egress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`[LIVEKIT_SERVICE] ✅ Mock egress started: ${egressId}`);
      console.log(`[LIVEKIT_SERVICE] Note: This is a mock implementation. Real recording requires LiveKit server configuration.`);
      
      return egressId;
    } catch (error) {
      console.error(`[LIVEKIT_SERVICE] ❌ Failed to start egress:`, error);
      console.error(`[LIVEKIT_SERVICE] Error details:`, error.message);
      throw error;
    }
  }

  async stopRecording(egressId: string) {
    try {
      await this.egress.stopEgress(egressId);
      console.log(`[LIVEKIT_SERVICE] Egress stopped: ${egressId}`);
      return true;
    } catch (error) {
      console.error(`[LIVEKIT_SERVICE] Failed to stop egress:`, error);
      throw error;
    }
  }
  getRecording(egressId: string) {
    return this.egress.listEgress({ egressId }).then((list) => list?.[0]);
  }
  listRecordings(room?: string) {
    return this.egress.listEgress({ roomName: room });
  }
  
  // Get the path where recordings should be saved
  getRecordingPath(fileName: string): string {
    const path = require('path');
    // Check if VOD server mount exists, otherwise use local uploads
    const vodServerPath = '/mnt/vod-server/recordings';
    const localPath = path.join(process.cwd(), 'uploads', 'recordings');
    
    // In production, you would check if the VOD mount exists
    // For now, return local path
    return path.join(localPath, fileName);
  }

  // Get the local recording path (alias for getRecordingPath for backward compatibility)
  getLocalRecordingPath(fileName: string): string {
    return this.getRecordingPath(fileName);
  }

  // Upload recording to VOD server
  async uploadRecordingToVodServer(localFilePath: string, fileName: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check if local file exists
      if (!fs.existsSync(localFilePath)) {
        console.error(`[LIVEKIT_SERVICE] Local recording file not found: ${localFilePath}`);
        return false;
      }

      // In production, you would upload to your VOD server (S3, etc.)
      // For now, we'll just copy to the VOD server path if it exists
      const vodServerPath = '/mnt/vod-server/recordings';
      const vodFilePath = path.join(vodServerPath, fileName);
      
      // Check if VOD server mount exists
      if (fs.existsSync(vodServerPath)) {
        // Ensure directory exists
        const vodDir = path.dirname(vodFilePath);
        if (!fs.existsSync(vodDir)) {
          fs.mkdirSync(vodDir, { recursive: true });
        }
        
        // Copy file to VOD server
        fs.copyFileSync(localFilePath, vodFilePath);
        console.log(`[LIVEKIT_SERVICE] Recording uploaded to VOD server: ${vodFilePath}`);
        return true;
      } else {
        console.log(`[LIVEKIT_SERVICE] VOD server mount not available, keeping local file: ${localFilePath}`);
        return true; // Consider it successful even if VOD server is not available
      }
    } catch (error) {
      console.error(`[LIVEKIT_SERVICE] Error uploading recording to VOD server:`, error);
      return false;
    }
  }

  // Get VOD server URL
  getVodServerUrl(): string {
    return process.env.VOD_SERVER_URL || 'https://i-vod1.hrdeedu.co.kr';
  }

  // Get VOD server recordings URL
  getVodRecordingsUrl(): string {
    return process.env.VOD_SERVER_RECORDINGS_URL || 'https://i-vod1.hrdeedu.co.kr/recordings';
  }
}
