import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { MeetingService } from './meeting.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Member } from '../../schemas/Member.model';
import { SystemRole } from '../../libs/enums/enums';
import { ObjectType, Field } from '@nestjs/graphql';
import {
  CreateMeetingInput,
  UpdateMeetingInput,
  JoinMeetingInput,
  MeetingQueryInput,
} from '../../libs/DTO/meeting/meeting.input';
import {
  MeetingWithHost,
  MeetingListResponse,
  MeetingStats,
  MeetingResponse,
} from '../../libs/DTO/meeting/meeting.query';
import { SignalingGateway } from '../signaling/signaling.gateway';

// MeetingResponse is now imported from DTO

@ObjectType()
export class JoinMeetingResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => MeetingWithHost, { nullable: true })
  meeting?: any;

  @Field(() => Member, { nullable: true })
  user?: Member;
}

@ObjectType()
export class SimpleMeetingInfo {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field()
  status: string;

  @Field()
  inviteCode: string;

  @Field({ nullable: true })
  isPrivate?: boolean;

  @Field({ nullable: true })
  isLocked?: boolean;

  @Field({ nullable: true })
  scheduledFor?: string;

  @Field({ nullable: true })
  actualStartAt?: string;

  @Field({ nullable: true })
  endedAt?: string;

  @Field({ nullable: true })
  durationMin?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  participantCount: number;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  @Field()
  hostId: string;

  @Field(() => Member, { nullable: true })
  host?: Member;
}

@ObjectType()
export class SimpleJoinMeetingResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => SimpleMeetingInfo, { nullable: true })
  meeting?: SimpleMeetingInfo;

  @Field(() => Member, { nullable: true })
  user?: Member;
}

@Resolver()
export class MeetingResolver {
  private readonly logger = new Logger(MeetingResolver.name);

  constructor(
    private readonly meetingService: MeetingService,
    @Inject(forwardRef(() => SignalingGateway))
    private readonly signalingGateway: SignalingGateway,
  ) {}

  // ==================== QUERIES ====================

  @Query(() => MeetingListResponse, { name: 'getMeetings' })
  @UseGuards(AuthGuard)
  async getMeetings(
    @Args('input') queryInput: MeetingQueryInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.getMeetings(
        queryInput,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_MEETINGS] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => MeetingWithHost, { name: 'getMeetingById' })
  @UseGuards(AuthGuard)
  async getMeetingById(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    try {
      const result = await this.meetingService.getMeetingById(
        meetingId,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_MEETING_BY_ID] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      
      // If it's a permission error, try to get meeting without user check
      if (error.message?.includes('You can only view meetings')) {
        this.logger.warn(`[GET_MEETING_BY_ID] Permission denied, trying public access for meeting ${meetingId}`);
        try {
          const result = await this.meetingService.getMeetingByIdPublic(meetingId);
          return result;
        } catch (publicError) {
          this.logger.error(`[GET_MEETING_BY_ID] Public access also failed - Meeting ID: ${meetingId}, Error: ${publicError.message}`);
          throw publicError;
        }
      }
      
      throw error;
    }
  }

  @Query(() => MeetingStats, { name: 'getMeetingStats' })
  @UseGuards(AuthGuard)
  async getMeetingStats(@AuthMember() user: Member) {
    try {
      const result = await this.meetingService.getMeetingStats(user._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_MEETING_STATS] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => MeetingWithHost, { name: 'createMeeting' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER, SystemRole.TUTOR)
  async createMeeting(
    @Args('input') createInput: CreateMeetingInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.createMeeting(
        createInput,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[CREATE_MEETING] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingWithHost, { name: 'updateMeeting' })
  @UseGuards(AuthGuard)
  async updateMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @Args('input') updateInput: UpdateMeetingInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.updateMeeting(
        meetingId,
        updateInput,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[UPDATE_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => SimpleJoinMeetingResponse, { name: 'joinMeetingByCode' })
  @UseGuards(AuthGuard)
  async joinMeetingByCode(
    @Args('input') joinInput: JoinMeetingInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.joinMeetingByCode(
        joinInput,
        user._id,
      );
      
      // Transform to SimpleMeetingInfo
      const simpleMeeting = {
        _id: result.meeting._id,
        title: result.meeting.title,
        status: result.meeting.status,
        inviteCode: result.meeting.inviteCode,
        isPrivate: result.meeting.isPrivate,
        isLocked: result.meeting.isLocked,
        scheduledFor: result.meeting.scheduledFor,
        actualStartAt: result.meeting.actualStartAt,
        endedAt: result.meeting.endedAt,
        durationMin: result.meeting.durationMin,
        notes: result.meeting.notes,
        participantCount: result.meeting.participantCount,
        createdAt: result.meeting.createdAt,
        updatedAt: result.meeting.updatedAt,
        hostId: result.meeting.hostId,
        host: result.meeting.host,
      };
      
      return {
        success: true,
        message: result.message,
        meeting: simpleMeeting,
        user: result.user,
      };
    } catch (error) {
      this.logger.error(
        `[JOIN_MEETING_BY_CODE] Failed - Invite Code: ${joinInput.inviteCode}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingWithHost, { name: 'startMeeting' })
  @UseGuards(AuthGuard)
  async startMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.startMeeting(
        meetingId,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[START_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingWithHost, { name: 'endMeeting' })
  @UseGuards(AuthGuard)
  async endMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.endMeeting(meetingId, user._id);
      
      // Emit WebSocket event to notify all participants immediately
      try {
        await this.signalingGateway.notifyMeetingEnded(meetingId);
      } catch (wsError) {
        this.logger.warn(`[END_MEETING] Failed to emit WebSocket event: ${wsError.message}`);
        // Don't fail the meeting end if WebSocket fails
      }
      
      return result;
    } catch (error) {
      this.logger.error(
        `[END_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingWithHost, { name: 'deleteMeeting' })
  @UseGuards(AuthGuard)
  async deleteMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.deleteMeeting(
        meetingId,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[DELETE_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingWithHost, { name: 'rotateInviteCode' })
  @UseGuards(AuthGuard)
  async rotateInviteCode(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.rotateInviteCode(
        meetingId,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[ROTATE_INVITE_CODE] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingWithHost, { name: 'lockRoom' })
  @UseGuards(AuthGuard)
  async lockRoom(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.lockRoom(meetingId, user._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[LOCK_ROOM] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingWithHost, { name: 'unlockRoom' })
  @UseGuards(AuthGuard)
  async unlockRoom(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.meetingService.unlockRoom(meetingId, user._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[UNLOCK_ROOM] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // ✅ CLEANUP: Admin-only endpoint to fix orphaned meetings
  @Mutation(() => String, { name: 'cleanupOrphanedMeetings' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  async cleanupOrphanedMeetings(@AuthMember() user: Member) {
    try {
      const result = await this.meetingService.cleanupOrphanedMeetings();
      this.logger.log(`[CLEANUP] Admin ${user._id} ran cleanup - Fixed: ${result.fixed}, Deleted: ${result.deleted}`);
      return `Cleanup complete: Fixed ${result.fixed} meetings, Deleted ${result.deleted} orphaned meetings`;
    } catch (error) {
      this.logger.error(`[CLEANUP] Failed - User ID: ${user._id}, Error: ${error.message}`);
      throw error;
    }
  }
}
