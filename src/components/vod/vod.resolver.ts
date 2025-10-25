import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { VodService } from './vod.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Member } from '../../schemas/Member.model';
import { SystemRole } from '../../libs/enums/enums';
import {
  CreateVodFileInput,
  CreateVodUrlInput,
  UpdateVodInput,
  VodQueryInput,
} from '../../libs/DTO/vod/vod.input';
import {
  VodWithMeeting,
  VodListResponse,
  VodStats,
  VodUploadResponse,
  VodUrlResponse,
} from '../../libs/DTO/vod/vod.query';
import { ParticipantMessageResponse } from '../../libs/DTO/participant/participant.mutation';
// GraphQL upload disabled due to ES module compatibility issues
// import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
// import Upload from 'graphql-upload/Upload.mjs';

@Resolver()
export class VodResolver {
  private readonly logger = new Logger(VodResolver.name);

  constructor(private readonly vodService: VodService) {}

  // ==================== QUERIES ====================

  @Query(() => VodListResponse, { name: 'getAllVods' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  async getAllVods(
    @Args('input', { nullable: true }) queryInput: VodQueryInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    try {
      const result = await this.vodService.getAllVods(
        queryInput || {},
        user._id,
        user.systemRole,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_ALL_VODS] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => VodWithMeeting, { name: 'getVodById' })
  @UseGuards(AuthGuard)
  async getVodById(
    @Args('vodId', { type: () => ID }) vodId: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.vodService.getVodById(vodId, user._id, user.systemRole);
  }

  @Query(() => VodStats, { name: 'getVodStats' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  async getVodStats(@AuthMember() user: Member) {
    return this.vodService.getVodStats(user._id, user.systemRole);
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => VodUploadResponse, { name: 'uploadVodFile' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  async uploadVodFile(
    @Args('input') createInput: CreateVodFileInput,
    @Args('file', { type: () => String }) file: string,
    @AuthMember() user: Member,
  ) {
    return this.vodService.createVodFromFile(
      createInput,
      file,
      user._id,
      user.systemRole,
    );
  }

  @Mutation(() => VodUrlResponse, { name: 'createVodUrl' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  async createVodUrl(
    @Args('input') createInput: CreateVodUrlInput,
    @AuthMember() user: Member,
  ) {
    return this.vodService.createVodFromUrl(
      createInput,
      user._id,
      user.systemRole,
    );
  }

  @Mutation(() => VodWithMeeting, { name: 'createVOD' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  async createVOD(
    @Args('input') createInput: CreateVodFileInput,
    @AuthMember() user: Member,
  ) {
    return this.vodService.createVodFromFile(
      createInput,
      null,
      user._id,
      user.systemRole,
    );
  }

  @Mutation(() => VodWithMeeting, { name: 'updateVod' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.TUTOR)
  async updateVod(
    @Args('input') updateInput: UpdateVodInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.vodService.updateVod(updateInput, user._id, user.systemRole);
  }

  @Mutation(() => ParticipantMessageResponse, { name: 'deleteVod' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  async deleteVod(
    @Args('vodId', { type: () => ID }) vodId: string,
    @AuthMember() user: Member,
  ) {
    return this.vodService.deleteVod(vodId, user._id, user.systemRole);
  }
}
