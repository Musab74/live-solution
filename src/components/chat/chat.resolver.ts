import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Member } from '../../schemas/Member.model';
import { SystemRole } from '../../libs/enums/enums';
import {
  ChatHistoryInput,
  ChatSearchInput,
  DeleteMessageInput,
} from '../../libs/DTO/chat/chat.input';
import {
  ChatHistoryResponse,
  ChatSearchResponse,
  ChatStats,
  ChatMessageWithDetails,
  ChatMessageResponse,
} from '../../libs/DTO/chat/chat.query';

@Resolver()
export class ChatResolver {
  private readonly logger = new Logger(ChatResolver.name);

  constructor(private readonly chatService: ChatService) {}

  // ==================== QUERIES ====================

  @Query(() => ChatHistoryResponse, { name: 'getChatHistory' })
  @UseGuards(AuthGuard)
  async getChatHistory(
    @Args('input') historyInput: ChatHistoryInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.chatService.getChatHistory(
      historyInput,
      user._id,
      user.systemRole,
    );
  }

  @Query(() => ChatSearchResponse, { name: 'searchChatMessages' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async searchChatMessages(
    @Args('input') searchInput: ChatSearchInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.chatService.searchMessages(
      searchInput,
      user._id,
      user.systemRole,
    );
  }

  @Query(() => ChatStats, { name: 'getChatStats' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async getChatStats(
    @Args('meetingId', { type: () => ID }) meetingId: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.chatService.getChatStats(meetingId, user._id, user.systemRole);
  }

  @Query(() => ChatMessageWithDetails, { name: 'getChatMessageById' })
  @UseGuards(AuthGuard)
  async getChatMessageById(
    @Args('messageId', { type: () => ID }) messageId: string,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.chatService.getMessageById(
      messageId,
      user._id,
      user.systemRole,
    );
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => ChatMessageResponse, { name: 'deleteChatMessage' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN, SystemRole.MEMBER)
  async deleteChatMessage(
    @Args('input') deleteInput: DeleteMessageInput,
    @AuthMember() user: Member,
  ): Promise<any> {
    return this.chatService.deleteMessage(
      deleteInput,
      user._id,
      user.systemRole,
    );
  }
}
