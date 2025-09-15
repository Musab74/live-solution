import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { MemberService } from './member.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import { Member } from '../../schemas/Member.model';
import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';
import { MemberInput } from '../../libs/DTO/member/member.input';
import { UpdateMemberInput } from '../../libs/DTO/member/member.update';

@ObjectType()
export class AuthResponse {
  @Field()
  token: string;

  @Field(() => Member)
  user: Member;
}

@InputType()
export class LoginInputType {
  @Field()
  email: string;

  @Field()
  password: string;
}

@InputType()
export class ChangePasswordInputType {
  @Field()
  currentPassword: string;

  @Field()
  newPassword: string;
}

@ObjectType()
export class MessageResponse {
  @Field()
  message: string;
}

@Resolver()
export class MemberResolver {
  constructor(private readonly memberService: MemberService) {}

  @Mutation(() => AuthResponse, { name: 'signup' })
  async signup(@Args('input') memberInput: MemberInput) {
    return this.memberService.signup(memberInput);
  }

  @Mutation(() => AuthResponse, { name: 'login' })
  async login(
    @Args('email') email: string,
    @Args('password') password: string,
  ) {
    return this.memberService.login({ email, password });
  }

  @Query(() => Member, { name: 'me' })
  @UseGuards(AuthGuard)
  async getProfile(@AuthMember() user: Member) {
    return this.memberService.getProfile(user._id);
  }

  @Mutation(() => Member, { name: 'updateProfile' })
  @UseGuards(AuthGuard)
  async updateProfile(
    @AuthMember() user: Member,
    @Args('input') updateData: UpdateMemberInput,
  ) {
    return this.memberService.updateProfile(user._id, updateData);
  }

  @Mutation(() => MessageResponse, { name: 'changePassword' })
  @UseGuards(AuthGuard)
  async changePassword(
    @AuthMember() user: Member,
    @Args('input') input: ChangePasswordInputType,
  ) {
    const result = await this.memberService.changePassword(user._id, input.currentPassword, input.newPassword);
    return result;
  }

  @Query(() => [Member], { name: 'members' })
  @UseGuards(AuthGuard)
  async getAllMembers() {
    return this.memberService.getAllMembers();
  }

  @Mutation(() => MessageResponse, { name: 'deleteMember' })
  @UseGuards(AuthGuard)
  async deleteMember(@Args('userId', { type: () => ID }) userId: string) {
    const result = await this.memberService.deleteMember(userId);
    return result;
  }
}