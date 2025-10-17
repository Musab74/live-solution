import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting } from '../../schemas/Meeting.model';
import { Member } from '../../schemas/Member.model';
import { SystemRole, RecordingStatus } from '../../libs/enums/enums';
import {
  StartMeetingRecordingInput,
  StopMeetingRecordingInput,
  PauseMeetingRecordingInput,
  ResumeRecordingInput,
  GetRecordingInput,
} from '../../libs/DTO/recording/recording.input';
import {
  MeetingRecordingInfo,
  RecordingResponse,
  RecordingStats,
} from '../../libs/DTO/recording/recording.query';

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<Meeting>,
    @InjectModel(Member.name) private memberModel: Model<Member>,
  ) {}

  // START RECORDING
  async startRecording(
    input: StartMeetingRecordingInput,
    userId: string,
  ): Promise<RecordingResponse> {

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(input.meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${input.meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(input.meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        meeting.hostId.toString() !== userId
      ) {
        throw new ForbiddenException(
          'Only the meeting host can start recording',
        );
      }

      // Check if meeting is active
      if (meeting.status === 'ENDED') {
        throw new BadRequestException(
          'Cannot start recording for a meeting that has ended',
        );
      }

      // Check if already recording
      if (meeting.isRecording) {
        throw new BadRequestException(
          'Recording is already in progress for this meeting',
        );
      }

      // Generate recording ID
      const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Start recording
      const now = new Date();
      meeting.isRecording = true;
      meeting.recordingId = recordingId;
      meeting.recordingStartedAt = now;
      meeting.recordingStatus = RecordingStatus.RECORDING;
      meeting.recordingDuration = 0;
      meeting.recordingPausedAt = undefined;
      meeting.recordingResumedAt = undefined;
      meeting.recordingEndedAt = undefined;

      // Set quality and format defaults
      const quality = input.quality || '720p';
      const format = input.format || 'mp4';

      await meeting.save();

      return {
        success: true,
        message: 'Recording started successfully',
        meetingId: meeting._id,
        recordingId: recordingId,
        recording: {
          meetingId: meeting._id,
          isRecording: true,
          recordingId: recordingId,
          recordingStartedAt: now,
          recordingStatus: RecordingStatus.RECORDING,
          recordingDuration: 0,
          quality: quality,
          format: format,
        },
      };
    } catch (error) {
      this.logger.error(
        `[START_RECORDING] Failed - Meeting ID: ${input.meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // STOP RECORDING
  async stopRecording(
    input: StopMeetingRecordingInput,
    userId: string,
  ): Promise<RecordingResponse> {

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(input.meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${input.meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(input.meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        meeting.hostId.toString() !== userId
      ) {
        throw new ForbiddenException(
          'Only the meeting host can stop recording',
        );
      }

      // Check if recording is in progress
      if (!meeting.isRecording) {
        throw new BadRequestException(
          'No recording is currently in progress for this meeting',
        );
      }

      // Stop recording
      const now = new Date();
      meeting.isRecording = false;
      meeting.recordingEndedAt = now;
      meeting.recordingStatus = RecordingStatus.STOPPED;

      // Calculate total recording duration
      if (meeting.recordingStartedAt) {
        const totalDuration = Math.floor(
          (now.getTime() - meeting.recordingStartedAt.getTime()) / 1000,
        );
        meeting.recordingDuration = totalDuration;
      }

      // Generate mock recording URL (in real implementation, this would come from LiveKit)
      const recordingUrl = `https://recordings.example.com/${meeting.recordingId}.mp4`;
      meeting.recordingUrl = recordingUrl;

      await meeting.save();

      return {
        success: true,
        message: 'Recording stopped successfully',
        meetingId: meeting._id,
        recordingId: meeting.recordingId,
        recordingUrl: recordingUrl,
        recording: {
          meetingId: meeting._id,
          isRecording: false,
          recordingId: meeting.recordingId,
          recordingUrl: recordingUrl,
          recordingStartedAt: meeting.recordingStartedAt,
          recordingEndedAt: now,
          recordingDuration: meeting.recordingDuration,
          recordingStatus: RecordingStatus.STOPPED,
        },
      };
    } catch (error) {
      this.logger.error(
        `[STOP_RECORDING] Failed - Meeting ID: ${input.meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // PAUSE RECORDING
  async pauseRecording(
    input: PauseMeetingRecordingInput,
    userId: string,
  ): Promise<RecordingResponse> {

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(input.meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${input.meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(input.meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        meeting.hostId.toString() !== userId
      ) {
        throw new ForbiddenException(
          'Only the meeting host can pause recording',
        );
      }

      // Check if recording is in progress
      if (!meeting.isRecording) {
        throw new BadRequestException(
          'No recording is currently in progress for this meeting',
        );
      }

      // Check if already paused
      if (meeting.recordingStatus === RecordingStatus.PAUSED) {
        throw new BadRequestException('Recording is already paused');
      }

      // Pause recording
      const now = new Date();
      meeting.recordingPausedAt = now;
      meeting.recordingStatus = RecordingStatus.PAUSED;

      await meeting.save();

      return {
        success: true,
        message: 'Recording paused successfully',
        meetingId: meeting._id,
        recordingId: meeting.recordingId,
        recording: {
          meetingId: meeting._id,
          isRecording: true, // Still recording, just paused
          recordingId: meeting.recordingId,
          recordingStartedAt: meeting.recordingStartedAt,
          recordingPausedAt: now,
          recordingStatus: RecordingStatus.PAUSED,
          recordingDuration: meeting.recordingDuration,
        },
      };
    } catch (error) {
      this.logger.error(
        `[PAUSE_RECORDING] Failed - Meeting ID: ${input.meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // RESUME RECORDING
  async resumeRecording(
    input: ResumeRecordingInput,
    userId: string,
  ): Promise<RecordingResponse> {

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(input.meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${input.meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(input.meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);
      if (
        user.systemRole !== SystemRole.ADMIN &&
        meeting.hostId.toString() !== userId
      ) {
        throw new ForbiddenException(
          'Only the meeting host can resume recording',
        );
      }

      // Check if recording is paused
      if (meeting.recordingStatus !== RecordingStatus.PAUSED) {
        throw new BadRequestException('Recording is not currently paused');
      }

      // Resume recording
      const now = new Date();
      meeting.recordingResumedAt = now;
      meeting.recordingStatus = RecordingStatus.RECORDING;

      // Calculate paused duration and add to total
      if (meeting.recordingPausedAt) {
        const pausedDuration = Math.floor(
          (now.getTime() - meeting.recordingPausedAt.getTime()) / 1000,
        );
        meeting.recordingDuration =
          (meeting.recordingDuration || 0) + pausedDuration;
      }

      await meeting.save();

      return {
        success: true,
        message: 'Recording resumed successfully',
        meetingId: meeting._id,
        recordingId: meeting.recordingId,
        recording: {
          meetingId: meeting._id,
          isRecording: true,
          recordingId: meeting.recordingId,
          recordingStartedAt: meeting.recordingStartedAt,
          recordingResumedAt: now,
          recordingStatus: RecordingStatus.RECORDING,
          recordingDuration: meeting.recordingDuration,
        },
      };
    } catch (error) {
      this.logger.error(
        `[RESUME_RECORDING] Failed - Meeting ID: ${input.meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // GET RECORDING INFO
  async getRecordingInfo(
    input: GetRecordingInput,
    userId: string,
  ): Promise<MeetingRecordingInfo> {

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(input.meetingId)) {
        throw new BadRequestException(
          `Invalid meeting ID format: ${input.meetingId}. Expected a valid MongoDB ObjectId.`,
        );
      }

      const meeting = await this.meetingModel.findById(input.meetingId);
      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      // Check permissions
      const user = await this.memberModel.findById(userId);

      // Fix: Use proper string comparison
      const isHost = meeting.hostId && meeting.hostId.toString() === userId;
      const isAdmin = user.systemRole === SystemRole.ADMIN;
      
      if (!isHost && !isAdmin) {
        throw new ForbiddenException(
          'Only the meeting host can view recording info',
        );
      }

      return {
        meetingId: meeting._id,
        isRecording: meeting.isRecording || false,
        recordingId: meeting.recordingId,
        recordingUrl: meeting.recordingUrl,
        recordingStartedAt: meeting.recordingStartedAt,
        recordingEndedAt: meeting.recordingEndedAt,
        recordingPausedAt: meeting.recordingPausedAt,
        recordingResumedAt: meeting.recordingResumedAt,
        recordingDuration: meeting.recordingDuration,
        recordingStatus: meeting.recordingStatus as RecordingStatus,
        quality: '720p', // Default quality
        format: 'mp4', // Default format,
        
        // Additional fields for frontend compatibility
        status: meeting.recordingStatus as RecordingStatus, // Alias for recordingStatus
        recordingType: 'VIDEO', // Default recording type
        startedAt: meeting.recordingStartedAt, // Alias for recordingStartedAt
        stoppedAt: meeting.recordingEndedAt, // Alias for recordingEndedAt
        pausedAt: meeting.recordingPausedAt, // Alias for recordingPausedAt
        resumedAt: meeting.recordingResumedAt, // Alias for recordingResumedAt
        durationSec: meeting.recordingDuration, // Alias for recordingDuration
        fileSize: 0, // File size in bytes (placeholder)
        downloadUrl: meeting.recordingUrl, // Direct download URL (same as recordingUrl)
      };
    } catch (error) {
      this.logger.error(
        `[GET_RECORDING_INFO] Failed - Meeting ID: ${input.meetingId}, User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  // GET RECORDING STATS
  async getRecordingStats(userId: string): Promise<RecordingStats> {

    try {
      const user = await this.memberModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Build query based on user role
      let query = {};
      if (user.systemRole !== SystemRole.ADMIN) {
        query = { hostId: new Types.ObjectId(userId) };
      }

      const meetings = await this.meetingModel.find(query).lean();

      const totalRecordings = meetings.filter((m) => m.recordingId).length;
      const activeRecordings = meetings.filter(
        (m) => m.isRecording && m.recordingStatus === RecordingStatus.RECORDING,
      ).length;
      const pausedRecordings = meetings.filter(
        (m) => m.isRecording && m.recordingStatus === RecordingStatus.PAUSED,
      ).length;

      const totalRecordingTime = meetings.reduce((total, meeting) => {
        return total + (meeting.recordingDuration || 0);
      }, 0);

      const averageRecordingDuration =
        totalRecordings > 0
          ? Math.floor(totalRecordingTime / totalRecordings)
          : 0;

      return {
        totalRecordings,
        activeRecordings,
        pausedRecordings,
        totalRecordingTime,
        averageRecordingDuration,
      };
    } catch (error) {
      this.logger.error(
        `[GET_RECORDING_STATS] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }
}
