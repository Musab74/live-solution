// import { Injectable, Logger } from '@nestjs/common';
// import {
//   OnGatewayInit,
//   WebSocketGateway,
//   WebSocketServer,
// } from '@nestjs/websockets';
// import { Server, WebSocket } from 'ws';
// import * as url from 'url';
// import { randomUUID } from 'crypto';
// import { AuthService } from '../components/auth/auth.service';
// import { Member } from 'src/libs/DTO/member/member';

// type IncomingMessage =
//   | { event: 'CHAT_SEND'; text: string }
//   | { event: 'PING' };

// type OutgoingMessage =
//   | { event: 'CHAT_MESSAGE'; text: string; meetingId: string; member: PublicMember; sentAt: string }
//   | { event: 'USER_JOINED'; meetingId: string; member: PublicMember }
//   | { event: 'USER_LEFT'; meetingId: string; memberId: string }
//   | { event: 'INFO'; text: string };

// type PublicMember = Pick<Member, 'id' | 'displayName' | 'avatarUrl'> & { socketId: string };

// interface ClientState {
//   id: string;                // server-side socket id
//   meetingId: string;         // current meeting room
//   member: Member | null;     // authenticated user (or null for guests)
// }

// @WebSocketGateway({ path: '/ws', cors: { origin: '*' } })
// @Injectable()
// export class SocketGateway implements OnGatewayInit {
//   private readonly logger = new Logger(SocketGateway.name);

//   @WebSocketServer()
//   server!: Server; // 'ws' server

//   // Room registry: meetingId -> Set<WebSocket>
//   private readonly rooms = new Map<string, Set<WebSocket>>();

//   // Track per-socket state
//   private readonly state = new WeakMap<WebSocket, ClientState>();

//   constructor(private readonly authService: AuthService) {}

//   afterInit(server: Server) {
//     this.logger.log('WS Gateway initialized');

//     server.on('connection', async (socket: WebSocket, req) => {
//       try {
//         // 1) Parse meetingId + token from query
//         const { query } = url.parse(req.url ?? '', true);
//         const meetingId = String(query.meetingId || '').trim();
//         const token = typeof query.token === 'string' ? query.token : undefined;

//         if (!meetingId) {
//           this.send(socket, { event: 'INFO', text: 'Missing meetingId' });
//           socket.close();
//           return;
//         }

//         // 2) Optional auth: verify token -> member
//         let member: Member | null = null;
//         try {
//           if (token) {
//             // Adjust to your AuthService API
//             // e.g., member = await this.authService.verifyAccessToken(token);
//             member = await (this.authService as any).verifyAccessToken?.(token) ?? null;
//           }
//         } catch {
//           // If token invalid, treat as guest (or close socket if you prefer strict)
//           member = null;
//         }

//         // 3) Register socket into the meeting room
//         const id = randomUUID();
//         this.state.set(socket, { id, meetingId, member });
//         this.addToRoom(meetingId, socket);

//         // 4) Broadcast join event (room only)
//         this.broadcast(meetingId, {
//           event: 'USER_JOINED',
//           meetingId,
//           member: this.toPublic(member, id),
//         });

//         // 5) Handle incoming messages
//         socket.on('message', (raw: string) => {
//           let msg: IncomingMessage | undefined;
//           try {
//             msg = JSON.parse(raw);
//           } catch {
//             return this.send(socket, { event: 'INFO', text: 'Invalid JSON' });
//           }
//           if (!msg || typeof (msg as any).event !== 'string') {
//             return this.send(socket, { event: 'INFO', text: 'Invalid payload' });
//           }

//           const s = this.state.get(socket);
//           if (!s) return;

//           switch (msg.event) {
//             case 'CHAT_SEND': {
//               const text = (msg as any).text?.toString()?.trim();
//               if (!text) return;
//               const out: OutgoingMessage = {
//                 event: 'CHAT_MESSAGE',
//                 text,
//                 meetingId: s.meetingId,
//                 member: this.toPublic(s.member, s.id),
//                 sentAt: new Date().toISOString(),
//               };
//               this.broadcast(s.meetingId, out); // only to same meeting
//               break;
//             }
//             case 'PING': {
//               this.send(socket, { event: 'INFO', text: 'PONG' });
//               break;
//             }
//             default:
//               this.send(socket, { event: 'INFO', text: `Unknown event: ${(msg as any).event}` });
//           }
//         });

//         // 6) Cleanup on close
//         socket.on('close', () => this.handleClose(socket));
//         socket.on('error', () => this.handleClose(socket));
//       } catch (e) {
//         this.logger.error(`WS connection error: ${e instanceof Error ? e.message : String(e)}`);
//         try { socket.close(); } catch {}
//       }
//     });
//   }

//   // ---------- helpers ----------

//   private addToRoom(meetingId: string, socket: WebSocket) {
//     if (!this.rooms.has(meetingId)) this.rooms.set(meetingId, new Set());
//     this.rooms.get(meetingId)!.add(socket);
//   }

//   private removeFromRoom(meetingId: string, socket: WebSocket) {
//     const room = this.rooms.get(meetingId);
//     if (!room) return;
//     room.delete(socket);
//     if (room.size === 0) this.rooms.delete(meetingId);
//   }

//   private handleClose(socket: WebSocket) {
//     const s = this.state.get(socket);
//     if (!s) return;
//     this.removeFromRoom(s.meetingId, socket);
//     this.state.delete(socket);
//     this.broadcast(s.meetingId, {
//       event: 'USER_LEFT',
//       meetingId: s.meetingId,
//       memberId: s.member?.id ?? s.id, // prefer user id if logged in; fallback to socket id
//     });
//   }

//   private send(socket: WebSocket, message: OutgoingMessage) {
//     if (socket.readyState === WebSocket.OPEN) {
//       socket.send(JSON.stringify(message));
//     }
//   }

//   private broadcast(meetingId: string, message: OutgoingMessage) {
//     const room = this.rooms.get(meetingId);
//     if (!room) return;
//     const payload = JSON.stringify(message);
//     room.forEach((client) => {
//       if (client.readyState === WebSocket.OPEN) client.send(payload);
//     });
//   }

//   private toPublic(member: Member | null, socketId: string): PublicMember {
//     if (member) {
//       const { id, displayName, avatarUrl } = member as any;
//       return { id, displayName, avatarUrl, socketId };
//     }
//     // guest view
//     return { id: 'guest', displayName: 'Guest', avatarUrl: undefined, socketId };
//   }
// }
