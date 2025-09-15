import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Participant, ParticipantDocument } from '../../schemas/Participant.model';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { CreateParticipantInput, UpdateParticipantInput, JoinMeetingInput, LeaveMeetingInput, UpdateSessionInput } from '../../libs/DTO/participant/participant.mutation';
import { Role, MediaState } from '../../libs/enums/enums';

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
}