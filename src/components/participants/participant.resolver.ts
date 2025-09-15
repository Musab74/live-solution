import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ParticipantService } from './participant.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import { Member } from '../../schemas/Member.model';
import { ParticipantWithLoginInfo, ParticipantStats } from '../../libs/DTO/participant/participant.query';
import { 
  CreateParticipantInput, 
  UpdateParticipantInput, 
  JoinMeetingInput, 
  LeaveMeetingInput, 
  UpdateSessionInput,
  ParticipantResponse,
  ParticipantMessageResponse 
} from '../../libs/DTO/participant/participant.mutation';

@Resolver()
export class ParticipantResolver {
  constructor(private readonly participantService: ParticipantService) {}

  @Query(() => [ParticipantWithLoginInfo], { name: 'getParticipantsByMeeting' })
  @UseGuards(AuthGuard)
  async getParticipantsByMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ): Promise<any[]> {
    return this.participantService.getParticipantsByMeeting(meetingId, user._id);
  }

  @Query(() => ParticipantStats, { name: 'getParticipantStats' })
  @UseGuards(AuthGuard)
  async getParticipantStats(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    return this.participantService.getParticipantStats(meetingId, user._id);
  }

  @Query(() => ParticipantWithLoginInfo, { name: 'getParticipantById' })
  @UseGuards(AuthGuard)
  async getParticipantById(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
  ) {
    return this.participantService.getParticipantById(participantId, user._id);
  }

  @Mutation(() => ParticipantResponse, { name: 'createParticipant' })
  @UseGuards(AuthGuard)
  async createParticipant(
    @Args('input') createInput: CreateParticipantInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.createParticipant(createInput, user._id);
  }

  @Mutation(() => ParticipantResponse, { name: 'updateParticipant' })
  @UseGuards(AuthGuard)
  async updateParticipant(
    @Args('input') updateInput: UpdateParticipantInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.updateParticipant(updateInput, user._id);
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'removeParticipant' })
  @UseGuards(AuthGuard)
  async removeParticipant(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
  ) {
    return this.participantService.removeParticipant(participantId, user._id);
  }

  @Mutation(() => ParticipantResponse, { name: 'joinMeeting' })
  @UseGuards(AuthGuard)
  async joinMeeting(
    @Args('input') joinInput: JoinMeetingInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.joinMeeting(joinInput, user._id);
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'leaveMeeting' })
  @UseGuards(AuthGuard)
  async leaveMeeting(
    @Args('input') leaveInput: LeaveMeetingInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.leaveMeeting(leaveInput, user._id);
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'updateSession' })
  @UseGuards(AuthGuard)
  async updateSession(
    @Args('input') updateInput: UpdateSessionInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.updateSession(updateInput, user._id);
  }
}