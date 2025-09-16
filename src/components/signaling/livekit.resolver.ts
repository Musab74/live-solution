import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../../libs/enums/enums';
import { AuthMember } from '../auth/decorators/authMember.decorator';

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
    this.logger.log(`[CREATE_LIVEKIT_TOKEN] Attempt - Meeting ID: ${meetingId}, User ID: ${me._id}, Email: ${me.email}, Display Name: ${me.displayName}`);
    try {
      // 1) verify member can join the meeting & load meetingRole (HOST/CO_HOST/…)
      const meetingRole = await /* participantsService */ Promise.resolve('PARTICIPANT' as const);

      const token = this.lk.generateAccessToken({
        room: meetingId,
        identity: String(me._id),
        name: me.displayName,
        meetingRole,
      });

      const result = JSON.stringify({ wsUrl: this.lk.getWsUrl(), token });
      this.logger.log(`[CREATE_LIVEKIT_TOKEN] Success - Meeting ID: ${meetingId}, User ID: ${me._id}, Meeting Role: ${meetingRole}`);
      return result;
    } catch (error) {
      this.logger.error(`[CREATE_LIVEKIT_TOKEN] Failed - Meeting ID: ${meetingId}, User ID: ${me._id}, Error: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(AuthGuard, RolesGuard) @Roles(SystemRole.ADMIN)
  @Mutation(() => Boolean) async endLivekitRoom(@Args('meetingId') meetingId: string) {
    await this.lk.deleteRoom(meetingId); return true;
  }

  @UseGuards(AuthGuard, RolesGuard) @Roles(SystemRole.ADMIN)
  @Mutation(() => Boolean) async kickLivekitParticipant(
    @Args('meetingId') meetingId: string,
    @Args('identity') identity: string,
  ) { await this.lk.removeParticipant(meetingId, identity); return true; }
}