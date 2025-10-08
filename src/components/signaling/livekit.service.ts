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
    
    // Log configuration (without exposing full credentials)
    console.log('🔧 LiveKit Service Configuration:', {
      httpUrl: this.httpUrl,
      wsUrl: this.wsUrl,
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
      apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'MISSING',
      apiSecretPrefix: this.apiSecret ? this.apiSecret.substring(0, 10) + '...' : 'MISSING',
    });
    
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
    console.log('🎫 [LIVEKIT_SERVICE] Generating LiveKit token:', {
      room: opts.room,
      identity: opts.identity,
      name: opts.name,
      meetingRole: opts.meetingRole,
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
      apiKeyLength: this.apiKey?.length || 0,
      apiSecretLength: this.apiSecret?.length || 0,
    });
    
    try {
      const at = new AccessToken(this.apiKey, this.apiSecret, {
        identity: opts.identity,
        name: opts.name,
        metadata: JSON.stringify({ meetingRole: opts.meetingRole }),
      });

      console.log('🎫 [LIVEKIT_SERVICE] AccessToken created successfully');

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
      
      console.log('🎫 [LIVEKIT_SERVICE] Token grants:', grants);
      at.addGrant(grants);
      console.log('🎫 [LIVEKIT_SERVICE] Grants added successfully');

      const token = at.toJwt();
      console.log('🎫 [LIVEKIT_SERVICE] toJwt() called, result:', {
        tokenType: typeof token,
        isPromise: token instanceof Promise,
        tokenValue: token
      });

      // Check if it's a Promise and handle accordingly
      if (token instanceof Promise) {
        console.log('🎫 [LIVEKIT_SERVICE] Token is a Promise, will be awaited in resolver');
        return token;
      } else {
        const tokenString = token as string;
        console.log('🎫 [LIVEKIT_SERVICE] Token is synchronous:', {
          tokenType: typeof tokenString,
          tokenLength: tokenString?.length || 0,
          tokenPreview: tokenString ? tokenString.substring(0, 50) + '...' : 'EMPTY'
        });
        return tokenString;
      }
    } catch (error) {
      console.error('🎫 [LIVEKIT_SERVICE] Error generating token:', error);
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

  // Recording (egress) — configure outputs in livekit.yaml for S3/FS first
  async startRecording(room: string, filepath: string) {
    // Simplified implementation - in production, configure proper egress outputs
    console.log(`Starting recording for room ${room} to ${filepath}`);
    return `rec_${Date.now()}`;
  }
  stopRecording(egressId: string) {
    console.log(`Stopping recording ${egressId}`);
    return Promise.resolve();
  }
  getRecording(egressId: string) {
    return this.egress.listEgress({ egressId }).then((list) => list?.[0]);
  }
  listRecordings(room?: string) {
    return this.egress.listEgress({ roomName: room });
  }
}
