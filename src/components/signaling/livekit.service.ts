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
  private readonly rooms: RoomServiceClient;

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