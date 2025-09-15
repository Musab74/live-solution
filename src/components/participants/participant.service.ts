import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Participant, ParticipantDocument } from '../../schemas/Participant.model';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { CreateParticipantInput, UpdateParticipantInput, JoinMeetingInput, LeaveMeetingInput, UpdateSessionInput, ForceMediaInput, ForceMuteInput, ForceCameraOffInput, TransferHostInput } from '../../libs/DTO/participant/participant.mutation';
import { PreMeetingSetupInput, ApproveParticipantInput, RejectParticipantInput, AdmitParticipantInput, DeviceTestInput } from '../../libs/DTO/participant/waiting-room.input';
import { Role, MediaState, ParticipantStatus, MediaTrack, SystemRole } from '../../libs/enums/enums';

@Injectable()
export class ParticipantService {
  constructor(
    @InjectModel(Participant.name) private participantModel: Model<ParticipantDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  async getParticipantsByMeeting(meetingId: string, hostId: string): Promise<any[]> {
    // Verify the meeting exists and the user is the host
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can view participants');
    }

    // Get all participants for this meeting with populated user data
    const participants = await this.participantModel
      .find({ meetingId })
      .populate('userId', 'email displayName avatarUrl organization department')
      .sort({ createdAt: 1 })
      .lean();

    // Transform the data to include login times and session information
    const participantsWithLoginInfo = participants.map(participant => {
      const sessions = participant.sessions || [];
      const totalSessions = sessions.length;
      const firstLogin = sessions.length > 0 ? sessions[0].joinedAt : null;
      const lastLogin = sessions.length > 0 ? sessions[sessions.length - 1].joinedAt : null;
      const totalDuration = participant.totalDurationSec || 0;
      const isCurrentlyOnline = sessions.length > 0 && !sessions[sessions.length - 1].leftAt;

      // Handle populated user data
      const userData = participant.userId && typeof participant.userId === 'object' ? {
        _id: (participant.userId as any)._id,
        email: (participant.userId as any).email,
        displayName: (participant.userId as any).displayName,
        avatarUrl: (participant.userId as any).avatarUrl,
        organization: (participant.userId as any).organization,
        department: (participant.userId as any).department,
      } : null;

      return {
        ...participant,
        user: userData,
        loginInfo: {
          totalSessions,
          firstLogin,
          lastLogin,
          totalDurationMinutes: Math.round(totalDuration / 60),
          isCurrentlyOnline,
          sessions: sessions.map(session => ({
            joinedAt: session.joinedAt,
            leftAt: session.leftAt,
            durationMinutes: Math.round(session.durationSec / 60),
          })),
        },
      };
    });

    return participantsWithLoginInfo;
  }

  async getParticipantStats(meetingId: string, hostId: string) {
    // Verify the meeting exists and the user is the host
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can view participant stats');
    }

    const participants = await this.participantModel.find({ meetingId }).lean();

    const stats = {
      totalParticipants: participants.length,
      currentlyOnline: participants.filter(p => {
        const sessions = p.sessions || [];
        return sessions.length > 0 && !sessions[sessions.length - 1].leftAt;
      }).length,
      totalSessions: participants.reduce((sum, p) => sum + (p.sessions?.length || 0), 0),
      averageSessionDuration: 0,
      totalMeetingDuration: 0,
    };

    // Calculate average session duration
    const allSessions = participants.flatMap(p => p.sessions || []);
    if (allSessions.length > 0) {
      const totalDuration = allSessions.reduce((sum, session) => sum + session.durationSec, 0);
      stats.averageSessionDuration = Math.round(totalDuration / allSessions.length / 60); // in minutes
    }

    // Calculate total meeting duration (from first join to last leave)
    if (allSessions.length > 0) {
      const firstJoin = Math.min(...allSessions.map(s => s.joinedAt.getTime()));
      const lastLeave = Math.max(...allSessions.map(s => s.leftAt?.getTime() || new Date().getTime()));
      stats.totalMeetingDuration = Math.round((lastLeave - firstJoin) / 1000 / 60); // in minutes
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
      throw new ForbiddenException('Only the meeting host can add participants');
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
      $inc: { participantCount: 1 }
    });

    return savedParticipant;
  }

  async updateParticipant(updateInput: UpdateParticipantInput, hostId: string) {
    const { participantId, displayName, role, micState, cameraState } = updateInput;

    // Find the participant
    const participant = await this.participantModel.findById(participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify the user is the host of the meeting
    const meeting = await this.meetingModel.findById(participant.meetingId);
    if (!meeting || meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can update participants');
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
      throw new ForbiddenException('Only the meeting host can remove participants');
    }

    // Remove the participant
    await this.participantModel.findByIdAndDelete(participantId);

    // Update participant count
    await this.meetingModel.findByIdAndUpdate(participant.meetingId, {
      $inc: { participantCount: -1 }
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
    const isHost = meeting && meeting.hostId.toString() === userId;
    const isOwner = participant.userId && participant.userId.toString() === userId;

    if (!isHost && !isOwner) {
      throw new ForbiddenException('You can only view your own participation or be the host');
    }

    return participant;
  }

  async joinMeeting(joinInput: JoinMeetingInput, userId?: string) {
    const { meetingId, displayName, inviteCode } = joinInput;

    // Verify the meeting exists
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check invite code if provided
    if (meeting.isPrivate && inviteCode !== meeting.inviteCode) {
      throw new ForbiddenException('Invalid invite code');
    }

    // Check if user is already a participant
    const existingParticipant = await this.participantModel.findOne({
      meetingId,
      userId: userId ? new Types.ObjectId(userId) : null,
    });

    if (existingParticipant) {
      // Update session - user rejoining
      const now = new Date();
      existingParticipant.sessions.push({
        joinedAt: now,
        leftAt: undefined,
        durationSec: 0,
      });
      await existingParticipant.save();
      return existingParticipant;
    }

    // Create new participant
    const newParticipant = new this.participantModel({
      meetingId: new Types.ObjectId(meetingId),
      userId: userId ? new Types.ObjectId(userId) : null,
      displayName,
      role: Role.PARTICIPANT,
      micState: MediaState.OFF,
      cameraState: MediaState.OFF,
      sessions: [{
        joinedAt: new Date(),
        leftAt: undefined,
        durationSec: 0,
      }],
      totalDurationSec: 0,
    });

    const savedParticipant = await newParticipant.save();

    // Update participant count
    await this.meetingModel.findByIdAndUpdate(meetingId, {
      $inc: { participantCount: 1 }
    });

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
    const isHost = meeting && meeting.hostId.toString() === userId;
    const isOwner = participant.userId && participant.userId.toString() === userId;

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
        lastSession.durationSec = Math.floor((now.getTime() - lastSession.joinedAt.getTime()) / 1000);
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
    const isHost = meeting && meeting.hostId.toString() === userId;
    const isOwner = participant.userId && participant.userId.toString() === userId;

    if (!isHost && !isOwner) {
      throw new ForbiddenException('You can only update your own participation');
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
          lastSession.durationSec = Math.floor((now.getTime() - lastSession.joinedAt.getTime()) / 1000);
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
    const { meetingId, displayName, inviteCode, joinWithCameraOff, joinWithMicOff, joinWithSpeakerOff } = setupInput;

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
      }
    };
  }

  async getWaitingParticipants(meetingId: string, hostId: string) {
    // Verify the meeting exists and the user is the host
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can view waiting participants');
    }

    // Get all participants in WAITING status
    const participants = await this.participantModel
      .find({ meetingId, status: ParticipantStatus.WAITING })
      .populate('userId', 'email displayName avatarUrl')
      .sort({ createdAt: 1 })
      .lean();

    return participants.map(participant => ({
      _id: participant._id.toString(),
      displayName: participant.displayName,
      status: participant.status,
      joinedAt: participant.createdAt,
      email: participant.userId && typeof participant.userId === 'object' ? (participant.userId as any).email : undefined,
      avatarUrl: participant.userId && typeof participant.userId === 'object' ? (participant.userId as any).avatarUrl : undefined,
      micState: participant.micState,
      cameraState: participant.cameraState,
      socketId: participant.socketId,
    }));
  }

  async approveParticipant(approveInput: ApproveParticipantInput, hostId: string) {
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
      throw new ForbiddenException('Only the meeting host can approve participants');
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
      }
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
      throw new ForbiddenException('Only the meeting host can reject participants');
    }

    // Update participant status to REJECTED
    participant.status = ParticipantStatus.REJECTED;
    await participant.save();

    return {
      message: `Participant ${participant.displayName} has been rejected${reason ? `: ${reason}` : ''}`,
      success: true
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
      throw new ForbiddenException('Only the meeting host can admit participants');
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
      }
    };
  }

  async getWaitingRoomStats(meetingId: string, hostId: string) {
    // Verify the meeting exists and the user is the host
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can view waiting room stats');
    }

    const stats = await this.participantModel.aggregate([
      { $match: { meetingId: new Types.ObjectId(meetingId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      totalWaiting: 0,
      totalApproved: 0,
      totalRejected: 0,
      totalAdmitted: 0,
    };

    stats.forEach(stat => {
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
      }
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
  async forceMuteParticipant(input: ForceMuteInput, hostId: string): Promise<{ success: boolean; message: string }> {
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
      role: { $in: [Role.HOST, Role.CO_HOST] }
    });

    if (!hostParticipant) {
      throw new ForbiddenException('Only hosts and co-hosts can force mute participants');
    }

    // Find target participant
    const targetParticipant = await this.participantModel.findOne({
      _id: participantId,
      meetingId
    });

    if (!targetParticipant) {
      throw new NotFoundException('Participant not found');
    }

    // Don't allow muting other hosts/co-hosts unless you're the main host
    if (targetParticipant.role === Role.HOST && hostParticipant.role !== Role.HOST) {
      throw new ForbiddenException('Only the main host can mute other hosts');
    }

    if (targetParticipant.role === Role.CO_HOST && hostParticipant.role !== Role.HOST) {
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
      message: `Successfully ${track === MediaTrack.MIC ? 'muted' : 'turned off camera for'} participant`
    };
  }

  // Force camera off participant (host/co-host only)
  async forceCameraOffParticipant(input: ForceCameraOffInput, hostId: string): Promise<{ success: boolean; message: string }> {
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
      role: { $in: [Role.HOST, Role.CO_HOST] }
    });

    if (!hostParticipant) {
      throw new ForbiddenException('Only hosts and co-hosts can force camera off participants');
    }

    // Find target participant
    const targetParticipant = await this.participantModel.findOne({
      _id: participantId,
      meetingId
    });

    if (!targetParticipant) {
      throw new NotFoundException('Participant not found');
    }

    // Don't allow turning off camera for other hosts/co-hosts unless you're the main host
    if (targetParticipant.role === Role.HOST && hostParticipant.role !== Role.HOST) {
      throw new ForbiddenException('Only the main host can turn off camera for other hosts');
    }

    if (targetParticipant.role === Role.CO_HOST && hostParticipant.role !== Role.HOST) {
      throw new ForbiddenException('Only the main host can turn off camera for co-hosts');
    }

    // Update participant's camera state
    await this.participantModel.findByIdAndUpdate(participantId, {
      cameraState: MediaState.OFF
    });

    return {
      success: true,
      message: 'Successfully turned off camera for participant'
    };
  }

  // Transfer host role to another participant
  async transferHost(input: TransferHostInput, currentHostId: string): Promise<{ success: boolean; message: string }> {
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
      role: Role.HOST
    });

    if (!currentHostParticipant) {
      throw new ForbiddenException('Only the current host can transfer host role');
    }

    // Find new host participant
    const newHostParticipant = await this.participantModel.findOne({
      _id: newHostParticipantId,
      meetingId
    });

    if (!newHostParticipant) {
      throw new NotFoundException('New host participant not found');
    }

    // Verify new host has appropriate system role (TUTOR or ADMIN)
    const newHostUser = await this.memberModel.findById(newHostParticipant.userId);
    if (!newHostUser || (newHostUser.systemRole !== SystemRole.TUTOR && newHostUser.systemRole !== SystemRole.ADMIN)) {
      throw new ForbiddenException('Only tutors and admins can be hosts');
    }

    // Transfer host role
    await this.participantModel.findByIdAndUpdate(currentHostParticipant._id, {
      role: Role.PARTICIPANT
    });

    await this.participantModel.findByIdAndUpdate(newHostParticipantId, {
      role: Role.HOST
    });

    // Update meeting host
    await this.meetingModel.findByIdAndUpdate(meetingId, {
      hostId: newHostParticipant.userId
    });

    return {
      success: true,
      message: 'Host role transferred successfully'
    };
  }

  // Check if user can be host (TUTOR or ADMIN only)
  async canBeHost(userId: string): Promise<boolean> {
    const user = await this.memberModel.findById(userId);
    return user && (user.systemRole === SystemRole.TUTOR || user.systemRole === SystemRole.ADMIN);
  }

  // Get attendance for a meeting (host/tutor only - tutors see their own courses)
  async getMeetingAttendance(meetingId: string, requesterId: string): Promise<any> {
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
      throw new ForbiddenException('Only meeting hosts and tutors can view attendance for their own courses');
    }

    // Get all participants with their session data
    const participants = await this.participantModel
      .find({ meetingId })
      .populate('userId', 'email displayName firstName lastName')
      .sort({ createdAt: 1 })
      .lean();

    // Calculate attendance data
    const attendanceData = participants.map(participant => {
      const sessions = participant.sessions || [];
      const totalDuration = sessions.reduce((total, session) => {
        const sessionDuration = session.leftAt 
          ? new Date(session.leftAt).getTime() - new Date(session.joinedAt).getTime()
          : Date.now() - new Date(session.joinedAt).getTime();
        return total + Math.floor(sessionDuration / 1000);
      }, 0);

      const userData = participant.userId && typeof participant.userId === 'object' ? {
        _id: (participant.userId as any)._id,
        email: (participant.userId as any).email,
        displayName: (participant.userId as any).displayName,
        firstName: (participant.userId as any).firstName,
        lastName: (participant.userId as any).lastName,
      } : null;

      return {
        _id: participant._id,
        user: userData,
        role: participant.role,
        status: participant.status,
        joinedAt: sessions.length > 0 ? sessions[0].joinedAt : participant.createdAt,
        leftAt: sessions.length > 0 && sessions[sessions.length - 1].leftAt ? sessions[sessions.length - 1].leftAt : null,
        totalDuration,
        sessionCount: sessions.length,
        isCurrentlyOnline: sessions.length > 0 && !sessions[sessions.length - 1].leftAt,
        sessions: sessions.map((session, index) => ({
          sessionId: session.joinedAt.getTime().toString() + '_' + index,
          joinedAt: session.joinedAt,
          leftAt: session.leftAt,
          duration: session.leftAt 
            ? Math.floor((new Date(session.leftAt).getTime() - new Date(session.joinedAt).getTime()) / 1000)
            : Math.floor((Date.now() - new Date(session.joinedAt).getTime()) / 1000)
        }))
      };
    });

    return {
      meetingId,
      totalParticipants: participants.length,
      currentlyOnline: participants.filter(p => {
        const sessions = p.sessions || [];
        return sessions.length > 0 && !sessions[sessions.length - 1].leftAt;
      }).length,
      attendance: attendanceData
    };
  }
}