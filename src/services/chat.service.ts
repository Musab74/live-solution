import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChatMessage,
  ChatMessageDocument,
} from '../schemas/Chat.message.model';
import { Meeting, MeetingDocument } from '../schemas/Meeting.model';
import { Member, MemberDocument } from '../schemas/Member.model';
import { Participant, ParticipantDocument } from '../schemas/Participant.model';
import { SystemRole } from '../libs/enums/enums';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name)
    private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Participant.name) private participantModel: Model<ParticipantDocument>,
  ) {}

  // WebSocket methods for real-time chat
  async createMessage(data: {
    meetingId: string;
    text: string;
    displayName: string;
    userId: string;
    replyToMessageId?: string;
  }): Promise<any> {
    const message = new this.chatMessageModel({
      meetingId: new Types.ObjectId(data.meetingId),
      text: data.text,
      displayName: data.displayName,
      userId: new Types.ObjectId(data.userId),
      replyToMessageId: data.replyToMessageId ? new Types.ObjectId(data.replyToMessageId) : undefined,
      createdAt: new Date(),
    });

    const savedMessage = await message.save();
    return savedMessage;
  }

  async deleteMessageById(messageId: string): Promise<boolean> {
    const result = await this.chatMessageModel.findByIdAndDelete(messageId);
    return !!result;
  }

  async getMessageByIdSimple(messageId: string): Promise<any> {
    return await this.chatMessageModel.findById(messageId).lean();
  }

  // WebSocket method to get messages by meeting ID (simplified for real-time chat)
  async getMessagesByMeeting(meetingId: string): Promise<any[]> {
    try {
      const messages = await this.chatMessageModel
        .find({ meetingId: new Types.ObjectId(meetingId) })
        .sort({ createdAt: 1 }) // Sort by creation time, oldest first
        .lean()
        .exec();

      return messages.map(message => ({
        _id: message._id.toString(),
        meetingId: message.meetingId.toString(),
        text: message.text,
        displayName: message.displayName,
        userId: message.userId.toString(),
        replyToMessageId: message.replyToMessageId?.toString(),
        createdAt: message.createdAt.toISOString(),
      }));
    } catch (error) {
      console.error('Error fetching messages by meeting:', error);
      return [];
    }
  }

  // Check if user has access to meeting chat
  async checkMeetingAccess(meetingId: string, userId: string, userRole: SystemRole): Promise<boolean> {
    try {
      // Verify meeting exists
      const meeting = await this.meetingModel.findById(meetingId);
      if (!meeting) {
        return false;
      }

      // Check if user has access to this meeting
      if (userRole === SystemRole.ADMIN || meeting.hostId.toString() === userId) {
        return true;
      }

      // Check if user is a participant in this meeting
      const isParticipant = await this.participantModel.findOne({
        meetingId: new Types.ObjectId(meetingId),
        userId: new Types.ObjectId(userId),
        status: { $in: ['WAITING', 'APPROVED', 'ADMITTED'] }
      });

      return !!isParticipant;
    } catch (error) {
      console.error('Error checking meeting access:', error);
      return false;
    }
  }
}




