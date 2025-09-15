import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { SystemRole } from '../../libs/enums/enums';

@Injectable()
export class LivekitService {
  private apiKey: string;
  private apiSecret: string;
  private wsUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    this.apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET') || 'secret';
    this.wsUrl = this.configService.get<string>('LIVEKIT_WS_URL') || 'ws://localhost:7880';
  }

  async generateAccessToken(
    roomName: string,
    participantName: string,
    participantId: string,
    userRole: SystemRole,
    meetingHostId: string,
    canPublish: boolean = true,
    canSubscribe: boolean = true,
    canPublishData: boolean = true,
  ): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantId,
      name: participantName,
    });

    // Grant permissions based on role
    const permissions = this.getPermissionsForRole(userRole, meetingHostId, participantId);
    
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe,
      canPublishData,
      canUpdateOwnMetadata: true,
      hidden: false,
      recorder: userRole === SystemRole.ADMIN || (userRole === SystemRole.MEMBER && meetingHostId === participantId),
      ...permissions,
    });

    return at.toJwt();
  }

  private getPermissionsForRole(userRole: SystemRole, meetingHostId: string, participantId: string) {
    const isHost = meetingHostId === participantId;
    
    switch (userRole) {
      case SystemRole.ADMIN:
        return {
          roomAdmin: true,
          roomCreate: true,
          roomList: true,
          roomRecord: true,
          roomUpdate: true,
          roomDelete: true,
        };
      
      case SystemRole.MEMBER:
        if (isHost) {
          return {
            roomAdmin: true,
            roomRecord: true,
            roomUpdate: true,
          };
        }
        return {};
      
      default:
        return {};
    }
  }

  // Simplified LiveKit integration - most operations handled by LiveKit client
  async createRoom(roomName: string, maxParticipants: number = 50): Promise<any> {
    // LiveKit rooms are created automatically when first participant joins
    return {
      name: roomName,
      maxParticipants,
      emptyTimeout: 10 * 60,
      creationTime: Date.now(),
    };
  }

  async deleteRoom(roomName: string): Promise<void> {
    // LiveKit rooms are cleaned up automatically
    console.log(`Room ${roomName} will be cleaned up automatically`);
  }

  async getRoomInfo(roomName: string): Promise<any> {
    // This would typically query LiveKit's REST API
    return {
      name: roomName,
      numParticipants: 0,
      maxParticipants: 50,
      creationTime: Date.now(),
      emptyTimeout: 600,
    };
  }

  async getRoomParticipants(roomName: string): Promise<any[]> {
    // This would typically query LiveKit's REST API
    return [];
  }

  async muteParticipant(roomName: string, participantId: string, trackSid: string, muted: boolean): Promise<void> {
    // This would typically use LiveKit's REST API
    console.log(`Muting participant ${participantId} in room ${roomName}: ${muted}`);
  }

  async kickParticipant(roomName: string, participantId: string, reason?: string): Promise<void> {
    // This would typically use LiveKit's REST API
    console.log(`Kicking participant ${participantId} from room ${roomName}: ${reason}`);
  }

  async updateParticipantMetadata(roomName: string, participantId: string, metadata: string): Promise<void> {
    // This would typically use LiveKit's REST API
    console.log(`Updating metadata for participant ${participantId} in room ${roomName}`);
  }

  async startRecording(roomName: string, outputPath?: string): Promise<string> {
    // This would typically use LiveKit's Egress API
    const recordingId = `rec_${Date.now()}`;
    console.log(`Starting recording for room ${roomName}: ${recordingId}`);
    return recordingId;
  }

  async stopRecording(recordingSid: string): Promise<void> {
    // This would typically use LiveKit's Egress API
    console.log(`Stopping recording: ${recordingSid}`);
  }

  async getRecordingInfo(recordingSid: string): Promise<any> {
    // This would typically query LiveKit's Egress API
    return {
      sid: recordingSid,
      status: 'completed',
      startTime: Date.now() - 60000,
      endTime: Date.now(),
      duration: 60000,
    };
  }

  async listRecordings(roomName?: string): Promise<any[]> {
    // This would typically query LiveKit's Egress API
    return [];
  }

  async getRoomStats(roomName: string): Promise<any> {
    return {
      roomName,
      participantCount: 0,
      isActive: false,
      createdAt: Date.now(),
      duration: 0,
      participants: [],
    };
  }
}
