import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../../libs/enums/enums';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import {
  StartRecordingInput,
  StopRecordingInput,
} from '../../libs/DTO/signaling/livekit.input';
import { RecordingInfo } from '../../libs/DTO/signaling/livekit.query';

@Resolver()
export class LivekitResolver {
  private readonly logger = new Logger(LivekitResolver.name);

  constructor(private readonly lk: LivekitService) {}

  @UseGuards(AuthGuard)
  @Mutation(() => String, { name: 'createLivekitToken' })
  async createLivekitToken(
    @Args('meetingId') meetingId: string,
    @AuthMember() me: any,
  ) {
    this.logger.log(
      `[CREATE_LIVEKIT_TOKEN] Attempt - Meeting ID: ${meetingId}, User ID: ${me._id}, Email: ${me.email}, Display Name: ${me.displayName}`,
    );
    try {
      // 1) verify member can join the meeting & load meetingRole (HOST/CO_HOST/…)
      const meetingRole = await /* participantsService */ Promise.resolve(
        'PARTICIPANT' as const,
      );

      const token = this.lk.generateAccessToken({
        room: meetingId,
        identity: String(me._id),
        name: me.displayName,
        meetingRole,
      });

      const result = JSON.stringify({ wsUrl: this.lk.getWsUrl(), token });
      this.logger.log(
        `[CREATE_LIVEKIT_TOKEN] Success - Meeting ID: ${meetingId}, User ID: ${me._id}, Meeting Role: ${meetingRole}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[CREATE_LIVEKIT_TOKEN] Failed - Meeting ID: ${meetingId}, User ID: ${me._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  @Mutation(() => String, { name: 'endLivekitRoom' })
  async endLivekitRoom(@Args('meetingId') meetingId: string) {
    await this.lk.deleteRoom(meetingId);
    return JSON.stringify({ success: true, message: 'Room ended successfully' });
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  @Mutation(() => String, { name: 'kickLivekitParticipant' })
  async kickLivekitParticipant(
    @Args('meetingId') meetingId: string,
    @Args('identity') identity: string,
  ) {
    await this.lk.removeParticipant(meetingId, identity);
    return JSON.stringify({ success: true, message: 'Participant kicked successfully' });
  }

  // Recording mutations
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  @Mutation(() => String, { name: 'startRecording' })
  async startRecording(
    @Args('input') input: StartRecordingInput,
    @AuthMember() me: any,
  ) {
    this.logger.log(
      `[START_RECORDING] Attempt - Room: ${input.roomName}, User ID: ${me._id}, Email: ${me.email}`,
    );
    try {
      const recordingId = await this.lk.startRecording(
        input.roomName,
        input.outputPath || `recordings/${input.roomName}_${Date.now()}.mp4`,
      );
      this.logger.log(
        `[START_RECORDING] Success - Room: ${input.roomName}, Recording ID: ${recordingId}, User ID: ${me._id}`,
      );
      return recordingId;
    } catch (error) {
      this.logger.error(
        `[START_RECORDING] Failed - Room: ${input.roomName}, User ID: ${me._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  @Mutation(() => String, { name: 'stopRecording' })
  async stopRecording(
    @Args('input') input: StopRecordingInput,
    @AuthMember() me: any,
  ) {
    this.logger.log(
      `[STOP_RECORDING] Attempt - Recording ID: ${input.recordingSid}, User ID: ${me._id}, Email: ${me.email}`,
    );
    try {
      await this.lk.stopRecording(input.recordingSid);
      this.logger.log(
        `[STOP_RECORDING] Success - Recording ID: ${input.recordingSid}, User ID: ${me._id}`,
      );
      return JSON.stringify({ success: true, message: 'Recording stopped successfully' });
    } catch (error) {
      this.logger.error(
        `[STOP_RECORDING] Failed - Recording ID: ${input.recordingSid}, User ID: ${me._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  @Query(() => RecordingInfo, { name: 'getRecording' })
  async getRecording(
    @Args('recordingSid') recordingSid: string,
    @AuthMember() me: any,
  ) {
    this.logger.log(
      `[GET_RECORDING] Attempt - Recording ID: ${recordingSid}, User ID: ${me._id}, Email: ${me.email}`,
    );
    try {
      const recording = await this.lk.getRecording(recordingSid);
      this.logger.log(
        `[GET_RECORDING] Success - Recording ID: ${recordingSid}, User ID: ${me._id}`,
      );
      return recording;
    } catch (error) {
      this.logger.error(
        `[GET_RECORDING] Failed - Recording ID: ${recordingSid}, User ID: ${me._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  @Query(() => [RecordingInfo], { name: 'listRecordings' })
  async listRecordings(
    @AuthMember() me: any,
    @Args('roomName', { nullable: true }) roomName?: string,
  ) {
    this.logger.log(
      `[LIST_RECORDINGS] Attempt - Room: ${roomName || 'all'}, User ID: ${me._id}, Email: ${me.email}`,
    );
    try {
      const recordings = await this.lk.listRecordings(roomName);
      this.logger.log(
        `[LIST_RECORDINGS] Success - Room: ${roomName || 'all'}, Count: ${recordings.length}, User ID: ${me._id}`,
      );
      return recordings;
    } catch (error) {
      this.logger.error(
        `[LIST_RECORDINGS] Failed - Room: ${roomName || 'all'}, User ID: ${me._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }
}
