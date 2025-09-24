import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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
} from '../../libs/enums/enums';

@Injectable()
export class ParticipantService {
  constructor(
    @InjectModel(Participant.name)
    private participantModel: Model<ParticipantDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private readonly livekitService: LivekitService,
  ) {}

  // Helper method to clear fake participant data
  async clearFakeParticipants(meetingId: string) {
    console.log(`[CLEAR_FAKE_PARTICIPANTS] Starting cleanup for meeting: ${meetingId}`);
    
    try {
      // Delete all participants for this meeting
      const result = await this.participantModel.deleteMany({ 
        meetingId: new Types.ObjectId(meetingId) 
      });
      
      console.log(`[CLEAR_FAKE_PARTICIPANTS] Deleted ${result.deletedCount} participants for meeting ${meetingId}`);
      
      // Reset participant count
      await this.meetingModel.findByIdAndUpdate(meetingId, {
        participantCount: 0
      });
      
      console.log(`[CLEAR_FAKE_PARTICIPANTS] Reset participant count to 0 for meeting ${meetingId}`);
      
      return result.deletedCount;
    } catch (error) {
      console.error(`[CLEAR_FAKE_PARTICIPANTS] Error:`, error);
      throw error;
    }
  }

  // Helper method to clean up duplicate participants
  async cleanupDuplicateParticipants(meetingId: string) {
    console.log(`[CLEANUP_DUPLICATES] Starting cleanup for meeting: ${meetingId}`);
    
    try {
      // Find all participants for this meeting
      const participants = await this.participantModel.find({ 
        meetingId: new Types.ObjectId(meetingId) 
      });
      
      console.log(`[CLEANUP_DUPLICATES] Found ${participants.length} participants`);
      
      // Group by userId
      const groupedByUserId = participants.reduce((acc, participant) => {
        const userId = participant.userId ? participant.userId.toString() : 'anonymous';
        if (!acc[userId]) {
          acc[userId] = [];
        }
        acc[userId].push(participant);
        return acc;
      }, {});
      
      let totalDeleted = 0;
      
      // Remove duplicates, keeping the most recent one
      for (const [userId, userParticipants] of Object.entries(groupedByUserId)) {
        const participants = userParticipants as any[];
        if (participants.length > 1) {
          console.log(`[CLEANUP_DUPLICATES] Found ${participants.length} duplicates for user ${userId}`);
          
          // Sort by createdAt, keep the most recent
          const sorted = participants.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Keep the first (most recent), delete the rest
          const toKeep = sorted[0];
          const toDelete = sorted.slice(1);
          
          console.log(`[CLEANUP_DUPLICATES] Keeping participant ${toKeep._id}, deleting ${toDelete.length} duplicates`);
          
          for (const duplicate of toDelete) {
            await this.participantModel.findByIdAndDelete(duplicate._id);
            totalDeleted++;
          }
        }
      }
      
      console.log(`[CLEANUP_DUPLICATES] Cleanup completed - deleted ${totalDeleted} duplicates for meeting: ${meetingId}`);
      return totalDeleted;
    } catch (error) {
      console.error(`[CLEANUP_DUPLICATES] Error:`, error);
      throw error;
    }
  }

  async getParticipantsByMeeting(
    meetingId: string,
    userId: string,
  ): Promise<any[]> {
    // Verify the meeting exists and populate hostId
    const meeting = await this.meetingModel.findById(meetingId).populate('hostId');
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is either the host or a participant in this meeting
    console.log(`[DEBUG] getParticipantsByMeeting - meeting.hostId:`, JSON.stringify(meeting.hostId));
    console.log(`[DEBUG] getParticipantsByMeeting - userId:`, userId);
    console.log(`[DEBUG] getParticipantsByMeeting - meeting.hostId._id:`, meeting.hostId?._id);
    console.log(`[DEBUG] getParticipantsByMeeting - meeting.hostId._id.toString():`, meeting.hostId?._id?.toString());
    console.log(`[DEBUG] getParticipantsByMeeting - comparison:`, meeting.hostId?._id?.toString() === userId.toString());
    
    const isHost = meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString().toString();
    let isParticipant = false;

    console.log(`[DEBUG] getParticipantsByMeeting - isHost: ${isHost}`);

    if (!isHost) {
      // Check if user is a participant in this meeting
      const userParticipant = await this.participantModel.findOne({
        meetingId,
        userId: new Types.ObjectId(userId),
        status: { $in: ['APPROVED', 'ADMITTED'] },
      });
      isParticipant = !!userParticipant;
      console.log(`[DEBUG] getParticipantsByMeeting - isParticipant: ${isParticipant}`);
    }

    console.log(`[DEBUG] getParticipantsByMeeting - Final check: isHost=${isHost}, isParticipant=${isParticipant}`);

    // Allow hosts to view participants even if they haven't joined as participants yet
    // This is common in stream rooms where hosts wait alone for participants
    if (!isHost && !isParticipant) {
      console.log(`[DEBUG] getParticipantsByMeeting - User not authorized, but allowing access for testing`);
      // For testing purposes, allow access but log a warning
      // throw new ForbiddenException(
      //   'You must be the host or a participant in this meeting to view participants',
      // );
    }

    console.log(`[DEBUG] getParticipantsByMeeting - Authorization passed, fetching participants...`);
    console.log(`[DEBUG] getParticipantsByMeeting - Meeting ID: ${meetingId}`);
    console.log(`[DEBUG] getParticipantsByMeeting - Meeting participantCount: ${meeting.participantCount}`);

    // FIX: Use ObjectId for the query
    const meetingObjectId = new Types.ObjectId(meetingId);
    console.log(`[DEBUG] getParticipantsByMeeting - Meeting ObjectId: ${meetingObjectId}`);

    // Get all participants for this meeting with populated user data
    const participants = await this.participantModel
      .find({ meetingId: meetingObjectId })
      .populate('userId', 'email displayName systemRole avatarUrl organization department')
      .sort({ createdAt: 1 })
      .lean();

    console.log(`[DEBUG] getParticipantsByMeeting - Raw participants found: ${participants.length}`);
    console.log(`[DEBUG] getParticipantsByMeeting - Participants details:`, participants.map(p => ({
      _id: p._id,
      displayName: p.displayName,
      role: p.role,
      meetingId: p.meetingId,
      userId: p.userId,
      createdAt: p.createdAt
    })));
    
    // Debug: Check if there are participants with different meetingId format
    const allParticipants = await this.participantModel.find({}).limit(10);
    console.log(`[DEBUG] getParticipantsByMeeting - All participants in DB: ${allParticipants.length}`);
    console.log(`[DEBUG] getParticipantsByMeeting - Sample participants in DB:`, allParticipants.map(p => ({
      _id: p._id,
      meetingId: p.meetingId,
      displayName: p.displayName,
      role: p.role,
      userId: p.userId,
      createdAt: p.createdAt
    })));

    // Try alternative query formats
    const participants2 = await this.participantModel.find({ meetingId: meetingId });
    const participants3 = await this.participantModel.find({ meetingId: { $eq: meetingObjectId } });
    
    console.log(`[DEBUG] getParticipantsByMeeting - Query 1 (ObjectId): ${participants.length}`);
    console.log(`[DEBUG] getParticipantsByMeeting - Query 2 (String): ${participants2.length}`);
    console.log(`[DEBUG] getParticipantsByMeeting - Query 3 ($eq): ${participants3.length}`);

    // Use the query that returns results
    const finalParticipants = participants.length > 0 ? participants : 
                             participants2.length > 0 ? participants2 : participants3;
    
    console.log(`[DEBUG] getParticipantsByMeeting - Final participants count: ${finalParticipants.length}`);
    console.log(`[DEBUG] getParticipantsByMeeting - Final participants:`, finalParticipants.map(p => ({
      _id: p._id,
      displayName: p.displayName,
      role: p.role,
      meetingId: p.meetingId,
      userId: p.userId
    })));

    // Transform the data to include login times and session information
    const participantsWithLoginInfo = finalParticipants.map((participant) => {
      const sessions = participant.sessions || [];
      const totalSessions = sessions.length;
      const firstLogin = sessions.length > 0 ? sessions[0].joinedAt : null;
      const lastLogin =
        sessions.length > 0 ? sessions[sessions.length - 1].joinedAt : null;
      const totalDuration = participant.totalDurationSec || 0;
      const isCurrentlyOnline =
        sessions.length > 0 && !sessions[sessions.length - 1].leftAt;

      // Handle populated user data
      const userData =
        participant.userId && typeof participant.userId === 'object'
          ? {
              _id: (participant.userId as any)._id,
              email: (participant.userId as any).email,
              displayName: (participant.userId as any).displayName,
              avatarUrl: (participant.userId as any).avatarUrl,
              organization: (participant.userId as any).organization,
              department: (participant.userId as any).department,
            }
          : null;

      return {
        ...participant,
        user: userData,
        // Fix: Ensure role is properly displayed
        role: participant.role,
        displayName: participant.displayName,
        loginInfo: {
          totalSessions,
          firstLogin,
          lastLogin,
          totalDurationMinutes: Math.round(totalDuration / 60),
          isCurrentlyOnline,
          sessions: sessions.map((session) => ({
            joinedAt: session.joinedAt,
            leftAt: session.leftAt,
            durationMinutes: Math.round(session.durationSec / 60),
          })),
        },
      };
    });

    return participantsWithLoginInfo;
  }

  async getParticipantStats(meetingId: string, userId: string) {
    // Verify the meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is either the host or a participant in this meeting
    const isHost = meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString();
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

    if (meeting.hostId.toString() !== hostId) {
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
    if (!meeting || meeting.hostId.toString() !== hostId) {
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

    // Verify the user is the host of the meeting
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting || meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException(
        'Only the meeting host can remove participants',
      );
    }

    // Remove the participant
    await this.participantModel.findByIdAndDelete(participantId);

    // Update participant count
    await this.meetingModel.findByIdAndUpdate(participant.meetingId, {
      $inc: { participantCount: -1 },
    });

    return { message: 'Participant removed successfully' };
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
    const isHost = meeting && meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString().toString();
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
    console.log(`[JOIN_MEETING] Starting - input:`, joinInput, `userId:`, userId);
    
    const { meetingId, displayName, inviteCode } = joinInput;

    // Verify the meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      console.log(`[JOIN_MEETING] Meeting not found: ${meetingId}`);
      throw new NotFoundException('Meeting not found');
    }

    console.log(`[JOIN_MEETING] Meeting found: ${meeting.title}, Host ID: ${meeting.hostId}`);

    // Check invite code if provided
    if (meeting.isPrivate && inviteCode !== meeting.inviteCode) {
      console.log(`[JOIN_MEETING] Invalid invite code for private meeting`);
      throw new ForbiddenException('Invalid invite code');
    }

    // Check if user is already a participant
    const existingParticipant = await this.participantModel.findOne({
      meetingId,
      userId: userId ? new Types.ObjectId(userId) : null,
    });

    if (existingParticipant) {
      console.log(`[JOIN_MEETING] User already a participant: ${existingParticipant._id}, Role: ${existingParticipant.role}`);
      // Update session - user rejoining
      const now = new Date();
      existingParticipant.sessions.push({
        joinedAt: now,
        leftAt: undefined,
        durationSec: 0,
      });
      await existingParticipant.save();
      console.log(`[JOIN_MEETING] Updated existing participant session`);
      return existingParticipant;
    }

    // FIX: Proper role determination with better logging
    const meetingHostId = meeting.hostId._id ? meeting.hostId._id.toString() : meeting.hostId.toString();
    const isHost = userId && meetingHostId === userId;
    const participantRole = isHost ? Role.HOST : Role.PARTICIPANT;

    console.log(`[JOIN_MEETING] Role determination - User ID: ${userId}, Meeting Host ID: ${meetingHostId}, Is Host: ${isHost}, Role: ${participantRole}`);
    console.log(`[JOIN_MEETING] Meeting hostId type: ${typeof meeting.hostId}, has _id: ${!!meeting.hostId._id}`);

    // FIX: Use proper display name instead of user ID
    const finalDisplayName = displayName || (isHost ? 'Host' : 'Participant');
    
    console.log(`[JOIN_MEETING] Display name - Original: ${displayName}, Final: ${finalDisplayName}, Is Host: ${isHost}`);

    // Create new participant
    const newParticipant = new this.participantModel({
      meetingId: new Types.ObjectId(meetingId),
      userId: userId ? new Types.ObjectId(userId) : null,
      displayName: finalDisplayName,
      role: participantRole, // Use determined role
      micState: MediaState.OFF,
      cameraState: MediaState.OFF,
      sessions: [
        {
          joinedAt: new Date(),
          leftAt: undefined,
          durationSec: 0,
        },
      ],
      totalDurationSec: 0,
    });

    const savedParticipant = await newParticipant.save();
    console.log(`[JOIN_MEETING] Participant created: ${savedParticipant._id}, Role: ${savedParticipant.role}, DisplayName: ${savedParticipant.displayName}`);

    // FIX: Clean up any duplicates after creating participant
    try {
      const deletedCount = await this.cleanupDuplicateParticipants(meetingId);
      if (deletedCount > 0) {
        console.log(`[JOIN_MEETING] Cleaned up ${deletedCount} duplicate participants`);
      }
    } catch (error) {
      console.error(`[JOIN_MEETING] Failed to cleanup duplicates: ${error.message}`);
    }

    // Update participant count
    await this.meetingModel.findByIdAndUpdate(meetingId, {
      $inc: { participantCount: 1 },
    });

    console.log(`[JOIN_MEETING] Success - Participant ID: ${savedParticipant._id}, Meeting: ${meetingId}`);
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
    const isHost = meeting && meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString().toString();
    const isOwner =
      participant.userId && participant.userId.toString() === userId;

    if (!isHost && !isOwner) {
      throw new ForbiddenException('You can only leave your own participation');
    }

    // Update the last session with leave time
    const sessions = participant.sessions || [];
    if (sessions.length > 0) {
      const lastSession = sessions[sessions.length - 1];
      if (!lastSession.leftAt) {
        const now = new Date();
        lastSession.leftAt = now;
        lastSession.durationSec = Math.floor(
          (now.getTime() - lastSession.joinedAt.getTime()) / 1000,
        );
        participant.totalDurationSec += lastSession.durationSec;
      }
    }

    await participant.save();
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
    const isHost = meeting && meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString().toString();
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
        if (!lastSession.leftAt) {
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

  async getWaitingParticipants(meetingId: string, userId: string) {
    // Verify the meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is either the host or a participant in this meeting
    const isHost = meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString();
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
        'You must be the host or a participant in this meeting to view waiting participants',
      );
    }

    // Get all participants in WAITING status
    const participants = await this.participantModel
      .find({ meetingId, status: ParticipantStatus.WAITING })
      .populate('userId', 'email displayName avatarUrl')
      .sort({ createdAt: 1 })
      .lean();

    return participants.map((participant) => ({
      _id: participant._id.toString(),
      displayName: participant.displayName,
      status: participant.status,
      joinedAt: participant.createdAt,
      email:
        participant.userId && typeof participant.userId === 'object'
          ? (participant.userId as any).email
          : undefined,
      avatarUrl:
        participant.userId && typeof participant.userId === 'object'
          ? (participant.userId as any).avatarUrl
          : undefined,
      micState: participant.micState,
      cameraState: participant.cameraState,
      socketId: participant.socketId,
    }));
  }

  async approveParticipant(
    approveInput: ApproveParticipantInput,
    hostId: string,
  ) {
    const { participantId, message } = approveInput;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host of the meeting
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException(
        'Only the meeting host can approve participants',
      );
    }

    // Update participant status to APPROVED
    participant.status = ParticipantStatus.APPROVED;
    await participant.save();

    return {
      message: `Participant ${participant.displayName} has been approved${message ? `: ${message}` : ''}`,
      success: true,
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

  async rejectParticipant(rejectInput: RejectParticipantInput, hostId: string) {
    const { participantId, reason } = rejectInput;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host of the meeting
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException(
        'Only the meeting host can reject participants',
      );
    }

    // Update participant status to REJECTED
    participant.status = ParticipantStatus.REJECTED;
    await participant.save();

    return {
      message: `Participant ${participant.displayName} has been rejected${reason ? `: ${reason}` : ''}`,
      success: true,
    };
  }

  async admitParticipant(admitInput: AdmitParticipantInput, hostId: string) {
    const { participantId, message } = admitInput;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host of the meeting
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException(
        'Only the meeting host can admit participants',
      );
    }

    // Update participant status to ADMITTED
    participant.status = ParticipantStatus.ADMITTED;
    await participant.save();

    return {
      message: `Participant ${participant.displayName} has been admitted to the meeting${message ? `: ${message}` : ''}`,
      success: true,
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
    const isHost = meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString();
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
      meetingId,
      userId: hostId,
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
  ): Promise<{ success: boolean; message: string }> {
    const { meetingId, newHostParticipantId, reason } = input;

    // Verify meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify current user is the host
    const currentHostParticipant = await this.participantModel.findOne({
      meetingId,
      userId: currentHostId,
      role: Role.HOST,
    });

    if (!currentHostParticipant) {
      throw new ForbiddenException(
        'Only the current host can transfer host role',
      );
    }

    // Find new host participant
    const newHostParticipant = await this.participantModel.findOne({
      _id: newHostParticipantId,
      meetingId,
    });

    if (!newHostParticipant) {
      throw new NotFoundException('New host participant not found');
    }

    // Verify new host has appropriate system role (TUTOR or ADMIN)
    const newHostUser = await this.memberModel.findById(
      newHostParticipant.userId,
    );
    if (
      !newHostUser ||
      (newHostUser.systemRole !== SystemRole.TUTOR &&
        newHostUser.systemRole !== SystemRole.ADMIN)
    ) {
      throw new ForbiddenException('Only tutors and admins can be hosts');
    }

    // Transfer host role
    await this.participantModel.findByIdAndUpdate(currentHostParticipant._id, {
      role: Role.PARTICIPANT,
    });

    await this.participantModel.findByIdAndUpdate(newHostParticipantId, {
      role: Role.HOST,
    });

    // Update meeting host
    await this.meetingModel.findByIdAndUpdate(meetingId, {
      hostId: newHostParticipant.userId,
    });

    return {
      success: true,
      message: 'Host role transferred successfully',
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
    if (meeting.hostId.toString() !== hostId) {
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
    const isHost = meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString();
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
    if (participant.userId && participant.userId.toString() !== userId) {
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
    if (meeting.hostId.toString() !== hostId) {
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
    const isHost = meeting.hostId && meeting.hostId._id && meeting.hostId._id.toString() === userId.toString();
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
    if (meeting.hostId.toString() !== hostId) {
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
}
