import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vod, VodDocument } from '../../schemas/Vod.model';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Member, MemberDocument } from '../../schemas/Member.model';
import {
  CreateVodFileInput,
  CreateVodUrlInput,
  UpdateVodInput,
  VodQueryInput,
} from '../../libs/DTO/vod/vod.input';
import { VodSourceType, SystemRole } from '../../libs/enums/enums';
import * as crypto from 'crypto';
import * as path from 'path';

@Injectable()
export class VodService {
  constructor(
    @InjectModel(Vod.name) private vodModel: Model<VodDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  async getAllVods(
    queryInput: VodQueryInput,
    userId: string,
    userRole: SystemRole,
  ): Promise<any> {
    const { q, source, meetingId, limit = 20, offset = 0 } = queryInput;

    // Build filter
    const filter: any = {};

    // Search by title or notes
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
      ];
    }

    if (source) {
      filter.source = source;
    }

    if (meetingId) {
      filter.meetingId = new Types.ObjectId(meetingId);
    }

    // If user is not admin, only show VODs from their meetings
    if (userRole !== SystemRole.ADMIN) {
      const userMeetings = await this.meetingModel
        .find({ hostId: new Types.ObjectId(userId) })
        .select('_id');
      const meetingIds = userMeetings.map((meeting) => meeting._id);
      filter.meetingId = { $in: meetingIds };
    }

    const vods = await this.vodModel
      .find(filter)
      .populate('meetingId', 'title status inviteCode')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    const total = await this.vodModel.countDocuments(filter);

    const vodsWithMeeting = vods.map((vod) => {
      const meetingData =
        vod.meetingId && typeof vod.meetingId === 'object'
          ? {
              _id: (vod.meetingId as any)._id,
              title: (vod.meetingId as any).title,
              status: (vod.meetingId as any).status,
              inviteCode: (vod.meetingId as any).inviteCode,
            }
          : null;

      return {
        ...vod,
        meeting: meetingData,
      };
    });

    return {
      vods: vodsWithMeeting,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getVodById(
    vodId: string,
    userId: string,
    userRole: SystemRole,
  ): Promise<any> {
    const vod = await this.vodModel
      .findById(vodId)
      .populate('meetingId', 'title status inviteCode hostId')
      .lean();

    if (!vod) {
      throw new NotFoundException('VOD not found');
    }

    // Check permissions
    if (userRole !== SystemRole.ADMIN) {
      if (vod.meetingId && typeof vod.meetingId === 'object') {
        const meeting = vod.meetingId as any;
        if (meeting.hostId.toString() !== userId) {
          throw new ForbiddenException(
            'You can only view VODs from your meetings',
          );
        }
      } else {
        throw new ForbiddenException(
          'You can only view VODs from your meetings',
        );
      }
    }

    const meetingData =
      vod.meetingId && typeof vod.meetingId === 'object'
        ? {
            _id: (vod.meetingId as any)._id,
            title: (vod.meetingId as any).title,
            status: (vod.meetingId as any).status,
            inviteCode: (vod.meetingId as any).inviteCode,
          }
        : null;

    return {
      ...vod,
      meeting: meetingData,
    };
  }

  async createVodFromFile(
    createInput: CreateVodFileInput,
    file: any,
    userId: string,
    userRole: SystemRole,
  ) {
    const { title, notes, meetingId, durationSec } = createInput;

    // Validate meeting access if meetingId is provided
    if (meetingId) {
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      if (
        userRole !== SystemRole.ADMIN &&
        meeting.hostId.toString() !== userId
      ) {
        throw new ForbiddenException('You can only add VODs to your meetings');
      }
    }

    // Generate storage key (in production, this would be S3 or similar)
    const fileExtension = path.extname(file.originalname);
    const storageKey = `vods/${crypto.randomUUID()}${fileExtension}`;

    // Create VOD record
    const newVod = new this.vodModel({
      title,
      notes,
      meetingId: meetingId ? new Types.ObjectId(meetingId) : undefined,
      source: VodSourceType.FILE,
      storageKey,
      sizeBytes: file.size,
      durationSec,
    });

    const savedVod = await newVod.save();

    return {
      vodId: savedVod._id.toString(),
      title: savedVod.title,
      storageKey: savedVod.storageKey,
      sizeBytes: savedVod.sizeBytes,
      message: 'VOD file uploaded successfully',
    };
  }

  async createVodFromUrl(
    createInput: CreateVodUrlInput,
    userId: string,
    userRole: SystemRole,
  ) {
    const { title, url, notes, meetingId, durationSec } = createInput;

    // Validate meeting access if meetingId is provided
    if (meetingId) {
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      if (
        userRole !== SystemRole.ADMIN &&
        meeting.hostId.toString() !== userId
      ) {
        throw new ForbiddenException('You can only add VODs to your meetings');
      }
    }

    // Create VOD record
    const newVod = new this.vodModel({
      title,
      url,
      notes,
      meetingId: meetingId ? new Types.ObjectId(meetingId) : undefined,
      source: VodSourceType.URL,
      durationSec,
    });

    const savedVod = await newVod.save();

    return {
      vodId: savedVod._id.toString(),
      title: savedVod.title,
      url: savedVod.url,
      message: 'VOD URL added successfully',
    };
  }

  async updateVod(
    updateInput: UpdateVodInput,
    userId: string,
    userRole: SystemRole,
  ) {
    const { vodId, title, notes, durationSec } = updateInput;

    // Find the VOD
    const vod = await this.vodModel.findById(vodId);
    if (!vod) {
      throw new NotFoundException('VOD not found');
    }

    // Check permissions
    if (userRole !== SystemRole.ADMIN) {
      if (vod.meetingId) {
        const meeting = await this.meetingModel.findById(vod.meetingId);
        if (!meeting || meeting.hostId.toString() !== userId) {
          throw new ForbiddenException(
            'You can only update VODs from your meetings',
          );
        }
      } else {
        throw new ForbiddenException(
          'You can only update VODs from your meetings',
        );
      }
    }

    // Update allowed fields
    if (title) vod.title = title;
    if (notes !== undefined) vod.notes = notes;
    if (durationSec) vod.durationSec = durationSec;

    await vod.save();
    return vod;
  }

  async deleteVod(vodId: string, userId: string, userRole: SystemRole) {
    // Find the VOD
    const vod = await this.vodModel.findById(vodId);
    if (!vod) {
      throw new NotFoundException('VOD not found');
    }

    // Check permissions - only admin can delete
    if (userRole !== SystemRole.ADMIN) {
      throw new ForbiddenException('Only administrators can delete VODs');
    }

    // In production, also delete the file from storage
    // await this.storageService.deleteFile(vod.storageKey);

    // Delete the VOD record
    await this.vodModel.findByIdAndDelete(vodId);

    return { message: 'VOD deleted successfully' };
  }

  async getVodStats(userId: string, userRole: SystemRole) {
    const filter: any = {};

    // If user is not admin, only show stats for their meetings
    if (userRole !== SystemRole.ADMIN) {
      const userMeetings = await this.meetingModel
        .find({ hostId: new Types.ObjectId(userId) })
        .select('_id');
      const meetingIds = userMeetings.map((meeting) => meeting._id);
      filter.meetingId = { $in: meetingIds };
    }

    const [
      totalVods,
      fileVods,
      urlVods,
      totalSizeResult,
      averageDurationResult,
    ] = await Promise.all([
      this.vodModel.countDocuments(filter),
      this.vodModel.countDocuments({ ...filter, source: VodSourceType.FILE }),
      this.vodModel.countDocuments({ ...filter, source: VodSourceType.URL }),
      this.vodModel.aggregate([
        {
          $match: {
            ...filter,
            source: VodSourceType.FILE,
            sizeBytes: { $exists: true },
          },
        },
        { $group: { _id: null, totalSize: { $sum: '$sizeBytes' } } },
      ]),
      this.vodModel.aggregate([
        { $match: { ...filter, durationSec: { $exists: true } } },
        { $group: { _id: null, avgDuration: { $avg: '$durationSec' } } },
      ]),
    ]);

    return {
      totalVods,
      fileVods,
      urlVods,
      totalSizeBytes:
        totalSizeResult.length > 0 ? totalSizeResult[0].totalSize : 0,
      averageDuration:
        averageDurationResult.length > 0
          ? Math.round(averageDurationResult[0].avgDuration)
          : 0,
    };
  }
}
