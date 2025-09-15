import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { Participant, ParticipantDocument } from '../../schemas/Participant.model';
import { 
  CreateMeetingInput, 
  UpdateMeetingInput, 
  JoinMeetingByCodeInput, 
  RotateInviteCodeInput,
  StartMeetingInput,
  EndMeetingInput,
  MeetingQueryInput
} from '../../libs/DTO/meeting/meeting.input';
import { MeetingStatus } from '../../libs/enums/enums';
import * as crypto from 'crypto';

@Injectable()
export class MeetingService {
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Participant.name) private participantModel: Model<ParticipantDocument>,
  ) {}

  async createMeeting(createInput: CreateMeetingInput, hostId: string) {
    const { title, notes, isPrivate, scheduledStartAt, durationMin } = createInput;

    // Generate unique invite code
    const inviteCode = this.generateInviteCode();

    // Create new meeting
    const newMeeting = new this.meetingModel({
      title,
      notes,
      isPrivate: isPrivate || false,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : undefined,
      durationMin,
      hostId: new Types.ObjectId(hostId),
      inviteCode,
      status: MeetingStatus.SCHEDULED,
      participantCount: 0,
    });

    const savedMeeting = await newMeeting.save();
    return savedMeeting;
  }

  async updateMeeting(updateInput: UpdateMeetingInput, hostId: string) {
    const { meetingId, title, notes, isPrivate, scheduledStartAt, durationMin } = updateInput;

    // Find the meeting
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host
    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can update the meeting');
    }

    // Don't allow updates to meetings that have ended
    if (meeting.status === MeetingStatus.ENDED) {
      throw new BadRequestException('Cannot update completed meetings');
    }

    // Update allowed fields
    if (title) meeting.title = title;
    if (notes !== undefined) meeting.notes = notes;
    if (isPrivate !== undefined) meeting.isPrivate = isPrivate;
    if (scheduledStartAt) meeting.scheduledStartAt = new Date(scheduledStartAt);
    if (durationMin) meeting.durationMin = durationMin;

    await meeting.save();
    return meeting;
  }

  async deleteMeeting(meetingId: string, hostId: string) {
    // Find the meeting
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host
    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can delete the meeting');
    }

    // Don't allow deletion of active meetings
    if (meeting.status === MeetingStatus.LIVE) {
      throw new BadRequestException('Cannot delete active meetings. End the meeting first.');
    }

    // Delete all participants first
    await this.participantModel.deleteMany({ meetingId });

    // Delete the meeting
    await this.meetingModel.findByIdAndDelete(meetingId);

    return { message: 'Meeting deleted successfully' };
  }

  async getMeetingById(meetingId: string, userId: string): Promise<any> {
    // Find the meeting with host information
    const meeting = await this.meetingModel
      .findById(meetingId)
      .populate('hostId', 'email displayName avatarUrl organization department')
      .lean();

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host or has access
    const isHost = meeting.hostId._id.toString() === userId;
    const isParticipant = await this.participantModel.findOne({
      meetingId,
      userId: new Types.ObjectId(userId),
    });

    if (!isHost && !isParticipant) {
      throw new ForbiddenException('You can only view meetings you host or participate in');
    }

    // Handle populated user data
    const hostData = meeting.hostId && typeof meeting.hostId === 'object' ? {
      _id: (meeting.hostId as any)._id,
      email: (meeting.hostId as any).email,
      displayName: (meeting.hostId as any).displayName,
      avatarUrl: (meeting.hostId as any).avatarUrl,
      organization: (meeting.hostId as any).organization,
      department: (meeting.hostId as any).department,
    } : null;

    return {
      ...meeting,
      host: hostData,
    };
  }

  async getMeetingsByHost(hostId: string, queryInput: MeetingQueryInput): Promise<any> {
    const { status, limit = 20, offset = 0 } = queryInput;

    const filter: any = { hostId: new Types.ObjectId(hostId) };
    if (status) {
      filter.status = status;
    }

    const meetings = await this.meetingModel
      .find(filter)
      .populate('hostId', 'email displayName avatarUrl organization department')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    const total = await this.meetingModel.countDocuments(filter);

    const meetingsWithHost = meetings.map(meeting => {
      const hostData = meeting.hostId && typeof meeting.hostId === 'object' ? {
        _id: (meeting.hostId as any)._id,
        email: (meeting.hostId as any).email,
        displayName: (meeting.hostId as any).displayName,
        avatarUrl: (meeting.hostId as any).avatarUrl,
        organization: (meeting.hostId as any).organization,
        department: (meeting.hostId as any).department,
      } : null;

      return {
        ...meeting,
        host: hostData,
      };
    });

    return {
      meetings: meetingsWithHost,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getAllMeetings(queryInput: MeetingQueryInput): Promise<any> {
    const { status, limit = 20, offset = 0 } = queryInput;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const meetings = await this.meetingModel
      .find(filter)
      .populate('hostId', 'email displayName avatarUrl organization department')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    const total = await this.meetingModel.countDocuments(filter);

    const meetingsWithHost = meetings.map(meeting => {
      const hostData = meeting.hostId && typeof meeting.hostId === 'object' ? {
        _id: (meeting.hostId as any)._id,
        email: (meeting.hostId as any).email,
        displayName: (meeting.hostId as any).displayName,
        avatarUrl: (meeting.hostId as any).avatarUrl,
        organization: (meeting.hostId as any).organization,
        department: (meeting.hostId as any).department,
      } : null;

      return {
        ...meeting,
        host: hostData,
      };
    });

    return {
      meetings: meetingsWithHost,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async rotateInviteCode(rotateInput: RotateInviteCodeInput, hostId: string) {
    const { meetingId } = rotateInput;

    // Find the meeting
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host
    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can rotate the invite code');
    }

    // Generate new invite code
    const newInviteCode = this.generateInviteCode();
    meeting.inviteCode = newInviteCode;
    await meeting.save();

    return {
      inviteCode: newInviteCode,
      message: 'Invite code rotated successfully',
    };
  }

  async joinMeetingByCode(joinInput: JoinMeetingByCodeInput, userId?: string) {
    const { inviteCode, displayName } = joinInput;

    // Find the meeting by invite code
    const meeting = await this.meetingModel.findOne({ inviteCode });
    if (!meeting) {
      throw new NotFoundException('Invalid invite code');
    }

    // Check if meeting is active or scheduled
    if (meeting.status === MeetingStatus.ENDED) {
      throw new BadRequestException('This meeting has already ended');
    }

    // Check if user is already a participant
    const existingParticipant = await this.participantModel.findOne({
      meetingId: meeting._id,
      userId: userId ? new Types.ObjectId(userId) : null,
    });

    if (existingParticipant) {
      return {
        meetingId: meeting._id.toString(),
        title: meeting.title,
        status: meeting.status,
        inviteCode: meeting.inviteCode,
        message: 'You are already a participant in this meeting',
      };
    }

    // Create new participant
    const newParticipant = new this.participantModel({
      meetingId: meeting._id,
      userId: userId ? new Types.ObjectId(userId) : null,
      displayName,
      role: 'PARTICIPANT',
      micState: 'OFF',
      cameraState: 'OFF',
      sessions: [{
        joinedAt: new Date(),
        leftAt: undefined,
        durationSec: 0,
      }],
      totalDurationSec: 0,
    });

    await newParticipant.save();

    // Update participant count
    await this.meetingModel.findByIdAndUpdate(meeting._id, {
      $inc: { participantCount: 1 }
    });

    return {
      meetingId: meeting._id.toString(),
      title: meeting.title,
      status: meeting.status,
      inviteCode: meeting.inviteCode,
      message: 'Successfully joined the meeting',
    };
  }

  async startMeeting(startInput: StartMeetingInput, hostId: string) {
    const { meetingId } = startInput;

    // Find the meeting
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host
    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can start the meeting');
    }

    // Check if meeting can be started
    if (meeting.status === MeetingStatus.LIVE) {
      throw new BadRequestException('Meeting is already active');
    }

    if (meeting.status === MeetingStatus.ENDED) {
      throw new BadRequestException('Cannot start a completed meeting');
    }

    // Start the meeting
    meeting.status = MeetingStatus.LIVE;
    meeting.actualStartAt = new Date();
    await meeting.save();

    return meeting;
  }

  async endMeeting(endInput: EndMeetingInput, hostId: string) {
    const { meetingId } = endInput;

    // Find the meeting
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Verify the user is the host
    if (meeting.hostId.toString() !== hostId) {
      throw new ForbiddenException('Only the meeting host can end the meeting');
    }

    // Check if meeting can be ended
    if (meeting.status === MeetingStatus.ENDED) {
      throw new BadRequestException('Meeting is already ended');
    }

    // End the meeting
    meeting.status = MeetingStatus.ENDED;
    meeting.endedAt = new Date();
    
    // Calculate duration if meeting was started
    if (meeting.actualStartAt) {
      const durationMs = meeting.endedAt.getTime() - meeting.actualStartAt.getTime();
      meeting.durationMin = Math.round(durationMs / (1000 * 60));
    }

    await meeting.save();

    return meeting;
  }

  async getMeetingStats(hostId?: string) {
    const filter = hostId ? { hostId: new Types.ObjectId(hostId) } : {};

    const [
      totalMeetings,
      activeMeetings,
      scheduledMeetings,
      completedMeetings,
      totalParticipants,
      averageDuration
    ] = await Promise.all([
      this.meetingModel.countDocuments(filter),
      this.meetingModel.countDocuments({ ...filter, status: MeetingStatus.LIVE }),
      this.meetingModel.countDocuments({ ...filter, status: MeetingStatus.SCHEDULED }),
      this.meetingModel.countDocuments({ ...filter, status: MeetingStatus.ENDED }),
      this.participantModel.countDocuments(),
      this.meetingModel.aggregate([
        { $match: { ...filter, status: MeetingStatus.ENDED, durationMin: { $exists: true } } },
        { $group: { _id: null, avgDuration: { $avg: '$durationMin' } } }
      ])
    ]);

    return {
      totalMeetings,
      activeMeetings,
      scheduledMeetings,
      completedMeetings,
      totalParticipants,
      averageMeetingDuration: averageDuration.length > 0 ? Math.round(averageDuration[0].avgDuration) : 0,
    };
  }

  private generateInviteCode(): string {
    // Generate a 8-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
