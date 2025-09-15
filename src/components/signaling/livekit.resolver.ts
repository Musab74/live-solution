import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Member } from '../../schemas/Member.model';
import { SystemRole } from '../../libs/enums/enums';
import { 
  GenerateTokenInput,
  CreateRoomInput,
  MuteParticipantInput,
  KickParticipantInput,
  UpdateParticipantMetadataInput,
  StartRecordingInput,
  StopRecordingInput
} from '../../libs/DTO/signaling/livekit.input';
import { 
  LivekitTokenResponse,
  RoomInfo,
  ParticipantInfo,
  RoomStats,
  RecordingInfo,
  LivekitResponse
} from '../../libs/DTO/signaling/livekit.query';

@Resolver()
export class LivekitResolver {
  constructor(private readonly livekitService: LivekitService) {}

  // ==================== QUERIES ====================

  @Query(() => LivekitTokenResponse, { name: 'generateLivekitToken' })
  @UseGuards(AuthGuard)
  async generateLivekitToken(
    @Args('input') tokenInput: GenerateTokenInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    const { roomName, participantName, participantId, canPublish = true, canSubscribe = true, canPublishData = true } = tokenInput;
    
    // Get meeting info to verify access
    // This would typically involve checking if user has access to the meeting
    const token = await this.livekitService.generateAccessToken(
      roomName,
      participantName,
      participantId,
      user.systemRole,
      user._id, // Assuming user is the host for now
      canPublish,
      canSubscribe,
      canPublishData,
    );

    const wsUrl = this.livekitService['wsUrl'];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      token,
      wsUrl,
      roomName,
      participantName,
      participantId,
      expiresAt,
    };
  }

  @Query(() => RoomInfo, { name: 'getLivekitRoomInfo' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async getLivekitRoomInfo(
    @Args('roomName') roomName: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.livekitService.getRoomInfo(roomName);
  }

  @Query(() => [ParticipantInfo], { name: 'getLivekitRoomParticipants' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async getLivekitRoomParticipants(
    @Args('roomName') roomName: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.livekitService.getRoomParticipants(roomName);
  }

  @Query(() => RoomStats, { name: 'getLivekitRoomStats' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async getLivekitRoomStats(
    @Args('roomName') roomName: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.livekitService.getRoomStats(roomName);
  }

  @Query(() => [RecordingInfo], { name: 'getLivekitRecordings' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async getLivekitRecordings(
    @Args('roomName', { nullable: true }) roomName: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.livekitService.listRecordings(roomName);
  }

  @Query(() => RecordingInfo, { name: 'getLivekitRecordingInfo' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async getLivekitRecordingInfo(
    @Args('recordingSid') recordingSid: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.livekitService.getRecordingInfo(recordingSid);
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => RoomInfo, { name: 'createLivekitRoom' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async createLivekitRoom(
    @Args('input') createInput: CreateRoomInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.livekitService.createRoom(createInput.roomName, createInput.maxParticipants);
  }

  @Mutation(() => LivekitResponse, { name: 'deleteLivekitRoom' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async deleteLivekitRoom(
    @Args('roomName') roomName: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    await this.livekitService.deleteRoom(roomName);
    return {
      success: true,
      message: 'Room deleted successfully',
    };
  }

  @Mutation(() => LivekitResponse, { name: 'muteLivekitParticipant' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async muteLivekitParticipant(
    @Args('input') muteInput: MuteParticipantInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    await this.livekitService.muteParticipant(
      muteInput.roomName,
      muteInput.participantId,
      muteInput.trackSid,
      muteInput.muted,
    );
    return {
      success: true,
      message: `Participant ${muteInput.muted ? 'muted' : 'unmuted'} successfully`,
    };
  }

  @Mutation(() => LivekitResponse, { name: 'kickLivekitParticipant' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async kickLivekitParticipant(
    @Args('input') kickInput: KickParticipantInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    await this.livekitService.kickParticipant(
      kickInput.roomName,
      kickInput.participantId,
      kickInput.reason,
    );
    return {
      success: true,
      message: 'Participant kicked successfully',
    };
  }

  @Mutation(() => LivekitResponse, { name: 'updateLivekitParticipantMetadata' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async updateLivekitParticipantMetadata(
    @Args('input') updateInput: UpdateParticipantMetadataInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    await this.livekitService.updateParticipantMetadata(
      updateInput.roomName,
      updateInput.participantId,
      updateInput.metadata,
    );
    return {
      success: true,
      message: 'Participant metadata updated successfully',
    };
  }

  @Mutation(() => LivekitResponse, { name: 'startLivekitRecording' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async startLivekitRecording(
    @Args('input') recordingInput: StartRecordingInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    const recordingSid = await this.livekitService.startRecording(
      recordingInput.roomName,
      recordingInput.outputPath,
    );
    return {
      success: true,
      message: 'Recording started successfully',
      data: recordingSid,
    };
  }

  @Mutation(() => LivekitResponse, { name: 'stopLivekitRecording' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async stopLivekitRecording(
    @Args('input') stopInput: StopRecordingInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    await this.livekitService.stopRecording(stopInput.recordingSid);
    return {
      success: true,
      message: 'Recording stopped successfully',
    };
  }
}
