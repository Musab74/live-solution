import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
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
} from '../../libs/DTO/meeting/meeting.query';

@ObjectType()
export class MeetingResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field({ nullable: true })
  meetingId?: string;

  @Field({ nullable: true })
  inviteCode?: string;
}

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

@Resolver()
export class MeetingResolver {
  private readonly logger = new Logger(MeetingResolver.name);

  constructor(private readonly meetingService: MeetingService) {}

  // ==================== QUERIES ====================

  @Query(() => MeetingListResponse, { name: 'getMeetings' })
  @UseGuards(AuthGuard)
  async getMeetings(
    @Args('input') queryInput: MeetingQueryInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[GET_MEETINGS] Attempt - User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.getMeetings(
        queryInput,
        user._id,
      );
      this.logger.log(
        `[GET_MEETINGS] Success - User ID: ${user._id}, Count: ${result.meetings.length}`,
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
  ) {
    this.logger.log(
      `[GET_MEETING_BY_ID] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.getMeetingById(
        meetingId,
        user._id,
      );
      this.logger.log(
        `[GET_MEETING_BY_ID] Success - Meeting ID: ${meetingId}, Title: ${result.title}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_MEETING_BY_ID] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => MeetingStats, { name: 'getMeetingStats' })
  @UseGuards(AuthGuard)
  async getMeetingStats(@AuthMember() user: Member) {
    this.logger.log(
      `[GET_MEETING_STATS] Attempt - User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.getMeetingStats(user._id);
      this.logger.log(
        `[GET_MEETING_STATS] Success - User ID: ${user._id}, Total Meetings: ${result.totalMeetings}`,
      );
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
    this.logger.log(
      `[CREATE_MEETING] Attempt - User ID: ${user._id}, Email: ${user.email}, Title: ${createInput.title}`,
    );
    try {
      const result = await this.meetingService.createMeeting(
        createInput,
        user._id,
      );
      this.logger.log(
        `[CREATE_MEETING] Success - User ID: ${user._id}, Meeting ID: ${result._id}, Invite Code: ${result.inviteCode}`,
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
    this.logger.log(
      `[UPDATE_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.updateMeeting(
        meetingId,
        updateInput,
        user._id,
      );
      this.logger.log(
        `[UPDATE_MEETING] Success - Meeting ID: ${meetingId}, Title: ${result.title}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[UPDATE_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => JoinMeetingResponse, { name: 'joinMeetingByCode' })
  @UseGuards(AuthGuard)
  async joinMeetingByCode(
    @Args('input') joinInput: JoinMeetingInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[JOIN_MEETING_BY_CODE] Attempt - Invite Code: ${joinInput.inviteCode}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.joinMeetingByCode(
        joinInput,
        user._id,
      );
      this.logger.log(
        `[JOIN_MEETING_BY_CODE] Success - Meeting ID: ${result.meeting._id}, User: ${user.email}`,
      );
      return {
        success: true,
        message: result.message,
        meeting: result.meeting,
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
    this.logger.log(
      `[START_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.startMeeting(
        meetingId,
        user._id,
      );
      this.logger.log(
        `[START_MEETING] Success - Meeting ID: ${meetingId}, Status: ${result.status}`,
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
    this.logger.log(
      `[END_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.endMeeting(meetingId, user._id);
      this.logger.log(
        `[END_MEETING] Success - Meeting ID: ${meetingId}, Duration: ${result.durationMin} minutes`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[END_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingResponse, { name: 'deleteMeeting' })
  @UseGuards(AuthGuard)
  async deleteMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[DELETE_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.deleteMeeting(
        meetingId,
        user._id,
      );
      this.logger.log(`[DELETE_MEETING] Success - Meeting ID: ${meetingId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `[DELETE_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingResponse, { name: 'rotateInviteCode' })
  @UseGuards(AuthGuard)
  async rotateInviteCode(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[ROTATE_INVITE_CODE] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.rotateInviteCode(
        meetingId,
        user._id,
      );
      this.logger.log(
        `[ROTATE_INVITE_CODE] Success - Meeting ID: ${meetingId}, New Code: ${result.inviteCode}`,
      );
      return {
        success: true,
        message: result.message,
        meetingId: result._id,
        inviteCode: result.inviteCode,
      };
    } catch (error) {
      this.logger.error(
        `[ROTATE_INVITE_CODE] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingResponse, { name: 'lockRoom' })
  @UseGuards(AuthGuard)
  async lockRoom(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[LOCK_ROOM] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.lockRoom(meetingId, user._id);
      this.logger.log(
        `[LOCK_ROOM] Success - Meeting ID: ${meetingId}, Locked: ${result.isLocked}`,
      );
      return {
        success: true,
        message: result.message,
        meetingId: result._id,
      };
    } catch (error) {
      this.logger.error(
        `[LOCK_ROOM] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MeetingResponse, { name: 'unlockRoom' })
  @UseGuards(AuthGuard)
  async unlockRoom(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[UNLOCK_ROOM] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.meetingService.unlockRoom(meetingId, user._id);
      this.logger.log(
        `[UNLOCK_ROOM] Success - Meeting ID: ${meetingId}, Locked: ${result.isLocked}`,
      );
      return {
        success: true,
        message: result.message,
        meetingId: result._id,
      };
    } catch (error) {
      this.logger.error(
        `[UNLOCK_ROOM] Failed - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }
}
