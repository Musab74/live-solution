import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ParticipantService } from './participant.service';
import { MeetingService } from '../meetings/meeting.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UseGuards, Logger } from '@nestjs/common';
import { Member } from '../../schemas/Member.model';
import { ParticipantStatus, Role } from '../../libs/enums/enums';
import {
  ParticipantWithLoginInfo,
  ParticipantStats,
} from '../../libs/DTO/participant/participant.query';
import { MeetingAttendance } from '../../libs/DTO/meeting/meeting.query';
import {
  CreateParticipantInput,
  UpdateParticipantInput,
  JoinParticipantInput,
  LeaveMeetingInput,
  UpdateSessionInput,
  ForceMediaInput,
  ForceMuteInput,
  ForceCameraOffInput,
  TransferHostInput,
  ParticipantResponse,
  ParticipantMessageResponse,
} from '../../libs/DTO/participant/participant.mutation';
import {
  ForceScreenShareInput,
  UpdateScreenShareInfoInput,
  GetScreenShareStatusInput,
} from '../../libs/DTO/participant/screen-sharing.input';
import {
  ScreenShareStatusResponse,
  ScreenShareControlResponse,
} from '../../libs/DTO/participant/screen-sharing.query';
import {
  RaiseHandInput,
  LowerHandInput,
  HostLowerHandInput,
  GetRaisedHandsInput,
} from '../../libs/DTO/participant/raise-hand.input';
import {
  HandRaiseActionResponse,
  RaisedHandsResponse,
} from '../../libs/DTO/participant/raise-hand.query';
import {
  PreMeetingSetupInput,
  ApproveParticipantInput,
  RejectParticipantInput,
  AdmitParticipantInput,
  DeviceTestInput,
} from '../../libs/DTO/participant/waiting-room.input';
import {
  WaitingParticipant,
  WaitingRoomStats,
  WaitingRoomResponse,
  DeviceTestResult,
} from '../../libs/DTO/participant/waiting-room.query';

@Resolver()
export class ParticipantResolver {
  private readonly logger = new Logger(ParticipantResolver.name);

  constructor(
    private readonly participantService: ParticipantService,
    private readonly meetingService: MeetingService,
  ) { }

  @Query(() => [ParticipantWithLoginInfo], { name: 'getParticipantsByMeeting' })
  @UseGuards(AuthGuard)
  async getParticipantsByMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ): Promise<any[]> {
    console.log('🔍 BACKEND GET_PARTICIPANTS: Query called', {
      meetingId,
      userId: user._id,
      userEmail: user.email
    });

    try {
      const result = await this.participantService.getParticipantsByMeeting(
        meetingId,
        user._id,
      );

      // Transform the data to match ParticipantWithLoginInfo type
      const transformedResult = result.map(p => ({
        _id: p._id.toString(),
        meetingId: p.meetingId.toString(),
        user: p.userId ? {
          _id: p.userId._id.toString(),
          email: (p.userId as any).email,
          displayName: (p.userId as any).displayName,
          systemRole: (p.userId as any).systemRole,
          avatarUrl: (p.userId as any).avatarUrl
        } : null,
        displayName: p.displayName,
        role: p.role,
        status: p.status, // 🔧 FIX: Include status field for frontend filtering
        micState: p.micState,
        cameraState: p.cameraState,
        socketId: p.socketId,
        hasHandRaised: p.hasHandRaised,
        handRaisedAt: p.handRaisedAt,
        handLoweredAt: p.handLoweredAt,
        loginInfo: {
          joinedAt: p.createdAt,
          lastSeen: p.updatedAt
        },
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));

      console.log('✅ BACKEND GET_PARTICIPANTS: Success', {
        meetingId,
        count: transformedResult.length,
        participants: transformedResult.map(p => ({
          _id: p._id,
          displayName: p.displayName,
          role: p.role,
          userId: p.user?._id
        }))
      });
      return transformedResult;
    } catch (error) {
      console.error('❌ BACKEND GET_PARTICIPANTS: Error', error);
      throw error;
    }
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

  @Mutation(() => ParticipantMessageResponse, { name: 'unbanParticipant' })
  @UseGuards(AuthGuard)
  async unbanParticipant(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @Args('userIdToUnban', { type: () => ID }) userIdToUnban: string,
    @AuthMember() user: Member,
  ) {
    return this.participantService.unbanParticipant(meetingId, userIdToUnban, user._id);
  }

  @Mutation(() => ParticipantResponse, { name: 'joinMeeting' })
  @UseGuards(AuthGuard)
  async joinMeeting(
    @Args('input') joinInput: JoinParticipantInput,
    @AuthMember() user: Member,
  ) {
    console.log('🚀 BACKEND JOIN_MEETING: Mutation called', {
      input: joinInput,
      userId: user._id,
      userEmail: user.email,
      userDisplayName: user.displayName,
      userObject: user
    });

    try {
      const result = await this.participantService.joinMeeting(joinInput, user._id);
      console.log('✅ BACKEND JOIN_MEETING: Success', {
        participantId: result._id,
        displayName: result.displayName,
        role: result.role
      });
      return result;
    } catch (error) {
      console.error('❌ BACKEND JOIN_MEETING: Error', error);
      throw error;
    }
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'leaveMeeting' })
  @UseGuards(AuthGuard)
  async leaveMeeting(
    @Args('input') leaveInput: LeaveMeetingInput,
    @AuthMember() user: Member,
  ) {
    return this.participantService.leaveMeeting(leaveInput, user._id);
  }

  @Mutation(() => String, { name: 'clearFakeParticipants' })
  @UseGuards(AuthGuard)
  async clearFakeParticipants(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    console.log(`[CLEAR_FAKE_PARTICIPANTS] Resolver called - Meeting ID: ${meetingId}, User ID: ${user._id}`);
    
    try {
      const deletedCount = await this.participantService.clearFakeParticipants(meetingId);
      console.log(`[CLEAR_FAKE_PARTICIPANTS] Success - Deleted ${deletedCount} participants`);
      return `Successfully cleared ${deletedCount} fake participants from meeting ${meetingId}`;
    } catch (error) {
      console.error(`[CLEAR_FAKE_PARTICIPANTS] Error:`, error);
      throw error;
    }
  }

  @Mutation(() => ParticipantResponse, { name: 'updateParticipantMediaState' })
  @UseGuards(AuthGuard)
  async updateParticipantMediaState(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
    @Args('micState', { nullable: true }) micState?: string,
    @Args('cameraState', { nullable: true }) cameraState?: string,
  ) {
    console.log('🎤 BACKEND UPDATE_MEDIA_STATE: Mutation called', {
      participantId,
      micState,
      cameraState,
      userId: user._id
    });

    try {
      const result = await this.participantService.updateParticipantMediaState(participantId, {
        micState: micState as any,
        cameraState: cameraState as any
      });
      console.log('✅ BACKEND UPDATE_MEDIA_STATE: Success', result);
      return result;
    } catch (error) {
      console.error('❌ BACKEND UPDATE_MEDIA_STATE: Error', error);
      throw error;
    }
  }

  @Mutation(() => String, { name: 'cleanupDuplicateParticipants' })
  @UseGuards(AuthGuard)
  async cleanupDuplicateParticipants(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    console.log(`[CLEANUP_DUPLICATES] Resolver called - Meeting ID: ${meetingId}, User ID: ${user._id}`);
    
    try {
      const deletedCount = await this.participantService.cleanupDuplicateParticipants(meetingId);
      console.log(`[CLEANUP_DUPLICATES] Success - Deleted ${deletedCount} duplicates`);
      return `Successfully cleaned up ${deletedCount} duplicate participants from meeting ${meetingId}`;
    } catch (error) {
      console.error(`[CLEANUP_DUPLICATES] Error:`, error);
      throw error;
    }
  }

  @Mutation(() => String, { name: 'cleanupStaleParticipants' })
  @UseGuards(AuthGuard)
  async cleanupStaleParticipants(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    console.log(`[CLEANUP_STALE] Manual cleanup called - Meeting ID: ${meetingId}, User ID: ${user._id}`);
    
    try {
        const cleanedCount = await this.participantService.cleanupStaleParticipants(10); // 10 seconds threshold - AGGRESSIVE cleanup
      console.log(`[CLEANUP_STALE] Success - Cleaned up ${cleanedCount} stale participants`);
      return `Successfully cleaned up ${cleanedCount} stale participants from meeting ${meetingId}`;
    } catch (error) {
      console.error(`[CLEANUP_STALE] Error:`, error);
      throw error;
    }
  }

  @Query(() => ParticipantWithLoginInfo, { name: 'getParticipantByUserAndMeeting' })
  @UseGuards(AuthGuard)
  async getParticipantByUserAndMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    console.log('🔍 BACKEND GET_PARTICIPANT_BY_USER_MEETING: Query called', {
      meetingId,
      userId: user._id
    });

    try {
      const result = await this.participantService.getParticipantByUserAndMeeting(
        user._id,
        meetingId
      );
      console.log('✅ BACKEND GET_PARTICIPANT_BY_USER_MEETING: Success', result);
      return result;
    } catch (error) {
      console.error('❌ BACKEND GET_PARTICIPANT_BY_USER_MEETING: Error', error);
      throw error;
    }
  }

  @Mutation(() => String, { name: 'forceLeaveMeeting' })
  @UseGuards(AuthGuard)
  async forceLeaveMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    console.log('🚪 BACKEND FORCE_LEAVE_MEETING: Mutation called', {
      meetingId,
      userId: user._id,
      userEmail: user.email
    });

    try {
      const participant = await this.participantService.getParticipantByUserAndMeeting(
        user._id,
        meetingId
      );

      if (!participant) {
        console.log('🚪 BACKEND FORCE_LEAVE_MEETING: No participant found');
        return 'No participant found for this meeting';
      }

      // 🔍 DEBUG: Log participant role and Role.HOST for comparison
      console.log('🔍 BACKEND FORCE_LEAVE_MEETING: Role comparison debug', {
        participantRole: participant.role,
        roleHost: Role.HOST,
        isEqual: participant.role === Role.HOST,
        roleType: typeof participant.role,
        hostType: typeof Role.HOST
      });

      participant.status = ParticipantStatus.LEFT;
      await participant.save();

      // FIXED: Only end meeting if this is the host AND they explicitly want to end the meeting
      // Regular participant leaving should NOT end the entire meeting
      console.log('🚪 BACKEND FORCE_LEAVE_MEETING: Participant left meeting (meeting continues)');

      console.log('✅ BACKEND FORCE_LEAVE_MEETING: Success - Participant status set to LEFT');
      return `Successfully left meeting ${meetingId}`;
    } catch (error) {
      console.error('❌ BACKEND FORCE_LEAVE_MEETING: Error', error);
      throw error;
    }
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
    // Use the simplified method
    const result = await this.participantService.approveParticipant(approveInput.participantId, user._id);
    return {
      message: `Participant ${result.displayName} has been approved`,
      success: true,
      participant: {
        _id: result._id.toString(),
        displayName: result.displayName,
        status: result.status,
        joinedAt: result.createdAt,
        micState: result.micState,
        cameraState: result.cameraState,
      },
    };
  }

  @Mutation(() => WaitingRoomResponse, { name: 'rejectParticipant' })
  @UseGuards(AuthGuard)
  async rejectParticipant(
    @Args('input') rejectInput: RejectParticipantInput,
    @AuthMember() user: Member,
  ) {
    // Use the simplified method
    const result = await this.participantService.rejectParticipant(rejectInput.participantId, user._id);
    return {
      message: `Participant ${result.displayName} has been rejected`,
      success: true,
    };
  }

  @Mutation(() => WaitingRoomResponse, { name: 'admitParticipant' })
  @UseGuards(AuthGuard)
  async admitParticipant(
    @Args('input') admitInput: AdmitParticipantInput,
    @AuthMember() user: Member,
  ) {
    // Use the simplified method - this is the same as approve
    const result = await this.participantService.approveParticipant(admitInput.participantId, user._id);
    return {
      message: `Participant ${result.displayName} has been admitted to the meeting`,
      success: true,
      participant: {
        _id: result._id.toString(),
        displayName: result.displayName,
        status: result.status,
        joinedAt: result.createdAt,
        micState: result.micState,
        cameraState: result.cameraState,
      },
    };
  }

  // ==================== SIMPLIFIED WAITING ROOM RESOLVERS ====================

  @Query(() => [ParticipantWithLoginInfo], { name: 'getWaitingParticipantsSimple' })
  @UseGuards(AuthGuard)
  async getWaitingParticipantsSimple(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    console.log('⏳ BACKEND GET_WAITING_PARTICIPANTS_SIMPLE: Query called', {
      meetingId,
      userId: user._id,
      userEmail: user.email
    });

    try {
      const result = await this.participantService.getWaitingParticipants(meetingId, user._id);
      console.log('✅ BACKEND GET_WAITING_PARTICIPANTS_SIMPLE: Success', {
        meetingId,
        count: result.length,
        participants: result.map(p => ({ _id: p._id, displayName: p.displayName, status: p.status }))
      });
      return result;
    } catch (error) {
      console.error('❌ BACKEND GET_WAITING_PARTICIPANTS_SIMPLE: Error', error);
      throw error;
    }
  }

  @Mutation(() => ParticipantResponse, { name: 'approveParticipantSimple' })
  @UseGuards(AuthGuard)
  async approveParticipantSimple(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
  ) {
    console.log('✅ BACKEND APPROVE_PARTICIPANT_SIMPLE: Mutation called', {
      participantId,
      userId: user._id,
      userEmail: user.email
    });

    try {
      const result = await this.participantService.approveParticipant(participantId, user._id);
      console.log('✅ BACKEND APPROVE_PARTICIPANT_SIMPLE: Success', {
        participantId: result._id,
        displayName: result.displayName,
        status: result.status
      });
      return result;
    } catch (error) {
      console.error('❌ BACKEND APPROVE_PARTICIPANT_SIMPLE: Error', error);
      throw error;
    }
  }

  @Mutation(() => ParticipantResponse, { name: 'rejectParticipantSimple' })
  @UseGuards(AuthGuard)
  async rejectParticipantSimple(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
  ) {
    console.log('❌ BACKEND REJECT_PARTICIPANT_SIMPLE: Mutation called', {
      participantId,
      userId: user._id,
      userEmail: user.email
    });

    try {
      const result = await this.participantService.rejectParticipant(participantId, user._id);
      console.log('✅ BACKEND REJECT_PARTICIPANT_SIMPLE: Success', {
        participantId: result._id,
        displayName: result.displayName,
        status: result.status
      });
      return result;
    } catch (error) {
      console.error('❌ BACKEND REJECT_PARTICIPANT_SIMPLE: Error', error);
      throw error;
    }
  }

  @Mutation(() => String, { name: 'admitAllWaitingParticipantsSimple' })
  @UseGuards(AuthGuard)
  async admitAllWaitingParticipantsSimple(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    console.log('🚀 BACKEND ADMIT_ALL_WAITING_SIMPLE: Mutation called', {
      meetingId,
      userId: user._id,
      userEmail: user.email
    });

    try {
      const result = await this.participantService.admitAllWaitingParticipants(meetingId, user._id);
      console.log('✅ BACKEND ADMIT_ALL_WAITING_SIMPLE: Success', result);
      return result.message;
    } catch (error) {
      console.error('❌ BACKEND ADMIT_ALL_WAITING_SIMPLE: Error', error);
      throw error;
    }
  }

  // ===== DEVICE TESTING FUNCTIONALITY =====

  @Query(() => DeviceTestResult, { name: 'testDevice' })
  async testDevice(@Args('input') testInput: DeviceTestInput) {
    return this.participantService.testDevice(testInput);
  }

  // ===== HOST CONTROL FUNCTIONALITY =====

  @Mutation(() => ParticipantMessageResponse, { name: 'forceMute' })
  @UseGuards(AuthGuard)
  async forceMute(
    @Args('input') forceMuteInput: ForceMuteInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[FORCE_MUTE] Attempt - Meeting ID: ${forceMuteInput.meetingId}, Participant ID: ${forceMuteInput.participantId}, Track: ${forceMuteInput.track}, Host ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.participantService.forceMuteParticipant(
        forceMuteInput,
        user._id,
      );
      this.logger.log(
        `[FORCE_MUTE] Success - Meeting ID: ${forceMuteInput.meetingId}, Participant ID: ${forceMuteInput.participantId}, Track: ${forceMuteInput.track}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[FORCE_MUTE] Failed - Meeting ID: ${forceMuteInput.meetingId}, Participant ID: ${forceMuteInput.participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'forceMuteParticipant' })
  @UseGuards(AuthGuard)
  async forceMuteParticipant(
    @Args('input') forceMuteInput: ForceMuteInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[FORCE_MUTE_PARTICIPANT] Attempt - Meeting ID: ${forceMuteInput.meetingId}, Participant ID: ${forceMuteInput.participantId}, Track: ${forceMuteInput.track}, Host ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.participantService.forceMuteParticipant(
        forceMuteInput,
        user._id,
      );
      this.logger.log(
        `[FORCE_MUTE_PARTICIPANT] Success - Meeting ID: ${forceMuteInput.meetingId}, Participant ID: ${forceMuteInput.participantId}, Track: ${forceMuteInput.track}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[FORCE_MUTE_PARTICIPANT] Failed - Meeting ID: ${forceMuteInput.meetingId}, Participant ID: ${forceMuteInput.participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'forceCameraOff' })
  @UseGuards(AuthGuard)
  async forceCameraOff(
    @Args('input') forceCameraOffInput: ForceCameraOffInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[FORCE_CAMERA_OFF] Attempt - Meeting ID: ${forceCameraOffInput.meetingId}, Participant ID: ${forceCameraOffInput.participantId}, Host ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.participantService.forceCameraOffParticipant(
        forceCameraOffInput,
        user._id,
      );
      this.logger.log(
        `[FORCE_CAMERA_OFF] Success - Meeting ID: ${forceCameraOffInput.meetingId}, Participant ID: ${forceCameraOffInput.participantId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[FORCE_CAMERA_OFF] Failed - Meeting ID: ${forceCameraOffInput.meetingId}, Participant ID: ${forceCameraOffInput.participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'transferHost' })
  @UseGuards(AuthGuard)
  async transferHost(
    @Args('input') transferHostInput: TransferHostInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[TRANSFER_HOST] Attempt - Meeting ID: ${transferHostInput.meetingId}, New Host Participant ID: ${transferHostInput.newHostParticipantId}, Current Host ID: ${user._id}, Email: ${user.email}`,
    );
    
    // 🔍 ADDITIONAL DEBUG: Log detailed user information
    this.logger.debug(`[TRANSFER_HOST] User details:`, {
      userId: user._id,
      userIdType: typeof user._id,
      userEmail: user.email,
      userSystemRole: user.systemRole,
      userDisplayName: user.displayName
    });
    
    try {
      const result = await this.participantService.transferHost(
        transferHostInput,
        user._id,
      );
      this.logger.log(
        `[TRANSFER_HOST] Success - Meeting ID: ${transferHostInput.meetingId}, New Host Participant ID: ${transferHostInput.newHostParticipantId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[TRANSFER_HOST] Failed - Meeting ID: ${transferHostInput.meetingId}, New Host Participant ID: ${transferHostInput.newHostParticipantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => Boolean, { name: 'canBeHost' })
  @UseGuards(AuthGuard)
  async canBeHost(@AuthMember() user: Member) {
    return this.participantService.canBeHost(user._id);
  }

  @Query(() => MeetingAttendance, { name: 'getMeetingAttendance' })
  @UseGuards(AuthGuard)
  async getMeetingAttendance(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    this.logger.log(`[GET_MEETING_ATTENDANCE_RESOLVER] Called - Meeting ID: ${meetingId}, User ID: ${user._id}, Email: ${user.email}`);
    try {
      const result = await this.participantService.getMeetingAttendance(meetingId, user._id);
      this.logger.log(`[GET_MEETING_ATTENDANCE_RESOLVER] Success - Meeting ID: ${meetingId}, Participants: ${result.totalParticipants}`);
      return result;
    } catch (error) {
      this.logger.error(`[GET_MEETING_ATTENDANCE_RESOLVER] Error - Meeting ID: ${meetingId}, User ID: ${user._id}, Error: ${error.message}`);
      throw error;
    }
  }

  // ==================== SCREEN SHARING RESOLVERS ====================

  @Mutation(() => ScreenShareControlResponse, { name: 'forceScreenShareControl' })
  @UseGuards(AuthGuard)
  async forceScreenShareControl(
    @Args('input') input: ForceScreenShareInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[FORCE_SCREEN_SHARE_CONTROL] Attempt - Meeting ID: ${input.meetingId}, Participant ID: ${input.participantId}, User ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.forceScreenShareControl(input, user._id);
      this.logger.log(
        `[FORCE_SCREEN_SHARE_CONTROL] Success - Participant ID: ${input.participantId}, Screen State: ${input.screenState}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[FORCE_SCREEN_SHARE_CONTROL] Failed - Participant ID: ${input.participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ScreenShareControlResponse, { name: 'updateScreenShareInfo' })
  @UseGuards(AuthGuard)
  async updateScreenShareInfo(
    @Args('input') input: UpdateScreenShareInfoInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[UPDATE_SCREEN_SHARE_INFO] Attempt - Participant ID: ${input.participantId}, User ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.updateScreenShareInfo(input, user._id);
      this.logger.log(
        `[UPDATE_SCREEN_SHARE_INFO] Success - Participant ID: ${input.participantId}, Screen Info: ${input.screenShareInfo}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[UPDATE_SCREEN_SHARE_INFO] Failed - Participant ID: ${input.participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => ScreenShareStatusResponse, { name: 'getScreenShareStatus' })
  @UseGuards(AuthGuard)
  async getScreenShareStatus(
    @Args('input') input: GetScreenShareStatusInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[GET_SCREEN_SHARE_STATUS] Attempt - Meeting ID: ${input.meetingId}, User ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.getScreenShareStatus(input, user._id);
      this.logger.log(
        `[GET_SCREEN_SHARE_STATUS] Success - Meeting ID: ${input.meetingId}, Currently Sharing: ${result.currentlySharingCount}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_SCREEN_SHARE_STATUS] Failed - Meeting ID: ${input.meetingId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => [ScreenShareControlResponse], { name: 'getActiveScreenSharers' })
  @UseGuards(AuthGuard)
  async getActiveScreenSharers(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[GET_ACTIVE_SCREEN_SHARERS] Attempt - Meeting ID: ${meetingId}, User ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.getActiveScreenSharers(meetingId);
      this.logger.log(
        `[GET_ACTIVE_SCREEN_SHARERS] Success - Meeting ID: ${meetingId}, Active Sharers: ${result.length}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_ACTIVE_SCREEN_SHARERS] Failed - Meeting ID: ${meetingId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // ==================== RAISE HAND RESOLVERS ====================

  @Mutation(() => HandRaiseActionResponse, { name: 'raiseHand' })
  @UseGuards(AuthGuard)
  async raiseHand(
    @Args('input') input: RaiseHandInput,
    @AuthMember() user: Member,
  ) {
    console.log('🔍 GRAPHQL RAISE_HAND RESOLVER CALLED:', {
      participantId: input.participantId,
      reason: input.reason,
      userId: user._id,
      userEmail: user.email,
      userDisplayName: user.displayName
    });
    
    this.logger.log(
      `[RAISE_HAND] Attempt - Participant ID: ${input.participantId}, User ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.raiseHand(input, user._id);
      console.log('✅ GRAPHQL RAISE_HAND SUCCESS:', result);
      this.logger.log(
        `[RAISE_HAND] Success - Participant ID: ${input.participantId}, Reason: ${input.reason || 'No reason provided'}`,
      );
      return result;
    } catch (error) {
      console.error('❌ GRAPHQL RAISE_HAND ERROR:', error);
      this.logger.error(
        `[RAISE_HAND] Failed - Participant ID: ${input.participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => HandRaiseActionResponse, { name: 'lowerHand' })
  @UseGuards(AuthGuard)
  async lowerHand(
    @Args('input') input: LowerHandInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[LOWER_HAND] Attempt - Participant ID: ${input.participantId}, User ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.lowerHand(input, user._id);
      this.logger.log(
        `[LOWER_HAND] Success - Participant ID: ${input.participantId}, Reason: ${input.reason || 'No reason provided'}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[LOWER_HAND] Failed - Participant ID: ${input.participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => HandRaiseActionResponse, { name: 'hostLowerHand' })
  @UseGuards(AuthGuard)
  async hostLowerHand(
    @Args('input') input: HostLowerHandInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[HOST_LOWER_HAND] Attempt - Meeting ID: ${input.meetingId}, Participant ID: ${input.participantId}, Host ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.hostLowerHand(input, user._id);
      this.logger.log(
        `[HOST_LOWER_HAND] Success - Participant ID: ${input.participantId}, Reason: ${input.reason || 'No reason provided'}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[HOST_LOWER_HAND] Failed - Participant ID: ${input.participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => HandRaiseActionResponse, { name: 'lowerAllHands' })
  @UseGuards(AuthGuard)
  async lowerAllHands(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[LOWER_ALL_HANDS] Attempt - Meeting ID: ${meetingId}, Host ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.lowerAllHands(meetingId, user._id);
      this.logger.log(
        `[LOWER_ALL_HANDS] Success - Meeting ID: ${meetingId}, Lowered: ${result.length} hands`,
      );
      return {
        success: true,
        message: `Lowered ${result.length} hands`,
        meetingId,
        loweredHandsCount: result.length
      };
    } catch (error) {
      this.logger.error(
        `[LOWER_ALL_HANDS] Failed - Meeting ID: ${meetingId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => RaisedHandsResponse, { name: 'getRaisedHands' })
  @UseGuards(AuthGuard)
  async getRaisedHands(
    @Args('input') input: GetRaisedHandsInput,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[GET_RAISED_HANDS] Attempt - Meeting ID: ${input.meetingId}, User ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.getRaisedHands(input, user._id);
      this.logger.log(
        `[GET_RAISED_HANDS] Success - Meeting ID: ${input.meetingId}, Raised Hands: ${result.totalRaisedHands}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_RAISED_HANDS] Failed - Meeting ID: ${input.meetingId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => HandRaiseActionResponse, { name: 'getParticipantHandStatus' })
  @UseGuards(AuthGuard)
  async getParticipantHandStatus(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
  ) {
    this.logger.log(
      `[GET_PARTICIPANT_HAND_STATUS] Attempt - Participant ID: ${participantId}, User ID: ${user._id}`,
    );
    try {
      const result = await this.participantService.getParticipantHandStatus(participantId);
      this.logger.log(
        `[GET_PARTICIPANT_HAND_STATUS] Success - Participant ID: ${participantId}, Hand Raised: ${result.hasHandRaised}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_PARTICIPANT_HAND_STATUS] Failed - Participant ID: ${participantId}, Error: ${error.message}`,
      );
      throw error;
    }
  }
}
