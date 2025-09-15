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
import { ChatService } from '../chat/chat.service';
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
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, AuthenticatedSocket>();
  private roomUsers = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private memberService: MemberService,
    private participantService: ParticipantService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      const user = await this.memberService.getProfile(payload.sub);
      
      if (!user) {
        client.disconnect();
        return;
      }

      client.user = user;
      this.connectedUsers.set(client.id, client);
      
      console.log(`User ${user.displayName} connected with socket ${client.id}`);
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      console.log(`User ${client.user.displayName} disconnected`);
      
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
        .map(socketId => {
          const user = this.connectedUsers.get(socketId);
          return user ? {
            userId: user.user!._id,
            displayName: user.user!.displayName,
            socketId,
          } : null;
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
    @MessageBody() data: { roomName: string; message: string; replyToMessageId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.user) return;

    const { roomName, message, replyToMessageId } = data;
    
    try {
      // Save message to database
      const chatMessage = {
        meetingId: roomName, // Assuming roomName is meetingId
        text: message,
        displayName: client.user.displayName,
        userId: client.user._id,
        replyToMessageId,
      };
      
      // Broadcast to room
      client.to(roomName).emit('CHAT_MESSAGE', {
        ...chatMessage,
        _id: Date.now().toString(), // Temporary ID
        createdAt: new Date(),
      });

      console.log(`Chat message from ${client.user.displayName} in room ${roomName}`);
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to send chat message' });
    }
  }

  @SubscribeMessage('FORCE_MUTE')
  async handleForceMute(
    @MessageBody() data: { roomName: string; targetUserId: string; reason?: string },
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
    const targetSocket = Array.from(this.connectedUsers.values())
      .find(socket => socket.user?._id === targetUserId);
    
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
    @MessageBody() data: { roomName: string; targetUserId: string; reason?: string },
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
    const targetSocket = Array.from(this.connectedUsers.values())
      .find(socket => socket.user?._id === targetUserId);
    
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
    @MessageBody() data: { roomName: string; targetUserId: string; reason?: string },
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
    const targetSocket = Array.from(this.connectedUsers.values())
      .find(socket => socket.user?._id === targetUserId);
    
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

  @SubscribeMessage('PING')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('PONG', { timestamp: Date.now() });
  }

  // Helper method to get room participants
  getRoomParticipants(roomName: string) {
    const roomUsers = this.roomUsers.get(roomName);
    if (!roomUsers) return [];
    
    return Array.from(roomUsers)
      .map(socketId => {
        const user = this.connectedUsers.get(socketId);
        return user ? {
          userId: user.user!._id,
          displayName: user.user!.displayName,
          socketId,
        } : null;
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
      
      // Join host room
      await client.join(`host_${meetingId}`);
      
      // Notify all waiting participants that host has joined
      client.to(`waiting_${meetingId}`).emit('HOST_JOINED', {
        message: 'Host has joined the meeting',
        meetingId,
      });

      client.emit('HOST_MEETING_JOINED', {
        message: 'Successfully joined as host',
        meetingId,
      });
    } catch (error) {
      client.emit('ERROR', { message: 'Failed to join as host' });
    }
  }

  @SubscribeMessage('PARTICIPANT_APPROVED')
  async handleParticipantApproved(
    @MessageBody() data: { meetingId: string; participantId: string; message?: string },
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

  @SubscribeMessage('PARTICIPANT_REJECTED')
  async handleParticipantRejected(
    @MessageBody() data: { meetingId: string; participantId: string; reason?: string },
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
    @MessageBody() data: { meetingId: string; participantId: string; message?: string },
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
}
