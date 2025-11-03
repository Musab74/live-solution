import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LivekitService } from './livekit.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../../libs/enums/enums';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import {
  StartLivekitRecordingInput,
  StopRecordingInput,
} from '../../libs/DTO/signaling/livekit.input';
import { RecordingInfo } from '../../libs/DTO/signaling/livekit.query';
import { Meeting } from '../../schemas/Meeting.model';
import { Participant } from '../../schemas/Participant.model';

@Resolver()
export class LivekitResolver {
  private readonly logger = new Logger(LivekitResolver.name);

  constructor(
    private readonly lk: LivekitService,
    @InjectModel(Meeting.name) private meetingModel: Model<Meeting>,
    @InjectModel(Participant.name) private participantModel: Model<Participant>,
  ) {}

  @UseGuards(AuthGuard)
  @Mutation(() => String, { name: 'createLivekitToken' })
  async createLivekitToken(
    @Args('meetingId') meetingId: string,
    @Args('identity') clientIdentity: string,
    @AuthMember() me: any,
  ) {
    this.logger.log(
      `[CREATE_LIVEKIT_TOKEN] Attempt - Meeting ID: ${meetingId}, User ID: ${me._id}, Email: ${me.email}, Display Name: ${me.displayName}`,
    );
    try {
      // CRITICAL FIX: Validate user data before token creation
      if (!me || !me._id) {
        throw new Error('User not authenticated or missing user ID');
      }
      
      // Use client-provided identity if available, otherwise use authenticated user ID
      const userId = clientIdentity || String(me._id);
      const userName = me.displayName || me.email || `User_${userId}`;
      
      // 1) verify member can join the meeting & load meetingRole (HOST/CO_HOST/…)
      let meetingRole: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER' = 'PARTICIPANT';
      
      try {
        // Check if user is the meeting host (using original authenticated user ID)
        const meeting = await this.meetingModel.findById(meetingId);
        if (!meeting) {
          throw new Error('Meeting not found');
        }
        
        // Check if user is banned from this meeting
        const userId = String(me._id);
        if (meeting.bannedUserIds && meeting.bannedUserIds.includes(userId)) {
          this.logger.warn(`[CREATE_LIVEKIT_TOKEN] Banned user ${userId} attempted to get token for meeting ${meetingId}`);
          throw new ForbiddenException('You have been removed from this meeting and cannot rejoin');
        }
        
        if (meeting && meeting.hostId && meeting.hostId.toString() === userId) {
          meetingRole = 'HOST';
        } else {
          // Check participant record for role (using original authenticated user ID)
          const participant = await this.participantModel
            .findOne({ meetingId: meetingId, userId: userId, status: { $ne: 'LEFT' } })
            .exec();
          
          if (participant && participant.role) {
            meetingRole = participant.role as any;
          }
        }
      } catch (roleError) {
        throw roleError;
      }
      
      const token = await this.lk.generateAccessToken({
        room: meetingId,
        identity: userId,
        name: userName,
        meetingRole,
      });

      const wsUrl = this.lk.getWsUrl(meetingId);
      
      // Determine server number (1 or 2) based on room ID
      const lastChar = meetingId.slice(-1);
      const isEven = parseInt(lastChar) % 2 === 0;
      const serverNumber = isEven ? 1 : 2;

      const tokenData = { wsUrl, token, serverNumber };

      const result = JSON.stringify(tokenData);

      this.logger.log(
        `[CREATE_LIVEKIT_TOKEN] Success - Meeting ID: ${meetingId}, Identity: ${userId}, Original User ID: ${me._id}, Meeting Role: ${meetingRole}, Token Length: ${token?.length || 0}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[CREATE_LIVEKIT_TOKEN] Failed - Meeting ID: ${meetingId}, User ID: ${me._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  @Mutation(() => String, { name: 'endLivekitRoom' })
  async endLivekitRoom(@Args('meetingId') meetingId: string) {
    await this.lk.deleteRoom(meetingId);
    return JSON.stringify({ success: true, message: 'Room ended successfully' });
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  @Mutation(() => String, { name: 'kickLivekitParticipant' })
  async kickLivekitParticipant(
    @Args('meetingId') meetingId: string,
    @Args('identity') identity: string,
  ) {
    await this.lk.removeParticipant(meetingId, identity);
    return JSON.stringify({ success: true, message: 'Participant kicked successfully' });
  }

  // Recording mutations
  // Client-side recording - no server-side egress methods needed
  // All recording is handled by the frontend and uploaded via the recording-upload controller
}
