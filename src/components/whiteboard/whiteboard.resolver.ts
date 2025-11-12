import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { WhiteboardService } from './whiteboard.service';
import { WhiteboardStatusResponse } from '../../libs/DTO/whiteboard/whiteboard.query';
import { CanUseWhiteboardInput } from '../../libs/DTO/whiteboard/whiteboard.input';

@Resolver()
export class WhiteboardResolver {
  constructor(private readonly whiteboardService: WhiteboardService) {}

  @Query(() => Boolean, { name: 'canUseWhiteboard' })
  @UseGuards(AuthGuard, RolesGuard)
  async canUseWhiteboard(
    @Args('input') input: CanUseWhiteboardInput,
    @AuthMember() user: any,
  ): Promise<boolean> {
    return this.whiteboardService.canUseWhiteboard(input.meetingId, user._id);
  }

  @Query(() => WhiteboardStatusResponse, { name: 'getWhiteboardStatus' })
  @UseGuards(AuthGuard)
  async getWhiteboardStatus(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: any,
  ): Promise<WhiteboardStatusResponse> {
    const status = await this.whiteboardService.getWhiteboardStatus(meetingId);
    return {
      isActive: status.isActive,
      hostId: status.hostId,
      startedAt: status.startedAt,
    };
  }
}



