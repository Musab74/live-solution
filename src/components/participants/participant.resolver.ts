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
  ForceMediaInput,
  ForceMuteInput,
  ForceCameraOffInput,
  TransferHostInput,
  ParticipantResponse,
  ParticipantMessageResponse 
} from '../../libs/DTO/participant/participant.mutation';
import { 
  PreMeetingSetupInput, 
  ApproveParticipantInput, 
  RejectParticipantInput, 
  AdmitParticipantInput, 
  DeviceTestInput 
} from '../../libs/DTO/participant/waiting-room.input';
import { 
  WaitingParticipant, 
  WaitingRoomStats, 
  WaitingRoomResponse, 
  DeviceTestResult 
} from '../../libs/DTO/participant/waiting-room.query';

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


  // ===== WAITING ROOM FUNCTIONALITY =====

  @Mutation(() => WaitingRoomResponse, { name: 'preMeetingSetup' })
  async preMeetingSetup(
    @Args('input') setupInput: PreMeetingSetupInput,
    @AuthMember() user?: Member,
  ) {
    return this.participantService.preMeetingSetup(setupInput, user?._id);
  }

  @Query(() => [WaitingParticipant], { name: 'getWaitingParticipants' })
  @UseGuards(AuthGuard)
  async getWaitingParticipants(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    return this.participantService.getWaitingParticipants(meetingId, user._id);
  }

  @Query(() => WaitingRoomStats, { name: 'getWaitingRoomStats' })
  @UseGuards(AuthGuard)
  async getWaitingRoomStats(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    return this.participantService.getWaitingRoomStats(meetingId, user._id);
  }

  @Mutation(() => WaitingRoomResponse, { name: 'approveParticipant' })
  @UseGuards(AuthGuard)
  async approveParticipant(
    @Args('input') approveInput: ApproveParticipantInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.approveParticipant(approveInput, user._id);
  }

  @Mutation(() => WaitingRoomResponse, { name: 'rejectParticipant' })
  @UseGuards(AuthGuard)
  async rejectParticipant(
    @Args('input') rejectInput: RejectParticipantInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.rejectParticipant(rejectInput, user._id);
  }

  @Mutation(() => WaitingRoomResponse, { name: 'admitParticipant' })
  @UseGuards(AuthGuard)
  async admitParticipant(
    @Args('input') admitInput: AdmitParticipantInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.admitParticipant(admitInput, user._id);
  }

  // ===== DEVICE TESTING FUNCTIONALITY =====

  @Query(() => DeviceTestResult, { name: 'testDevice' })
  async testDevice(
    @Args('input') testInput: DeviceTestInput,
  ) {
    return this.participantService.testDevice(testInput);
  }

  // ===== HOST CONTROL FUNCTIONALITY =====

  @Mutation(() => ParticipantMessageResponse, { name: 'forceMute' })
  @UseGuards(AuthGuard)
  async forceMute(
    @Args('input') forceMuteInput: ForceMuteInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.forceMuteParticipant(forceMuteInput, user._id);
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'forceCameraOff' })
  @UseGuards(AuthGuard)
  async forceCameraOff(
    @Args('input') forceCameraOffInput: ForceCameraOffInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.forceCameraOffParticipant(forceCameraOffInput, user._id);
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'transferHost' })
  @UseGuards(AuthGuard)
  async transferHost(
    @Args('input') transferHostInput: TransferHostInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.transferHost(transferHostInput, user._id);
  }

  @Query(() => Boolean, { name: 'canBeHost' })
  @UseGuards(AuthGuard)
  async canBeHost(
    @AuthMember() user: Member,
  ) {
    return this.participantService.canBeHost(user._id);
  }

  @Query(() => String, { name: 'getMeetingAttendance' })
  @UseGuards(AuthGuard)
  async getMeetingAttendance(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    const attendance = await this.participantService.getMeetingAttendance(meetingId, user._id);
    return JSON.stringify(attendance, null, 2);
  }
}