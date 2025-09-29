const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Mock chat messages storage
const chatMessages = new Map();

// Mock JWT secret (use the same as your backend)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Chat namespace
const chatNamespace = io.of('/chat');

chatNamespace.on('connection', (socket) => {
  console.log(`🔌 Chat client connected: ${socket.id}`);

  socket.on('JOIN_CHAT_ROOM', async (data) => {
    const { meetingId } = data;
    console.log(`📤 JOIN_CHAT_ROOM received for meeting: ${meetingId}`);
    
    // Join socket room
    await socket.join(meetingId);
    console.log(`✅ Socket ${socket.id} joined room: ${meetingId}`);
    
    // Get existing messages for this meeting
    const existingMessages = chatMessages.get(meetingId) || [];
    console.log(`📚 Found ${existingMessages.length} existing messages for meeting ${meetingId}`);
    
    // Send existing messages to the client
    socket.emit('CHAT_MESSAGES_LOADED', { messages: existingMessages });
    console.log(`📤 Sent ${existingMessages.length} messages to ${socket.id}`);
  });

  socket.on('SEND_CHAT_MESSAGE', (data) => {
    const { meetingId, message } = data;
    console.log(`📨 SEND_CHAT_MESSAGE received: ${message} for meeting ${meetingId}`);
    
    // Create new message
    const newMessage = {
      _id: Date.now().toString(),
      meetingId: meetingId,
      text: message,
      displayName: 'Test User',
      userId: 'test-user-id',
      createdAt: new Date().toISOString()
    };
    
    // Store message
    if (!chatMessages.has(meetingId)) {
      chatMessages.set(meetingId, []);
    }
    chatMessages.get(meetingId).push(newMessage);
    
    // Broadcast to all clients in the room
    chatNamespace.to(meetingId).emit('CHAT_MESSAGE', newMessage);
    console.log(`📤 Broadcasted message to room ${meetingId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Chat client disconnected: ${socket.id}`);
  });
});

const PORT = 3007;
server.listen(PORT, () => {
  console.log(`🚀 Test chat server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/chat`);
  console.log(`💬 Test with meeting ID: 68d9d55aad3da2683f05b2d0`);
});
