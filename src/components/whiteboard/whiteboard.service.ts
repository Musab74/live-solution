import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting } from '../../schemas/Meeting.model';
import { Participant } from '../../schemas/Participant.model';
import { SystemRole } from '../../libs/enums/enums';
import { MeetingUtils } from '../../utils/meeting-utils';

@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<Meeting>,
    @InjectModel(Participant.name) private participantModel: Model<Participant>,
  ) {}

  /**
   * Check if user can use whiteboard (host only)
   */
  async canUseWhiteboard(meetingId: string, userId: string): Promise<boolean> {
    try {
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check if user is host
      const isHost = MeetingUtils.isMeetingHost(meeting.hostId, userId) || 
                     (meeting.currentHostId && MeetingUtils.isMeetingHost(meeting.currentHostId, userId));

      return isHost;
    } catch (error) {
      this.logger.error(`[CAN_USE_WHITEBOARD] Error: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate whiteboard permission
   */
  async validateWhiteboardPermission(meetingId: string, userId: string): Promise<void> {
    const canUse = await this.canUseWhiteboard(meetingId, userId);
    if (!canUse) {
      throw new ForbiddenException('Only the meeting host can use the whiteboard');
    }
  }

  /**
   * Get whiteboard status for a meeting
   */
  async getWhiteboardStatus(meetingId: string): Promise<{
    isActive: boolean;
    hostId: string;
    startedAt?: Date;
  }> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // TODO: Add whiteboard state tracking to Meeting model if needed
    return {
      isActive: false,
      hostId: meeting.hostId.toString(),
    };
  }
}






