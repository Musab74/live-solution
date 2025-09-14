// // src/socket/socket.module.ts
// import { Module } from '@nestjs/common';

// // If your gateway uses AuthService (token verify), import your AuthModule:
// import { AuthModule } from '../components/auth/auth.module'; // <-- adjust path to your project
// import { SocketGateway } from './socket.getaway';

// @Module({
//   imports: [AuthModule],        // remove if you don't need AuthService inside gateway
//   providers: [SocketGateway],
//   exports: [SocketGateway],
// })
// export class SocketModule {}
