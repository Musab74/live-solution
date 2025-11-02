import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
} from 'livekit-server-sdk';

@Injectable({ scope: Scope.DEFAULT })
export class LivekitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly httpUrl: string;
  private readonly wsUrl: string;
  // Server 2 configuration
  private readonly httpUrl2: string;
  private readonly wsUrl2: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('LIVEKIT_API_KEY')!;
    this.apiSecret = config.get<string>('LIVEKIT_API_SECRET')!;
    
    // Server 1 configuration
    const base = config.get<string>('LIVEKIT_URL')!; // https://...
    this.httpUrl = base.replace(/\/$/, '');
    this.wsUrl = this.httpUrl.replace('http', 'ws'); // wss://...
    
    // Server 2 configuration
    const base2 = config.get<string>('LIVEKIT2_URL')!; // https://...
    this.httpUrl2 = base2.replace(/\/$/, '');
    this.wsUrl2 = this.httpUrl2.replace('http', 'ws'); // wss://...
    
    // Log configuration on startup
    console.log('🚀 [LOAD_BALANCER] Two-server configuration loaded:');
    console.log(`   Server 1 (Even): ${this.wsUrl}`);
    console.log(`   Server 2 (Odd):  ${this.wsUrl2}`);
  }

  /**
   * Get WebSocket URL for the appropriate server based on room ID
   * Even rooms (last digit 0,2,4,6,8) → Server 1
   * Odd rooms (last digit 1,3,5,7,9) → Server 2
   */
  getWsUrl(roomId?: string): string {
    if (!roomId) return this.wsUrl; // Fallback to Server 1 for backwards compatibility
    
    const lastChar = roomId.slice(-1);
    const isEven = parseInt(lastChar) % 2 === 0;
    const selectedServer = isEven ? 'Server 1' : 'Server 2';
    const selectedUrl = isEven ? this.wsUrl : this.wsUrl2;
    
    console.log(`🔄 [LOAD_BALANCER] Room ${roomId} → Last digit: ${lastChar} → ${selectedServer} → ${selectedUrl}`);
    
    return selectedUrl;
  }
  
  /**
   * Get HTTP URL for the appropriate server based on room ID
   */
  private getHttpUrl(roomId: string): string {
    const lastChar = roomId.slice(-1);
    const isEven = parseInt(lastChar) % 2 === 0;
    const selectedServer = isEven ? 'Server 1' : 'Server 2';
    const selectedUrl = isEven ? this.httpUrl : this.httpUrl2;
    
    console.log(`🔄 [LOAD_BALANCER] HTTP - Room ${roomId} → Last digit: ${lastChar} → ${selectedServer} → ${selectedUrl}`);
    
    return selectedUrl;
  }
  
  /**
   * Get appropriate RoomServiceClient for the room
   */
  private getRoomServiceClient(roomId: string): RoomServiceClient {
    const httpUrl = this.getHttpUrl(roomId);
    return new RoomServiceClient(httpUrl, this.apiKey, this.apiSecret);
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
    const roomsClient = this.getRoomServiceClient(name);
    return roomsClient.createRoom({ name, maxParticipants, emptyTimeout: 600 });
  }
  deleteRoom(name: string) {
    const roomsClient = this.getRoomServiceClient(name);
    return roomsClient.deleteRoom(name);
  }
  getRoom(name: string) {
    const roomsClient = this.getRoomServiceClient(name);
    return roomsClient
      .listRooms()
      .then((rooms) => rooms.find((r) => r.name === name));
  }
  listParticipants(room: string) {
    const roomsClient = this.getRoomServiceClient(room);
    return roomsClient.listParticipants(room);
  }
  removeParticipant(room: string, identity: string) {
    const roomsClient = this.getRoomServiceClient(room);
    return roomsClient.removeParticipant(room, identity);
  }
  muteTrack(room: string, identity: string, trackSid: string, muted: boolean) {
    const roomsClient = this.getRoomServiceClient(room);
    return roomsClient.mutePublishedTrack(room, identity, trackSid, muted);
  }
  updateParticipantMetadata(room: string, identity: string, metadata: string) {
    const roomsClient = this.getRoomServiceClient(room);
    return roomsClient.updateParticipant(room, identity, { metadata });
  }

  // Client-side recording support (no server-side egress needed)
  // All recording is handled by the frontend and uploaded via the recording-upload controller

  // Get VOD server URL
  getVodServerUrl(): string {
    return process.env.VOD_SERVER_URL || 'https://i-vod1.hrdeedu.co.kr';
  }

  // Get VOD server recordings URL
  getVodRecordingsUrl(): string {
    return process.env.VOD_SERVER_RECORDINGS_URL || 'https://i-vod1.hrdeedu.co.kr/recordings';
  }
}