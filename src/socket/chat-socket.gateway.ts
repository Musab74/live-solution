import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MemberService } from '../components/members/member.service';
import { ChatService } from '../components/chat/chat.service';
import { SystemRole } from '../libs/enums/enums';

interface AuthenticatedSocket extends Socket {
  user?: {
    _id: string;
    email: string;
    displayName: string;
    systemRole: SystemRole;
  };
  handshake: any;
  id: string;
}

interface ChatMessage {
  _id: string;
  meetingId: string;
  text: string;
  displayName: string;
  userId: string;
  replyToMessageId?: string;
  createdAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
@Injectable()
export class ChatSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatSocketGateway.name);

  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, AuthenticatedSocket>();
  private roomUsers = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private memberService: MemberService,
    private chatService: ChatService,
  ) { }

  afterInit(server: Server) {
    this.logger.log('Chat WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      this.logger.log(`Chat WebSocket connection attempt - Token present: ${!!token}`);

      if (!token) {
        this.logger.warn('Chat WebSocket connection rejected: No token provided');
        client.emit('ERROR', { message: 'No authentication token provided' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      this.logger.log(`Verifying JWT token: ${token.substring(0, 20)}...`);
      const payload = this.jwtService.verify(token);
      this.logger.log(`JWT payload verified: ${JSON.stringify(payload)}`);

      const user = await this.memberService.getProfile(payload.sub);
      this.logger.log(`User profile retrieved: ${user ? 'Success' : 'Failed'}`);

      if (!user) {
        this.logger.warn(`Chat WebSocket connection rejected: User not found for ID ${payload.sub}`);
        client.emit('ERROR', { message: 'User not found' });
        client.disconnect();
        return;
      }

      client.user = user;
      this.connectedUsers.set(client.id, client);

      this.logger.log(
        `User ${user.displayName} connected to chat with socket ${client.id}`,
      );
    } catch (error) {
      this.logger.error('Chat connection error:', error);
      this.logger.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      client.emit('ERROR', { message: `Authentication failed: ${error.message}` });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.logger.log(`User ${client.user.displayName} disconnected from chat`);

      // Remove from all rooms
      for (const [roomName, users] of this.roomUsers.entries()) {
        if (users.has(client.id)) {
          users.delete(client.id);
          this.server.to(roomName).emit('USER_LEFT_CHAT', {
            userId: client.user._id,
            displayName: client.user.displayName,
            socketId: client.id,
          });
        }
      }

      this.connectedUsers.delete(client.id);
    }
  }

  @SubscribeMessage('JOIN_CHAT_ROOM')
  async handleJoinChatRoom(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { meetingId } = data;

    try {
      // Join socket room
      await client.join(meetingId);

      // Track user in room
      if (!this.roomUsers.has(meetingId)) {
        this.roomUsers.set(meetingId, new Set());
      }
      this.roomUsers.get(meetingId)!.add(client.id);

      // Load existing messages from database
      this.logger.log(`Loading existing messages for meeting ${meetingId}`);
      const existingMessages = await this.chatService.getMessagesByMeeting(meetingId);
      this.logger.log(`Found ${existingMessages.length} existing messages`);

      // Send existing messages to the joining user
      client.emit('CHAT_MESSAGES_LOADED', { messages: existingMessages });
      this.logger.log(
        `Sent ${existingMessages.length} existing messages to ${client.user.displayName}`
      );


      // Get current participants in room
      const roomParticipants = Array.from(this.roomUsers.get(meetingId) || [])
        .map((socketId) => {
          const user = this.connectedUsers.get(socketId);
          return user
            ? {
              userId: user.user!._id,
              displayName: user.user!.displayName,
              socketId,
            }
            : null;
        })
        .filter(Boolean);

      // Notify user of current participants
      client.emit('CHAT_PEER_LIST', { participants: roomParticipants });

      // Notify others that user joined chat
      client.to(meetingId).emit('USER_JOINED_CHAT', {
        userId: client.user._id,
        displayName: client.user.displayName,
        socketId: client.id,
      });

      this.logger.log(`User ${client.user.displayName} joined chat room ${meetingId}`);
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to join chat room' });
    }
  }

  @SubscribeMessage('LEAVE_CHAT_ROOM')
  async handleLeaveChatRoom(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { meetingId } = data;

    // Leave socket room
    await client.leave(meetingId);

    // Remove from room tracking
    const roomUsers = this.roomUsers.get(meetingId);
    if (roomUsers) {
      roomUsers.delete(client.id);
    }

    // Notify others that user left chat
    client.to(meetingId).emit('USER_LEFT_CHAT', {
      userId: client.user._id,
      displayName: client.user.displayName,
      socketId: client.id,
    });

    this.logger.log(`User ${client.user.displayName} left chat room ${meetingId}`);
  }

  @SubscribeMessage('SEND_CHAT_MESSAGE')
  async handleSendChatMessage(
    @MessageBody()
    data: { meetingId: string; message: string; replyToMessageId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { meetingId, message, replyToMessageId } = data;

    this.logger.log(`Received chat message from ${client.user.displayName}: ${message}`);

    try {
      // Save message to database
      const chatMessage = await this.chatService.createMessage({
        meetingId,
        text: message,
        displayName: client.user.displayName,
        userId: client.user._id,
        replyToMessageId,
      });

      this.logger.log(`Message saved to database with ID: ${chatMessage._id}`);

      // Broadcast to room
      const messageData = {
        _id: chatMessage._id.toString(),
        meetingId: chatMessage.meetingId.toString(),
        text: chatMessage.text,
        displayName: chatMessage.displayName,
        userId: chatMessage.userId.toString(),
        replyToMessageId: chatMessage.replyToMessageId?.toString(),
        createdAt: chatMessage.createdAt.toISOString(),
      };

      this.server.to(meetingId).emit('CHAT_MESSAGE', messageData);
      this.logger.log(`Message broadcasted to room ${meetingId}`);

      this.logger.log(
        `Chat message from ${client.user.displayName} in room ${meetingId}`,
      );
    } catch (error) {
      this.logger.error('Error sending chat message:', error);
      this.logger.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      client.emit('ERROR', { message: 'Failed to send chat message' });
    }
  }

  @SubscribeMessage('DELETE_CHAT_MESSAGE')
  async handleDeleteChatMessage(
    @MessageBody()
    data: { meetingId: string; messageId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { meetingId, messageId } = data;

    try {
      // Check if user has permission to delete (host or message owner)
      const message = await this.chatService.getMessageByIdSimple(messageId);
      if (!message) {
        client.emit('ERROR', { message: 'Message not found' });
        return;
      }

      // Check permissions
      const isHost = client.user.systemRole === SystemRole.ADMIN || client.user.systemRole === SystemRole.TUTOR;
      const isOwner = message.userId === client.user._id;

      if (!isHost && !isOwner) {
        client.emit('ERROR', { message: 'Insufficient permissions to delete message' });
        return;
      }

      // Delete message from database
      await this.chatService.deleteMessageById(messageId);

      // Broadcast deletion to room
      this.server.to(meetingId).emit('CHAT_MESSAGE_DELETED', {
        messageId,
        deletedBy: client.user._id,
      });

      this.logger.log(
        `Chat message ${messageId} deleted by ${client.user.displayName}`,
      );
    } catch (error) {
      this.logger.error('Error deleting chat message:', error);
      client.emit('ERROR', { message: 'Failed to delete chat message' });
    }
  }

  @SubscribeMessage('PING')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('PONG', { timestamp: Date.now() });
  }

  // Helper method to get room participants
  getRoomParticipants(meetingId: string) {
    const roomUsers = this.roomUsers.get(meetingId);
    if (!roomUsers) return [];

    return Array.from(roomUsers)
      .map((socketId) => {
        const user = this.connectedUsers.get(socketId);
        return user
          ? {
            userId: user.user!._id,
            displayName: user.user!.displayName,
            socketId,
          }
          : null;
      })
      .filter(Boolean);
  }
}
