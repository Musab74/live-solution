import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { MemberService } from './member.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UseGuards, Logger } from '@nestjs/common';
import { Member } from '../../schemas/Member.model';
import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';
import { MemberInput } from '../../libs/DTO/member/member.input';
import { UpdateMemberInput } from '../../libs/DTO/member/member.update';
import { LoginInput } from '../../libs/DTO/auth/login.input';

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

@ObjectType()
export class LogoutResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field()
  timestamp: string;
}

@ObjectType()
export class ImageUploadResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field(() => Member)
  user: Member;
}

@Resolver()
export class MemberResolver {
  private readonly logger = new Logger(MemberResolver.name);

  constructor(private readonly memberService: MemberService) {}

  @Mutation(() => AuthResponse, { name: 'signup' })
  async signup(@Args('input') memberInput: MemberInput) {
    try {
      const result = await this.memberService.signup(memberInput);
      return result;
    } catch (error) {
      this.logger.error(
        `[SIGNUP] Failed - Email: ${memberInput.email}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => AuthResponse, { name: 'login' })
  async login(
    @Args('email') email: string,
    @Args('password') password: string,
  ) {
    try {
      const result = await this.memberService.login({ email, password });
      return result;
    } catch (error) {
      this.logger.error(
        `[LOGIN] Failed - Email: ${email}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => Member, { name: 'me' })
  @UseGuards(AuthGuard)
  async getProfile(@AuthMember() user: Member) {
    try {
      const result = await this.memberService.getProfile(user._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[GET_PROFILE] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => Member, { name: 'updateProfile' })
  @UseGuards(AuthGuard)
  async updateProfile(
    @AuthMember() user: Member,
    @Args('input') updateData: UpdateMemberInput,
  ) {
    try {
      const result = await this.memberService.updateProfile(
        user._id,
        updateData,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[UPDATE_PROFILE] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MessageResponse, { name: 'changePassword' })
  @UseGuards(AuthGuard)
  async changePassword(
    @AuthMember() user: Member,
    @Args('input') input: ChangePasswordInputType,
  ) {
    try {
      const result = await this.memberService.changePassword(
        user._id,
        input.currentPassword,
        input.newPassword,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[CHANGE_PASSWORD] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => [Member], { name: 'members' })
  @UseGuards(AuthGuard)
  async getAllMembers() {
    try {
      const result = await this.memberService.getAllMembers();
      return result;
    } catch (error) {
      this.logger.error(`[GET_ALL_MEMBERS] Failed - Error: ${error.message}`);
      throw error;
    }
  }

  @Mutation(() => MessageResponse, { name: 'deleteMember' })
  @UseGuards(AuthGuard)
  async deleteMember(@Args('userId', { type: () => ID }) userId: string) {
    try {
      const result = await this.memberService.deleteMember(userId);
      return result;
    } catch (error) {
      this.logger.error(
        `[DELETE_MEMBER] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => LogoutResponse, { name: 'logout' })
  @UseGuards(AuthGuard)
  async logout(@AuthMember() user: Member) {
    try {
      const result = await this.memberService.logout(user._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[LOGOUT] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ImageUploadResponse, { name: 'uploadProfileImage' })
  @UseGuards(AuthGuard)
  async uploadProfileImage(
    @Args('file', { type: () => String }) file: any,
    @AuthMember() user: Member,
  ) {
    try {
      // Log file object structure for debugging

      const result = await this.memberService.uploadProfileImage(
        user._id,
        file,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[UPLOAD_PROFILE_IMAGE] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ImageUploadResponse, { name: 'deleteProfileImage' })
  @UseGuards(AuthGuard)
  async deleteProfileImage(@AuthMember() user: Member) {
    try {
      const result = await this.memberService.deleteProfileImage(user._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[DELETE_PROFILE_IMAGE] Failed - User ID: ${user._id}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ImageUploadResponse, { name: 'promoteUserRole' })
  @UseGuards(AuthGuard)
  async promoteUserRole(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('newRole') newRole: string,
    @AuthMember() admin: Member,
  ) {
    try {
      const result = await this.memberService.promoteUserRole(
        userId,
        newRole as any,
        admin._id,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[PROMOTE_USER_ROLE] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MessageResponse, { name: 'deleteUser' })
  @UseGuards(AuthGuard)
  async deleteUser(
    @Args('userId', { type: () => ID }) userId: string,
    @AuthMember() admin: Member,
  ) {
    try {
      const result = await this.memberService.deleteUser(userId, admin._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[DELETE_USER] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ImageUploadResponse, { name: 'blockUser' })
  @UseGuards(AuthGuard)
  async blockUser(
    @Args('userId', { type: () => ID }) userId: string,
    @AuthMember() admin: Member,
    @Args('reason', { nullable: true }) reason?: string,
  ) {
    try {
      const result = await this.memberService.blockUser(
        userId,
        admin._id,
        reason,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[BLOCK_USER] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => ImageUploadResponse, { name: 'unblockUser' })
  @UseGuards(AuthGuard)
  async unblockUser(
    @Args('userId', { type: () => ID }) userId: string,
    @AuthMember() admin: Member,
  ) {
    try {
      const result = await this.memberService.unblockUser(userId, admin._id);
      return result;
    } catch (error) {
      this.logger.error(
        `[UNBLOCK_USER] Failed - User ID: ${userId}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => AuthResponse, { name: 'createFirstAdmin' })
  async createFirstAdmin(@Args('input') adminInput: MemberInput) {
    try {
      const result = await this.memberService.createFirstAdmin(adminInput);
      return result;
    } catch (error) {
      this.logger.error(
        `[CREATE_FIRST_ADMIN] Failed - Email: ${adminInput.email}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => AuthResponse, { name: 'tutorLogin' })
  async tutorLogin(@Args('input') loginInput: LoginInput) {
    try {
      const result = await this.memberService.tutorLogin(loginInput);
      return result;
    } catch (error) {
      this.logger.error(
        `[TUTOR_LOGIN] Failed - Email: ${loginInput.email}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => AuthResponse, { name: 'adminLogin' })
  async adminLogin(@Args('input') loginInput: LoginInput) {
    try {
      const result = await this.memberService.adminLogin(loginInput);
      return result;
    } catch (error) {
      this.logger.error(
        `[ADMIN_LOGIN] Failed - Email: ${loginInput.email}, Error: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => AuthResponse, { name: 'tutorSignup' })
  async tutorSignup(@Args('input') memberInput: MemberInput) {
    try {
      const result = await this.memberService.tutorSignup(memberInput);
      return result;
    } catch (error) {
      this.logger.error(
        `[TUTOR_SIGNUP] Failed - Email: ${memberInput.email}, Error: ${error.message}`,
      );
      throw error;
    }
  }
}
