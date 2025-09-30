import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MemberService } from '../members/member.service';
import { ParticipantService } from '../participants/participant.service';
import { ChatService } from '../../services/chat.service';
import { SystemRole } from '../../libs/enums/enums';

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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/signaling',
})
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, AuthenticatedSocket>();
  private roomUsers = new Map<string, Set<string>>();
  private raisedHands = new Map<string, { userId: string; displayName: string; raisedAt: Date; timeoutId: NodeJS.Timeout }>();

  constructor(
    private jwtService: JwtService,
    private memberService: MemberService,
    private participantService: ParticipantService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    console.log('🔌 WebSocket connection attempt from client:', client.id);
    console.log('🔌 Handshake auth:', client.handshake.auth);
    console.log('🔌 Handshake headers:', client.handshake.headers);
    
    try {
      
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      console.log('🔌 Extracted token:', token ? 'Present' : 'Missing');
      console.log('🔌 Token preview:', token ? token.substring(0, 20) + '...' : 'None');

      if (!token) {
        console.log('❌ No token provided, disconnecting client');
        client.emit('ERROR', { message: 'No authentication token provided' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      console.log('🔌 Verifying JWT token...');
      let payload;
      try {
        payload = this.jwtService.verify(token);
        console.log('🔌 JWT payload:', payload);
      } catch (jwtError) {
        console.error('❌ JWT verification failed:', jwtError.message);
        client.emit('ERROR', { message: 'Invalid authentication token' });
        client.disconnect();
        return;
      }
      
      console.log('🔌 Getting user profile for ID:', payload.sub);
      const user = await this.memberService.getProfile(payload.sub);

      if (!user) {
        console.log('❌ User not found, disconnecting client');
        client.emit('ERROR', { message: 'User not found' });
        client.disconnect();
        return;
      }

      console.log('✅ User found:', user.displayName, user.email);
      client.user = user;
      this.connectedUsers.set(client.id, client);

      console.log(
        `✅ User ${user.displayName} connected with socket ${client.id}`,
      );
      
      // Send success message to client
      client.emit('CONNECTION_SUCCESS', { 
        message: 'Successfully connected to chat server',
        user: {
          _id: user._id,
          displayName: user.displayName,
          email: user.email,
          systemRole: user.systemRole
        }
      });
      
    } catch (error) {
      console.error('❌ Connection error:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      client.emit('ERROR', { message: 'Connection failed: ' + error.message });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      console.log(`User ${client.user.displayName} disconnected`);

      // Clean up raised hands for this user
      this.cleanupUserHands(client.user._id);

      // Remove from all rooms
      for (const [roomName, users] of this.roomUsers.entries()) {
        if (users.has(client.id)) {
          users.delete(client.id);
          this.server.to(roomName).emit('USER_LEFT', {
            userId: client.user._id,
            displayName: client.user.displayName,
            socketId: client.id,
          });
        }
      }

      this.connectedUsers.delete(client.id);
    }
  }

  @SubscribeMessage('JOIN_ROOM')
  async handleJoinRoom(
    @MessageBody() data: { meetingId: string; roomName: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { meetingId, roomName } = data;

    // Verify user has access to this meeting
    try {
      // This would typically check if user is a participant in the meeting
      // For now, we'll allow it

      // Join socket room
      await client.join(roomName);

      // Track user in room
      if (!this.roomUsers.has(roomName)) {
        this.roomUsers.set(roomName, new Set());
      }
      this.roomUsers.get(roomName)!.add(client.id);

      // Get current participants in room
      const roomParticipants = Array.from(this.roomUsers.get(roomName) || [])
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
      client.emit('PEER_LIST', { participants: roomParticipants });

      // Notify others that user joined
      client.to(roomName).emit('USER_JOINED', {
        userId: client.user._id,
        displayName: client.user.displayName,
        socketId: client.id,
      });

      console.log(`User ${client.user.displayName} joined room ${roomName}`);
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('LEAVE_ROOM')
  async handleLeaveRoom(
    @MessageBody() data: { roomName: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { roomName } = data;

    // Leave socket room
    await client.leave(roomName);

    // Remove from room tracking
    const roomUsers = this.roomUsers.get(roomName);
    if (roomUsers) {
      roomUsers.delete(client.id);
    }

    // Notify others that user left
    client.to(roomName).emit('USER_LEFT', {
      userId: client.user._id,
      displayName: client.user.displayName,
      socketId: client.id,
    });

    console.log(`User ${client.user.displayName} left room ${roomName}`);
  }

  // WebRTC events removed - LiveKit handles media signaling

  @SubscribeMessage('CHAT_SEND')
  async handleChatSend(
    @MessageBody()
    data: { roomName: string; message: string; replyToMessageId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { roomName, message, replyToMessageId } = data;

    try {
      // Check if user has access to this meeting
      const hasAccess = await this.chatService.checkMeetingAccess(
        roomName,
        client.user._id,
        client.user.systemRole
      );

      if (!hasAccess) {
        client.emit('ERROR', { message: 'You do not have access to this meeting chat' });
        return;
      }

      // Save message to database
      const savedMessage = await this.chatService.createMessage({
        meetingId: roomName,
        text: message,
        displayName: client.user.displayName,
        userId: client.user._id,
        replyToMessageId,
      });

      // Format message for broadcast
      const messageData = {
        _id: savedMessage._id.toString(),
        meetingId: savedMessage.meetingId.toString(),
        text: savedMessage.text,
        displayName: savedMessage.displayName,
        userId: savedMessage.userId.toString(),
        replyToMessageId: savedMessage.replyToMessageId?.toString(),
        createdAt: savedMessage.createdAt.toISOString(),
      };

      // Broadcast to room
      this.server.to(roomName).emit('CHAT_MESSAGE', messageData);

      console.log(
        `Chat message from ${client.user.displayName} in room ${roomName} saved with ID: ${savedMessage._id}`,
      );
    } catch (error) {
      console.error('Error sending chat message:', error);
      client.emit('ERROR', { message: 'Failed to send chat message' });
    }
  }

  @SubscribeMessage('JOIN_CHAT_ROOM')
  async handleJoinChatRoom(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    console.log('📤 JOIN_CHAT_ROOM received:', data);
    console.log('📤 Client user:', client.user ? 'Present' : 'Missing');
    
    if (!client.user) {
      console.log('❌ No client user, returning');
      return;
    }

    const { meetingId } = data;
    console.log('📤 Processing meeting ID:', meetingId);

    try {
      // Check if user has access to this meeting
      const hasAccess = await this.chatService.checkMeetingAccess(
        meetingId,
        client.user._id,
        client.user.systemRole
      );

      if (!hasAccess) {
        client.emit('ERROR', { message: 'You do not have access to this meeting chat' });
        return;
      }

      // Join socket room
      await client.join(meetingId);

      // Track user in room
      if (!this.roomUsers.has(meetingId)) {
        this.roomUsers.set(meetingId, new Set());
      }
      this.roomUsers.get(meetingId)!.add(client.id);

      // Load existing messages from database
      console.log(`Loading existing messages for meeting ${meetingId}`);
      const existingMessages = await this.chatService.getMessagesByMeeting(meetingId);
      console.log(`Found ${existingMessages.length} existing messages`);

      // Send existing messages to the joining user
      client.emit('CHAT_MESSAGES_LOADED', { messages: existingMessages });
      console.log(
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

      console.log(`User ${client.user.displayName} joined chat room ${meetingId}`);
    } catch (error) {
      console.error('Error joining chat room:', error);
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

    console.log(`User ${client.user.displayName} left chat room ${meetingId}`);
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

      console.log(
        `Chat message ${messageId} deleted by ${client.user.displayName}`,
      );
    } catch (error) {
      console.error('Error deleting chat message:', error);
      client.emit('ERROR', { message: 'Failed to delete chat message' });
    }
  }

  @SubscribeMessage('PING')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('PONG', { timestamp: Date.now() });
  }

  // ==================== HAND RAISE WEBSOCKET HANDLERS (REMOVED - USING NEW SYSTEM BELOW) ====================

  @SubscribeMessage('HOST_LOWER_HAND')
  async handleHostLowerHand(
    @MessageBody() data: { meetingId: string; participantId: string; reason?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { meetingId, participantId, reason } = data;
    console.log('✋ HOST_LOWER_HAND received:', { meetingId, participantId, reason, hostId: client.user._id });

    try {
      // Use the new WebSocket-only system
      const handKey = `${meetingId}:${participantId}`;
      
      // Check if hand is raised in our in-memory system
      if (!this.raisedHands.has(handKey)) {
        console.log(`✋ Hand not found in raised hands: ${handKey}`);
        client.emit('HOST_LOWER_HAND_ERROR', { 
          message: 'Participant\'s hand is not currently raised',
          participantId 
        });
        return;
      }

      // Get participant info
      const handInfo = this.raisedHands.get(handKey);
      const { displayName } = handInfo;

      // Remove from raised hands and clear timeout
      clearTimeout(handInfo.timeoutId);
      this.raisedHands.delete(handKey);

      // Broadcast to all participants in the meeting
      this.server.to(meetingId).emit('HAND_LOWERED_BY_HOST', {
        userId: participantId,
        displayName,
        hostId: client.user._id,
        hostDisplayName: client.user.displayName,
        reason,
        loweredAt: new Date(),
        meetingId,
      });

      // Send confirmation to the host
      client.emit('HOST_LOWER_HAND_SUCCESS', {
        success: true,
        message: 'Participant\'s hand lowered successfully',
        participantId,
        hasHandRaised: false,
        handLoweredAt: new Date(),
        reason,
      });

      console.log(`✋ Hand lowered by host ${client.user.displayName} for participant ${participantId} (${displayName}) in meeting ${meetingId}`);
    } catch (error) {
      console.error('❌ Error lowering hand as host:', error);
      client.emit('HOST_LOWER_HAND_ERROR', { 
        message: error.message || 'Failed to lower hand as host',
        participantId 
      });
    }
  }

  @SubscribeMessage('LOWER_ALL_HANDS')
  async handleLowerAllHands(
    @MessageBody() data: { meetingId: string; reason?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { meetingId, reason } = data;
    console.log('✋ LOWER_ALL_HANDS received:', { meetingId, reason, hostId: client.user._id });

    try {
      // Use the new WebSocket-only system
      const loweredHands = [];
      const handsToRemove = [];

      // Find all raised hands for this meeting
      for (const [handKey, handInfo] of this.raisedHands.entries()) {
        if (handKey.startsWith(`${meetingId}:`)) {
          loweredHands.push({
            userId: handInfo.userId,
            displayName: handInfo.displayName,
            loweredAt: new Date()
          });
          handsToRemove.push(handKey);
        }
      }

      // Remove all hands and clear timeouts
      for (const handKey of handsToRemove) {
        const handInfo = this.raisedHands.get(handKey);
        if (handInfo) {
          clearTimeout(handInfo.timeoutId);
          this.raisedHands.delete(handKey);
        }
      }

      // Broadcast to all participants in the meeting
      this.server.to(meetingId).emit('ALL_HANDS_LOWERED', {
        hostId: client.user._id,
        hostDisplayName: client.user.displayName,
        reason,
        loweredAt: new Date(),
        meetingId,
        loweredCount: loweredHands.length,
        loweredHands
      });

      console.log(`✋ All hands lowered by host ${client.user.displayName} in meeting ${meetingId} (${loweredHands.length} hands lowered)`);

      // Send confirmation to the host
      client.emit('LOWER_ALL_HANDS_SUCCESS', { 
        success: true,
        message: `Successfully lowered ${loweredHands.length} hands`,
        loweredCount: loweredHands.length 
      });
    } catch (error) {
      console.error('❌ Error lowering all hands:', error);
      client.emit('LOWER_ALL_HANDS_ERROR', { 
        message: error.message || 'Failed to lower all hands',
        meetingId 
      });
    }
  }

  @SubscribeMessage('FORCE_MUTE')
  async handleForceMute(
    @MessageBody()
    data: { roomName: string; targetUserId: string; reason?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    // Check if user has permission to mute others
    if (client.user.systemRole !== SystemRole.ADMIN) {
      client.emit('ERROR', { message: 'Insufficient permissions' });
      return;
    }

    const { roomName, targetUserId, reason } = data;

    // Find target user's socket
    const targetSocket = Array.from(this.connectedUsers.values()).find(
      (socket) => socket.user?._id === targetUserId,
    );

    if (targetSocket) {
      targetSocket.emit('FORCE_MUTE', { reason });
      client.to(roomName).emit('USER_MUTED', {
        userId: targetUserId,
        byUserId: client.user._id,
        reason,
      });
    }
  }

  @SubscribeMessage('FORCE_CAMERA_OFF')
  async handleForceCameraOff(
    @MessageBody()
    data: { roomName: string; targetUserId: string; reason?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    // Check if user has permission
    if (client.user.systemRole !== SystemRole.ADMIN) {
      client.emit('ERROR', { message: 'Insufficient permissions' });
      return;
    }

    const { roomName, targetUserId, reason } = data;

    // Find target user's socket
    const targetSocket = Array.from(this.connectedUsers.values()).find(
      (socket) => socket.user?._id === targetUserId,
    );

    if (targetSocket) {
      targetSocket.emit('FORCE_CAMERA_OFF', { reason });
      client.to(roomName).emit('USER_CAMERA_OFF', {
        userId: targetUserId,
        byUserId: client.user._id,
        reason,
      });
    }
  }

  @SubscribeMessage('KICK_USER')
  async handleKickUser(
    @MessageBody()
    data: { roomName: string; targetUserId: string; reason?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    // Check if user has permission
    if (client.user.systemRole !== SystemRole.ADMIN) {
      client.emit('ERROR', { message: 'Insufficient permissions' });
      return;
    }

    const { roomName, targetUserId, reason } = data;

    // Find target user's socket
    const targetSocket = Array.from(this.connectedUsers.values()).find(
      (socket) => socket.user?._id === targetUserId,
    );

    if (targetSocket) {
      targetSocket.emit('KICKED', { reason });
      targetSocket.disconnect();

      client.to(roomName).emit('USER_KICKED', {
        userId: targetUserId,
        byUserId: client.user._id,
        reason,
      });
    }
  }

  // Helper method to get room participants
  getRoomParticipants(roomName: string) {
    const roomUsers = this.roomUsers.get(roomName);
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

  // ===== WAITING ROOM EVENTS =====

  @SubscribeMessage('JOIN_WAITING_ROOM')
  async handleJoinWaitingRoom(
    @MessageBody() data: { meetingId: string; participantId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.user) {
        client.emit('ERROR', { message: 'Authentication required' });
        return;
      }

      const { meetingId, participantId } = data;

      // Join the waiting room
      await client.join(`waiting_${meetingId}`);

      // Store participant info
      client.data = { ...client.data, meetingId, participantId };

      // Notify host about new participant in waiting room
      client.to(`host_${meetingId}`).emit('PARTICIPANT_WAITING', {
        participantId,
        displayName: client.user.displayName,
        joinedAt: new Date(),
      });

      client.emit('WAITING_ROOM_JOINED', {
        message: 'Successfully joined waiting room',
        meetingId,
        participantId,
      });
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to join waiting room' });
    }
  }

  @SubscribeMessage('LEAVE_WAITING_ROOM')
  async handleLeaveWaitingRoom(
    @MessageBody() data: { meetingId: string; participantId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { meetingId, participantId } = data;

      // Leave the waiting room
      await client.leave(`waiting_${meetingId}`);

      // Notify host about participant leaving waiting room
      client.to(`host_${meetingId}`).emit('PARTICIPANT_LEFT_WAITING', {
        participantId,
        displayName: client.user?.displayName,
      });

      client.emit('WAITING_ROOM_LEFT', {
        message: 'Left waiting room',
        meetingId,
        participantId,
      });
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to leave waiting room' });
    }
  }

  @SubscribeMessage('HOST_JOIN_MEETING')
  async handleHostJoinMeeting(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.user) {
        client.emit('ERROR', { message: 'Authentication required' });
        return;
      }

      const { meetingId } = data;
      console.log(`✋ Host ${client.user.displayName} joining meeting room ${meetingId}`);

      // Join host room
      await client.join(`host_${meetingId}`);
      
      // Also join the main meeting room for hand raise events
      await client.join(meetingId);

      // Notify all waiting participants that host has joined
      client.to(`waiting_${meetingId}`).emit('HOST_JOINED', {
        message: 'Host has joined the meeting',
        meetingId,
      });

      client.emit('HOST_MEETING_JOINED', {
        message: 'Successfully joined as host',
        meetingId,
      });
      
      console.log(`✋ Host ${client.user.displayName} joined meeting room ${meetingId}`);
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to join as host' });
    }
  }

  @SubscribeMessage('PARTICIPANT_APPROVED')
  async handleParticipantApproved(
    @MessageBody()
    data: { meetingId: string; participantId: string; message?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { meetingId, participantId, message } = data;

      // Notify the specific participant
      client.to(`waiting_${meetingId}`).emit('PARTICIPANT_APPROVED', {
        participantId,
        message: message || 'You have been approved to join the meeting',
        meetingId,
      });

      // Notify other participants in waiting room
      client.to(`waiting_${meetingId}`).emit('WAITING_ROOM_UPDATE', {
        type: 'PARTICIPANT_APPROVED',
        participantId,
        message: 'A participant has been approved',
      });
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to approve participant' });
    }
  }

  @SubscribeMessage('PARTICIPANT_JOIN_MEETING')
  async handleParticipantJoinMeeting(
    @MessageBody() data: { meetingId: string; participantId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.user) {
        client.emit('ERROR', { message: 'Authentication required' });
        return;
      }

      const { meetingId, participantId } = data;
      console.log(`✋ Participant ${client.user.displayName} joining meeting room ${meetingId}`);

      // Join the main meeting room for hand raise events
      await client.join(meetingId);

      // Store participant info
      client.data = { ...client.data, meetingId, participantId };

      // Notify all participants in the meeting
      client.to(meetingId).emit('PARTICIPANT_JOINED_MEETING', {
        participantId,
        displayName: client.user.displayName,
        userId: client.user._id,
        meetingId,
      });

      console.log(`✋ Participant ${client.user.displayName} joined meeting room ${meetingId}`);
    } catch (error) {
      console.error('Error joining meeting room:', error);
      client.emit('ERROR', { message: 'Failed to join meeting room' });
    }
  }

  @SubscribeMessage('PARTICIPANT_REJECTED')
  async handleParticipantRejected(
    @MessageBody()
    data: { meetingId: string; participantId: string; reason?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { meetingId, participantId, reason } = data;

      // Notify the specific participant
      client.to(`waiting_${meetingId}`).emit('PARTICIPANT_REJECTED', {
        participantId,
        reason: reason || 'You have been rejected from joining the meeting',
        meetingId,
      });

      // Notify other participants in waiting room
      client.to(`waiting_${meetingId}`).emit('WAITING_ROOM_UPDATE', {
        type: 'PARTICIPANT_REJECTED',
        participantId,
        message: 'A participant has been rejected',
      });
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to reject participant' });
    }
  }

  @SubscribeMessage('PARTICIPANT_ADMITTED')
  async handleParticipantAdmitted(
    @MessageBody()
    data: { meetingId: string; participantId: string; message?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { meetingId, participantId, message } = data;

      // Notify the specific participant
      client.to(`waiting_${meetingId}`).emit('PARTICIPANT_ADMITTED', {
        participantId,
        message: message || 'You have been admitted to the meeting',
        meetingId,
      });

      // Notify other participants in waiting room
      client.to(`waiting_${meetingId}`).emit('WAITING_ROOM_UPDATE', {
        type: 'PARTICIPANT_ADMITTED',
        participantId,
        message: 'A participant has been admitted to the meeting',
      });
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to admit participant' });
    }
  }

  // ===== REAL-TIME HAND RAISE SYSTEM (WebSocket-based, no DB) =====

  @SubscribeMessage('RAISE_HAND')
  async handleRaiseHand(
    @MessageBody() data: { meetingId: string; userId: string; displayName: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      console.log('✋ RAISE_HAND event received:', data);
      
      if (!client.user) {
        console.log('✋ No user found in client');
        client.emit('ERROR', { message: 'Authentication required' });
        return;
      }

      const { meetingId, userId, displayName } = data;
      const handKey = `${meetingId}:${userId}`;

      console.log(`✋ Hand raised: ${displayName} in meeting ${meetingId}`);

      // Check if hand is already raised
      if (this.raisedHands.has(handKey)) {
        console.log(`✋ Hand already raised for ${displayName}, ignoring`);
        return;
      }

      // Set 2-minute timeout for auto-lower
      const timeoutId = setTimeout(() => {
        this.autoLowerHand(meetingId, userId, displayName);
      }, 120000); // 2 minutes = 120000ms

      // Store raised hand info
      this.raisedHands.set(handKey, {
        userId,
        displayName,
        raisedAt: new Date(),
        timeoutId
      });

      // Broadcast to all participants in the meeting room
      const broadcastData = {
        userId,
        displayName,
        raisedAt: new Date(),
        meetingId
      };
      
      console.log('✋ Broadcasting HAND_RAISED to meeting room:', meetingId, broadcastData);
      client.to(meetingId).emit('HAND_RAISED', broadcastData);

      // Also send to the person who raised their hand
      console.log('✋ Sending HAND_RAISED to sender:', broadcastData);
      client.emit('HAND_RAISED', broadcastData);

      console.log(`✋ Hand raise broadcasted for ${displayName}`);
    } catch (error) {
      console.error('Error handling hand raise:', error);
      client.emit('ERROR', { message: 'Failed to raise hand' });
    }
  }

  @SubscribeMessage('LOWER_HAND')
  async handleLowerHand(
    @MessageBody() data: { meetingId: string; userId: string; displayName: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.user) {
        client.emit('ERROR', { message: 'Authentication required' });
        return;
      }

      const { meetingId, userId, displayName } = data;
      const handKey = `${meetingId}:${userId}`;

      console.log(`✋ Hand lowered: ${displayName} in meeting ${meetingId}`);

      // Remove from raised hands and clear timeout
      const handInfo = this.raisedHands.get(handKey);
      if (handInfo) {
        clearTimeout(handInfo.timeoutId);
        this.raisedHands.delete(handKey);
      }

      // Broadcast to all participants in the meeting room
      client.to(meetingId).emit('HAND_LOWERED', {
        userId,
        displayName,
        loweredAt: new Date(),
        meetingId
      });

      // Also send to the person who lowered their hand
      client.emit('HAND_LOWERED', {
        userId,
        displayName,
        loweredAt: new Date(),
        meetingId
      });

      console.log(`✋ Hand lower broadcasted for ${displayName}`);
    } catch (error) {
      console.error('Error handling hand lower:', error);
      client.emit('ERROR', { message: 'Failed to lower hand' });
    }
  }

  @SubscribeMessage('GET_RAISED_HANDS')
  async handleGetRaisedHands(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.user) {
        client.emit('ERROR', { message: 'Authentication required' });
        return;
      }

      const { meetingId } = data;
      const raisedHands = Array.from(this.raisedHands.entries())
        .filter(([key]) => key.startsWith(`${meetingId}:`))
        .map(([key, handInfo]) => ({
          userId: handInfo.userId,
          displayName: handInfo.displayName,
          raisedAt: handInfo.raisedAt,
          timeRemaining: Math.max(0, 60000 - (Date.now() - handInfo.raisedAt.getTime()))
        }));

      client.emit('RAISED_HANDS_LIST', {
        meetingId,
        raisedHands,
        timestamp: new Date()
      });

      console.log(`✋ Sent raised hands list for meeting ${meetingId}:`, raisedHands.length);
    } catch (error) {
      console.error('Error getting raised hands:', error);
      client.emit('ERROR', { message: 'Failed to get raised hands' });
    }
  }

  // Auto-lower hand after 1 minute
  private autoLowerHand(meetingId: string, userId: string, displayName: string) {
    const handKey = `${meetingId}:${userId}`;
    const handInfo = this.raisedHands.get(handKey);
    
    if (handInfo) {
      console.log(`✋ Auto-lowering hand for ${displayName} after 1 minute`);
      
      // Remove from raised hands
      this.raisedHands.delete(handKey);
      
      // Broadcast auto-lower to all participants
      this.server.to(meetingId).emit('HAND_AUTO_LOWERED', {
        userId,
        displayName,
        loweredAt: new Date(),
        meetingId,
        reason: 'Auto-lowered after 1 minute'
      });
    }
  }

  // Clean up raised hands when user disconnects
  private cleanupUserHands(userId: string) {
    for (const [key, handInfo] of this.raisedHands.entries()) {
      if (handInfo.userId === userId) {
        clearTimeout(handInfo.timeoutId);
        this.raisedHands.delete(key);
        
        const [meetingId] = key.split(':');
        this.server.to(meetingId).emit('HAND_AUTO_LOWERED', {
          userId,
          displayName: handInfo.displayName,
          loweredAt: new Date(),
          meetingId,
          reason: 'User disconnected'
        });
      }
    }
  }
}
