import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { MeetingService } from './meeting.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import { Member } from '../../schemas/Member.model';
import { Meeting } from '../../schemas/Meeting.model';
import { 
  CreateMeetingInput, 
  UpdateMeetingInput, 
  JoinMeetingByCodeInput, 
  RotateInviteCodeInput,
  StartMeetingInput,
  EndMeetingInput,
  MeetingQueryInput
} from '../../libs/DTO/meeting/meeting.input';
import { 
  MeetingWithHost, 
  MeetingStats, 
  MeetingListResponse, 
  InviteCodeResponse, 
  MeetingJoinResponse 
} from '../../libs/DTO/meeting/meeting.query';
import { ParticipantMessageResponse } from '../../libs/DTO/participant/participant.mutation';

@Resolver()
export class MeetingResolver {
  constructor(private readonly meetingService: MeetingService) {}

  // ==================== QUERIES ====================

  @Query(() => MeetingWithHost, { name: 'getMeetingById' })
  @UseGuards(AuthGuard)
  async getMeetingById(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.meetingService.getMeetingById(meetingId, user._id);
  }

  @Query(() => MeetingListResponse, { name: 'getMyMeetings' })
  @UseGuards(AuthGuard)
  async getMyMeetings(
    @Args('input', { nullable: true }) queryInput: MeetingQueryInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.meetingService.getMeetingsByHost(user._id, queryInput || {});
  }

  @Query(() => MeetingListResponse, { name: 'getAllMeetings' })
  @UseGuards(AuthGuard)
  async getAllMeetings(
    @Args('input', { nullable: true }) queryInput: MeetingQueryInput,
  ): Promise<any> {
    return this.meetingService.getAllMeetings(queryInput || {});
  }

  @Query(() => MeetingStats, { name: 'getMeetingStats' })
  @UseGuards(AuthGuard)
  async getMeetingStats(
    @AuthMember() user: Member,
  ) {
    return this.meetingService.getMeetingStats(user._id);
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => Meeting, { name: 'createMeeting' })
  @UseGuards(AuthGuard)
  async createMeeting(
    @Args('input') createInput: CreateMeetingInput,
    @AuthMember() user: Member,
  ) {
    return this.meetingService.createMeeting(createInput, user._id);
  }

  @Mutation(() => Meeting, { name: 'updateMeeting' })
  @UseGuards(AuthGuard)
  async updateMeeting(
    @Args('input') updateInput: UpdateMeetingInput,
    @AuthMember() user: Member,
  ) {
    return this.meetingService.updateMeeting(updateInput, user._id);
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'deleteMeeting' })
  @UseGuards(AuthGuard)
  async deleteMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    return this.meetingService.deleteMeeting(meetingId, user._id);
  }

  @Mutation(() => InviteCodeResponse, { name: 'rotateInviteCode' })
  @UseGuards(AuthGuard)
  async rotateInviteCode(
    @Args('input') rotateInput: RotateInviteCodeInput,
    @AuthMember() user: Member,
  ) {
    return this.meetingService.rotateInviteCode(rotateInput, user._id);
  }

  @Mutation(() => MeetingJoinResponse, { name: 'joinMeetingByCode' })
  @UseGuards(AuthGuard)
  async joinMeetingByCode(
    @Args('input') joinInput: JoinMeetingByCodeInput,
    @AuthMember() user: Member,
  ) {
    return this.meetingService.joinMeetingByCode(joinInput, user._id);
  }

  @Mutation(() => Meeting, { name: 'startMeeting' })
  @UseGuards(AuthGuard)
  async startMeeting(
    @Args('input') startInput: StartMeetingInput,
    @AuthMember() user: Member,
  ) {
    return this.meetingService.startMeeting(startInput, user._id);
  }

  @Mutation(() => Meeting, { name: 'endMeeting' })
  @UseGuards(AuthGuard)
  async endMeeting(
    @Args('input') endInput: EndMeetingInput,
    @AuthMember() user: Member,
  ) {
    return this.meetingService.endMeeting(endInput, user._id);
  }
}
