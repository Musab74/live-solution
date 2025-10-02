import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { HostValidationUtil } from '../../utils/host-validation.util';
import { MeetingUtils } from '../../utils/meeting-utils';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Participant,
  ParticipantDocument,
} from '../../schemas/Participant.model';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { LivekitService } from '../signaling/livekit.service';
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
} from '../../libs/DTO/participant/participant.mutation';
import {
  ForceScreenShareInput,
  UpdateScreenShareInfoInput,
  GetScreenShareStatusInput,
} from '../../libs/DTO/participant/screen-sharing.input';
import {
  ScreenShareStatusResponse,
  ScreenShareControlResponse,
  ScreenShareInfo,
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
  HandRaiseInfo,
} from '../../libs/DTO/participant/raise-hand.query';
import {
  PreMeetingSetupInput,
  ApproveParticipantInput,
  RejectParticipantInput,
  AdmitParticipantInput,
  DeviceTestInput,
} from '../../libs/DTO/participant/waiting-room.input';
import {
  Role,
  MediaState,
  ParticipantStatus,
  MediaTrack,
  SystemRole,
  MeetingStatus,
} from '../../libs/enums/enums';

@Injectable()
export class ParticipantService {
  private readonly logger = new Logger(ParticipantService.name);

  constructor(
    @InjectModel(Participant.name)
    private participantModel: Model<ParticipantDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private readonly livekitService: LivekitService,
  ) {}

  async getParticipantsByMeeting(meetingId: string, userId: string): Promise<Participant[]> {
    console.log(`[DEBUG] getParticipantsByMeeting - meetingId: ${meetingId}, userId: ${userId}`);

    // First, check if meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      console.log(`[DEBUG] getParticipantsByMeeting - Meeting not found: ${meetingId}`);
      throw new NotFoundException('Meeting not found');
    }

    console.log(`[DEBUG] getParticipantsByMeeting - Meeting found: ${meeting.title}, participantCount: ${meeting.participantCount}`);

    // Query participants with proper ObjectId conversion and populate user data
    // For hosts: return all participants (including WAITING) for management
    // For participants: only return admitted participants
    // 🔧 FIX: Check both original host (hostId) and current host (currentHostId)
    const isOriginalHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
    const isCurrentHost = meeting.currentHostId ? MeetingUtils.isMeetingHost(meeting.currentHostId, userId) : false;
    const isHost = isOriginalHost || isCurrentHost; // User is host if they are either original or current host
    const statusFilter = isHost
      ? { $in: [ParticipantStatus.WAITING, ParticipantStatus.ADMITTED, ParticipantStatus.APPROVED] } // Host sees all active participants
      : { $in: [ParticipantStatus.ADMITTED, ParticipantStatus.APPROVED] }; // Participants only see admitted ones

    console.log(`[DEBUG] getParticipantsByMeeting - Host detection: meeting.hostId:`, meeting.hostId, 'userId:', userId, 'isHost:', isHost);

    // Filter by fresh participants (seen within last 10 seconds) - AGGRESSIVE cleanup
    const threshold = new Date(Date.now() - (10 * 1000));
    
    const participants = await this.participantModel.find({
      meetingId: new Types.ObjectId(meetingId),
      status: statusFilter,
      lastSeenAt: { $gte: threshold } // Only show participants seen within last 30 seconds
    }).populate('userId', 'email displayName systemRole avatarUrl');

    console.log(`[DEBUG] getParticipantsByMeeting - Found ${participants.length} active participants (excluding LEFT)`);

    // Debug each participant
    participants.forEach((participant, index) => {
      console.log(`[DEBUG] Participant ${index}:`, {
        _id: participant._id,
        meetingId: participant.meetingId,
        userId: participant.userId,
        displayName: participant.displayName,
        role: participant.role,
        status: participant.status,
        realDisplayName: (participant.userId as any)?.displayName || participant.displayName
      });
    });

    return participants;
  }

  async getParticipantStats(meetingId: string, userId: string) {
    // Verify the meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is either the host or a participant in this meeting
    const isHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
    let isParticipant = false;

    if (!isHost) {
      // Check if user is a participant in this meeting
      const userParticipant = await this.participantModel.findOne({
        meetingId,
        userId: new Types.ObjectId(userId),
        status: { $in: ['APPROVED', 'ADMITTED'] },
      });
      isParticipant = !!userParticipant;
    }

    if (!isHost && !isParticipant) {
      throw new ForbiddenException(
        'You must be the host or a participant in this meeting to view participant stats',
      );
    }

    const participants = await this.participantModel.find({ meetingId }).lean();

    const stats = {
      totalParticipants: participants.length,
      currentlyOnline: participants.filter((p) => {
        const sessions = p.sessions || [];
        return sessions.length > 0 && !sessions[sessions.length - 1].leftAt;
      }).length,
      totalSessions: participants.reduce(
        (sum, p) => sum + (p.sessions?.length || 0),
        0,
      ),
      averageSessionDuration: 0,
      totalMeetingDuration: 0,
      // Additional stats for frontend
      activeParticipants: participants.filter((p) => {
        const sessions = p.sessions || [];
        return sessions.length > 0 && !sessions[sessions.length - 1].leftAt;
      }).length,
      mutedParticipants: participants.filter((p) =>
        p.micState === 'OFF' || p.micState === 'MUTED' || p.micState === 'MUTED_BY_HOST'
      ).length,
      cameraOffParticipants: participants.filter((p) =>
        p.cameraState === 'OFF' || p.cameraState === 'OFF_BY_HOST'
      ).length,
      raisedHandsCount: participants.filter((p) => p.hasHandRaised).length,
      screenSharersCount: participants.filter((p) => p.screenState === 'ON').length,
    };

    // Calculate average session duration
    const allSessions = participants.flatMap((p) => p.sessions || []);
    if (allSessions.length > 0) {
      const totalDuration = allSessions.reduce(
        (sum, session) => sum + session.durationSec,
        0,
      );
      stats.averageSessionDuration = Math.round(
        totalDuration / allSessions.length / 60,
      ); // in minutes
    }

    // Calculate total meeting duration (from first join to last leave)
    if (allSessions.length > 0) {
      const firstJoin = Math.min(
        ...allSessions.map((s) => s.joinedAt.getTime()),
      );
      const lastLeave = Math.max(
        ...allSessions.map((s) => s.leftAt?.getTime() || new Date().getTime()),
      );
      stats.totalMeetingDuration = Math.round(
        (lastLeave - firstJoin) / 1000 / 60,
      ); // in minutes
    }

    return stats;
  }

  async createParticipant(createInput: CreateParticipantInput, hostId: string) {
    const { meetingId, userId, displayName, role } = createInput;

    // Verify the meeting exists and the user is the host
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (!MeetingUtils.isMeetingHost(meeting.hostId, hostId)) {
      throw new ForbiddenException(
        'Only the meeting host can add participants',
      );
    }

    // Check if participant already exists
    const existingParticipant = await this.participantModel.findOne({
      meetingId,
      userId: userId ? new Types.ObjectId(userId) : null,
    });

    if (existingParticipant) {
      throw new ConflictException('Participant already exists in this meeting');
    }

    // Create new participant
    const newParticipant = new this.participantModel({
      meetingId: new Types.ObjectId(meetingId),
      userId: userId ? new Types.ObjectId(userId) : null,
      displayName,
      role: role || Role.PARTICIPANT,
      micState: MediaState.OFF,
      cameraState: MediaState.OFF,
      sessions: [],
      totalDurationSec: 0,
    });

    const savedParticipant = await newParticipant.save();

    // Update participant count
    await this.meetingModel.findByIdAndUpdate(meetingId, {
      $inc: { participantCount: 1 },
    });

    return savedParticipant;
  }

  async updateParticipant(updateInput: UpdateParticipantInput, hostId: string) {
    const { participantId, displayName, role, micState, cameraState } =
      updateInput;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host of the meeting
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting || !MeetingUtils.isMeetingHost(meeting.hostId, hostId)) {
      throw new ForbiddenException(
        'Only the meeting host can update participants',
      );
    }

    // Update allowed fields
    if (displayName) participant.displayName = displayName;
    if (role) participant.role = role;
    if (micState) participant.micState = micState;
    if (cameraState) participant.cameraState = cameraState;

    await participant.save();
    return participant;
  }

  async removeParticipant(participantId: string, hostId: string) {
    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host of the meeting (either original or current host)
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting || !MeetingUtils.isCurrentMeetingHost(meeting, hostId)) {
      throw new ForbiddenException(
        'Only the meeting host can remove participants',
      );
    }

    // Add user to ban list if they have a userId (not a guest)
    if (participant.userId) {
      const userId = participant.userId.toString();
      const bannedUserIds = meeting.bannedUserIds || [];
      
      if (!bannedUserIds.includes(userId)) {
        bannedUserIds.push(userId);
        await this.meetingModel.findByIdAndUpdate(participant.meetingId, {
          bannedUserIds: bannedUserIds,
        });
      }
    }

    // Remove the participant
    await this.participantModel.findByIdAndDelete(participantId);

    // Update participant count
    await this.meetingModel.findByIdAndUpdate(participant.meetingId, {
      $inc: { participantCount: -1 },
    });


    return { 
      success: true, 
      message: 'Participant removed and banned from rejoining',
      removedParticipant: {
        userId: participant.userId?.toString(),
        meetingId: participant.meetingId,
        displayName: participant.displayName
      }
    };
  }

  async unbanParticipant(meetingId: string, userIdToUnban: string, hostId: string) {
    // Verify the user is the host of the meeting (either original or current host)
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting || !MeetingUtils.isCurrentMeetingHost(meeting, hostId)) {
      throw new ForbiddenException(
        'Only the meeting host can unban participants',
      );
    }

    // Remove user from ban list
    const bannedUserIds = meeting.bannedUserIds || [];
    const updatedBannedUserIds = bannedUserIds.filter(id => id !== userIdToUnban);
    
    await this.meetingModel.findByIdAndUpdate(meetingId, {
      bannedUserIds: updatedBannedUserIds,
    });

    return { 
      success: true, 
      message: 'Participant unbanned and can now rejoin' 
    };
  }

  async getParticipantById(participantId: string, userId: string) {
    // Find the participant
    const participant = await this.participantModel
      .findById(participantId)
      .populate('userId', 'email displayName avatarUrl organization department')
      .lean();

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host or the participant themselves
    const meeting = await this.meetingModel.findById(participant.meetingId);
    const isHost = meeting && MeetingUtils.isCurrentMeetingHost(meeting, userId);
    const isOwner =
      participant.userId && participant.userId.toString() === userId;

    if (!isHost && !isOwner) {
      throw new ForbiddenException(
        'You can only view your own participation or be the host',
      );
    }

    return participant;
  }

  async joinMeeting(joinInput: JoinParticipantInput, userId?: string) {
    console.log(`[JOIN_MEETING] Starting - meetingId: ${joinInput.meetingId}, userId: ${userId}, displayName: ${joinInput.displayName}`);

    const { meetingId, displayName, inviteCode } = joinInput;

    console.log(`[JOIN_MEETING] Starting - meetingId: ${meetingId}, userId: ${userId}, displayName: ${displayName}`);

    // Verify the meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      console.log(`[JOIN_MEETING] Meeting not found: ${meetingId}`);
      throw new NotFoundException('Meeting not found');
    }

    console.log(`[JOIN_MEETING] Meeting found: ${meeting.title}, hostId: ${meeting.hostId}`);

    // Check if meeting is active
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('This meeting has ended');
    }

    // Check if room is locked
    if (meeting.isLocked) {
      throw new ForbiddenException('This room is currently locked');
    }

    // Check if user is banned from this meeting
    if (userId && meeting.bannedUserIds && meeting.bannedUserIds.includes(userId)) {
      throw new ForbiddenException('You have been removed from this meeting and cannot rejoin');
    }

    // Determine if participant should go to waiting room
    // 🔧 FIX: Check both original host (hostId) and current host (currentHostId)
    const isOriginalHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
    const isCurrentHost = meeting.currentHostId ? MeetingUtils.isMeetingHost(meeting.currentHostId, userId) : false;
    const isHost = isOriginalHost || isCurrentHost; // User is host if they are either original or current host

    // Hosts always get admitted directly, others go to waiting room if meeting not started
    const shouldGoToWaitingRoom =
      !isHost && meeting.status !== MeetingStatus.LIVE;


    console.log(`[JOIN_MEETING] Waiting room check - User ID: ${userId}, Meeting Host ID: ${meeting.hostId}, Is Host: ${isHost}, Meeting Status: ${meeting.status}, Should Wait: ${shouldGoToWaitingRoom}`);

    // Get user info to use real display name
    let realDisplayName = displayName || 'Anonymous';
    if (userId) {
      const user = await this.memberModel.findById(userId);
      if (user && user.displayName) {
        realDisplayName = user.displayName;
        console.log(`[JOIN_MEETING] Using real display name: ${realDisplayName}`);
      } else {
        console.log(`[JOIN_MEETING] User not found or no displayName, using: ${realDisplayName}`);
      }
    }

    // Check if user is already a participant
    // Check if user is already a participant
    if (userId) {
      const existingParticipant = await this.participantModel.findOne({
        meetingId: new Types.ObjectId(meetingId),
        userId: new Types.ObjectId(userId),
      });

      if (existingParticipant) {
        console.log(`[JOIN_MEETING] User already a participant, updating status and displayName`);

        // Always refresh display name and update lastSeenAt
        existingParticipant.displayName = realDisplayName;
        existingParticipant.lastSeenAt = new Date();

        const prevStatus = existingParticipant.status;

        // FIXED: If participant was previously LEFT, reset their status properly
        if (prevStatus === ParticipantStatus.LEFT) {
          console.log(`[JOIN_MEETING] Participant ${existingParticipant._id} was LEFT, resetting status`);
          // Clear any existing sessions since they left
          existingParticipant.sessions = [];
        }

        if (isHost) {
          // Host joins immediately
          existingParticipant.status = ParticipantStatus.ADMITTED;
          existingParticipant.sessions.push({
            joinedAt: new Date(),
            leftAt: undefined,
            durationSec: 0,
          });

          // Increment count if they weren't already admitted
          if (prevStatus !== ParticipantStatus.ADMITTED) {
            await this.meetingModel.findByIdAndUpdate(meetingId, { $inc: { participantCount: 1 } });
          }
        } else {
          // Non-host behavior
          if (meeting.status !== MeetingStatus.LIVE) {
            // Meeting not started => force waiting even if they were previously admitted
            existingParticipant.status = ParticipantStatus.WAITING;
            console.log(`[JOIN_MEETING] Participant ${existingParticipant._id} forced to WAITING (meeting not LIVE)`);
            // IMPORTANT: do NOT create a session while waiting
          } else {
            // Meeting is live => admit and start a session
            existingParticipant.status = ParticipantStatus.ADMITTED;
            existingParticipant.sessions.push({
              joinedAt: new Date(),
              leftAt: undefined,
              durationSec: 0,
            });

            // Increment count if they weren't already admitted
            if (prevStatus !== ParticipantStatus.ADMITTED) {
              await this.meetingModel.findByIdAndUpdate(meetingId, { $inc: { participantCount: 1 } });
            }
          }
        }

        await existingParticipant.save();
        return existingParticipant;
      }
    }


    // Determine participant role based on whether user is the host
    const participantRole = isHost ? 'HOST' : 'PARTICIPANT';

    console.log(`[JOIN_MEETING] Role determination - User ID: ${userId}, Meeting Host ID: ${meeting.hostId}, Is Host: ${isHost}, Role: ${participantRole}`);

    // Determine initial status based on waiting room logic
    const initialStatus = shouldGoToWaitingRoom ? ParticipantStatus.WAITING : ParticipantStatus.ADMITTED;

    console.log(`[JOIN_MEETING] Initial status - ${initialStatus} (shouldGoToWaitingRoom: ${shouldGoToWaitingRoom})`);

    // Create new participant with appropriate status
    const newParticipant = new this.participantModel({
      meetingId: new Types.ObjectId(meetingId),
      userId: userId ? new Types.ObjectId(userId) : null,
      displayName: realDisplayName,
      role: participantRole,
      status: initialStatus,
      lastSeenAt: new Date(), // Initialize lastSeenAt for presence tracking
      sessions: initialStatus === ParticipantStatus.ADMITTED ? [{
        joinedAt: new Date(),
        leftAt: undefined,
        durationSec: 0,
      }] : [], // Only add session if admitted directly
    });

    const savedParticipant = await newParticipant.save();
    console.log(`[JOIN_MEETING] Participant created: ${savedParticipant._id} with displayName: ${realDisplayName} and status: ${initialStatus}`);

    // Only update participant count if participant is admitted directly
    if (initialStatus === ParticipantStatus.ADMITTED) {
      await this.meetingModel.findByIdAndUpdate(meetingId, {
        $inc: { participantCount: 1 },
      });
      console.log(`[JOIN_MEETING] Updated participant count for admitted participant`);
    } else {
      console.log(`[JOIN_MEETING] Participant sent to waiting room - not counting in participant count`);
    }

    console.log(`[JOIN_MEETING] Success - Participant ID: ${savedParticipant._id}`);

    return savedParticipant;
  }

  async leaveMeeting(leaveInput: LeaveMeetingInput, userId?: string) {
    const { participantId } = leaveInput;

    console.log(`[LEAVE_MEETING] Starting - participantId: ${participantId}, userId: ${userId}`);

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      console.log(`[LEAVE_MEETING] Participant not found: ${participantId}`);
      throw new NotFoundException('Participant not found');
    }

    // Verify the user owns this participant or is the host
    const meeting = await this.meetingModel.findById(participant.meetingId);
    const hostId = meeting?.hostId?._id ? meeting.hostId._id.toString() : meeting?.hostId?.toString();
    const isHost = meeting && hostId && hostId === userId?.toString();

    // Fix: check both by userId (Member) and participantId (Participant doc)
    const isOwner =
      participant.userId && participant.userId.toString() === userId?.toString();
    const isSelf = participant._id.toString() === participantId.toString();

    if (!isHost && !isOwner && !isSelf) {
      console.log(
        `[LEAVE_MEETING] Forbidden - User ${userId} cannot leave participant ${participantId}`
      );
      throw new ForbiddenException('You can only leave your own participation');
    }


    // Update the last session with leave time
    const sessions = participant.sessions || [];
    if (sessions.length > 0) {
      const lastSession = sessions[sessions.length - 1];
      if (!lastSession.leftAt && lastSession.joinedAt) {
        const now = new Date();
        lastSession.leftAt = now;
        lastSession.durationSec = Math.floor(
          (now.getTime() - lastSession.joinedAt.getTime()) / 1000,
        );
        participant.totalDurationSec += lastSession.durationSec;
      }
    }

    // CRITICAL: Set status to LEFT so participant doesn't appear in active participants
    participant.status = ParticipantStatus.LEFT;

    await participant.save();

    console.log(`[LEAVE_MEETING] Success - Participant ${participantId} (${participant.displayName}) status set to LEFT`);
    
    // 🔧 DEBUG: Verify the status was actually saved
    const updatedParticipant = await this.participantModel.findById(participantId);
    console.log(`[LEAVE_MEETING] Verification - Participant status after save: ${updatedParticipant?.status}`);
    
    return { message: 'Successfully left the meeting' };
  }

  async updateSession(updateInput: UpdateSessionInput, userId?: string) {
    const { participantId, action } = updateInput;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user owns this participant or is the host
    const meeting = await this.meetingModel.findById(participant.meetingId);
    const isHost = meeting && MeetingUtils.isMeetingHost(meeting.hostId, userId);
    const isOwner =
      participant.userId && participant.userId.toString() === userId;

    if (!isHost && !isOwner) {
      throw new ForbiddenException(
        'You can only update your own participation',
      );
    }

    const now = new Date();
    const sessions = participant.sessions || [];

    if (action === 'join') {
      // Add new session
      sessions.push({
        joinedAt: now,
        leftAt: undefined,
        durationSec: 0,
      });
    } else if (action === 'leave') {
      // Update last session
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        if (!lastSession.leftAt && lastSession.joinedAt) {
          lastSession.leftAt = now;
          lastSession.durationSec = Math.floor(
            (now.getTime() - lastSession.joinedAt.getTime()) / 1000,
          );
          participant.totalDurationSec += lastSession.durationSec;
        }
      }
    } else {
      throw new BadRequestException('Invalid action. Use "join" or "leave"');
    }

    participant.sessions = sessions;
    await participant.save();

    return { message: `Successfully ${action}ed the meeting` };
  }

  // ===== WAITING ROOM FUNCTIONALITY =====

  async preMeetingSetup(setupInput: PreMeetingSetupInput, userId?: string) {
    const {
      meetingId,
      displayName,
      inviteCode,
      joinWithCameraOff,
      joinWithMicOff,
      joinWithSpeakerOff,
    } = setupInput;

    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check invite code if provided
    if (inviteCode && meeting.inviteCode !== inviteCode) {
      throw new ForbiddenException('Invalid invite code');
    }

    // Create participant in WAITING status
    const participant = new this.participantModel({
      meetingId,
      userId: userId ? new Types.ObjectId(userId) : undefined,
      displayName,
      role: Role.PARTICIPANT,
      status: ParticipantStatus.WAITING,
      micState: joinWithMicOff ? MediaState.OFF : MediaState.OFF,
      cameraState: joinWithCameraOff ? MediaState.OFF : MediaState.OFF,
    });

    await participant.save();

    return {
      message: 'Successfully joined waiting room',
      participant: {
        _id: participant._id.toString(),
        displayName: participant.displayName,
        status: participant.status,
        joinedAt: participant.createdAt,
        micState: participant.micState,
        cameraState: participant.cameraState,
      },
    };
  }


  async getWaitingRoomStats(meetingId: string, userId: string) {
    // Verify the meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is either the host or a participant in this meeting
    const isHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
    let isParticipant = false;

    if (!isHost) {
      // Check if user is a participant in this meeting
      const userParticipant = await this.participantModel.findOne({
        meetingId,
        userId: new Types.ObjectId(userId),
        status: { $in: ['APPROVED', 'ADMITTED'] },
      });
      isParticipant = !!userParticipant;
    }

    if (!isHost && !isParticipant) {
      throw new ForbiddenException(
        'You must be the host or a participant in this meeting to view waiting room stats',
      );
    }

    // Filter by fresh participants (seen within last 10 seconds) - AGGRESSIVE cleanup
    const threshold = new Date(Date.now() - (10 * 1000));
    
    const stats = await this.participantModel.aggregate([
      { 
        $match: { 
          meetingId: new Types.ObjectId(meetingId),
          lastSeenAt: { $gte: threshold } // Only count participants seen within last 30 seconds
        } 
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      totalWaiting: 0,
      totalApproved: 0,
      totalRejected: 0,
      totalAdmitted: 0,
    };

    stats.forEach((stat) => {
      switch (stat._id) {
        case ParticipantStatus.WAITING:
          result.totalWaiting = stat.count;
          break;
        case ParticipantStatus.APPROVED:
          result.totalApproved = stat.count;
          break;
        case ParticipantStatus.REJECTED:
          result.totalRejected = stat.count;
          break;
        case ParticipantStatus.ADMITTED:
          result.totalAdmitted = stat.count;
          break;
      }
    });

    return result;
  }

  // ===== DEVICE TESTING FUNCTIONALITY =====

  async testDevice(testInput: DeviceTestInput) {
    const { deviceType, deviceId } = testInput;

    // This is a mock implementation - in a real app, you'd use WebRTC APIs
    // to actually test the devices
    const mockResults = {
      camera: {
        isWorking: true,
        deviceName: 'Default Camera',
        errorMessage: null,
      },
      microphone: {
        isWorking: true,
        deviceName: 'Default Microphone',
        volumeLevel: 75,
        errorMessage: null,
      },
      speaker: {
        isWorking: true,
        deviceName: 'Default Speaker',
        volumeLevel: 50,
        errorMessage: null,
      },
    };

    const result = mockResults[deviceType as keyof typeof mockResults];

    if (!result) {
      throw new BadRequestException('Invalid device type');
    }

    return {
      deviceType,
      isWorking: result.isWorking,
      deviceName: result.deviceName,
      volumeLevel: 'volumeLevel' in result ? result.volumeLevel : undefined,
      errorMessage: result.errorMessage,
    };
  }

  // Force mute participant (host/co-host only)
  async forceMuteParticipant(
    input: ForceMuteInput,
    hostId: string,
  ): Promise<{ success: boolean; message: string }> {
    const { meetingId, participantId, track, reason } = input;

    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify host is authorized (host or co-host)
    const hostParticipant = await this.participantModel.findOne({
      meetingId: new Types.ObjectId(meetingId),
      userId: new Types.ObjectId(hostId),
      role: { $in: [Role.HOST, Role.CO_HOST] },
    });


    if (!hostParticipant) {
      throw new ForbiddenException(
        'Only hosts and co-hosts can force mute participants',
      );
    }

    // Find target participant
    const targetParticipant = await this.participantModel.findOne({
      _id: participantId,
      meetingId,
    });

    if (!targetParticipant) {
      throw new NotFoundException('Participant not found');
    }

    // Don't allow muting other hosts/co-hosts unless you're the main host
    if (
      targetParticipant.role === Role.HOST &&
      hostParticipant.role !== Role.HOST
    ) {
      throw new ForbiddenException('Only the main host can mute other hosts');
    }

    if (
      targetParticipant.role === Role.CO_HOST &&
      hostParticipant.role !== Role.HOST
    ) {
      throw new ForbiddenException('Only the main host can mute co-hosts');
    }

    // Update participant's media state
    const updateData: any = {};
    if (track === MediaTrack.MIC) {
      updateData.micState = MediaState.MUTED;
    } else if (track === MediaTrack.CAMERA) {
      updateData.cameraState = MediaState.OFF;
    }

    await this.participantModel.findByIdAndUpdate(participantId, updateData);

    return {
      success: true,
      message: `Successfully ${track === MediaTrack.MIC ? 'muted' : 'turned off camera for'} participant`,
    };
  }

  // Force camera off participant (host/co-host only)
  async forceCameraOffParticipant(
    input: ForceCameraOffInput,
    hostId: string,
  ): Promise<{ success: boolean; message: string }> {
    const { meetingId, participantId, reason } = input;

    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify host is authorized (host or co-host)
    const hostParticipant = await this.participantModel.findOne({
      meetingId,
      userId: hostId,
      role: { $in: [Role.HOST, Role.CO_HOST] },
    });

    if (!hostParticipant) {
      throw new ForbiddenException(
        'Only hosts and co-hosts can force camera off participants',
      );
    }

    // Find target participant
    const targetParticipant = await this.participantModel.findOne({
      _id: participantId,
      meetingId,
    });

    if (!targetParticipant) {
      throw new NotFoundException('Participant not found');
    }

    // Don't allow turning off camera for other hosts/co-hosts unless you're the main host
    if (
      targetParticipant.role === Role.HOST &&
      hostParticipant.role !== Role.HOST
    ) {
      throw new ForbiddenException(
        'Only the main host can turn off camera for other hosts',
      );
    }

    if (
      targetParticipant.role === Role.CO_HOST &&
      hostParticipant.role !== Role.HOST
    ) {
      throw new ForbiddenException(
        'Only the main host can turn off camera for co-hosts',
      );
    }

    // Update participant's camera state
    await this.participantModel.findByIdAndUpdate(participantId, {
      cameraState: MediaState.OFF,
    });

    return {
      success: true,
      message: 'Successfully turned off camera for participant',
    };
  }

  // Transfer host role to another participant
  async transferHost(
    input: TransferHostInput,
    currentHostId: string,
  ): Promise<{ success: boolean; message: string; newHostId: string; newHostParticipantId: string }> {
    const { meetingId, newHostParticipantId, reason } = input;

    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) throw new NotFoundException('Meeting not found');

    // 🔍 IMPROVED: Use comprehensive host validation utility
    const user = await this.memberModel.findById(currentHostId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 🔍 ADDITIONAL DEBUG: Log detailed comparison data
    this.logger.debug(`[TRANSFER_HOST] Detailed comparison data:`, {
      meetingHostId: meeting.hostId,
      meetingHostIdType: typeof meeting.hostId,
      meetingHostIdString: meeting.hostId?.toString(),
      currentHostId: currentHostId,
      currentHostIdType: typeof currentHostId,
      currentHostIdString: currentHostId?.toString(),
      userFromDB: user,
      userFromDBId: user._id,
      userFromDBIdType: typeof user._id,
      userFromDBIdString: user._id?.toString()
    });

    // 🔍 CRITICAL DEBUG: Test the comparison logic directly
    const directComparison = meeting.hostId?.toString() === currentHostId?.toString();
    const utilityComparison = MeetingUtils.isMeetingHost(meeting.hostId, currentHostId);
    
    this.logger.warn(`[TRANSFER_HOST] CRITICAL DEBUG - Direct comparison: ${directComparison}`);
    this.logger.warn(`[TRANSFER_HOST] CRITICAL DEBUG - Utility comparison: ${utilityComparison}`);
    this.logger.warn(`[TRANSFER_HOST] CRITICAL DEBUG - Meeting hostId: ${meeting.hostId?.toString()}`);
    this.logger.warn(`[TRANSFER_HOST] CRITICAL DEBUG - Current hostId: ${currentHostId?.toString()}`);
    this.logger.warn(`[TRANSFER_HOST] CRITICAL DEBUG - Are they equal? ${meeting.hostId?.toString() === currentHostId?.toString()}`);

    const hostValidation = await HostValidationUtil.validateHost(
      meeting.hostId,
      currentHostId,
      user.systemRole,
      this.participantModel,
      meetingId
    );

    this.logger.debug(`[TRANSFER_HOST] Host validation result:`, hostValidation);
    
    if (!hostValidation.isAuthorized) {
      this.logger.warn(`[TRANSFER_HOST] Failed - User ${currentHostId} is not authorized to transfer host role. Reason: ${hostValidation.reason}`);
      throw new ForbiddenException('Only the current host can transfer host role');
    }

    this.logger.debug(`[TRANSFER_HOST] Looking for new host participant - meetingId: ${meetingId}, newHostParticipantId: ${newHostParticipantId}`);

    const newHostParticipant = await this.participantModel.findOne({
      _id: new Types.ObjectId(newHostParticipantId),
      meetingId: new Types.ObjectId(meetingId),
    });
    
    this.logger.debug(`[TRANSFER_HOST] New host participant search result:`, {
      found: !!newHostParticipant,
      participantId: newHostParticipant?._id,
      participantUserId: newHostParticipant?.userId,
      participantRole: newHostParticipant?.role,
      participantStatus: newHostParticipant?.status
    });
    
    if (!newHostParticipant) throw new NotFoundException('New host participant not found');
    
    // 🔧 FIX: Validate that the new host participant is active (not LEFT)
    if (newHostParticipant.status === ParticipantStatus.LEFT) {
      throw new BadRequestException('Cannot transfer host role to a participant who has left the meeting');
    }
    
    // 🔧 FIX: Validate that the new host participant is admitted/approved
    if (![ParticipantStatus.ADMITTED, ParticipantStatus.APPROVED].includes(newHostParticipant.status)) {
      throw new BadRequestException('Cannot transfer host role to a participant who is not actively in the meeting');
    }

    const newHostUser = await this.memberModel.findById(newHostParticipant.userId);
    if (!newHostUser) throw new ForbiddenException('New host user not found');

    // Find current host participant to demote
    const currentHostParticipant = await this.participantModel.findOne({
      meetingId: new Types.ObjectId(meetingId),
      $or: [
        { userId: new Types.ObjectId(currentHostId) },
        { 'userId._id': new Types.ObjectId(currentHostId) }
      ],
      role: Role.HOST,
    });

    // Demote current host, promote new host
    if (currentHostParticipant) {
      await this.participantModel.findByIdAndUpdate(currentHostParticipant._id, { role: Role.PARTICIPANT });
    }
    await this.participantModel.findByIdAndUpdate(newHostParticipantId, { role: Role.HOST });

    // 🔧 SOLUTION 1: Update currentHostId instead of hostId to preserve original tutor
    // hostId remains as original tutor, currentHostId tracks current meeting host
    await this.meetingModel.findByIdAndUpdate(meetingId, { 
      currentHostId: newHostParticipant.userId 
    });

    // (Optional) Publish a subscription event here so clients refresh the host badge

    return {
      success: true,
      message: 'Host role transferred successfully',
      newHostId: newHostParticipant.userId?.toString(),
      newHostParticipantId: newHostParticipant._id.toString(),
    };
  }


  // Check if user can be host (TUTOR or ADMIN only)
  async canBeHost(userId: string): Promise<boolean> {
    const user = await this.memberModel.findById(userId);
    return (
      user &&
      (user.systemRole === SystemRole.TUTOR ||
        user.systemRole === SystemRole.ADMIN)
    );
  }

  // Get attendance for a meeting (host/tutor only - tutors see their own courses)
  async getMeetingAttendance(
    meetingId: string,
    requesterId: string,
  ): Promise<any> {
    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify requester has permission
    const requester = await this.memberModel.findById(requesterId);
    if (!requester) {
      throw new NotFoundException('User not found');
    }

    // Check permissions:
    // 1. If requester is the host of the meeting
    // 2. If requester is a tutor and this is their course (hostId matches requesterId)
    const isHost = meeting.hostId.toString() === requesterId;
    const isTutor = requester.systemRole === SystemRole.TUTOR && isHost;

    if (!isHost && !isTutor) {
      throw new ForbiddenException(
        'Only meeting hosts and tutors can view attendance for their own courses',
      );
    }

    // Get all participants with their session data
    const participants = await this.participantModel
      .find({ meetingId })
      .populate('userId', 'email displayName firstName lastName')
      .sort({ createdAt: 1 })
      .lean();

    // Calculate attendance data
    const attendanceData = participants.map((participant) => {
      const sessions = participant.sessions || [];
      const totalDuration = sessions.reduce((total, session) => {
        const sessionDuration = session.leftAt
          ? new Date(session.leftAt).getTime() -
          new Date(session.joinedAt).getTime()
          : Date.now() - new Date(session.joinedAt).getTime();
        return total + Math.floor(sessionDuration / 1000);
      }, 0);

      const userData =
        participant.userId && typeof participant.userId === 'object'
          ? {
            _id: (participant.userId as any)._id,
            email: (participant.userId as any).email,
            displayName: (participant.userId as any).displayName,
            firstName: (participant.userId as any).firstName,
            lastName: (participant.userId as any).lastName,
          }
          : null;

      return {
        _id: participant._id,
        user: userData,
        role: participant.role,
        status: participant.status,
        joinedAt:
          sessions.length > 0 ? sessions[0].joinedAt : participant.createdAt,
        leftAt:
          sessions.length > 0 && sessions[sessions.length - 1].leftAt
            ? sessions[sessions.length - 1].leftAt
            : null,
        totalDuration,
        sessionCount: sessions.length,
        isCurrentlyOnline:
          sessions.length > 0 && !sessions[sessions.length - 1].leftAt,
        sessions: sessions.map((session, index) => ({
          sessionId: session.joinedAt.getTime().toString() + '_' + index,
          joinedAt: session.joinedAt,
          leftAt: session.leftAt,
          duration: session.leftAt
            ? Math.floor(
              (new Date(session.leftAt).getTime() -
                new Date(session.joinedAt).getTime()) /
              1000,
            )
            : Math.floor(
              (Date.now() - new Date(session.joinedAt).getTime()) / 1000,
            ),
        })),
      };
    });

    return {
      meetingId,
      totalParticipants: participants.length,
      currentlyOnline: participants.filter((p) => {
        const sessions = p.sessions || [];
        return sessions.length > 0 && !sessions[sessions.length - 1].leftAt;
      }).length,
      attendance: attendanceData,
    };
  }

  // ==================== SCREEN SHARING METHODS ====================

  // Force screen share control (host/co-host only)
  async forceScreenShareControl(
    input: ForceScreenShareInput,
    hostId: string,
  ): Promise<ScreenShareControlResponse> {
    const { meetingId, participantId, screenState, reason, screenShareInfo } = input;

    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host
    if (!MeetingUtils.isMeetingHost(meeting.hostId, hostId)) {
      throw new ForbiddenException('Only the meeting host can control screen sharing');
    }

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify participant is in the meeting
    if (participant.meetingId.toString() !== meetingId) {
      throw new BadRequestException('Participant is not in this meeting');
    }

    // Update participant's screen state
    const updateData: any = {
      screenState,
    };

    if (screenShareInfo) {
      updateData.screenShareInfo = screenShareInfo;
    }

    await this.participantModel.findByIdAndUpdate(participantId, updateData);

    const action = screenState === MediaState.ON ? 'enabled' : 'disabled';
    return {
      success: true,
      message: `Successfully ${action} screen sharing for participant${reason ? `: ${reason}` : ''}`,
      participantId,
      screenState,
      screenShareInfo,
    };
  }

  // Update screen share info (for when user starts/stops sharing)
  async updateScreenShareInfo(
    input: UpdateScreenShareInfoInput,
    userId: string,
  ): Promise<ScreenShareControlResponse> {
    const { participantId, screenShareInfo, screenState } = input;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user owns this participant record
    if (participant.userId && participant.userId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own screen share info');
    }

    // Update participant's screen share info
    const updateData: any = {};
    if (screenShareInfo !== undefined) {
      updateData.screenShareInfo = screenShareInfo;
    }
    if (screenState !== undefined) {
      updateData.screenState = screenState;
    }

    await this.participantModel.findByIdAndUpdate(participantId, updateData);

    return {
      success: true,
      message: 'Screen share info updated successfully',
      participantId,
      screenState: screenState || participant.screenState,
      screenShareInfo: screenShareInfo || participant.screenShareInfo,
    };
  }

  // Get screen share status for meeting
  async getScreenShareStatus(
    input: GetScreenShareStatusInput,
    userId: string,
  ): Promise<ScreenShareStatusResponse> {
    const { meetingId, participantId } = input;

    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host or a participant in the meeting
    const isHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
    if (!isHost) {
      // Check if user is a participant in this meeting
      const userParticipant = await this.participantModel.findOne({
        meetingId,
        userId: new Types.ObjectId(userId),
      });
      if (!userParticipant) {
        throw new ForbiddenException('You must be the host or a participant to view screen share status');
      }
    }

    // Build query
    let query: any = { meetingId };
    if (participantId) {
      query._id = new Types.ObjectId(participantId);
    }

    // Get participants
    const participants = await this.participantModel
      .find(query)
      .select('_id displayName screenState screenShareInfo createdAt')
      .lean();

    // Transform to screen share info
    const screenShareInfos: ScreenShareInfo[] = participants.map((p) => ({
      participantId: p._id.toString(),
      displayName: p.displayName,
      screenState: p.screenState as MediaState,
      screenShareInfo: p.screenShareInfo,
      screenShareStartedAt: p.screenState === MediaState.ON ? p.createdAt : undefined,
      screenShareDuration: p.screenState === MediaState.ON ?
        Math.floor((Date.now() - p.createdAt.getTime()) / 1000) : undefined,
      isCurrentlySharing: p.screenState === MediaState.ON,
    }));

    const currentlySharingCount = screenShareInfos.filter(
      (info) => info.isCurrentlySharing,
    ).length;

    return {
      participants: screenShareInfos,
      totalParticipants: participants.length,
      currentlySharingCount,
      meetingId,
    };
  }

  // Get who is currently screen sharing
  async getActiveScreenSharers(meetingId: string): Promise<ScreenShareInfo[]> {
    const participants = await this.participantModel
      .find({
        meetingId,
        screenState: MediaState.ON,
      })
      .select('_id displayName screenState screenShareInfo createdAt')
      .lean();

    return participants.map((p) => ({
      participantId: p._id.toString(),
      displayName: p.displayName,
      screenState: p.screenState as MediaState,
      screenShareInfo: p.screenShareInfo,
      screenShareStartedAt: p.createdAt,
      screenShareDuration: Math.floor((Date.now() - p.createdAt.getTime()) / 1000),
      isCurrentlySharing: true,
    }));
  }

  // Check if specific screen is being shared
  async checkScreenShareConflict(
    meetingId: string,
    screenShareInfo: string,
    excludeParticipantId?: string,
  ): Promise<{ isConflict: boolean; conflictingParticipant?: ScreenShareInfo }> {
    let query: any = {
      meetingId,
      screenState: MediaState.ON,
      screenShareInfo,
    };

    if (excludeParticipantId) {
      query._id = { $ne: new Types.ObjectId(excludeParticipantId) };
    }

    const conflictingParticipant = await this.participantModel
      .findOne(query)
      .select('_id displayName screenState screenShareInfo createdAt')
      .lean();

    if (conflictingParticipant) {
      return {
        isConflict: true,
        conflictingParticipant: {
          participantId: conflictingParticipant._id.toString(),
          displayName: conflictingParticipant.displayName,
          screenState: conflictingParticipant.screenState as MediaState,
          screenShareInfo: conflictingParticipant.screenShareInfo,
          screenShareStartedAt: conflictingParticipant.createdAt,
          screenShareDuration: Math.floor((Date.now() - conflictingParticipant.createdAt.getTime()) / 1000),
          isCurrentlySharing: true,
        },
      };
    }

    return { isConflict: false };
  }

  // ==================== RAISE HAND METHODS ====================

  // Raise hand (participant action)
  async raiseHand(input: RaiseHandInput, userId: string): Promise<HandRaiseActionResponse> {
    const { participantId, reason } = input;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user owns this participant record
    console.log('🔍 Backend validation - Participant ownership check:', {
      participantId,
      participantUserId: participant.userId,
      participantUserIdString: participant.userId?.toString(),
      participantUserIdType: typeof participant.userId,
      requestedUserId: userId,
      requestedUserIdType: typeof userId,
      areEqual: participant.userId?.toString() === userId,
      areEqualStrict: participant.userId?.toString() === userId?.toString()
    });
    
    // Fix: Proper ObjectId comparison
    const participantUserIdStr = participant.userId?.toString();
    const requestedUserIdStr = userId?.toString();
    
    if (participant.userId && participantUserIdStr !== requestedUserIdStr) {
      console.error('❌ Backend validation failed - User ID mismatch:', {
        participantUserId: participantUserIdStr,
        requestedUserId: requestedUserIdStr,
        participantId,
        participantDisplayName: participant.displayName,
        comparison: `${participantUserIdStr} !== ${requestedUserIdStr}`
      });
      throw new ForbiddenException('You can only raise your own hand');
    }
    
    console.log('✅ Backend validation passed - User owns participant:', {
      participantId,
      participantUserId: participantUserIdStr,
      requestedUserId: requestedUserIdStr
    });

    // Check if hand is already raised
    if (participant.hasHandRaised) {
      throw new BadRequestException('Your hand is already raised');
    }

    // Raise hand
    const now = new Date();
    await this.participantModel.findByIdAndUpdate(participantId, {
      hasHandRaised: true,
      handRaisedAt: now,
      handLoweredAt: undefined,
    });

    return {
      success: true,
      message: 'Hand raised successfully',
      participantId,
      hasHandRaised: true,
      handRaisedAt: now,
      reason,
    };
  }

  // Lower hand (participant action)
  async lowerHand(input: LowerHandInput, userId: string): Promise<HandRaiseActionResponse> {
    const { participantId, reason } = input;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user owns this participant record
    if (participant.userId && participant.userId.toString() !== userId) {
      throw new ForbiddenException('You can only lower your own hand');
    }

    // Check if hand is raised
    if (!participant.hasHandRaised) {
      throw new BadRequestException('Your hand is not currently raised');
    }

    // Lower hand
    const now = new Date();
    await this.participantModel.findByIdAndUpdate(participantId, {
      hasHandRaised: false,
      handLoweredAt: now,
    });

    return {
      success: true,
      message: 'Hand lowered successfully',
      participantId,
      hasHandRaised: false,
      handLoweredAt: now,
      reason,
    };
  }

  // Host lowers participant's hand
  async hostLowerHand(input: HostLowerHandInput, hostId: string): Promise<HandRaiseActionResponse> {
    const { meetingId, participantId, reason } = input;

    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host
    if (!MeetingUtils.isMeetingHost(meeting.hostId, hostId)) {
      throw new ForbiddenException('Only the meeting host can lower participants\' hands');
    }

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify participant is in the meeting
    if (participant.meetingId.toString() !== meetingId) {
      throw new BadRequestException('Participant is not in this meeting');
    }

    // Check if hand is raised
    if (!participant.hasHandRaised) {
      throw new BadRequestException('Participant\'s hand is not currently raised');
    }

    // Lower hand
    const now = new Date();
    await this.participantModel.findByIdAndUpdate(participantId, {
      hasHandRaised: false,
      handLoweredAt: now,
    });

    return {
      success: true,
      message: 'Participant\'s hand lowered successfully',
      participantId,
      hasHandRaised: false,
      handLoweredAt: now,
      reason,
    };
  }

  // Get all raised hands in a meeting
  async getRaisedHands(input: GetRaisedHandsInput, userId: string): Promise<RaisedHandsResponse> {
    const { meetingId, includeLowered } = input;

    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host or a participant in the meeting
    const isHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
    if (!isHost) {
      // Check if user is a participant in this meeting
      const userParticipant = await this.participantModel.findOne({
        meetingId,
        userId: new Types.ObjectId(userId),
      });
      if (!userParticipant) {
        throw new ForbiddenException('You must be the host or a participant to view raised hands');
      }
    }

    // Build query
    let query: any = { meetingId };
    if (!includeLowered) {
      query.hasHandRaised = true;
    }

    // Get participants with raised hands
    const participants = await this.participantModel
      .find(query)
      .select('_id displayName hasHandRaised handRaisedAt handLoweredAt createdAt')
      .sort({ handRaisedAt: 1 }) // Sort by when hand was raised (oldest first)
      .lean();

    // Transform to hand raise info
    const raisedHands: HandRaiseInfo[] = participants.map((p) => {
      const handRaiseDuration = p.handRaisedAt && !p.handLoweredAt ?
        Math.floor((Date.now() - p.handRaisedAt.getTime()) / 1000) : undefined;

      return {
        participantId: p._id.toString(),
        displayName: p.displayName,
        hasHandRaised: p.hasHandRaised,
        handRaisedAt: p.handRaisedAt,
        handLoweredAt: p.handLoweredAt,
        handRaiseDuration,
        isWaitingForResponse: p.hasHandRaised,
      };
    });

    const totalRaisedHands = raisedHands.filter((info) => info.hasHandRaised).length;

    return {
      raisedHands,
      totalRaisedHands,
      meetingId,
      timestamp: new Date(),
    };
  }

  // Get participant's hand raise status
  async getParticipantHandStatus(participantId: string): Promise<HandRaiseInfo> {
    const participant = await this.participantModel
      .findById(participantId)
      .select('_id displayName hasHandRaised handRaisedAt handLoweredAt createdAt')
      .lean();

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const handRaiseDuration = participant.handRaisedAt && !participant.handLoweredAt ?
      Math.floor((Date.now() - participant.handRaisedAt.getTime()) / 1000) : undefined;

    return {
      participantId: participant._id.toString(),
      displayName: participant.displayName,
      hasHandRaised: participant.hasHandRaised,
      handRaisedAt: participant.handRaisedAt,
      handLoweredAt: participant.handLoweredAt,
      handRaiseDuration,
      isWaitingForResponse: participant.hasHandRaised,
    };
  }

  // Lower all hands in meeting (host action)
  async lowerAllHands(meetingId: string, hostId: string): Promise<HandRaiseActionResponse[]> {
    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host
    if (!MeetingUtils.isMeetingHost(meeting.hostId, hostId)) {
      throw new ForbiddenException('Only the meeting host can lower all hands');
    }

    // Find all participants with raised hands
    const participantsWithRaisedHands = await this.participantModel.find({
      meetingId,
      hasHandRaised: true,
    });

    if (participantsWithRaisedHands.length === 0) {
      return [];
    }

    // Lower all hands
    const now = new Date();
    const participantIds = participantsWithRaisedHands.map(p => p._id);

    await this.participantModel.updateMany(
      { _id: { $in: participantIds } },
      {
        hasHandRaised: false,
        handLoweredAt: now,
      }
    );

    // Return results for each participant
    return participantsWithRaisedHands.map((p) => ({
      success: true,
      message: 'Hand lowered by host',
      participantId: p._id.toString(),
      hasHandRaised: false,
      handLoweredAt: now,
      reason: 'Host lowered all hands',
    }));
  }

  // Update participant media state
  async updateParticipantMediaState(participantId: string, mediaState: { micState?: MediaState, cameraState?: MediaState }) {
    console.log(`[UPDATE_MEDIA_STATE] Participant: ${participantId}, State:`, mediaState);

    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    if (mediaState.micState) {
      participant.micState = mediaState.micState;
    }
    if (mediaState.cameraState) {
      participant.cameraState = mediaState.cameraState;
    }

    await participant.save();
    console.log(`[UPDATE_MEDIA_STATE] Success - Participant: ${participantId}`);

    return participant;
  }

  // Get participant by user ID and meeting ID
  async getParticipantByUserAndMeeting(userId: string, meetingId: string) {
    console.log(`[GET_PARTICIPANT_BY_USER_MEETING] User: ${userId}, Meeting: ${meetingId}`);

    const participant = await this.participantModel.findOne({
      userId: new Types.ObjectId(userId),
      meetingId: new Types.ObjectId(meetingId)
    }).populate('userId', 'email displayName systemRole avatarUrl');

    console.log(`[GET_PARTICIPANT_BY_USER_MEETING] Found:`, participant ? 'Yes' : 'No');

    return participant;
  }

  // ==================== WAITING ROOM METHODS ====================

  // Get all participants in waiting room for a meeting
  async getWaitingParticipants(meetingId: string, hostUserId: string) {
    console.log(`[GET_WAITING_PARTICIPANTS] Meeting: ${meetingId}, Host: ${hostUserId}`);

    // Verify the user is the host
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const isHost = meeting.hostId &&
      meeting.hostId.toString() === hostUserId.toString();

    if (!isHost) {
      throw new ForbiddenException('Only the meeting host can view waiting participants');
    }

    // Filter by fresh participants (seen within last 10 seconds) - AGGRESSIVE cleanup
    const threshold = new Date(Date.now() - (10 * 1000));
    
    const waitingParticipants = await this.participantModel
      .find({
        meetingId: new Types.ObjectId(meetingId),
        status: ParticipantStatus.WAITING,
        lastSeenAt: { $gte: threshold } // Only show participants seen within last 30 seconds
      })
      .populate('userId', 'email displayName systemRole avatarUrl')
      .sort({ createdAt: 1 });

    console.log(`[GET_WAITING_PARTICIPANTS] Found ${waitingParticipants.length} fresh waiting participants (filtered by lastSeenAt)`);

    return waitingParticipants;
  }

  // Approve a participant from waiting room
  async approveParticipant(participantId: string, hostUserId: string) {
    console.log(`[APPROVE_PARTICIPANT] Participant: ${participantId}, Host: ${hostUserId}`);

    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host of this meeting
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const isHost = meeting.hostId &&
      meeting.hostId.toString() === hostUserId.toString();

    if (!isHost) {
      throw new ForbiddenException('Only the meeting host can approve participants');
    }

    // Check if participant is in waiting room
    if (participant.status !== ParticipantStatus.WAITING) {
      throw new BadRequestException('Participant is not in waiting room');
    }

    // Approve the participant
    participant.status = ParticipantStatus.ADMITTED;
    participant.sessions.push({
      joinedAt: new Date(),
      leftAt: undefined,
      durationSec: 0,
    });

    await participant.save();

    // Update meeting participant count
    await this.meetingModel.findByIdAndUpdate(participant.meetingId, {
      $inc: { participantCount: 1 },
    });

    console.log(`[APPROVE_PARTICIPANT] Success - Participant ${participantId} approved and admitted`);

    return participant;
  }

  // Reject a participant from waiting room
  async rejectParticipant(participantId: string, hostUserId: string) {
    console.log(`[REJECT_PARTICIPANT] Participant: ${participantId}, Host: ${hostUserId}`);

    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host of this meeting
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const isHost = meeting.hostId &&
      meeting.hostId.toString() === hostUserId.toString();

    if (!isHost) {
      throw new ForbiddenException('Only the meeting host can reject participants');
    }

    // Check if participant is in waiting room
    if (participant.status !== ParticipantStatus.WAITING) {
      throw new BadRequestException('Participant is not in waiting room');
    }

    // Reject the participant
    participant.status = ParticipantStatus.REJECTED;
    await participant.save();

    console.log(`[REJECT_PARTICIPANT] Success - Participant ${participantId} rejected`);

    return participant;
  }

  // Admit all waiting participants (bulk approve)
  async admitAllWaitingParticipants(meetingId: string, hostUserId: string) {
    console.log(`[ADMIT_ALL_WAITING] Meeting: ${meetingId}, Host: ${hostUserId}`);

    // Verify the user is the host
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const isHost = meeting.hostId &&
      meeting.hostId.toString() === hostUserId.toString();

    if (!isHost) {
      throw new ForbiddenException('Only the meeting host can admit all participants');
    }

    // Find all waiting participants
    const waitingParticipants = await this.participantModel.find({
      meetingId: new Types.ObjectId(meetingId),
      status: ParticipantStatus.WAITING
    });

    console.log(`[ADMIT_ALL_WAITING] Found ${waitingParticipants.length} waiting participants`);

    // Admit all waiting participants
    const now = new Date();
    for (const participant of waitingParticipants) {
      participant.status = ParticipantStatus.ADMITTED;
      participant.sessions.push({
        joinedAt: now,
        leftAt: undefined,
        durationSec: 0,
      });
      await participant.save();
    }

    // Update meeting participant count
    await this.meetingModel.findByIdAndUpdate(meetingId, {
      $inc: { participantCount: waitingParticipants.length },
    });

    console.log(`[ADMIT_ALL_WAITING] Success - Admitted ${waitingParticipants.length} participants`);

    return {
      message: `Successfully admitted ${waitingParticipants.length} participants`,
      admittedCount: waitingParticipants.length
    };
  }

  // Clear fake participants method
  async clearFakeParticipants(meetingId: string): Promise<number> {
    try {
      const result = await this.participantModel.deleteMany({
        meetingId: new Types.ObjectId(meetingId),
        // Add any criteria to identify fake participants
        $or: [
          { displayName: { $regex: /^fake|test|dummy/i } },
          { userId: { $exists: false } },
          { userId: null }
        ]
      });
      
      this.logger.log(`[CLEAR_FAKE_PARTICIPANTS] Cleared ${result.deletedCount} fake participants for meeting ${meetingId}`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`[CLEAR_FAKE_PARTICIPANTS] Error: ${error.message}`);
      return 0;
    }
  }

  // Cleanup duplicate participants method
  async cleanupDuplicateParticipants(meetingId: string): Promise<number> {
    try {
      const participants = await this.participantModel.find({
        meetingId: new Types.ObjectId(meetingId)
      });
      
      // Group by userId and remove duplicates
      const groupedByUserId = participants.reduce((acc, participant) => {
        const userId = participant.userId ? participant.userId.toString() : 'anonymous';
        if (!acc[userId]) {
          acc[userId] = [];
        }
        acc[userId].push(participant);
        return acc;
      }, {});
      
      let duplicateCount = 0;
      for (const [userId, userParticipants] of Object.entries(groupedByUserId)) {
        const participants = userParticipants as any[];
        if (participants.length > 1) {
          // Sort by createdAt, keep the most recent
          const sorted = participants.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Delete all but the first (most recent)
          const toDelete = sorted.slice(1);
          for (const duplicate of toDelete) {
            await this.participantModel.findByIdAndDelete(duplicate._id);
            duplicateCount++;
          }
        }
      }
      
      this.logger.log(`[CLEANUP_DUPLICATE_PARTICIPANTS] Cleaned up ${duplicateCount} duplicate participants for meeting ${meetingId}`);
      return duplicateCount;
    } catch (error) {
      this.logger.error(`[CLEANUP_DUPLICATE_PARTICIPANTS] Error: ${error.message}`);
      return 0;
    }
  }

  // ==================== PRESENCE SYSTEM METHODS ====================

  /**
   * Update participant presence when they join a meeting
   */
  async updateParticipantPresence(userId: string, meetingId: string, socketId: string) {
    try {
      const now = new Date();
      
      // Find and update the participant
      const participant = await this.participantModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          meetingId: new Types.ObjectId(meetingId)
        },
        {
          $set: {
            lastSeenAt: now,
            socketId: socketId
          }
        },
        { new: true }
      );

      if (!participant) {
        this.logger.warn(`[PRESENCE] Participant not found for user ${userId} in meeting ${meetingId}`);
        return null;
      }

      this.logger.log(`[PRESENCE] Updated presence for participant ${participant._id} in meeting ${meetingId}`);
      return participant;
    } catch (error) {
      this.logger.error(`[PRESENCE] Error updating participant presence: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update participant heartbeat timestamp
   */
  async updateParticipantHeartbeat(userId: string, meetingId: string) {
    try {
      const now = new Date();
      
      const participant = await this.participantModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          meetingId: new Types.ObjectId(meetingId),
          status: { $in: [ParticipantStatus.WAITING, ParticipantStatus.ADMITTED] }
        },
        {
          $set: {
            lastSeenAt: now
          }
        },
        { new: true }
      );

      if (!participant) {
        this.logger.warn(`[PRESENCE] Participant not found for heartbeat update: user ${userId} in meeting ${meetingId}`);
        return null;
      }

      return participant;
    } catch (error) {
      this.logger.error(`[PRESENCE] Error updating participant heartbeat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark participant as LEFT in all meetings (for disconnect detection)
   */
  async markParticipantAsLeft(userId: string) {
    try {
      const now = new Date();
      
      const result = await this.participantModel.updateMany(
        {
          userId: new Types.ObjectId(userId),
          status: { $in: [ParticipantStatus.WAITING, ParticipantStatus.ADMITTED] }
        },
        {
          $set: {
            status: ParticipantStatus.LEFT,
            lastSeenAt: now,
            socketId: null
          }
        }
      );

      this.logger.log(`[PRESENCE] Marked ${result.modifiedCount} participants as LEFT for user ${userId}`);
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`[PRESENCE] Error marking participant as LEFT: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark participant as LEFT in a specific meeting (for explicit leave)
   */
  async markParticipantAsLeftInMeeting(userId: string, meetingId: string) {
    try {
      const now = new Date();
      
      const participant = await this.participantModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          meetingId: new Types.ObjectId(meetingId),
          status: { $in: [ParticipantStatus.WAITING, ParticipantStatus.ADMITTED] }
        },
        {
          $set: {
            status: ParticipantStatus.LEFT,
            lastSeenAt: now,
            socketId: null
          }
        },
        { new: true }
      );

      if (!participant) {
        this.logger.warn(`[PRESENCE] Participant not found for leave: user ${userId} in meeting ${meetingId}`);
        return null;
      }

      this.logger.log(`[PRESENCE] Marked participant as LEFT in meeting ${meetingId}`);
      return participant;
    } catch (error) {
      this.logger.error(`[PRESENCE] Error marking participant as LEFT in meeting: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up stale participants (those with lastSeenAt older than threshold)
   */
  async cleanupStaleParticipants(thresholdSeconds: number = 30) {
    try {
      const threshold = new Date(Date.now() - (thresholdSeconds * 1000));
      
      const result = await this.participantModel.updateMany(
        {
          status: { $in: [ParticipantStatus.WAITING, ParticipantStatus.ADMITTED] },
          lastSeenAt: { $lt: threshold }
        },
        {
          $set: {
            status: ParticipantStatus.LEFT,
            socketId: null
          }
        }
      );

      this.logger.log(`[PRESENCE] Cleaned up ${result.modifiedCount} stale participants (older than ${thresholdSeconds}s)`);
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`[PRESENCE] Error cleaning up stale participants: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get fresh participants only (those seen within threshold)
   */
  async getFreshParticipants(meetingId: string, thresholdSeconds: number = 30) {
    try {
      const threshold = new Date(Date.now() - (thresholdSeconds * 1000));
      
      const participants = await this.participantModel.find({
        meetingId: new Types.ObjectId(meetingId),
        status: { $in: [ParticipantStatus.WAITING, ParticipantStatus.ADMITTED] },
        lastSeenAt: { $gte: threshold }
      }).lean();

      return participants;
    } catch (error) {
      this.logger.error(`[PRESENCE] Error getting fresh participants: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get count of stale participants (for monitoring)
   */
  async getStaleParticipantsCount(thresholdSeconds: number = 30): Promise<number> {
    try {
      const threshold = new Date(Date.now() - (thresholdSeconds * 1000));
      
      const count = await this.participantModel.countDocuments({
        status: { $in: [ParticipantStatus.WAITING, ParticipantStatus.ADMITTED] },
        lastSeenAt: { $lt: threshold }
      });

      return count;
    } catch (error) {
      this.logger.error(`[PRESENCE] Error getting stale participants count: ${error.message}`);
      throw error;
    }
  }

  // Notify SignalingGateway that meeting has started (for WebSocket notifications)
  async notifyMeetingStarted(meetingId: string) {
    try {
      this.logger.log(`[NOTIFY_MEETING_STARTED] Meeting ${meetingId} started - triggering WebSocket notifications`);
      
      // Emit a global event that the SignalingGateway can listen to
      // We'll use Node.js EventEmitter for this
      if ((global as any).meetingStartEmitter) {
        (global as any).meetingStartEmitter.emit('meetingStarted', meetingId);
        this.logger.log(`[NOTIFY_MEETING_STARTED] Emitted meetingStarted event for meeting ${meetingId}`);
      } else {
        this.logger.warn(`[NOTIFY_MEETING_STARTED] Global meetingStartEmitter not available`);
      }
      
    } catch (error) {
      this.logger.error(`[NOTIFY_MEETING_STARTED] Error:`, error);
    }
  }
}
