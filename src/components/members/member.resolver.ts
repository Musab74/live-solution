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
    this.logger.log(
      `[SIGNUP] Attempt - Email: ${memberInput.email}, DisplayName: ${memberInput.displayName}`,
    );
    try {
      const result = await this.memberService.signup(memberInput);
      this.logger.log(
        `[SIGNUP] Success - User ID: ${result.user._id}, Email: ${result.user.email}`,
      );
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
    this.logger.log(`[LOGIN] Attempt - Email: ${email}`);
    try {
      const result = await this.memberService.login({ email, password });
      this.logger.log(
        `[LOGIN] Success - User ID: ${result.user._id}, Email: ${result.user.email}, Role: ${result.user.systemRole}`,
      );
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
    this.logger.log(
      `[GET_PROFILE] Attempt - User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.memberService.getProfile(user._id);
      this.logger.log(
        `[GET_PROFILE] Success - User ID: ${result._id}, Email: ${result.email}`,
      );
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
    this.logger.log(
      `[UPDATE_PROFILE] Attempt - User ID: ${user._id}, Email: ${user.email}, Fields: ${Object.keys(updateData).join(', ')}`,
    );
    try {
      const result = await this.memberService.updateProfile(
        user._id,
        updateData,
      );
      this.logger.log(
        `[UPDATE_PROFILE] Success - User ID: ${result._id}, Email: ${result.email}`,
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
    this.logger.log(
      `[CHANGE_PASSWORD] Attempt - User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.memberService.changePassword(
        user._id,
        input.currentPassword,
        input.newPassword,
      );
      this.logger.log(
        `[CHANGE_PASSWORD] Success - User ID: ${user._id}, Email: ${user.email}`,
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
    this.logger.log(`[GET_ALL_MEMBERS] Attempt`);
    try {
      const result = await this.memberService.getAllMembers();
      this.logger.log(`[GET_ALL_MEMBERS] Success - Count: ${result.length}`);
      return result;
    } catch (error) {
      this.logger.error(`[GET_ALL_MEMBERS] Failed - Error: ${error.message}`);
      throw error;
    }
  }

  @Mutation(() => MessageResponse, { name: 'deleteMember' })
  @UseGuards(AuthGuard)
  async deleteMember(@Args('userId', { type: () => ID }) userId: string) {
    this.logger.log(`[DELETE_MEMBER] Attempt - User ID: ${userId}`);
    try {
      const result = await this.memberService.deleteMember(userId);
      this.logger.log(`[DELETE_MEMBER] Success - User ID: ${userId}`);
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
    this.logger.log(
      `[LOGOUT] Attempt - User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.memberService.logout(user._id);
      this.logger.log(
        `[LOGOUT] Success - User ID: ${user._id}, Email: ${user.email}, Timestamp: ${result.timestamp}`,
      );
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
    this.logger.log(
      `[UPLOAD_PROFILE_IMAGE] Attempt - User ID: ${user._id}, Email: ${user.email}, File: ${file?.originalname || file?.filename || 'unknown'}`,
    );
    try {
      // Log file object structure for debugging
      this.logger.log(
        `[UPLOAD_PROFILE_IMAGE] File object keys: ${Object.keys(file || {}).join(', ')}`,
      );

      const result = await this.memberService.uploadProfileImage(
        user._id,
        file,
      );
      this.logger.log(
        `[UPLOAD_PROFILE_IMAGE] Success - User ID: ${user._id}, Avatar URL: ${result.avatarUrl}`,
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
    this.logger.log(
      `[DELETE_PROFILE_IMAGE] Attempt - User ID: ${user._id}, Email: ${user.email}`,
    );
    try {
      const result = await this.memberService.deleteProfileImage(user._id);
      this.logger.log(
        `[DELETE_PROFILE_IMAGE] Success - User ID: ${user._id}, Email: ${user.email}`,
      );
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
    this.logger.log(
      `[PROMOTE_USER_ROLE] Attempt - User ID: ${userId}, New Role: ${newRole}, Admin ID: ${admin._id}`,
    );
    try {
      const result = await this.memberService.promoteUserRole(
        userId,
        newRole as any,
        admin._id,
      );
      this.logger.log(
        `[PROMOTE_USER_ROLE] Success - User ID: ${userId}, New Role: ${newRole}`,
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
    this.logger.log(
      `[DELETE_USER] Attempt - User ID: ${userId}, Admin ID: ${admin._id}`,
    );
    try {
      const result = await this.memberService.deleteUser(userId, admin._id);
      this.logger.log(`[DELETE_USER] Success - User ID: ${userId}`);
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
    this.logger.log(
      `[BLOCK_USER] Attempt - User ID: ${userId}, Admin ID: ${admin._id}, Reason: ${reason || 'No reason provided'}`,
    );
    try {
      const result = await this.memberService.blockUser(
        userId,
        admin._id,
        reason,
      );
      this.logger.log(`[BLOCK_USER] Success - User ID: ${userId}`);
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
    this.logger.log(
      `[UNBLOCK_USER] Attempt - User ID: ${userId}, Admin ID: ${admin._id}`,
    );
    try {
      const result = await this.memberService.unblockUser(userId, admin._id);
      this.logger.log(`[UNBLOCK_USER] Success - User ID: ${userId}`);
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
    this.logger.log(
      `[CREATE_FIRST_ADMIN] Attempt - Email: ${adminInput.email}`,
    );
    try {
      const result = await this.memberService.createFirstAdmin(adminInput);
      this.logger.log(
        `[CREATE_FIRST_ADMIN] Success - Email: ${adminInput.email}, Role: ADMIN`,
      );
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
    this.logger.log(`[TUTOR_LOGIN] Attempt - Email: ${loginInput.email}`);
    try {
      const result = await this.memberService.tutorLogin(loginInput);
      this.logger.log(
        `[TUTOR_LOGIN] Success - Email: ${loginInput.email}, Role: ${result.user.systemRole}`,
      );
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
    this.logger.log(`[ADMIN_LOGIN] Attempt - Email: ${loginInput.email}`);
    try {
      const result = await this.memberService.adminLogin(loginInput);
      this.logger.log(
        `[ADMIN_LOGIN] Success - Email: ${loginInput.email}, Role: ${result.user.systemRole}`,
      );
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
    this.logger.log(`[TUTOR_SIGNUP] Attempt - Email: ${memberInput.email}`);
    try {
      const result = await this.memberService.tutorSignup(memberInput);
      this.logger.log(
        `[TUTOR_SIGNUP] Success - Email: ${memberInput.email}, Role: TUTOR`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[TUTOR_SIGNUP] Failed - Email: ${memberInput.email}, Error: ${error.message}`,
      );
      throw error;
    }
  }
}
