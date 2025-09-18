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
// import { GraphQLUpload } from 'graphql-upload';

@Resolver()
export class VodResolver {
  private readonly logger = new Logger(VodResolver.name);

  constructor(private readonly vodService: VodService) {}

  // ==================== QUERIES ====================

  @Query(() => VodListResponse, { name: 'getAllVods' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async getAllVods(
    @Args('input', { nullable: true }) queryInput: VodQueryInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    this.logger.log(
      `[GET_ALL_VODS] Attempt - User ID: ${user._id}, Email: ${user.email}, Role: ${user.systemRole}, Query: ${JSON.stringify(queryInput)}`,
    );
    try {
      const result = await this.vodService.getAllVods(
        queryInput || {},
        user._id,
        user.systemRole,
      );
      this.logger.log(
        `[GET_ALL_VODS] Success - User ID: ${user._id}, Count: ${result.vods?.length || 0}`,
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
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async getVodStats(@AuthMember() user: Member) {
    return this.vodService.getVodStats(user._id, user.systemRole);
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => VodUploadResponse, { name: 'uploadVodFile' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async uploadVodFile(
    @Args('input') createInput: CreateVodFileInput,
    @Args('file', { type: () => String }) file: any,
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
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
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

  @Mutation(() => VodWithMeeting, { name: 'updateVod' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
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
