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
import { Vod } from '../../schemas/Vod.model';
import { SystemRole, RecordingStatus, VodSourceType } from '../../libs/enums/enums';
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
import { LivekitService } from '../signaling/livekit.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<Meeting>,
    @InjectModel(Member.name) private memberModel: Model<Member>,
    @InjectModel(Vod.name) private vodModel: Model<Vod>,
    private readonly livekitService: LivekitService,
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
      
      // DEBUG LOGGING - Meeting data
      this.logger.log(`[DEBUG] Meeting ID: ${input.meetingId}`);
      this.logger.log(`[DEBUG] Meeting found: ${meeting ? 'YES' : 'NO'}`);
      if (meeting) {
        this.logger.log(`[DEBUG] Meeting title: ${meeting.title}`);
        this.logger.log(`[DEBUG] Meeting hostId: ${meeting.hostId} (type: ${typeof meeting.hostId})`);
        this.logger.log(`[DEBUG] Meeting status: ${meeting.status}`);
        this.logger.log(`[DEBUG] Meeting isRecording: ${meeting.isRecording}`);
      }

      // Check if meeting is active FIRST
      if (meeting.status === 'ENDED') {
        this.logger.error(`[MEETING_ENDED] Cannot start recording for ended meeting: ${meeting._id}`);
        throw new BadRequestException(
          'Cannot start recording for a meeting that has ended',
        );
      }
      
      this.logger.log(`[MEETING_ACTIVE] Meeting ${meeting._id} is active, checking permissions...`);

      // Check permissions AFTER confirming meeting is active
      const user = await this.memberModel.findById(userId);
      
      // DEBUG LOGGING - Check all values
      this.logger.log(`[DEBUG] User ID: ${userId} (type: ${typeof userId})`);
      this.logger.log(`[DEBUG] User found: ${user ? 'YES' : 'NO'}`);
      if (user) {
        this.logger.log(`[DEBUG] User systemRole: ${user.systemRole}`);
        this.logger.log(`[DEBUG] User _id: ${user._id} (type: ${typeof user._id})`);
      }
      this.logger.log(`[DEBUG] Meeting hostId: ${meeting.hostId} (type: ${typeof meeting.hostId})`);
      this.logger.log(`[DEBUG] Meeting hostId.toString(): ${meeting.hostId.toString()}`);
      this.logger.log(`[DEBUG] userId.toString(): ${userId.toString()}`);
      this.logger.log(`[DEBUG] Comparison: ${meeting.hostId.toString()} !== ${userId.toString()} = ${meeting.hostId.toString() !== userId.toString()}`);
      this.logger.log(`[DEBUG] Is Admin: ${user?.systemRole === SystemRole.ADMIN}`);
      
      if (
        user.systemRole !== SystemRole.ADMIN &&
        meeting.hostId.toString() !== userId.toString()
      ) {
        this.logger.error(`[PERMISSION_DENIED] User ${userId} is not the host ${meeting.hostId.toString()}`);
        throw new ForbiddenException(
          'Only the meeting host can start recording',
        );
      }
      
      this.logger.log(`[PERMISSION_GRANTED] User ${userId} can start recording`);

      // Check if already recording
      if (meeting.isRecording) {
        throw new BadRequestException(
          'Recording is already in progress for this meeting',
        );
      }

      // Generate recording ID and file name
      const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fileName = `${meeting._id}_${Date.now()}.mp4`;
      
      // Configure recording for local file output first
      const recordingsDir = path.join(process.cwd(), 'uploads', 'recordings');
      const filePath = path.join(recordingsDir, fileName);
      
      // Ensure recordings directory exists
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
        this.logger.log(`[START_RECORDING] Created recordings directory: ${recordingsDir}`);
      }
      
      this.logger.log(`[START_RECORDING] Recording will be saved to: ${filePath}`);
      
      // Start LiveKit recording with VOD server upload
      let livekitEgressId: string;
      try {
        livekitEgressId = await this.livekitService.startRecording(
          meeting._id.toString(),
          filePath
        );
        this.logger.log(`[START_RECORDING] ✅ LiveKit egress started: ${livekitEgressId}`);
        this.logger.log(`[START_RECORDING] 📹 Recording will be uploaded to: https://i-vod1.hrdeedu.co.kr/upload`);
      } catch (error) {
        this.logger.error(`[START_RECORDING] ❌ LiveKit egress failed: ${error.message}`);
        throw new BadRequestException(`Failed to start recording: ${error.message}`);
      }

      // Start recording
      const now = new Date();
      meeting.isRecording = true;
      meeting.recordingId = livekitEgressId;
      meeting.recordingStartedAt = now;
      meeting.recordingStatus = RecordingStatus.RECORDING;
      meeting.recordingDuration = 0;
      meeting.recordingPausedAt = undefined;
      meeting.recordingResumedAt = undefined;
      meeting.recordingEndedAt = undefined;
      // Recording saved locally first
      meeting.recordingUrl = `/uploads/recordings/${fileName}`;
      this.logger.log(`[START_RECORDING] 📹 Recording URL: ${meeting.recordingUrl}`);
      this.logger.log(`[START_RECORDING] 💾 Recording will be saved locally: ${filePath}`);

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
        meeting.hostId.toString() !== userId.toString()
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

      // Stop LiveKit recording
      try {
        await this.livekitService.stopRecording(meeting.recordingId);
        this.logger.log(`[STOP_RECORDING] LiveKit egress stopped: ${meeting.recordingId}`);
      } catch (error) {
        this.logger.error(`[STOP_RECORDING] Failed to stop LiveKit egress: ${error.message}`);
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

      // Update recording URL to point to local file
      const fileName = `${meeting._id}_${meeting.recordingStartedAt?.getTime() || Date.now()}.mp4`;
      const recordingUrl = `/uploads/recordings/${fileName}`;
      meeting.recordingUrl = recordingUrl;

      await meeting.save();

      // Auto-create VOD entry from recording
      try {
        const fileName = recordingUrl.split('/').pop() || `${meeting.recordingId}.mp4`;
        const storageKey = `recordings/${fileName}`;
        
        // Get actual file size from local file
        let fileSize = 0;
        const localFilePath = path.join(process.cwd(), 'uploads', 'recordings', fileName);
        
        if (fs.existsSync(localFilePath)) {
          const stats = fs.statSync(localFilePath);
          fileSize = stats.size;
          this.logger.log(`[STOP_RECORDING] 💾 Local recording, actual size: ${fileSize} bytes`);
        } else {
          // Estimate size based on duration if file doesn't exist yet
          fileSize = Math.round(meeting.recordingDuration * 312500); // ~2.5 Mbps = 312.5 KB/s
          this.logger.log(`[STOP_RECORDING] ⚠️ File not found, estimated size: ${fileSize} bytes`);
        }

        const newVod = new this.vodModel({
          title: `${meeting.title || 'Meeting'} - Recording`,
          notes: `Automatically created from meeting recording on ${now.toLocaleDateString()}. Stored locally.`,
          meetingId: meeting._id,
          source: VodSourceType.FILE,
          storageKey: storageKey,
          sizeBytes: fileSize,
          durationSec: meeting.recordingDuration,
          url: recordingUrl, // Store the local file URL
        });

        await newVod.save();
        this.logger.log(`[STOP_RECORDING] ✅ VOD entry created: ${newVod._id} (Local)`);
      } catch (vodError) {
        this.logger.error(`[STOP_RECORDING] ❌ Failed to create VOD entry: ${vodError.message}`);
        // Don't fail the recording stop if VOD creation fails
      }

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
        meeting.hostId.toString() !== userId.toString()
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
        meeting.hostId.toString() !== userId.toString()
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
