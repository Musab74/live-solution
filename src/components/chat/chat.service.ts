import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from '../../schemas/Chat.message.model';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { 
  ChatHistoryInput, 
  ChatSearchInput, 
  DeleteMessageInput 
} from '../../libs/DTO/chat/chat.input';
import { SystemRole } from '../../libs/enums/enums';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  async getChatHistory(historyInput: ChatHistoryInput, userId: string, userRole: SystemRole): Promise<any> {
    const { meetingId, before, limit = 50 } = historyInput;

    // Verify meeting exists and user has access
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user has access to this meeting
    if (userRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
      // Check if user is a participant in this meeting
      const isParticipant = await this.chatMessageModel.findOne({
        meetingId: new Types.ObjectId(meetingId),
        userId: new Types.ObjectId(userId)
      });
      
      if (!isParticipant) {
        throw new ForbiddenException('You can only view chat history for meetings you are part of');
      }
    }

    // Build query for pagination
    const query: any = { meetingId: new Types.ObjectId(meetingId) };
    
    if (before) {
      const beforeMessage = await this.chatMessageModel.findById(before);
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    // Get messages with user details
    const messages = await this.chatMessageModel
      .find(query)
      .populate('userId', 'displayName avatarUrl')
      .populate('replyToMessageId', 'text displayName createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Get total count for this meeting
    const total = await this.chatMessageModel.countDocuments({ meetingId: new Types.ObjectId(meetingId) });

    // Check if there are more messages
    const hasMore = messages.length === limit;

    // Get next cursor (oldest message ID in current batch)
    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1]._id.toString() : null;

    // Format response with populated data
    const messagesWithDetails = messages.map(message => {
      const userData = message.userId && typeof message.userId === 'object' ? {
        _id: (message.userId as any)._id,
        displayName: (message.userId as any).displayName,
        avatarUrl: (message.userId as any).avatarUrl,
      } : null;

      const replyData = message.replyToMessageId && typeof message.replyToMessageId === 'object' ? {
        _id: (message.replyToMessageId as any)._id,
        text: (message.replyToMessageId as any).text,
        displayName: (message.replyToMessageId as any).displayName,
        createdAt: (message.replyToMessageId as any).createdAt,
      } : null;

      return {
        ...message,
        user: userData,
        replyToMessage: replyData,
      };
    });

    return {
      messages: messagesWithDetails,
      hasMore,
      total,
      limit,
      nextCursor,
    };
  }

  async searchMessages(searchInput: ChatSearchInput, userId: string, userRole: SystemRole): Promise<any> {
    const { meetingId, q, limit = 20, offset = 0 } = searchInput;

    // Verify meeting exists and user has access
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user has access to this meeting (HOST/CO_HOST/ADMIN only for search)
    if (userRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
      throw new ForbiddenException('Only meeting hosts and administrators can search messages');
    }

    // Build search query
    const searchQuery = {
      meetingId: new Types.ObjectId(meetingId),
      $text: { $search: q }
    };

    // Get search results with user details
    const messages = await this.chatMessageModel
      .find(searchQuery)
      .populate('userId', 'displayName avatarUrl')
      .populate('replyToMessageId', 'text displayName createdAt')
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    // Get total count for search
    const total = await this.chatMessageModel.countDocuments(searchQuery);

    // Format response with populated data
    const messagesWithDetails = messages.map(message => {
      const userData = message.userId && typeof message.userId === 'object' ? {
        _id: (message.userId as any)._id,
        displayName: (message.userId as any).displayName,
        avatarUrl: (message.userId as any).avatarUrl,
      } : null;

      const replyData = message.replyToMessageId && typeof message.replyToMessageId === 'object' ? {
        _id: (message.replyToMessageId as any)._id,
        text: (message.replyToMessageId as any).text,
        displayName: (message.replyToMessageId as any).displayName,
        createdAt: (message.replyToMessageId as any).createdAt,
      } : null;

      return {
        ...message,
        user: userData,
        replyToMessage: replyData,
      };
    });

    return {
      messages: messagesWithDetails,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      query: q,
    };
  }

  async deleteMessage(deleteInput: DeleteMessageInput, userId: string, userRole: SystemRole): Promise<any> {
    const { messageId } = deleteInput;

    // Find the message
    const message = await this.chatMessageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Get meeting details
    const meeting = await this.meetingModel.findById(message.meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check permissions (HOST/CO_HOST/ADMIN only)
    if (userRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
      throw new ForbiddenException('Only meeting hosts and administrators can delete messages');
    }

    // Delete the message
    await this.chatMessageModel.findByIdAndDelete(messageId);

    return {
      success: true,
      message: 'Message deleted successfully',
      messageId: messageId,
    };
  }

  async getChatStats(meetingId: string, userId: string, userRole: SystemRole): Promise<any> {
    // Verify meeting exists and user has access
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user has access to this meeting
    if (userRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
      throw new ForbiddenException('You can only view chat stats for meetings you host');
    }

    const meetingObjectId = new Types.ObjectId(meetingId);

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalMessages,
      messagesToday,
      activeUsersResult,
      averageMessagesPerUserResult
    ] = await Promise.all([
      this.chatMessageModel.countDocuments({ meetingId: meetingObjectId }),
      this.chatMessageModel.countDocuments({ 
        meetingId: meetingObjectId,
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      this.chatMessageModel.aggregate([
        { $match: { meetingId: meetingObjectId, userId: { $exists: true } } },
        { $group: { _id: '$userId' } },
        { $count: 'activeUsers' }
      ]),
      this.chatMessageModel.aggregate([
        { $match: { meetingId: meetingObjectId, userId: { $exists: true } } },
        { $group: { _id: '$userId', messageCount: { $sum: 1 } } },
        { $group: { _id: null, avgMessages: { $avg: '$messageCount' } } }
      ])
    ]);

    return {
      totalMessages,
      messagesToday,
      activeUsers: activeUsersResult.length > 0 ? activeUsersResult[0].activeUsers : 0,
      averageMessagesPerUser: averageMessagesPerUserResult.length > 0 
        ? Math.round(averageMessagesPerUserResult[0].avgMessages) 
        : 0,
    };
  }

  async getMessageById(messageId: string, userId: string, userRole: SystemRole): Promise<any> {
    const message = await this.chatMessageModel
      .findById(messageId)
      .populate('userId', 'displayName avatarUrl')
      .populate('replyToMessageId', 'text displayName createdAt')
      .lean();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Get meeting details for permission check
    const meeting = await this.meetingModel.findById(message.meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user has access to this meeting
    if (userRole !== SystemRole.ADMIN && meeting.hostId.toString() !== userId) {
      // Check if user is a participant in this meeting
      const isParticipant = await this.chatMessageModel.findOne({
        meetingId: message.meetingId,
        userId: new Types.ObjectId(userId)
      });
      
      if (!isParticipant) {
        throw new ForbiddenException('You can only view messages from meetings you are part of');
      }
    }

    const userData = message.userId && typeof message.userId === 'object' ? {
      _id: (message.userId as any)._id,
      displayName: (message.userId as any).displayName,
      avatarUrl: (message.userId as any).avatarUrl,
    } : null;

    const replyData = message.replyToMessageId && typeof message.replyToMessageId === 'object' ? {
      _id: (message.replyToMessageId as any)._id,
      text: (message.replyToMessageId as any).text,
      displayName: (message.replyToMessageId as any).displayName,
      createdAt: (message.replyToMessageId as any).createdAt,
    } : null;

    return {
      ...message,
      user: userData,
      replyToMessage: replyData,
    };
  }
}