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
    // First, check if meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Query participants with proper ObjectId conversion and populate user data
    // FIXED: ALL participants see the same list (only ADMITTED participants)
    // This ensures consistent participant counts across all users
    // Hosts can see WAITING participants separately via getWaitingParticipants query
    // Check both original host (hostId) and current host (currentHostId)
    const isOriginalHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
    const isCurrentHost = meeting.currentHostId ? MeetingUtils.isMeetingHost(meeting.currentHostId, userId) : false;
    const isHost = isOriginalHost || isCurrentHost;
    const statusFilter = { $in: [ParticipantStatus.ADMITTED, ParticipantStatus.APPROVED] };

    const participants = await this.participantModel.find({
      meetingId: new Types.ObjectId(meetingId),
      status: statusFilter
    }).populate('userId', 'email displayName systemRole avatarUrl');

    // Filter out participants where userId populate failed (user was deleted)
    const validParticipants = participants.filter(participant => {
      if (!participant.userId) {
        return false;
      }
      return true;
    });

    return validParticipants;
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

    // Force disconnect from LiveKit BEFORE removing from database
    try {
      const roomName = participant.meetingId.toString(); // Use meetingId directly as room name (matches token generation)
      const identity = participant.userId?.toString() || participant.displayName;
      
      this.logger.log(`Attempting to disconnect participant ${identity} from LiveKit room ${roomName}`);
      await this.livekitService.removeParticipant(roomName, identity);
      this.logger.log(`Successfully disconnected participant ${identity} from LiveKit room ${roomName}`);
    } catch (livekitError) {
      // Log error but don't fail the removal - participant might not be in LiveKit room
      this.logger.warn(`Failed to disconnect participant from LiveKit: ${livekitError.message}`);
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

    const { meetingId, displayName, inviteCode } = joinInput;


    // Verify the meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }


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



    // Get user info to use real display name
    let realDisplayName = displayName || 'Anonymous';
    if (userId) {
      const user = await this.memberModel.findById(userId);
      if (user && user.displayName) {
        realDisplayName = user.displayName;
      } else {
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

        // Always refresh display name
        existingParticipant.displayName = realDisplayName;

        const prevStatus = existingParticipant.status;

        if (isHost) {
          // Host joins immediately
          existingParticipant.status = ParticipantStatus.ADMITTED;
          const sessionToAdd = {
            joinedAt: new Date(),
            leftAt: undefined,
            durationSec: 0,
          };
          existingParticipant.sessions.push(sessionToAdd);

          // Increment count if they weren't already admitted
          if (prevStatus !== ParticipantStatus.ADMITTED) {
            await this.meetingModel.findByIdAndUpdate(meetingId, { $inc: { participantCount: 1 } });
          }
        } else {
          // Non-host behavior
          if (meeting.status !== MeetingStatus.LIVE) {
            // Meeting not started => force waiting even if they were previously admitted
            existingParticipant.status = ParticipantStatus.WAITING;
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


    // Determine initial status based on waiting room logic
    const initialStatus = shouldGoToWaitingRoom ? ParticipantStatus.WAITING : ParticipantStatus.ADMITTED;


    // Create new participant with appropriate status
    const newParticipant = new this.participantModel({
      meetingId: new Types.ObjectId(meetingId),
      userId: userId ? new Types.ObjectId(userId) : null,
      displayName: realDisplayName,
      role: participantRole,
      status: initialStatus,
      sessions: initialStatus === ParticipantStatus.ADMITTED ? [{
        joinedAt: new Date(),
        leftAt: undefined,
        durationSec: 0,
      }] : [], // Only add session if admitted directly
    });

    const savedParticipant = await newParticipant.save();

    // Only update participant count if participant is admitted directly
    if (initialStatus === ParticipantStatus.ADMITTED) {
      await this.meetingModel.findByIdAndUpdate(meetingId, {
        $inc: { participantCount: 1 },
      });
    } else {
    }


    return savedParticipant;
  }

  async leaveMeeting(leaveInput: LeaveMeetingInput, userId?: string) {
    const { participantId } = leaveInput;


    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
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
      throw new ForbiddenException('You can only leave your own participation');
    }


    // ✅ FIX BUG #5: Update the last session with leave time, prevent double counting
    const sessions = participant.sessions || [];
    if (sessions.length > 0) {
      const lastSession = sessions[sessions.length - 1];
      
      // ✅ FIX: Check if session is already closed to prevent double counting
      if (lastSession.leftAt) {
        // Session already closed, don't process again
      } else if (lastSession.joinedAt) {
        const now = new Date();
        const durationSec = Math.floor(
          (now.getTime() - lastSession.joinedAt.getTime()) / 1000,
        );
        
        // 🔧 FIX: Only update if duration is positive (prevent invalid sessions)
        if (durationSec >= 0) {
          lastSession.leftAt = now;
          lastSession.durationSec = durationSec;
          
          // ✅ FIX BUG #4: Prevent double counting - only add if not already counted
          // Check if this duration was already added to totalDurationSec
          const previousTotal = participant.totalDurationSec || 0;
          // Count all closed sessions including those with durationSec = 0
          const sessionSum = sessions
            .filter(s => s.leftAt && (s.durationSec !== undefined && s.durationSec !== null))
            .reduce((sum, s) => sum + (s.durationSec || 0), 0);
          
          // Only add if this session's duration wasn't already counted
          // Note: We compare sessionSum (sum of all closed sessions) with previousTotal (stored total)
          // If they're equal or previousTotal is less, the new duration wasn't counted yet
          if (sessionSum <= previousTotal) {
            participant.totalDurationSec = previousTotal + durationSec;
          } else {
            // Duration already counted, just update the session but don't add to total
          }
        } else {
          // If duration would be negative, remove this invalid session
          sessions.pop();
        }
      }
    }

    // CRITICAL: Set status to LEFT so participant doesn't appear in active participants
    participant.status = ParticipantStatus.LEFT;

    await participant.save();

    
    // 🔧 DEBUG: Verify the status was actually saved
    const updatedParticipant = await this.participantModel.findById(participantId);
    
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
      // ✅ FIX: Update last session with double-counting prevention
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        // ✅ Check if session already closed to prevent double counting
        if (lastSession.leftAt) {
        } else if (lastSession.joinedAt) {
          lastSession.leftAt = now;
          const durationSec = Math.floor(
            (now.getTime() - lastSession.joinedAt.getTime()) / 1000,
          );
          lastSession.durationSec = durationSec;
          
          // ✅ Prevent double counting - include sessions with durationSec = 0
          const previousTotal = participant.totalDurationSec || 0;
          const sessionSum = sessions
            .filter(s => s.leftAt && (s.durationSec !== undefined && s.durationSec !== null))
            .reduce((sum, s) => sum + (s.durationSec || 0), 0);
          
          if (sessionSum <= previousTotal) {
            participant.totalDurationSec = previousTotal + durationSec;
          }
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

    const stats = await this.participantModel.aggregate([
      { $match: { meetingId: new Types.ObjectId(meetingId) } },
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
  ): Promise<{ success: boolean; message: string; newHostId: string; newHostParticipantId: string; newLiveKitToken?: string }> {
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
      meetingId,
      meeting.currentHostId // Pass currentHostId for transferred host support
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

    // ✅ Generate new LiveKit token for new host with elevated permissions
    let newLiveKitToken = null;
    try {
      const token = await this.livekitService.generateAccessToken({
        room: meetingId,
        identity: newHostParticipant.userId?.toString() || newHostUser._id?.toString(),
        name: newHostUser.displayName || newHostUser.email || 'Host',
        meetingRole: 'HOST' as any,
      });
      newLiveKitToken = token;
      this.logger.log(`[TRANSFER_HOST] Generated new LiveKit token for new host: ${newHostParticipant.userId}`);
    } catch (error) {
      this.logger.error(`[TRANSFER_HOST] Failed to generate LiveKit token: ${error.message}`);
      // Continue with transfer even if token generation fails
    }

    return {
      success: true,
      message: 'Host role transferred successfully',
      newHostId: newHostParticipant.userId?.toString(),
      newHostParticipantId: newHostParticipant._id.toString(),
      newLiveKitToken, // ✅ Return token for WebSocket emission
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
    // 1. If requester is the host of the meeting (original host)
    // 2. If requester is the current host
    // 3. If requester is a tutor and this is their course
    // 4. If requester is an admin (temporary bypass for testing)
    const isOriginalHost = meeting.hostId?.toString() === requesterId?.toString();
    const isCurrentHost = meeting.currentHostId?.toString() === requesterId?.toString();
    const isTutor = requester.systemRole === SystemRole.TUTOR && isOriginalHost;
    const isAdmin = requester.systemRole === SystemRole.ADMIN;

    // Debug logging

    // TEMPORARY: Allow any authenticated user to view attendance for testing
    // TODO: Remove this in production
    const isAuthenticatedUser = !!requesterId;
    
    if (!isOriginalHost && !isCurrentHost && !isTutor && !isAdmin && !isAuthenticatedUser) {
      throw new ForbiddenException(
        'Only meeting hosts and tutors can view attendance for their own courses',
      );
    }
    
    if (isAuthenticatedUser && !isOriginalHost && !isCurrentHost && !isTutor && !isAdmin) {
    }

    // Get all participants with their session data
    
    // Convert string meetingId to ObjectId if needed
    const ObjectId = require('mongoose').Types.ObjectId;
    const meetingIdObj = ObjectId.isValid(meetingId) ? new ObjectId(meetingId) : meetingId;
    
    const participants = await this.participantModel
      .find({ meetingId: meetingIdObj })
      .populate('userId', 'email displayName firstName lastName systemRole avatarUrl organization department')
      .sort({ createdAt: 1 })
      .lean();
    


    // Calculate attendance data
    const attendanceData = participants
      .filter(participant => {
        // ✅ FIX: Filter out participants with null userId (deleted users)
        if (!participant || !participant._id) return false;
        if (!participant.userId) {
          return false;
        }
        return true;
      })
      .map((participant) => {
        try {
          const sessions = participant.sessions || [];
          
          // 🔧 FIX: Filter out invalid sessions (where leftAt < joinedAt, or null sessions)
          const validSessions = sessions.filter(session => {
            // ✅ CRITICAL FIX: Remove null/undefined sessions
            if (!session) {
              return false;
            }
            if (!session.joinedAt) return false;
            if (!session.leftAt) return true; // Currently active session is valid
            
            const joinedTime = new Date(session.joinedAt).getTime();
            const leftTime = new Date(session.leftAt).getTime();
            return leftTime >= joinedTime; // Only keep sessions where leftAt >= joinedAt
          });
          
          // ✅ FIX BUG #1: Use saved durationSec first, recalculate only if missing or invalid
          const totalDuration = validSessions.reduce((total, session) => {
            if (!session || !session.joinedAt) return total;
            
            let sessionDurationSec = 0;
            
            // ✅ PRIORITY 1: Use saved durationSec if it exists (>= 0, can be 0 for instant leaves) and session is closed
            if (session.durationSec !== undefined && session.durationSec !== null && session.durationSec >= 0 && session.leftAt) {
              // Session is closed and has a saved duration - use it (most accurate)
              // Note: durationSec can be 0 if participant left immediately
              sessionDurationSec = session.durationSec;
            } else {
              // ✅ PRIORITY 2: Recalculate only if durationSec is missing or invalid
              const getTimestamp = (dateValue: any): number => {
                if (!dateValue) return 0;
                if (typeof dateValue === 'number') return dateValue;
                if (typeof dateValue === 'string' && /^\d+$/.test(dateValue)) {
                  return parseInt(dateValue, 10);
                }
                const date = new Date(dateValue);
                return isNaN(date.getTime()) ? 0 : date.getTime();
              };
              
              const joinedTime = getTimestamp(session.joinedAt);
              
              if (!joinedTime) {
                return total;
              }
              
              if (session.leftAt) {
                // Session is closed but durationSec missing - recalculate from timestamps
                const leftTime = getTimestamp(session.leftAt);
                if (leftTime && leftTime >= joinedTime) {
                  sessionDurationSec = Math.floor((leftTime - joinedTime) / 1000);
                }
              } else {
                // ✅ FIX BUG #3: Session still active - calculate current duration
                // Only for truly active sessions (participant hasn't left)
                const now = Date.now();
                sessionDurationSec = Math.floor((now - joinedTime) / 1000);
              }
            }
            
            return total + Math.max(0, sessionDurationSec); // Ensure non-negative
          }, 0);

          // ✅ FIX BUG #4: Validation - Verify totalDuration matches calculated sum (for debugging)
          // If totalDurationSec exists but doesn't match calculated sum, log warning but use calculated value
          if (participant.totalDurationSec && participant.totalDurationSec !== totalDuration) {
            const diff = Math.abs(participant.totalDurationSec - totalDuration);
            if (diff > 5) { // Only warn if difference is significant (> 5 seconds)
              // Use calculated value as it's more accurate (sums from session.durationSec)
              // Don't update participant.totalDurationSec here to avoid race conditions
            }
          }

          // ✅ SAFER: Handle case where populate failed (user deleted)
          let userData = null;
          try {
            if (participant.userId && typeof participant.userId === 'object' && !participant.userId.constructor.name.includes('ObjectId')) {
              const userId = participant.userId as any;
              userData = {
                _id: userId?._id,
                email: userId?.email,
                displayName: userId?.displayName || 'Unknown User',
                firstName: userId?.firstName || null,
                lastName: userId?.lastName || null,
                systemRole: userId?.systemRole || null,
                avatarUrl: userId?.avatarUrl || null,
                organization: userId?.organization || null,
                department: userId?.department || null,
              };
            }
          } catch (err) {
            // Set default values
            userData = null;
          }

          // Get first join time from sessions or fallback to createdAt
          const firstJoinedAt = validSessions.length > 0 && validSessions[0]?.joinedAt
            ? (typeof validSessions[0].joinedAt === 'string' ? validSessions[0].joinedAt : new Date(validSessions[0].joinedAt).toISOString())
            : (participant.createdAt ? (typeof participant.createdAt === 'string' ? participant.createdAt : new Date(participant.createdAt).toISOString()) : new Date().toISOString());

          // Get last leave time
          const lastLeftAt = validSessions.length > 0 && validSessions[validSessions.length - 1]?.leftAt
            ? (typeof validSessions[validSessions.length - 1].leftAt === 'string' ? validSessions[validSessions.length - 1].leftAt : new Date(validSessions[validSessions.length - 1].leftAt).toISOString())
            : null;

          return {
            _id: participant._id || 'unknown',
            displayName: userData?.displayName || participant.displayName || 'Unknown User',
            email: userData?.email || null,
            firstName: userData?.firstName || null,
            lastName: userData?.lastName || null,
            systemRole: userData?.systemRole || null,
            avatarUrl: userData?.avatarUrl || null,
            organization: userData?.organization || null,
            department: userData?.department || null,
            role: participant.role || 'PARTICIPANT',
            status: participant.status || 'UNKNOWN',
            joinedAt: typeof firstJoinedAt === 'string' ? new Date(firstJoinedAt) : (firstJoinedAt || new Date()),
            leftAt: lastLeftAt ? (typeof lastLeftAt === 'string' ? new Date(lastLeftAt) : lastLeftAt) : null,
            totalTime: totalDuration,
            sessionCount: validSessions.length,
            isCurrentlyOnline: validSessions.length > 0 && !validSessions[validSessions.length - 1]?.leftAt,
            micState: participant.micState || 'OFF',
            cameraState: participant.cameraState || 'OFF',
            hasHandRaised: participant.hasHandRaised || false,
            handRaisedAt: participant.handRaisedAt ? (typeof participant.handRaisedAt === 'string' ? new Date(participant.handRaisedAt) : participant.handRaisedAt) : null,
            handLoweredAt: participant.handLoweredAt ? (typeof participant.handLoweredAt === 'string' ? new Date(participant.handLoweredAt) : participant.handLoweredAt) : null,
            // ✅ FIX BUG #2: Use saved durationSec in session mapping, recalculate only if missing
            sessions: validSessions.map((session) => {
              if (!session || !session.joinedAt) return null;
              
              // Convert to Date objects for GraphQL DateTime scalar
              const joinedAt = typeof session.joinedAt === 'string' ? new Date(session.joinedAt) : session.joinedAt;
              const leftAt = session.leftAt ? (typeof session.leftAt === 'string' ? new Date(session.leftAt) : session.leftAt) : null;
              
              // Use saved durationSec if available (can be 0 for instant leaves), otherwise recalculate
              let durationSec = session.durationSec;
              if (durationSec === undefined || durationSec === null || durationSec < 0) {
                // Only recalculate if durationSec is missing or invalid (negative)
                // durationSec = 0 is valid (participant left immediately)
                if (leftAt) {
                  // Closed session - recalculate from timestamps
                  durationSec = Math.floor((new Date(leftAt).getTime() - new Date(joinedAt).getTime()) / 1000);
                } else {
                  // Active session - calculate current duration
                  durationSec = Math.floor((Date.now() - new Date(joinedAt).getTime()) / 1000);
                }
              }
              
              return {
                joinedAt: joinedAt,
                leftAt: leftAt,
                durationSec: Math.max(0, durationSec), // Ensure non-negative
              };
            }).filter(s => s !== null), // Remove null entries
          };
        } catch (error) {
          return null;
        }
      })
      .filter(p => p !== null); // Remove any null entries from errors

    attendanceData.forEach((p, idx) => {
    });

    const presentParticipants = attendanceData.filter(p => p.status === ParticipantStatus.ADMITTED || p.status === ParticipantStatus.APPROVED).length;
    const totalMeetingDuration = meeting.endedAt && meeting.actualStartAt 
      ? Math.floor((new Date(meeting.endedAt).getTime() - new Date(meeting.actualStartAt).getTime()) / 1000)
      : 0;
    const averageAttendanceTime = attendanceData.length > 0 
      ? Math.floor(attendanceData.reduce((sum, p) => sum + p.totalTime, 0) / attendanceData.length)
      : 0;
    const attendanceRate = participants.length > 0 ? Math.round((presentParticipants / participants.length) * 100) : 0;

    const result = {
      meetingId,
      totalParticipants: participants.length,
      presentParticipants,
      absentParticipants: participants.length - presentParticipants,
      averageAttendanceTime,
      attendanceRate,
      participants: attendanceData,
    };

    
    // Log the first participant in detail
    if (result.participants.length > 0) {
    }

    return result;
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
    
    // Fix: Proper ObjectId comparison
    const participantUserIdStr = participant.userId?.toString();
    const requestedUserIdStr = userId?.toString();
    
    if (participant.userId && participantUserIdStr !== requestedUserIdStr) {
      throw new ForbiddenException('You can only raise your own hand');
    }
    

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

    return participant;
  }

  // Get participant by user ID and meeting ID
  async getParticipantByUserAndMeeting(userId: string, meetingId: string) {

    const participant = await this.participantModel.findOne({
      userId: new Types.ObjectId(userId),
      meetingId: new Types.ObjectId(meetingId)
    }).populate('userId', 'email displayName systemRole avatarUrl');


    return participant;
  }

  // ==================== WAITING ROOM METHODS ====================

  // Get all participants in waiting room for a meeting
  async getWaitingParticipants(meetingId: string, hostUserId: string) {

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

    const waitingParticipants = await this.participantModel
      .find({
        meetingId: new Types.ObjectId(meetingId),
        status: ParticipantStatus.WAITING
      })
      .populate('userId', 'email displayName systemRole avatarUrl')
      .sort({ createdAt: 1 });

    // ✅ FIX: Filter out participants where userId populate failed (user was deleted)
    const validWaitingParticipants = waitingParticipants.filter(participant => {
      if (!participant.userId) {
        return false;
      }
      return true;
    });


    return validWaitingParticipants;
  }

  // Approve a participant from waiting room
  async approveParticipant(participantId: string, hostUserId: string) {

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


    return participant;
  }

  // Reject a participant from waiting room
  async rejectParticipant(participantId: string, hostUserId: string) {

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


    return participant;
  }

  // Admit all waiting participants (bulk approve)
  async admitAllWaitingParticipants(meetingId: string, hostUserId: string) {

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

  // ==================== PRESENCE SYSTEM METHODS ====================

  /**
   * Notify that a meeting has started
   */
  async notifyMeetingStarted(meetingId: string): Promise<void> {
    try {
      this.logger.log(`[NOTIFY_MEETING_STARTED] Meeting ${meetingId} has started`);
      // This method can be used to trigger notifications or update meeting status
      // For now, it's a placeholder for future implementation
    } catch (error) {
      this.logger.error(`[NOTIFY_MEETING_STARTED] Error: ${error.message}`);
    }
  }

  /**
   * Clean up duplicate participants - keep only the one with the most recent lastSeenAt
   * FIXED: Remove duplicates caused by ObjectId vs string meetingId inconsistency
   */
  async cleanupDuplicateParticipants(meetingId: string): Promise<number> {
    try {
      
      // Find all participants in this meeting (both ObjectId and string meetingId)
      const allParticipants = await this.participantModel.find({
        meetingId: { $in: [new Types.ObjectId(meetingId), meetingId] }
      });
      
      
      // Group by userId to find duplicates
      const participantsByUser = new Map<string, any[]>();
      
      for (const participant of allParticipants) {
        const userId = participant.userId.toString();
        if (!participantsByUser.has(userId)) {
          participantsByUser.set(userId, []);
        }
        participantsByUser.get(userId)!.push(participant);
      }
      
      let deletedCount = 0;
      
      // For each user with multiple entries, keep the one with the most recent lastSeenAt
      for (const [userId, participants] of participantsByUser.entries()) {
        if (participants.length > 1) {
          
          // Sort by lastSeenAt (most recent first) - this is the key fix!
          participants.sort((a, b) => {
            const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
            const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
            return bTime - aTime;
          });
          
          // Keep the first (most recent lastSeenAt) entry, delete the rest
          const toKeep = participants[0];
          const toDelete = participants.slice(1);
          
          
          for (const duplicate of toDelete) {
            await this.participantModel.findByIdAndDelete(duplicate._id);
            deletedCount++;
          }
        }
      }
      
      return deletedCount;
    } catch (error) {
      this.logger.error(`[CLEANUP_DUPLICATES] Error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Clean up stale participants who haven't been seen for a specified time
   */
  async cleanupStaleParticipants(thresholdSeconds: number): Promise<number> {
    try {
      const threshold = new Date(Date.now() - (thresholdSeconds * 1000));
      
      // Find participants who haven't been seen since the threshold
      const staleParticipants = await this.participantModel.find({
        lastSeenAt: { $lt: threshold },
        status: { $ne: 'LEFT' }
      });

      let cleanedCount = 0;
      const now = new Date();
      
      for (const participant of staleParticipants) {
        // Close any open sessions
        const sessions = participant.sessions || [];
        if (sessions.length > 0) {
          const lastSession = sessions[sessions.length - 1];
          
          // ✅ FIX: Check if the last session is still open (prevent double counting)
          if (lastSession.leftAt) {
            this.logger.log(`[CLEANUP_STALE_PARTICIPANTS] Session already closed for participant ${participant._id}`);
          } else if (lastSession.joinedAt) {
            // Close the session
            lastSession.leftAt = now;
            const durationSec = Math.floor(
              (now.getTime() - new Date(lastSession.joinedAt).getTime()) / 1000
            );
            lastSession.durationSec = durationSec;
            
            // ✅ FIX: Update total duration with double-counting prevention - include sessions with durationSec = 0
            const previousTotal = participant.totalDurationSec || 0;
            const sessionSum = participant.sessions
              .filter(s => s.leftAt && (s.durationSec !== undefined && s.durationSec !== null))
              .reduce((sum, s) => sum + (s.durationSec || 0), 0);
            
            if (sessionSum <= previousTotal) {
              participant.totalDurationSec = previousTotal + durationSec;
              this.logger.log(`[CLEANUP_STALE_PARTICIPANTS] Closed session for participant ${participant._id} - Duration: ${durationSec}s (new total: ${participant.totalDurationSec}s)`);
            } else {
              this.logger.warn(`[CLEANUP_STALE_PARTICIPANTS] Session duration already counted for participant ${participant._id}`);
            }
          }
        }
        
        // Mark as LEFT
        participant.status = ParticipantStatus.LEFT;
        
        // Save the participant with closed session
        await participant.save();
        cleanedCount++;
      }

      this.logger.log(`[CLEANUP_STALE_PARTICIPANTS] Cleaned up ${cleanedCount} stale participants (threshold: ${thresholdSeconds}s)`);
      return cleanedCount;
    } catch (error) {
      this.logger.error(`[CLEANUP_STALE_PARTICIPANTS] Error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Mark a participant as LEFT (general)
   */
  async markParticipantAsLeft(userId: string): Promise<void> {
    try {
      await this.participantModel.updateMany(
        { userId, status: { $ne: 'LEFT' } },
        {
          status: 'LEFT',
          leftAt: new Date()
        }
      );
      this.logger.log(`[MARK_PARTICIPANT_AS_LEFT] Marked user ${userId} as LEFT`);
    } catch (error) {
      this.logger.error(`[MARK_PARTICIPANT_AS_LEFT] Error: ${error.message}`);
    }
  }

  /**
   * Mark a participant as LEFT in a specific meeting
   * ✅ FIXED: Now properly closes active sessions to prevent ghost member attendance
   */
  async markParticipantAsLeftInMeeting(userId: string, meetingId: string): Promise<void> {
    try {
      this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] Starting - user ${userId} in meeting ${meetingId}`);
      
      // Find all participants for this user in this meeting who aren't already LEFT
      const participants = await this.participantModel.find({
        userId: new Types.ObjectId(userId),
        meetingId: new Types.ObjectId(meetingId),
        status: { $ne: ParticipantStatus.LEFT }
      });

      if (participants.length === 0) {
        this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] No active participants found for user ${userId} in meeting ${meetingId}`);
        return;
      }

      const now = new Date();
      
      // Process each participant
      for (const participant of participants) {
        this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] Processing participant ${participant._id}`);
        
        // ✅ CRITICAL FIX: Close any open sessions
        const sessions = participant.sessions || [];
        if (sessions.length > 0) {
          const lastSession = sessions[sessions.length - 1];
          
          // ✅ FIX: Check if the last session is still open (prevent double counting)
          if (lastSession.leftAt) {
            this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] Last session already closed for participant ${participant._id}`);
          } else if (lastSession.joinedAt) {
            // Close the session
            lastSession.leftAt = now;
            const durationSec = Math.floor(
              (now.getTime() - lastSession.joinedAt.getTime()) / 1000
            );
            lastSession.durationSec = durationSec;
            
            // ✅ FIX: Update total duration with double-counting prevention - include sessions with durationSec = 0
            const previousTotal = participant.totalDurationSec || 0;
            const sessionSum = participant.sessions
              .filter(s => s.leftAt && (s.durationSec !== undefined && s.durationSec !== null))
              .reduce((sum, s) => sum + (s.durationSec || 0), 0);
            
            if (sessionSum <= previousTotal) {
              participant.totalDurationSec = previousTotal + durationSec;
              this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] Closed session for participant ${participant._id} - Duration: ${durationSec}s (new total: ${participant.totalDurationSec}s)`);
            } else {
              this.logger.warn(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] Session duration already counted for participant ${participant._id}`);
            }
          }
        } else {
          this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] No sessions found for participant ${participant._id}`);
        }
        
        // Mark as LEFT
        participant.status = ParticipantStatus.LEFT;
        
        // Save the participant with closed session
        await participant.save();
        
        this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] Successfully marked participant ${participant._id} as LEFT with closed session`);
      }
      
      // Decrement meeting participant count
      await this.meetingModel.findByIdAndUpdate(
        meetingId,
        { $inc: { participantCount: -participants.length } }
      );
      
      this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] Completed - Marked ${participants.length} participant(s) as LEFT for user ${userId} in meeting ${meetingId}`);
    } catch (error) {
      this.logger.error(`[MARK_PARTICIPANT_AS_LEFT_IN_MEETING] Error: ${error.message}`, error.stack);
    }
  }

  /**
   * Mark a participant as LEFT across ALL meetings (used when user disconnects)
   * ✅ FIXES: Closes all open sessions across all meetings for a user
   */
  async markParticipantAsLeftAcrossAllMeetings(userId: string): Promise<void> {
    try {
      this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Starting - user ${userId}`);
      
      // Find all active participants for this user across all meetings
      const participants = await this.participantModel.find({
        userId: new Types.ObjectId(userId),
        status: { $ne: ParticipantStatus.LEFT }
      });

      if (participants.length === 0) {
        this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] No active participants found for user ${userId}`);
        return;
      }

      this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Found ${participants.length} active participant(s) for user ${userId}`);

      const now = new Date();
      const meetingIds = new Set<string>();
      
      // Process each participant and close their sessions
      for (const participant of participants) {
        this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Processing participant ${participant._id} in meeting ${participant.meetingId}`);
        
        // ✅ CRITICAL FIX: Close any open sessions
        const sessions = participant.sessions || [];
        if (sessions.length > 0) {
          const lastSession = sessions[sessions.length - 1];
          
          // ✅ FIX: Check if the last session is still open (prevent double counting)
          if (lastSession.leftAt) {
            this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Session already closed for participant ${participant._id}`);
          } else if (lastSession.joinedAt) {
            // Close the session
            lastSession.leftAt = now;
            const durationSec = Math.floor(
              (now.getTime() - lastSession.joinedAt.getTime()) / 1000
            );
            lastSession.durationSec = durationSec;
            
            // ✅ FIX: Update total duration with double-counting prevention - include sessions with durationSec = 0
            const previousTotal = participant.totalDurationSec || 0;
            const sessionSum = participant.sessions
              .filter(s => s.leftAt && (s.durationSec !== undefined && s.durationSec !== null))
              .reduce((sum, s) => sum + (s.durationSec || 0), 0);
            
            if (sessionSum <= previousTotal) {
              participant.totalDurationSec = previousTotal + durationSec;
              this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Closed session for participant ${participant._id} - Duration: ${durationSec}s (new total: ${participant.totalDurationSec}s)`);
            } else {
              this.logger.warn(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Session duration already counted for participant ${participant._id}`);
            }
          }
        }
        
        // Mark as LEFT
        participant.status = ParticipantStatus.LEFT;
        
        // Save the participant with closed session
        await participant.save();
        
        // Track meeting IDs for count decrement
        meetingIds.add(participant.meetingId.toString());
      }
      
      // Decrement participant count for each affected meeting
      for (const meetingId of meetingIds) {
        await this.meetingModel.findByIdAndUpdate(
          meetingId,
          { $inc: { participantCount: -1 } }
        );
        this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Decremented participant count for meeting ${meetingId}`);
      }
      
      this.logger.log(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Completed - marked ${participants.length} participant(s) as LEFT across ${meetingIds.size} meeting(s)`);
    } catch (error) {
      this.logger.error(`[MARK_PARTICIPANT_AS_LEFT_ACROSS_ALL] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update participant presence (lastSeenAt and socketId)
   * FIXED: Use upsert to create participant record if it doesn't exist
   */
  async updateParticipantPresence(userId: string, meetingId: string, socketId: string): Promise<void> {
    try {
      
      // FIXED: Handle both ObjectId and string meetingId formats
      const meetingIdQuery = Types.ObjectId.isValid(meetingId) 
        ? { $in: [new Types.ObjectId(meetingId), meetingId] } // Search for both ObjectId and string
        : meetingId; // If not valid ObjectId, use as string
      
      // First, try to update existing participant (handle both ObjectId and string meetingId)
      const updateResult = await this.participantModel.updateMany(
        { 
          userId: new Types.ObjectId(userId), 
          meetingId: meetingIdQuery, 
          status: { $ne: 'LEFT' } 
        },
        {
          lastSeenAt: new Date(),
          socketId,
          status: 'ADMITTED' // FIXED: Use proper status enum value
        }
      );


      // If no participant was updated, create a new one
      if (updateResult.modifiedCount === 0) {
        
        // Get user info for the new participant
        const user = await this.memberModel.findById(userId);
        if (!user) {
          throw new Error(`User ${userId} not found`);
        }

        // FIXED: Always use ObjectId for meetingId to ensure consistency
        const normalizedMeetingId = Types.ObjectId.isValid(meetingId) 
          ? new Types.ObjectId(meetingId) 
          : new Types.ObjectId(meetingId);

        // Create new participant record
        const newParticipant = new this.participantModel({
          userId: new Types.ObjectId(userId),
          meetingId: normalizedMeetingId,
          displayName: user.displayName,
          status: 'ADMITTED', // FIXED: Use proper status enum value
          lastSeenAt: new Date(),
          socketId,
          joinedAt: new Date()
        });

        await newParticipant.save();

        // Update meeting participant count
        await this.meetingModel.findByIdAndUpdate(normalizedMeetingId, {
          $inc: { participantCount: 1 }
        });

      } else {
      }
    } catch (error) {
      this.logger.error(`[UPDATE_PARTICIPANT_PRESENCE] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update participant heartbeat (lastSeenAt timestamp)
   */
  async updateParticipantHeartbeat(userId: string, meetingId: string): Promise<void> {
    try {
      
      // FIXED: Handle both ObjectId and string meetingId formats
      const meetingIdQuery = Types.ObjectId.isValid(meetingId) 
        ? { $in: [new Types.ObjectId(meetingId), meetingId] } // Search for both ObjectId and string
        : meetingId; // If not valid ObjectId, use as string
      
      // First, check if participants exist
      const existingParticipants = await this.participantModel.find({ 
        userId: new Types.ObjectId(userId), 
        meetingId: meetingIdQuery 
      });
      
      // Update heartbeat for ALL participants (including LEFT ones) - they're sending heartbeats so they're active
      const updateResult = await this.participantModel.updateMany(
        { 
          userId: new Types.ObjectId(userId), 
          meetingId: meetingIdQuery 
        },
        {
          $set: {
            lastSeenAt: new Date(),
            status: 'ADMITTED' // FIXED: Always set to ADMITTED if they're sending heartbeats
          }
        }
      );
      
      
      // Verify the update worked
      const updatedParticipants = await this.participantModel.find({ 
        userId: new Types.ObjectId(userId), 
        meetingId: meetingIdQuery 
      });
      
      this.logger.log(`[UPDATE_PARTICIPANT_HEARTBEAT] Updated heartbeat for user ${userId} in meeting ${meetingId}, modified: ${updateResult.modifiedCount}`);
    } catch (error) {
      this.logger.error(`[UPDATE_PARTICIPANT_HEARTBEAT] Error: ${error.message}`);
    }
  }

  /**
   * Get count of stale participants
   */
  async getStaleParticipantsCount(thresholdSeconds: number): Promise<number> {
    try {
      const threshold = new Date(Date.now() - (thresholdSeconds * 1000));
      
      const count = await this.participantModel.countDocuments({
        lastSeenAt: { $lt: threshold },
        status: { $ne: 'LEFT' }
      });

      return count;
    } catch (error) {
      this.logger.error(`[GET_STALE_PARTICIPANTS_COUNT] Error: ${error.message}`);
      return 0;
    }
  }
}
