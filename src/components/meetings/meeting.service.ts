import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { CreateMeetingInput, UpdateMeetingInput, JoinMeetingInput, MeetingQueryInput } from '../../libs/DTO/meeting/meeting.input';
import { SystemRole, MeetingStatus } from '../../libs/enums/enums';
import { Logger } from '@nestjs/common';

@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  // CREATE MEETING
  async createMeeting(createInput: CreateMeetingInput, userId: string) {
    this.logger.log(`[CREATE_MEETING] Attempt - User ID: ${userId}, Title: ${createInput.title}`);
    
    try {
      const { title, notes, isPrivate, scheduledFor, duration, maxParticipants } = createInput;

      // Validate and parse scheduledFor date
      let parsedScheduledFor: Date | undefined;
      if (scheduledFor) {
        try {
          const date = new Date(scheduledFor);
          if (isNaN(date.getTime())) {
            this.logger.warn(`[CREATE_MEETING] Invalid date format: ${scheduledFor}, ignoring`);
            parsedScheduledFor = undefined;
          } else {
            parsedScheduledFor = date;
          }
        } catch (error) {
          this.logger.warn(`[CREATE_MEETING] Date parsing error: ${error.message}, ignoring scheduledFor`);
          parsedScheduledFor = undefined;
        }
      }

      // Generate unique invite code
      const inviteCode = await this.generateUniqueInviteCode();

      // Create new meeting
      const newMeeting = new this.meetingModel({
        title,
        notes,
        isPrivate: isPrivate || false,
        scheduledFor: parsedScheduledFor,
        durationMin: duration,
        maxParticipants: maxParticipants ?? 100,
        hostId: new Types.ObjectId(userId),
        inviteCode,
        status: parsedScheduledFor ? MeetingStatus.SCHEDULED : MeetingStatus.CREATED,
        participantCount: 0,
      });

      const savedMeeting = await newMeeting.save();
      await savedMeeting.populate('hostId', 'email displayName systemRole');

      this.logger.log(`[CREATE_MEETING] Success - Meeting ID: ${savedMeeting._id}, Invite Code: ${inviteCode}`);
      
      return {
        _id: savedMeeting._id,
        title: savedMeeting.title,
        inviteCode: savedMeeting.inviteCode,
        status: savedMeeting.status,
        isPrivate: savedMeeting.isPrivate,
        scheduledFor: savedMeeting.scheduledFor,
        durationMin: savedMeeting.durationMin,
        duration: savedMeeting.durationMin,
        maxParticipants: savedMeeting.maxParticipants || 100,
        participantCount: savedMeeting.participantCount,
        host: savedMeeting.hostId,
        createdAt: savedMeeting.createdAt,
      };
    } catch (error) {
      this.logger.error(`[CREATE_MEETING] Failed - User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // GET MEETINGS
  async getMeetings(queryInput: MeetingQueryInput, userId: string) {
    this.logger.log(`[GET_MEETINGS] Attempt - User ID: ${userId}, Page: ${queryInput.page}, Limit: ${queryInput.limit}`);
    
    try {
      const { page = 1, limit = 10, status, search, hostId } = queryInput;
      const skip = (page - 1) * limit;

      // Build filter
      const filter: any = {};
      
      if (status) {
        filter.status = status;
      }
      
      if (hostId) {
        filter.hostId = new Types.ObjectId(hostId);
      } else {
        // All users (MEMBER, TUTOR, ADMIN) can see all meetings
        // No additional filtering needed - show all meetings
        this.logger.log(`[GET_MEETINGS] Showing all meetings for user role: ${userId}`);
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } },
        ];
      }

      // Get meetings with pagination
      const meetings = await this.meetingModel
        .find(filter)
        .populate('hostId', 'email displayName systemRole avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Get total count
      const total = await this.meetingModel.countDocuments(filter);

      // Map meetings to ensure proper host data structure
      const mappedMeetings = meetings.map(meeting => {
        const meetingObj = meeting.toObject();
        this.logger.debug(`[GET_MEETINGS] Meeting ${meetingObj._id} hostId:`, meetingObj.hostId);
        
        // Check if hostId is populated (has email property) or just an ObjectId
        const hostData = meetingObj.hostId && typeof meetingObj.hostId === 'object' && 'email' in meetingObj.hostId ? {
          _id: meetingObj.hostId._id,
          email: meetingObj.hostId.email,
          displayName: (meetingObj.hostId as any).displayName,
          systemRole: (meetingObj.hostId as any).systemRole,
          avatarUrl: (meetingObj.hostId as any).avatarUrl,
        } : null;
        
        return {
          ...meetingObj,
          host: hostData,
        };
      });

      this.logger.log(`[GET_MEETINGS] Success - Found ${meetings.length} meetings, Total: ${total}`);
      
      return {
        meetings: mappedMeetings,
        total,
        page,
        limit,
        offset: skip,
        hasMore: skip + meetings.length < total,
      };
    } catch (error) {
      this.logger.error(`[GET_MEETINGS] Failed - User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // GET MEETING BY ID
  async getMeetingById(meetingId: string, userId: string) {
    this.logger.log(`[GET_MEETING_BY_ID] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`);
    
    try {
      const meeting = await this.meetingModel
        .findById(meetingId)
        .populate('hostId', 'email displayName systemRole avatarUrl')
        .lean();

      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check access permissions
      const user = await this.memberModel.findById(userId);
      if (user.systemRole !== SystemRole.ADMIN && meeting.hostId._id.toString() !== userId) {
        throw new ForbiddenException('You can only view your own meetings');
      }

      this.logger.log(`[GET_MEETING_BY_ID] Success - Meeting ID: ${meetingId}`);
      
      return meeting;
    } catch (error) {
      this.logger.error(`[GET_MEETING_BY_ID] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // JOIN MEETING BY CODE
  async joinMeetingByCode(joinInput: JoinMeetingInput, userId: string) {
    this.logger.log(`[JOIN_MEETING_BY_CODE] Attempt - Invite Code: ${joinInput.inviteCode}, User ID: ${userId}`);
    
    try {
      const { inviteCode, passcode } = joinInput;

      // Find meeting by invite code
      const meeting = await this.meetingModel
        .findOne({ inviteCode })
        .populate('hostId', 'email displayName systemRole')
        .lean();

      if (!meeting) {
        throw new NotFoundException('Meeting not found with this invite code');
      }

      // Check if meeting is active
      if (meeting.status === MeetingStatus.ENDED) {
        throw new BadRequestException('This meeting has ended');
      }

      // Check passcode if meeting is private
      if (meeting.isPrivate && meeting.passcodeHash) {
        // Note: In a real app, you'd verify the passcode hash
        if (passcode !== 'default_passcode') { // Simplified for now
          throw new ForbiddenException('Invalid passcode');
        }
      }

      // Get user info
      const user = await this.memberModel.findById(userId).lean();

      this.logger.log(`[JOIN_MEETING_BY_CODE] Success - Meeting ID: ${meeting._id}, User: ${user.email}`);
      
      return {
        meeting: {
          _id: meeting._id,
          title: meeting.title,
          status: meeting.status,
          isPrivate: meeting.isPrivate,
          participantCount: meeting.participantCount,
          host: meeting.hostId,
        },
        user: {
          _id: user._id,
          email: user.email,
          displayName: user.displayName,
          systemRole: user.systemRole,
        },
        message: 'Successfully joined meeting',
      };
    } catch (error) {
      this.logger.error(`[JOIN_MEETING_BY_CODE] Failed - Invite Code: ${joinInput.inviteCode}, User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // UPDATE MEETING
  async updateMeeting(meetingId: string, updateInput: UpdateMeetingInput, userId: string) {
    this.logger.log(`[UPDATE_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`);
    
    try {
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (user.systemRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
        throw new ForbiddenException('You can only update your own meetings');
      }

      // Update allowed fields
      if (updateInput.title) meeting.title = updateInput.title;
      if (updateInput.notes !== undefined) meeting.notes = updateInput.notes;
      if (updateInput.isPrivate !== undefined) meeting.isPrivate = updateInput.isPrivate;
      if (updateInput.scheduledFor) meeting.scheduledFor = new Date(updateInput.scheduledFor);
      if (updateInput.durationMin) meeting.durationMin = updateInput.durationMin;

      await meeting.save();
      await meeting.populate('hostId', 'email displayName systemRole avatarUrl');

      this.logger.log(`[UPDATE_MEETING] Success - Meeting ID: ${meetingId}`);
      
      return {
        _id: meeting._id,
        title: meeting.title,
        notes: meeting.notes,
        isPrivate: meeting.isPrivate,
        scheduledFor: meeting.scheduledFor,
        durationMin: meeting.durationMin,
        status: meeting.status,
        inviteCode: meeting.inviteCode,
        participantCount: meeting.participantCount,
        host: meeting.hostId,
        updatedAt: meeting.updatedAt,
      };
    } catch (error) {
      this.logger.error(`[UPDATE_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // START MEETING
  async startMeeting(meetingId: string, userId: string) {
    this.logger.log(`[START_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`);
    
    try {
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (user.systemRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
        throw new ForbiddenException('Only the meeting host can start the meeting');
      }

      // Update meeting status
      meeting.status = MeetingStatus.LIVE;
      meeting.actualStartAt = new Date();
      await meeting.save();

      this.logger.log(`[START_MEETING] Success - Meeting ID: ${meetingId}`);
      
      return {
        _id: meeting._id,
        status: meeting.status,
        actualStartAt: meeting.actualStartAt,
        message: 'Meeting started successfully',
      };
    } catch (error) {
      this.logger.error(`[START_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // END MEETING
  async endMeeting(meetingId: string, userId: string) {
    this.logger.log(`[END_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`);
    
    try {
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (user.systemRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
        throw new ForbiddenException('Only the meeting host can end the meeting');
      }

      // Update meeting status
      meeting.status = MeetingStatus.ENDED;
      meeting.endedAt = new Date();
      
      // Calculate duration if meeting was started
      if (meeting.actualStartAt) {
        const durationMs = meeting.endedAt.getTime() - meeting.actualStartAt.getTime();
        meeting.durationMin = Math.round(durationMs / (1000 * 60));
      }

      await meeting.save();

      this.logger.log(`[END_MEETING] Success - Meeting ID: ${meetingId}, Duration: ${meeting.durationMin} minutes`);
      
      return {
        _id: meeting._id,
        status: meeting.status,
        endedAt: meeting.endedAt,
        durationMin: meeting.durationMin,
        message: 'Meeting ended successfully',
      };
    } catch (error) {
      this.logger.error(`[END_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // DELETE MEETING
  async deleteMeeting(meetingId: string, userId: string) {
    this.logger.log(`[DELETE_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`);
    
    try {
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (user.systemRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
        throw new ForbiddenException('You can only delete your own meetings');
      }

      await this.meetingModel.findByIdAndDelete(meetingId);

      this.logger.log(`[DELETE_MEETING] Success - Meeting ID: ${meetingId}`);
      
      return {
        success: true,
        message: 'Meeting deleted successfully',
      };
    } catch (error) {
      this.logger.error(`[DELETE_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // ROTATE INVITE CODE
  async rotateInviteCode(meetingId: string, userId: string) {
    this.logger.log(`[ROTATE_INVITE_CODE] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`);
    
    try {
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (user.systemRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
        throw new ForbiddenException('Only the meeting host can rotate the invite code');
      }

      // Generate new unique invite code
      const newInviteCode = await this.generateUniqueInviteCode();
      meeting.inviteCode = newInviteCode;
      await meeting.save();

      this.logger.log(`[ROTATE_INVITE_CODE] Success - Meeting ID: ${meetingId}, New Code: ${newInviteCode}`);
      
      return {
        _id: meeting._id,
        inviteCode: newInviteCode,
        message: 'Invite code rotated successfully',
      };
    } catch (error) {
      this.logger.error(`[ROTATE_INVITE_CODE] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // GET MEETING STATS
  async getMeetingStats(userId: string) {
    this.logger.log(`[GET_MEETING_STATS] Attempt - User ID: ${userId}`);
    
    try {
      const user = await this.memberModel.findById(userId);
      const filter = user.systemRole === SystemRole.ADMIN ? {} : { hostId: new Types.ObjectId(userId) };

      const stats = await this.meetingModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalMeetings: { $sum: 1 },
            liveMeetings: { $sum: { $cond: [{ $eq: ['$status', MeetingStatus.LIVE] }, 1, 0] } },
            scheduledMeetings: { $sum: { $cond: [{ $eq: ['$status', MeetingStatus.SCHEDULED] }, 1, 0] } },
            endedMeetings: { $sum: { $cond: [{ $eq: ['$status', MeetingStatus.ENDED] }, 1, 0] } },
            totalParticipants: { $sum: '$participantCount' },
            averageDuration: { $avg: '$durationMin' },
          },
        },
      ]);

      const result = stats[0] || {
        totalMeetings: 0,
        liveMeetings: 0,
        scheduledMeetings: 0,
        endedMeetings: 0,
        totalParticipants: 0,
        averageDuration: 0,
      };

      this.logger.log(`[GET_MEETING_STATS] Success - Total Meetings: ${result.totalMeetings}`);
      
      return result;
    } catch (error) {
      this.logger.error(`[GET_MEETING_STATS] Failed - User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // PRIVATE HELPER: Generate unique invite code
  private async generateUniqueInviteCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    let isUnique = false;

    while (!isUnique) {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await this.meetingModel.findOne({ inviteCode: code });
      if (!existing) {
        isUnique = true;
      }
    }

    return code!;
  }
}
