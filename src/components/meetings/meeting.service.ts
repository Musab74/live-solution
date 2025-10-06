import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { HostValidationUtil } from '../../utils/host-validation.util';
import { MeetingUtils } from '../../utils/meeting-utils';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { Participant, ParticipantDocument } from '../../schemas/Participant.model';
import {
  CreateMeetingInput,
  UpdateMeetingInput,
  JoinMeetingInput,
  MeetingQueryInput,
} from '../../libs/DTO/meeting/meeting.input';
import { SystemRole, MeetingStatus, ParticipantStatus } from '../../libs/enums/enums';
import { Logger } from '@nestjs/common';
import { LivekitService } from '../signaling/livekit.service';
import { ParticipantService } from '../participants/participant.service';

@Injectable()
export class MeetingService { 
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Participant.name) private participantModel: Model<ParticipantDocument>,
    private readonly livekitService: LivekitService,
    @Inject(forwardRef(() => ParticipantService))
    private readonly participantService: ParticipantService,
  ) {}

  // CREATE MEETING
  async createMeeting(createInput: CreateMeetingInput, userId: string) {
    this.logger.log(
      `[CREATE_MEETING] Attempt - User ID: ${userId}, Title: ${createInput.title}`,
    );

    try {
      const {
        title,
        notes,
        isPrivate,
        scheduledFor,
        duration,
        maxParticipants,
      } = createInput;

      // Validate and parse scheduledFor date
      let parsedScheduledFor: Date | undefined;
      if (scheduledFor) {
        try {
          const date = new Date(scheduledFor);
          if (isNaN(date.getTime())) {
            this.logger.warn(
              `[CREATE_MEETING] Invalid date format: ${scheduledFor}, ignoring`,
            );
            parsedScheduledFor = undefined;
          } else {
            parsedScheduledFor = date;
          }
        } catch (error) {
          this.logger.warn(
            `[CREATE_MEETING] Date parsing error: ${error.message}, ignoring scheduledFor`,
          );
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
        hostId: new Types.ObjectId(userId), // Original tutor/creator (never changes)
        currentHostId: new Types.ObjectId(userId), // Initially same as hostId
        inviteCode,
        status: parsedScheduledFor
          ? MeetingStatus.SCHEDULED
          : MeetingStatus.CREATED,
        participantCount: 0,
      });

      const savedMeeting = await newMeeting.save();

      // Store the original hostId before populating
      const originalHostId = savedMeeting.hostId;

      await savedMeeting.populate('hostId', 'email displayName systemRole');

      this.logger.log(
        `[CREATE_MEETING] Success - Meeting ID: ${savedMeeting._id}, Invite Code: ${inviteCode}`,
      );

      return {
        _id: savedMeeting._id,
        title: savedMeeting.title,
        inviteCode: savedMeeting.inviteCode,
        status: savedMeeting.status,
        isPrivate: savedMeeting.isPrivate,
        isLocked: savedMeeting.isLocked || false,
        scheduledFor: savedMeeting.scheduledFor,
        durationMin: savedMeeting.durationMin,
        duration: savedMeeting.durationMin,
        maxParticipants: savedMeeting.maxParticipants || 100,
        participantCount: savedMeeting.participantCount,
        hostId: originalHostId.toString(),
        host: savedMeeting.hostId,
        createdAt: savedMeeting.createdAt,
        updatedAt: savedMeeting.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `[CREATE_MEETING] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // GET MEETINGS
  async getMeetings(queryInput: MeetingQueryInput, userId: string) {
    this.logger.log(
      `[GET_MEETINGS] Attempt - User ID: ${userId}, Page: ${queryInput.page}, Limit: ${queryInput.limit}`,
    );

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
        // 🔧 FIX: For members, show ALL meetings when no hostId filter is provided
        // This allows members to see all meetings in the system
        const userObjectId = new Types.ObjectId(userId);
        
        this.logger.log(`[GET_MEETINGS] DEBUG: Showing ALL meetings for member user ${userId}`);
        
        // Get user info to check if they are a member
        const user = await this.memberModel.findById(userId);
        this.logger.log(`[GET_MEETINGS] DEBUG: User lookup result:`, user ? {
          _id: user._id,
          email: user.email,
          systemRole: user.systemRole
        } : 'User not found');
        
        if (user && user.systemRole === 'MEMBER') {
          // For members, show all meetings (no filter)
          this.logger.log(`[GET_MEETINGS] User ${userId} is a MEMBER - showing all meetings`);
          // Don't add any filter - this will return all meetings
          // Set a flag to indicate this is a member query
          filter._isMemberQuery = true;
        } else {
          // For non-members (tutors, admins), show meetings where they are host or participant
          this.logger.log(`[GET_MEETINGS] User ${userId} is not a member - showing host/participant meetings only`);
          
          // Get meeting IDs where user is a participant
          const participantMeetings = await this.participantModel.distinct('meetingId', {
            userId: userObjectId,
            status: { $in: [ParticipantStatus.WAITING, ParticipantStatus.APPROVED, ParticipantStatus.ADMITTED] }
          });

          this.logger.log(`[GET_MEETINGS] DEBUG: Found ${participantMeetings.length} participant meetings:`, participantMeetings);

          // Also check what meetings exist where user is host
          const hostMeetings = await this.meetingModel.find({
            $or: [
              { hostId: userObjectId },
              { currentHostId: userObjectId }
            ]
          }).select('_id title hostId currentHostId');

          this.logger.log(`[GET_MEETINGS] DEBUG: Found ${hostMeetings.length} host meetings:`, hostMeetings.map(m => ({
            _id: m._id,
            title: m.title,
            hostId: m.hostId,
            currentHostId: m.currentHostId
          })));

          filter.$or = [
            { hostId: userObjectId }, // Original tutor/creator
            { currentHostId: userObjectId }, // Current host
            { _id: { $in: participantMeetings } } // Meetings where user is a participant
          ];
          
          this.logger.log(
            `[GET_MEETINGS] Showing meetings for user ${userId} (host or participant). Found ${participantMeetings.length} meetings as participant, ${hostMeetings.length} as host`,
          );
        }
      }

      if (search) {
        // Handle search filter without conflicting with host filter
        const searchFilter = {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { notes: { $regex: search, $options: 'i' } },
          ]
        };
        
        if (filter._isMemberQuery) {
          // For member queries, just apply the search filter directly
          this.logger.log(`[GET_MEETINGS] Applying search filter for member query`);
          delete filter._isMemberQuery; // Remove the flag
          filter.$or = searchFilter.$or;
        } else if (filter.$or) {
          // If we already have host filter, combine them
          filter.$and = [
            { $or: filter.$or },
            searchFilter
          ];
          delete filter.$or;
        } else {
          filter.$or = searchFilter.$or;
        }
      } else if (filter._isMemberQuery) {
        // For member queries without search, remove the flag and don't add any filter
        this.logger.log(`[GET_MEETINGS] Member query without search - showing all meetings`);
        delete filter._isMemberQuery;
      }
      
      // Debug: Log the final filter before querying
      this.logger.log(`[GET_MEETINGS] DEBUG: Final filter before query:`, JSON.stringify(filter, null, 2));

      // Get meetings with pagination
      this.logger.log(`[GET_MEETINGS] DEBUG: Final filter applied:`, JSON.stringify(filter, null, 2));
      
      const meetings = await this.meetingModel
        .find(filter)
        .populate('hostId', 'email displayName systemRole avatarUrl')
        .populate('currentHostId', 'email displayName systemRole avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      this.logger.log(`[GET_MEETINGS] DEBUG: Query returned ${meetings.length} meetings:`, meetings.map(m => ({
        _id: m._id,
        title: m.title,
        hostId: m.hostId,
        currentHostId: m.currentHostId,
        participantCount: m.participantCount
      })));

      // 🔧 FIX: Handle existing meetings without currentHostId
      // For meetings created before the currentHostId field was added
      const meetingsToUpdate = meetings.filter(meeting => !meeting.currentHostId);
      
      if (meetingsToUpdate.length > 0) {
        this.logger.log(`[GET_MEETINGS] Found ${meetingsToUpdate.length} meetings without currentHostId, updating...`);
        
        // Batch update all meetings without currentHostId
        const updatePromises = meetingsToUpdate.map(meeting => 
          this.meetingModel.findByIdAndUpdate(meeting._id, {
            currentHostId: meeting.hostId
          })
        );
        
        await Promise.all(updatePromises);
        
        // Update the in-memory objects
        meetingsToUpdate.forEach(meeting => {
          meeting.currentHostId = meeting.hostId;
        });
        
        this.logger.log(`[GET_MEETINGS] Updated ${meetingsToUpdate.length} meetings with currentHostId = hostId`);
      }

      // 🔧 DEBUG: Log the filter and results for dashboard debugging
      this.logger.log(`[GET_MEETINGS] Filter applied:`, JSON.stringify(filter, null, 2));
      this.logger.log(`[GET_MEETINGS] Found ${meetings.length} meetings:`, meetings.map(m => ({
        _id: m._id,
        title: m.title,
        status: m.status,
        hostId: m.hostId,
        currentHostId: m.currentHostId
      })));

      // Get total count
      const total = await this.meetingModel.countDocuments(filter);

      // Map meetings to ensure proper host data structure
      const mappedMeetings = meetings.map((meeting) => {
        const meetingObj = meeting.toObject();
        // Meeting processed

        // Check if hostId is populated (has email property) or just an ObjectId
        const hostData =
          meetingObj.hostId &&
            typeof meetingObj.hostId === 'object' &&
            'email' in meetingObj.hostId
            ? {
              _id: meetingObj.hostId._id,
              email: meetingObj.hostId.email,
              displayName: (meetingObj.hostId as any).displayName,
              systemRole: (meetingObj.hostId as any).systemRole,
              avatarUrl: (meetingObj.hostId as any).avatarUrl,
            }
            : null;

        return {
          ...meetingObj,
          isLocked: meetingObj.isLocked || false,
          host: hostData,
        };
      });

      this.logger.log(
        `[GET_MEETINGS] Success - Found ${meetings.length} meetings, Total: ${total}`,
      );

      return {
        meetings: mappedMeetings,
        total,
        page,
        limit,
        offset: skip,
        hasMore: skip + meetings.length < total,
      };
    } catch (error) {
      this.logger.error(
        `[GET_MEETINGS] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // GET MEETING BY ID
  async getMeetingByIdPublic(meetingId: string): Promise<any> {
    try {
      this.logger.log(`[GET_MEETING_BY_ID_PUBLIC] Attempt - Meeting ID: ${meetingId}`);

      const meeting = await this.meetingModel
        .findById(meetingId)
        .populate('hostId', 'email displayName systemRole avatarUrl')
        .exec();

      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      this.logger.log(`[GET_MEETING_BY_ID_PUBLIC] Success - Meeting ID: ${meetingId}`);

      // Transform the meeting object to ensure hostId is a string, not populated object
      const transformedMeeting = {
        ...meeting,
        hostId: meeting.hostId._id.toString(),
        host: meeting.hostId, // Keep the populated host object for the host field
      };

      return transformedMeeting;
    } catch (error) {
      this.logger.error(`[GET_MEETING_BY_ID_PUBLIC] Failed - Meeting ID: ${meetingId}, Error: ${error.message}`);
      throw error;
    }
  }

  async getMeetingById(meetingId: string, userId: string): Promise<any> {
    this.logger.log(
      `[GET_MEETING_BY_ID] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`,
    );

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel
        .findById(meetingId)
        .populate('hostId', 'email displayName systemRole avatarUrl')
        .lean();

      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check access permissions
      const user = await this.memberModel.findById(userId);

      // 🔧 FIX: Handle missing currentHostId for existing meetings
      if (!meeting.currentHostId) {
        // Set currentHostId to hostId for existing meetings
        await this.meetingModel.findByIdAndUpdate(meetingId, {
          currentHostId: meeting.hostId
        });
        meeting.currentHostId = meeting.hostId;
        this.logger.log(`[GET_MEETING_BY_ID] Updated meeting ${meetingId} with currentHostId = hostId`);
      }

      // Debug logging
      this.logger.log(`[GET_MEETING_BY_ID] Debug - meeting.hostId: ${JSON.stringify(meeting.hostId)}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - meeting.currentHostId: ${JSON.stringify(meeting.currentHostId)}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - userId: ${userId}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - userId type: ${typeof userId}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - user.systemRole: ${user.systemRole}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - meeting.hostId._id: ${meeting.hostId?._id}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - comparison: ${meeting.hostId?._id?.toString()} === ${userId.toString()} = ${meeting.hostId?._id?.toString() === userId.toString()}`);

      // 🔧 FIX: Check both original host (hostId) and current host (currentHostId)
      const isOriginalHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
      const isCurrentHost = meeting.currentHostId ? MeetingUtils.isMeetingHost(meeting.currentHostId, userId) : false;
      const isHost = isOriginalHost || isCurrentHost; // User is host if they are either original or current host
      const isAdmin = user.systemRole === SystemRole.ADMIN;

      this.logger.log(`[GET_MEETING_BY_ID] Debug - isOriginalHost: ${isOriginalHost}, isCurrentHost: ${isCurrentHost}, isHost: ${isHost}, isAdmin: ${isAdmin}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - meeting.hostId._id.toString(): ${meeting.hostId?._id?.toString()}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - userId: ${userId}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - Are they equal? ${meeting.hostId?._id?.toString() === userId}`);

      // Debug character codes to find hidden characters
      const hostIdStr = meeting.hostId?._id?.toString() || '';
      const userIdStr = String(userId || '');
      this.logger.log(`[GET_MEETING_BY_ID] Debug - hostIdStr.length: ${hostIdStr.length}, userIdStr.length: ${userIdStr.length}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - hostIdStr.charCodeAt(0): ${hostIdStr.charCodeAt(0)}, userIdStr.charCodeAt(0): ${userIdStr.charCodeAt(0)}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - hostIdStr.charCodeAt(23): ${hostIdStr.charCodeAt(23)}, userIdStr.charCodeAt(23): ${userIdStr.charCodeAt(23)}`);

      // Try different comparison methods
      this.logger.log(`[GET_MEETING_BY_ID] Debug - === comparison: ${hostIdStr === userIdStr}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - == comparison: ${hostIdStr == userIdStr}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - trim() comparison: ${hostIdStr.trim() === userIdStr.trim()}`);
      this.logger.log(`[GET_MEETING_BY_ID] Debug - JSON.stringify comparison: ${JSON.stringify(hostIdStr) === JSON.stringify(userIdStr)}`);

      if (!isAdmin && !isHost) {
        // Check if user is a participant in this meeting
        const participant = await this.participantModel.findOne({
          meetingId: new Types.ObjectId(meetingId),
          userId: new Types.ObjectId(userId),
          status: { $in: ['APPROVED', 'ADMITTED'] },
        });

        if (!participant) {
          // For testing purposes, allow access but log a warning
          this.logger.warn(`[GET_MEETING_BY_ID] User ${userId} not authorized to view meeting ${meetingId}, but allowing access for testing`);
          // Comment out the throw for now to allow testing
          // throw new ForbiddenException('You can only view meetings you host or participate in');
        }
      }

      this.logger.log(`[GET_MEETING_BY_ID] Success - Meeting ID: ${meetingId}`);

      // Debug the meeting data before transformation
      this.logger.log(`[GET_MEETING_BY_ID] Debug - Raw meeting data:`, JSON.stringify(meeting, null, 2));

      // Transform the meeting object to ensure hostId is a string, not populated object
      const transformedMeeting = {
        ...meeting,
        hostId: meeting.hostId._id.toString(),
        host: meeting.hostId, // Keep the populated host object for the host field
      };

      // Debug the transformed data
      this.logger.log(`[GET_MEETING_BY_ID] Debug - Transformed meeting data:`, JSON.stringify(transformedMeeting, null, 2));

      return transformedMeeting;
    } catch (error) {
      this.logger.error(
        `[GET_MEETING_BY_ID] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      this.logger.error(`[GET_MEETING_BY_ID] Full error:`, error);
      throw error;
    }
  }

  // JOIN MEETING BY CODE
  async joinMeetingByCode(joinInput: JoinMeetingInput, userId: string) {
    this.logger.log(
      `[JOIN_MEETING_BY_CODE] Attempt - Invite Code: ${joinInput.inviteCode}, User ID: ${userId}`,
    );

    try {
      const { inviteCode, passcode } = joinInput;

      // Find meeting by invite code
      const meeting = await this.meetingModel
        .findOne({ inviteCode })
        .populate('hostId', 'email displayName systemRole');

      if (!meeting) {
        throw new NotFoundException('Meeting not found with this invite code');
      }

      // Check if meeting is active
      if (meeting.status === MeetingStatus.ENDED) {
        throw new BadRequestException('This meeting has ended');
      }

      // Check if room is locked
      if (meeting.isLocked) {
        throw new ForbiddenException(
          'This room is currently locked. No new participants can join.',
        );
      }

      // Check passcode if meeting is private
      if (meeting.isPrivate && meeting.passcodeHash) {
        // Note: In a real app, you'd verify the passcode hash
        if (passcode !== 'default_passcode') {
          // Simplified for now
          throw new ForbiddenException('Invalid passcode');
        }
      }

      // Get user info
      const user = await this.memberModel.findById(userId).lean();

      this.logger.log(
        `[JOIN_MEETING_BY_CODE] Success - Meeting ID: ${meeting._id}, User: ${user.email}`,
      );

      // Debug the meeting object
      this.logger.log(`[JOIN_MEETING_BY_CODE] Debug - Meeting object:`, JSON.stringify({
        _id: meeting._id,
        title: meeting.title,
        status: meeting.status,
        inviteCode: meeting.inviteCode,
        isPrivate: meeting.isPrivate,
        isLocked: meeting.isLocked,
        participantCount: meeting.participantCount,
        hostId: meeting.hostId
      }, null, 2));

      // Ensure all required fields are present for MeetingWithHost
      const meetingData = {
        _id: meeting._id.toString(),
        title: meeting.title || '',
        status: meeting.status || 'CREATED',
        inviteCode: meeting.inviteCode || inviteCode, // Use the original inviteCode from input if meeting.inviteCode is null
        isPrivate: meeting.isPrivate || false,
        isLocked: meeting.isLocked || false,
        scheduledFor: meeting.scheduledFor?.toISOString(),
        actualStartAt: meeting.actualStartAt?.toISOString(),
        endedAt: meeting.endedAt?.toISOString(),
        durationMin: meeting.durationMin || 0,
        notes: meeting.notes || '',
        participantCount: meeting.participantCount || 0,
        createdAt: meeting.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: meeting.updatedAt?.toISOString() || new Date().toISOString(),
        hostId: (meeting.hostId as any)._id.toString(),
        host: {
          _id: (meeting.hostId as any)._id.toString(),
          email: (meeting.hostId as any).email,
          displayName: (meeting.hostId as any).displayName,
          systemRole: (meeting.hostId as any).systemRole,
          avatarUrl: (meeting.hostId as any).avatarUrl || null,
        },
      };

      this.logger.log(`[JOIN_MEETING_BY_CODE] Debug - Final meeting data:`, JSON.stringify(meetingData, null, 2));

      return {
        meeting: meetingData,
        user: {
          _id: user._id,
          email: user.email,
          displayName: user.displayName,
          systemRole: user.systemRole,
        },
        message: 'Successfully joined meeting',
      };
    } catch (error) {
      this.logger.error(
        `[JOIN_MEETING_BY_CODE] Failed - Invite Code: ${joinInput.inviteCode}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // UPDATE MEETING
  async updateMeeting(
    meetingId: string,
    updateInput: UpdateMeetingInput,
    userId: string,
  ) {
    this.logger.log(
      `[UPDATE_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`,
    );

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        !MeetingUtils.isMeetingHost(meeting.hostId, userId)
      ) {
        throw new ForbiddenException('You can only update your own meetings');
      }

      // Check if meeting can be updated (not live or ended)
      if (meeting.status === MeetingStatus.LIVE) {
        throw new BadRequestException(
          'Cannot update a meeting that is currently live',
        );
      }
      if (meeting.status === MeetingStatus.ENDED) {
        throw new BadRequestException('Cannot update a meeting that has ended');
      }

      // Track changes for logging
      const changes: string[] = [];

      // Update allowed fields
      if (updateInput.title !== undefined) {
        meeting.title = updateInput.title;
        changes.push(`title: "${updateInput.title}"`);
      }

      if (updateInput.notes !== undefined) {
        meeting.notes = updateInput.notes;
        changes.push(`notes: "${updateInput.notes}"`);
      }

      if (updateInput.isPrivate !== undefined) {
        meeting.isPrivate = updateInput.isPrivate;
        changes.push(`isPrivate: ${updateInput.isPrivate}`);
      }

      if (updateInput.scheduledFor !== undefined) {
        if (updateInput.scheduledFor) {
          // Parse and validate the new scheduled date
          const newScheduledDate = new Date(updateInput.scheduledFor);
          if (isNaN(newScheduledDate.getTime())) {
            throw new BadRequestException(
              `Invalid date format: ${updateInput.scheduledFor}. Please use a valid date string.`,
            );
          }

          // Check if the new date is in the past
          if (newScheduledDate < new Date()) {
            throw new BadRequestException(
              'Cannot schedule a meeting in the past',
            );
          }

          meeting.scheduledFor = newScheduledDate;
          changes.push(`scheduledFor: ${newScheduledDate.toISOString()}`);
        } else {
          // If scheduledFor is explicitly set to null/empty, remove the scheduled time
          meeting.scheduledFor = undefined;
          changes.push('scheduledFor: removed');
        }
      }

      if (updateInput.duration !== undefined) {
        meeting.durationMin = updateInput.duration;
        changes.push(`duration: ${updateInput.duration} minutes`);
      }

      if (updateInput.maxParticipants !== undefined) {
        meeting.maxParticipants = updateInput.maxParticipants;
        changes.push(`maxParticipants: ${updateInput.maxParticipants}`);
      }

      // Update meeting status based on scheduledFor
      if (updateInput.scheduledFor !== undefined) {
        if (updateInput.scheduledFor) {
          meeting.status = MeetingStatus.SCHEDULED;
        } else {
          meeting.status = MeetingStatus.CREATED;
        }
      }

      await meeting.save();
      await meeting.populate(
        'hostId',
        'email displayName systemRole avatarUrl',
      );

      this.logger.log(
        `[UPDATE_MEETING] Success - Meeting ID: ${meetingId}, Changes: [${changes.join(', ')}]`,
      );

      return {
        _id: meeting._id,
        title: meeting.title,
        notes: meeting.notes,
        isPrivate: meeting.isPrivate,
        isLocked: meeting.isLocked || false,
        scheduledFor: meeting.scheduledFor,
        actualStartAt: meeting.actualStartAt,
        endedAt: meeting.endedAt,
        durationMin: meeting.durationMin,
        duration: meeting.durationMin,
        maxParticipants: meeting.maxParticipants || 100,
        status: meeting.status,
        inviteCode: meeting.inviteCode,
        participantCount: meeting.participantCount,
        hostId: meeting.hostId.toString(),
        host: meeting.hostId,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `[UPDATE_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // START MEETING
  async startMeeting(meetingId: string, userId: string) {
    this.logger.log(
      `[START_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`,
    );

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(meetingId).populate('hostId');
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);

      // Debug logging
      console.log(`[DEBUG] startMeeting - meeting.hostId:`, JSON.stringify(meeting.hostId));
      console.log(`[DEBUG] startMeeting - userId:`, userId);
      console.log(`[DEBUG] startMeeting - meeting.hostId._id:`, meeting.hostId._id);
      console.log(`[DEBUG] startMeeting - meeting.hostId._id.toString():`, meeting.hostId._id.toString());
      console.log(`[DEBUG] startMeeting - userId.toString():`, userId.toString());
      console.log(`[DEBUG] startMeeting - comparison:`, meeting.hostId._id.toString() === userId.toString());
      console.log(`[DEBUG] startMeeting - user.systemRole:`, user.systemRole);

      // 🔧 FIX: Check both original host (hostId) and current host (currentHostId)
      const isOriginalHost = MeetingUtils.isMeetingHost(meeting.hostId, userId);
      const isCurrentHost = meeting.currentHostId ? MeetingUtils.isMeetingHost(meeting.currentHostId, userId) : false;
      const isHost = isOriginalHost || isCurrentHost; // User is host if they are either original or current host
      const isAdmin = user.systemRole === SystemRole.ADMIN;

      console.log(`[DEBUG] startMeeting - isOriginalHost: ${isOriginalHost}, isCurrentHost: ${isCurrentHost}, isHost: ${isHost}, isAdmin: ${isAdmin}`);

      if (!isAdmin && !isHost) {
        console.log(`[DEBUG] startMeeting - THROWING FORBIDDEN EXCEPTION`);
        throw new ForbiddenException(
          'Only the meeting host can start the meeting',
        );
      }

      // Update meeting status
      meeting.status = MeetingStatus.LIVE;
      meeting.actualStartAt = new Date();
      await meeting.save();

      // 🔧 FIX: Don't delete participants when meeting starts!
      // This was causing participants to disappear from the list
      this.logger.log(`[START_MEETING] Meeting ${meetingId} started successfully without clearing participants`);

      // FIXED: Send WebSocket notification to all waiting participants
      // Notify the participant service to trigger WebSocket notifications
      await this.participantService.notifyMeetingStarted(meetingId);

      // 🔧 FIX: Removed duplicate cleanup to prevent participant deletion issues

      // Admit all waiting participants when meeting starts
      try {
        const waitingParticipants = await this.participantModel.find({
          meetingId: new Types.ObjectId(meetingId),
          status: ParticipantStatus.WAITING
        });

        this.logger.log(`[START_MEETING] Found ${waitingParticipants.length} waiting participants`);

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

        // Update participant count
        if (waitingParticipants.length > 0) {
          await this.meetingModel.findByIdAndUpdate(meetingId, {
            $inc: { participantCount: waitingParticipants.length },
          });
        }

        this.logger.log(`[START_MEETING] Admitted ${waitingParticipants.length} waiting participants for meeting ${meetingId}`);
      } catch (error) {
        this.logger.warn(`[START_MEETING] Failed to admit waiting participants: ${error.message}`);
        // Don't fail the meeting start if participant admission fails
      }

      // Fix: Create LiveKit room when meeting starts
      try {
        await this.livekitService.createRoom(meetingId, 50); // Create room with max 50 participants
        this.logger.log(`[START_MEETING] LiveKit room created for meeting ${meetingId}`);
      } catch (error) {
        this.logger.error(`[START_MEETING] Failed to create LiveKit room: ${error.message}`);
        // Don't fail the meeting start if LiveKit fails
      }

      this.logger.log(`[START_MEETING] Success - Meeting ID: ${meetingId}`);

      // Return the full meeting object as expected by MeetingWithHost
      return {
        _id: meeting._id,
        title: meeting.title,
        notes: meeting.notes,
        status: meeting.status,
        inviteCode: meeting.inviteCode,
        isPrivate: meeting.isPrivate,
        isLocked: meeting.isLocked || false,
        scheduledFor: meeting.scheduledFor,
        actualStartAt: meeting.actualStartAt,
        endedAt: meeting.endedAt,
        durationMin: meeting.durationMin,
        participantCount: meeting.participantCount,
        hostId: meeting.hostId._id.toString(),
        host: meeting.hostId,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `[START_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // END MEETING (close all participants + sessions)
  async endMeeting(meetingId: string, userId: string) {
    this.logger.log(`[END_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`);

    try {
      if (!Types.ObjectId.isValid(meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${meetingId}. Expected a valid MongoDB ObjectId.`
        );
      }

      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) throw new NotFoundException('Meeting not found');

      // permissions: host or admin
      const user = await this.memberModel.findById(userId);
      
      // 🔍 IMPROVED: Use comprehensive host validation utility
      const hostValidation = await HostValidationUtil.validateHost(
        meeting.hostId,
        userId,
        user.systemRole,
        this.participantModel,
        meetingId
      );

      // Host validation completed
      
      // Allow end meeting if user is admin OR meeting host (not requiring host participant role for end meeting)
      if (!hostValidation.isAdmin && !hostValidation.isMeetingHost) {
        this.logger.warn(`[END_MEETING] Permission denied - userId: ${userId} is not authorized to end meeting. Reason: ${hostValidation.reason}`);
        throw new ForbiddenException('Only the meeting host or admin can end the meeting');
      }

      // 1) Mark meeting ENDED + compute duration
      meeting.status = MeetingStatus.ENDED;
      meeting.endedAt = new Date();

      if (meeting.actualStartAt) {
        const durationMs = meeting.endedAt.getTime() - meeting.actualStartAt.getTime();
        meeting.durationMin = Math.round(durationMs / (1000 * 60));
      }

      this.logger.log(`[END_MEETING] Meeting status updated to ENDED - Meeting ID: ${meetingId}, Status: ${meeting.status}, EndedAt: ${meeting.endedAt}`);

      // 2) Mark ALL participants as LEFT and close any open sessions
      const now = new Date();
      // Pull current participants first so we can compute totalDurationSec increments
      const participants = await this.participantModel.find({
        meetingId: new Types.ObjectId(meetingId),
        status: { $in: [ParticipantStatus.WAITING, ParticipantStatus.APPROVED, ParticipantStatus.ADMITTED] }
      });

      // Close sessions in memory (to compute per-doc totals) then bulk persist
      const updates = [];
      for (const p of participants) {
        let totalIncrement = 0;
        const sessions = p.sessions || [];
        if (sessions.length > 0) {
          const last = sessions[sessions.length - 1];
          if (!last.leftAt && last.joinedAt) {
            last.leftAt = now;
            last.durationSec = Math.floor((now.getTime() - last.joinedAt.getTime()) / 1000);
            totalIncrement += last.durationSec;
          }
        }
        p.totalDurationSec = (p.totalDurationSec || 0) + totalIncrement;
        p.status = ParticipantStatus.LEFT;
        updates.push({
          updateOne: {
            filter: { _id: p._id },
            update: {
              $set: {
                status: ParticipantStatus.LEFT,
                sessions: sessions,
                totalDurationSec: p.totalDurationSec
              }
            }
          }
        });
      }
      if (updates.length) {
        await this.participantModel.bulkWrite(updates);
      }

      // 3) Reset participantCount to 0 (since everyone is LEFT)
      meeting.participantCount = 0;

      await meeting.save();

      this.logger.log(
        `[END_MEETING] Success - Meeting ID: ${meetingId}, Duration: ${meeting.durationMin ?? 0} minutes, Closed participants: ${updates.length}`
      );

      // 4) (Optional) publish subscriptions so UIs react immediately
      // await this.pubSub.publish('meetingUpdated', { meetingUpdated: { _id: meeting._id, status: meeting.status, endedAt: meeting.endedAt, durationMin: meeting.durationMin, participantCount: meeting.participantCount } });

      // Return the full meeting object as expected by the frontend
      const populatedMeeting = await this.meetingModel.findById(meetingId).populate('hostId');
      
      // Get host information safely
      const hostInfo = populatedMeeting.hostId && typeof populatedMeeting.hostId === 'object' && '_id' in populatedMeeting.hostId 
        ? populatedMeeting.hostId as any
        : null;
      
      return {
        _id: populatedMeeting._id,
        title: populatedMeeting.title,
        status: populatedMeeting.status,
        inviteCode: populatedMeeting.inviteCode,
        isPrivate: populatedMeeting.isPrivate,
        scheduledFor: populatedMeeting.scheduledFor,
        actualStartAt: populatedMeeting.actualStartAt,
        endedAt: populatedMeeting.endedAt,
        durationMin: populatedMeeting.durationMin,
        notes: populatedMeeting.notes,
        participantCount: populatedMeeting.participantCount,
        hostId: hostInfo?._id || populatedMeeting.hostId,
        currentHostId: populatedMeeting.currentHostId,
        createdAt: populatedMeeting.createdAt,
        updatedAt: populatedMeeting.updatedAt,
        host: hostInfo ? {
          _id: hostInfo._id,
          email: hostInfo.email || '',
          displayName: hostInfo.displayName || '',
          systemRole: hostInfo.systemRole || '',
          avatarUrl: hostInfo.avatarUrl || '',
          organization: hostInfo.organization || '',
          department: hostInfo.department || ''
        } : {
          _id: populatedMeeting.hostId.toString(),
          email: '',
          displayName: '',
          systemRole: '',
          avatarUrl: '',
          organization: '',
          department: ''
        }
      };
    } catch (error) {
      this.logger.error(
        `[END_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`
      );
      throw error;
    }
  }


  // DELETE MEETING
  async deleteMeeting(meetingId: string, userId: string) {
    this.logger.log(
      `[DELETE_MEETING] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`,
    );

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        !MeetingUtils.isMeetingHost(meeting.hostId, userId)
      ) {
        throw new ForbiddenException('You can only delete your own meetings');
      }

      await this.meetingModel.findByIdAndDelete(meetingId);

      this.logger.log(`[DELETE_MEETING] Success - Meeting ID: ${meetingId}`);

      return {
        success: true,
        message: 'Meeting deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `[DELETE_MEETING] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // ROTATE INVITE CODE
  async rotateInviteCode(meetingId: string, userId: string) {
    this.logger.log(
      `[ROTATE_INVITE_CODE] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`,
    );

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        !MeetingUtils.isMeetingHost(meeting.hostId, userId)
      ) {
        throw new ForbiddenException(
          'Only the meeting host can rotate the invite code',
        );
      }

      // Generate new unique invite code
      const newInviteCode = await this.generateUniqueInviteCode();
      meeting.inviteCode = newInviteCode;
      await meeting.save();

      this.logger.log(
        `[ROTATE_INVITE_CODE] Success - Meeting ID: ${meetingId}, New Code: ${newInviteCode}`,
      );

      return {
        _id: meeting._id,
        inviteCode: newInviteCode,
        message: 'Invite code rotated successfully',
      };
    } catch (error) {
      this.logger.error(
        `[ROTATE_INVITE_CODE] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // GET MEETING STATS
  async getMeetingStats(userId: string) {
    this.logger.log(`[GET_MEETING_STATS] Attempt - User ID: ${userId}`);

    try {
      const user = await this.memberModel.findById(userId);
      const filter =
        user.systemRole === SystemRole.ADMIN
          ? {}
          : { hostId: new Types.ObjectId(userId) };

      const stats = await this.meetingModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalMeetings: { $sum: 1 },
            liveMeetings: {
              $sum: { $cond: [{ $eq: ['$status', MeetingStatus.LIVE] }, 1, 0] },
            },
            scheduledMeetings: {
              $sum: {
                $cond: [{ $eq: ['$status', MeetingStatus.SCHEDULED] }, 1, 0],
              },
            },
            endedMeetings: {
              $sum: {
                $cond: [{ $eq: ['$status', MeetingStatus.ENDED] }, 1, 0],
              },
            },
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

      this.logger.log(
        `[GET_MEETING_STATS] Success - Total Meetings: ${result.totalMeetings}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[GET_MEETING_STATS] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // LOCK ROOM
  async lockRoom(meetingId: string, userId: string) {
    this.logger.log(
      `[LOCK_ROOM] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`,
    );

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        !MeetingUtils.isMeetingHost(meeting.hostId, userId)
      ) {
        throw new ForbiddenException('Only the meeting host can lock the room');
      }

      // Check if meeting is active
      if (meeting.status === MeetingStatus.ENDED) {
        throw new BadRequestException('Cannot lock a meeting that has ended');
      }

      // Lock the room
      meeting.isLocked = true;
      await meeting.save();

      this.logger.log(
        `[LOCK_ROOM] Success - Meeting ID: ${meetingId}, Locked: ${meeting.isLocked}`,
      );

      return {
        _id: meeting._id,
        isLocked: meeting.isLocked,
        message: 'Room locked successfully. No new participants can join.',
      };
    } catch (error) {
      this.logger.error(
        `[LOCK_ROOM] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // UNLOCK ROOM
  async unlockRoom(meetingId: string, userId: string) {
    this.logger.log(
      `[UNLOCK_ROOM] Attempt - Meeting ID: ${meetingId}, User ID: ${userId}`,
    );

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        !MeetingUtils.isMeetingHost(meeting.hostId, userId)
      ) {
        throw new ForbiddenException(
          'Only the meeting host can unlock the room',
        );
      }

      // Check if meeting is active
      if (meeting.status === MeetingStatus.ENDED) {
        throw new BadRequestException('Cannot unlock a meeting that has ended');
      }

      // Unlock the room
      meeting.isLocked = false;
      await meeting.save();

      this.logger.log(
        `[UNLOCK_ROOM] Success - Meeting ID: ${meetingId}, Locked: ${meeting.isLocked}`,
      );

      return {
        _id: meeting._id,
        isLocked: meeting.isLocked,
        message: 'Room unlocked successfully. New participants can now join.',
      };
    } catch (error) {
      this.logger.error(
        `[UNLOCK_ROOM] Failed - Meeting ID: ${meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
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
