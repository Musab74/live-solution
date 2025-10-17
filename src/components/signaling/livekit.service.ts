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

  // Recording (egress) — configure outputs in livekit.yaml for S3/FS first
  async startRecording(room: string, filepath: string) {
    // Simplified implementation - in production, configure proper egress outputs
    return `rec_${Date.now()}`;
  }
  stopRecording(egressId: string) {
    return Promise.resolve();
  }
  getRecording(egressId: string) {
    return this.egress.listEgress({ egressId }).then((list) => list?.[0]);
  }
  listRecordings(room?: string) {
    return this.egress.listEgress({ roomName: room });
  }
}
