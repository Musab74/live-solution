import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Member } from '../../schemas/Member.model';
import { RecordingService } from './recording.service';
import {
  StartMeetingRecordingInput,
  StopMeetingRecordingInput,
  PauseMeetingRecordingInput,
  ResumeRecordingInput,
  GetRecordingInput,
} from '../../libs/DTO/recording/recording.input';
import {
  RecordingResponse,
  MeetingRecordingInfo,
  RecordingStats,
  RecordingInfo,
} from '../../libs/DTO/recording/recording.query';

@Resolver()
export class RecordingResolver {
  private readonly logger = new Logger(RecordingResolver.name);

  constructor(private readonly recordingService: RecordingService) {}

  @Mutation(() => RecordingResponse, { name: 'startMeetingRecording' })
  @UseGuards(AuthGuard)
  async startMeetingRecording(
    @Args('input') input: StartMeetingRecordingInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.recordingService.startRecording(
        input,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[START_RECORDING] Failed - Meeting ID: ${input.meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => RecordingResponse, { name: 'stopMeetingRecording' })
  @UseGuards(AuthGuard)
  async stopMeetingRecording(
    @Args('input') input: StopMeetingRecordingInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.recordingService.stopRecording(input, user._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[STOP_RECORDING] Failed - Meeting ID: ${input.meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => RecordingResponse, { name: 'pauseMeetingRecording' })
  @UseGuards(AuthGuard)
  async pauseMeetingRecording(
    @Args('input') input: PauseMeetingRecordingInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.recordingService.pauseRecording(
        input,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[PAUSE_RECORDING] Failed - Meeting ID: ${input.meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => RecordingResponse, { name: 'resumeMeetingRecording' })
  @UseGuards(AuthGuard)
  async resumeMeetingRecording(
    @Args('input') input: ResumeRecordingInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.recordingService.resumeRecording(
        input,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[RESUME_RECORDING] Failed - Meeting ID: ${input.meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => MeetingRecordingInfo, { name: 'getRecordingInfo' })
  @UseGuards(AuthGuard)
  async getRecordingInfo(
    @Args('input') input: GetRecordingInput,
    @AuthMember() user: Member,
  ) {
    try {
      const result = await this.recordingService.getRecordingInfo(
        input,
        user._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_RECORDING_INFO] Failed - Meeting ID: ${input.meetingId}, User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => RecordingStats, { name: 'getRecordingStats' })
  @UseGuards(AuthGuard)
  async getRecordingStats(@AuthMember() user: Member) {
    try {
      const result = await this.recordingService.getRecordingStats(user._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_RECORDING_STATS] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }
}
