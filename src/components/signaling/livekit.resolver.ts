import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../../libs/enums/enums';
import { AuthMember } from '../auth/decorators/authMember.decorator';

@Resolver()
export class LivekitResolver {
  constructor(private readonly lk: LivekitService) {}

  @UseGuards(AuthGuard)
  @Mutation(() => String, { name: 'createLivekitToken' })
  async createLivekitToken(
    @Args('meetingId') meetingId: string,
    @AuthMember() me: any,
  ) {
    // 1) verify member can join the meeting & load meetingRole (HOST/CO_HOST/…)
    const meetingRole = await /* participantsService */ Promise.resolve('PARTICIPANT' as const);

    const token = this.lk.generateAccessToken({
      room: meetingId,
      identity: String(me._id),
      name: me.displayName,
      meetingRole,
    });

    // Return JSON string or create a proper GraphQL type
    return JSON.stringify({ wsUrl: this.lk.getWsUrl(), token });
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