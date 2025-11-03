import { Resolver, Query, Mutation, Args, ID, Parent } from '@nestjs/graphql';
import { ParticipantService } from './participant.service';
import { MeetingService } from '../meetings/meeting.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { Member } from '../../schemas/Member.model';
import { ParticipantStatus, Role } from '../../libs/enums/enums';
import { SignalingGateway } from '../signaling/signaling.gateway';
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

@Resolver(() => ParticipantWithLoginInfo)
export class ParticipantResolver {
  private readonly logger = new Logger(ParticipantResolver.name)

  constructor(
    private readonly participantService: ParticipantService,
    private readonly meetingService: MeetingService,
    @Inject(forwardRef(() => SignalingGateway))
    private readonly signalingGateway: SignalingGateway,
  ) {}

  // Field resolver for loginInfo - calculates attendance data from sessions
  @Resolver(() => ParticipantWithLoginInfo)
  loginInfo(@Parent() participant: any) {
    if (!participant || !participant.sessions) {
      return {
        totalSessions: 0,
        firstLogin: null,
        lastLogin: null,
        totalDurationMinutes: 0,
        isCurrentlyOnline: participant?.status === 'ADMITTED' || participant?.status === 'APPROVED',
        sessions: []
      };
    }

    const sessions = Array.isArray(participant.sessions) ? participant.sessions : [];
    const now = new Date();
    
    // Calculate total duration from sessions
    let totalDurationSec = participant.totalDurationSec || 0;
    
    // If there's an active session (joinedAt exists but leftAt is null), calculate current duration
    if (sessions.length > 0) {
      const lastSession = sessions[sessions.length - 1];
      if (lastSession.joinedAt && !lastSession.leftAt) {
        const durationMs = now.getTime() - new Date(lastSession.joinedAt).getTime();
        totalDurationSec += Math.floor(durationMs / 1000);
      }
    }

    const totalDurationMinutes = Math.floor(totalDurationSec / 60);
    
    // Find first and last login
    let firstLogin = null;
    let lastLogin = null;
    
    if (sessions.length > 0) {
      const joinedTimes = sessions
        .filter(s => s.joinedAt)
        .map(s => new Date(s.joinedAt).getTime());
      
      if (joinedTimes.length > 0) {
        firstLogin = new Date(Math.min(...joinedTimes));
        lastLogin = new Date(Math.max(...joinedTimes));
      }
    }

    // Convert sessions to SessionInfo format
    const sessionInfos = sessions.map(session => ({
      joinedAt: session.joinedAt,
      leftAt: session.leftAt,
      durationMinutes: Math.floor((session.durationSec || 0) / 60)
    }));

    return {
      totalSessions: sessions.length,
      firstLogin,
      lastLogin,
      totalDurationMinutes,
      isCurrentlyOnline: participant.status === 'ADMITTED' || participant.status === 'APPROVED',
      sessions: sessionInfos
    };
  }

  @Query(() => [ParticipantWithLoginInfo], { name: 'getParticipantsByMeeting' })
  @UseGuards(AuthGuard)
  async getParticipantsByMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ): Promise<any[]> {

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

      return transformedResult;
    } catch (error) {
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

    try {
      const result = await this.participantService.joinMeeting(joinInput, user._id);
      return result;
    } catch (error) {
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
    
    try {
      const deletedCount = await this.participantService.clearFakeParticipants(meetingId);
      return `Successfully cleared ${deletedCount} fake participants from meeting ${meetingId}`;
    } catch (error) {
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

    try {
      const result = await this.participantService.updateParticipantMediaState(participantId, {
        micState: micState as any,
        cameraState: cameraState as any
      });
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => String, { name: 'cleanupDuplicateParticipants' })
  @UseGuards(AuthGuard)
  async cleanupDuplicateParticipants(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    
    try {
      const deletedCount = await this.participantService.cleanupDuplicateParticipants(meetingId);
      return `Successfully cleaned up ${deletedCount} duplicate participants from meeting ${meetingId}`;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => String, { name: 'cleanupStaleParticipants' })
  @UseGuards(AuthGuard)
  async cleanupStaleParticipants(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    
    try {
        const cleanedCount = await this.participantService.cleanupStaleParticipants(10); // 10 seconds threshold - AGGRESSIVE cleanup
      return `Successfully cleaned up ${cleanedCount} stale participants from meeting ${meetingId}`;
    } catch (error) {
      throw error;
    }
  }

  @Query(() => ParticipantWithLoginInfo, { 
    name: 'getParticipantByUserAndMeeting',
    nullable: true 
  })
  @UseGuards(AuthGuard)
  async getParticipantByUserAndMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ): Promise<ParticipantWithLoginInfo | null> {

    try {
      const result = await this.participantService.getParticipantByUserAndMeeting(
        user._id,
        meetingId
      );
      
      // Return null if no participation found (instead of throwing error)
      if (!result) {
        return null;
      }

      // Calculate loginInfo from sessions - filter out invalid sessions without joinedAt
      const sessions = (result.sessions || []).filter(s => s.joinedAt);
      const now = new Date();
      
      // Calculate total duration
      let totalDurationSec = result.totalDurationSec || 0;
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        if (lastSession.joinedAt && !lastSession.leftAt) {
          const durationMs = now.getTime() - new Date(lastSession.joinedAt).getTime();
          totalDurationSec += Math.floor(durationMs / 1000);
        }
      }

      const totalDurationMinutes = Math.floor(totalDurationSec / 60);
      
      // Find first and last login
      let firstLogin = null;
      let lastLogin = null;
      if (sessions.length > 0) {
        const joinedTimes = sessions
          .filter(s => s.joinedAt)
          .map(s => new Date(s.joinedAt).getTime());
        
        if (joinedTimes.length > 0) {
          firstLogin = new Date(Math.min(...joinedTimes));
          lastLogin = new Date(Math.max(...joinedTimes));
        }
      }

      const sessionInfos = sessions
        .filter(session => {
          return !!session.joinedAt;
        })
        .map(session => {
          // If session is active (no leftAt), calculate current duration
          let durationSec = session.durationSec || 0;
          if (session.joinedAt && !session.leftAt) {
            const durationMs = now.getTime() - new Date(session.joinedAt).getTime();
            durationSec = Math.floor(durationMs / 1000);
          }
          
          return {
            joinedAt: session.joinedAt,
            leftAt: session.leftAt,
            durationMinutes: Math.floor(durationSec / 60)
          };
        });

      return {
        _id: result._id.toString(),
        meetingId: result.meetingId.toString(),
        user: result.userId ? {
          _id: result.userId._id.toString(),
          email: (result.userId as any).email,
          displayName: (result.userId as any).displayName,
          avatarUrl: (result.userId as any).avatarUrl,
          organization: (result.userId as any).organization,
          department: (result.userId as any).department,
        } : undefined,
        displayName: result.displayName,
        role: result.role,
        status: result.status,
        micState: result.micState,
        cameraState: result.cameraState,
        socketId: result.socketId,
        hasHandRaised: result.hasHandRaised,
        handRaisedAt: result.handRaisedAt,
        handLoweredAt: result.handLoweredAt,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        loginInfo: {
          totalSessions: sessions.length,
          firstLogin,
          lastLogin,
          totalDurationMinutes,
          isCurrentlyOnline: result.status === 'ADMITTED' || result.status === 'APPROVED',
          sessions: sessionInfos
        }
      };
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => String, { name: 'forceLeaveMeeting' })
  @UseGuards(AuthGuard)
  async forceLeaveMeeting(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {

    try {
      const participant = await this.participantService.getParticipantByUserAndMeeting(
        user._id,
        meetingId
      );

      if (!participant) {
        return 'No participant found for this meeting';
      }

      // 🔍 DEBUG: Log participant role and Role.HOST for comparison

      participant.status = ParticipantStatus.LEFT;
      await participant.save();

      // 👇 FIXED: Always try to end meeting if user is the meeting host (by checking meeting.hostId)
      // This bypasses the role check issue and ensures host can always end meeting
      try {
        await this.meetingService.endMeeting(meetingId, user._id);
      } catch (error) {
        // Don't throw error here - participant is already marked as LEFT
        // Just log the error and continue
      }

      return `Successfully left meeting ${meetingId}`;
    } catch (error) {
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

    try {
      const result = await this.participantService.getWaitingParticipants(meetingId, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => ParticipantResponse, { name: 'approveParticipantSimple' })
  @UseGuards(AuthGuard)
  async approveParticipantSimple(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
  ) {

    try {
      const result = await this.participantService.approveParticipant(participantId, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => ParticipantResponse, { name: 'rejectParticipantSimple' })
  @UseGuards(AuthGuard)
  async rejectParticipantSimple(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
  ) {

    try {
      const result = await this.participantService.rejectParticipant(participantId, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => String, { name: 'admitAllWaitingParticipantsSimple' })
  @UseGuards(AuthGuard)
  async admitAllWaitingParticipantsSimple(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {

    try {
      const result = await this.participantService.admitAllWaitingParticipants(meetingId, user._id);
      return result.message;
    } catch (error) {
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
    try {
      const result = await this.participantService.forceMuteParticipant(
        forceMuteInput,
        user._id,
      );
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'forceMuteParticipant' })
  @UseGuards(AuthGuard)
  async forceMuteParticipant(
    @Args('input') forceMuteInput: ForceMuteInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.forceMuteParticipant(
        forceMuteInput,
        user._id,
      );
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'forceCameraOff' })
  @UseGuards(AuthGuard)
  async forceCameraOff(
    @Args('input') forceCameraOffInput: ForceCameraOffInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.forceCameraOffParticipant(
        forceCameraOffInput,
        user._id,
      );
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'transferHost' })
  @UseGuards(AuthGuard)
  async transferHost(
    @Args('input') transferHostInput: TransferHostInput,
    @AuthMember() user: Member,
  ) {
    
    // 🔍 ADDITIONAL DEBUG: Log detailed user information
    
    try {
      const result = await this.participantService.transferHost(
        transferHostInput,
        user._id,
      );
      
      // ✅ Emit WebSocket event to notify new host with LiveKit token
      if (result.newLiveKitToken && result.newHostId) {
        this.logger.log(`[TRANSFER_HOST] Emitting host-transfer event to: ${result.newHostId}`);
        this.signalingGateway.emitHostTransfer(
          result.newHostId,
          result.newLiveKitToken,
          transferHostInput.meetingId
        );
      }
      
      return result;
    } catch (error) {
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
    try {
      const result = await this.participantService.getMeetingAttendance(meetingId, user._id);
      return result;
    } catch (error) {
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
    try {
      const result = await this.participantService.forceScreenShareControl(input, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => ScreenShareControlResponse, { name: 'updateScreenShareInfo' })
  @UseGuards(AuthGuard)
  async updateScreenShareInfo(
    @Args('input') input: UpdateScreenShareInfoInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.updateScreenShareInfo(input, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Query(() => ScreenShareStatusResponse, { name: 'getScreenShareStatus' })
  @UseGuards(AuthGuard)
  async getScreenShareStatus(
    @Args('input') input: GetScreenShareStatusInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.getScreenShareStatus(input, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Query(() => [ScreenShareControlResponse], { name: 'getActiveScreenSharers' })
  @UseGuards(AuthGuard)
  async getActiveScreenSharers(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.getActiveScreenSharers(meetingId);
      return result;
    } catch (error) {
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
    
    try {
      const result = await this.participantService.raiseHand(input, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => HandRaiseActionResponse, { name: 'lowerHand' })
  @UseGuards(AuthGuard)
  async lowerHand(
    @Args('input') input: LowerHandInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.lowerHand(input, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => HandRaiseActionResponse, { name: 'hostLowerHand' })
  @UseGuards(AuthGuard)
  async hostLowerHand(
    @Args('input') input: HostLowerHandInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.hostLowerHand(input, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => HandRaiseActionResponse, { name: 'lowerAllHands' })
  @UseGuards(AuthGuard)
  async lowerAllHands(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.lowerAllHands(meetingId, user._id);
      return {
        success: true,
        message: `Lowered ${result.length} hands`,
        meetingId,
        loweredHandsCount: result.length
      };
    } catch (error) {
      throw error;
    }
  }

  @Query(() => RaisedHandsResponse, { name: 'getRaisedHands' })
  @UseGuards(AuthGuard)
  async getRaisedHands(
    @Args('input') input: GetRaisedHandsInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.getRaisedHands(input, user._id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Query(() => HandRaiseActionResponse, { name: 'getParticipantHandStatus' })
  @UseGuards(AuthGuard)
  async getParticipantHandStatus(
    @Args('participantId', { type: () => ID }) participantId: string,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.participantService.getParticipantHandStatus(participantId);
      return result;
    } catch (error) {
      throw error;
    }
  }
}
