#!/usr/bin/env node

// Simple Socket.IO client test to verify WebSocket connection
const { io } = require('socket.io-client');

console.log('🧪 Testing Socket.IO connection...');

// Test connection to signaling namespace
const socket = io('https://api.hrdeedu.co.kr/signaling', {
  auth: {
    token: 'test-token' // This will fail auth but should connect to namespace
  },
  transports: ['websocket', 'polling'],
  timeout: 5000,
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.IO signaling namespace!');
  console.log('🔌 Socket ID:', socket.id);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
  
  // Check if it's an auth error (which means namespace is working)
  if (error.message.includes('Invalid authentication token') || 
      error.message.includes('No authentication token')) {
    console.log('✅ Namespace /signaling is accessible (auth error expected)');
    process.exit(0);
  }
  
  // If it's a different error, the namespace might not be working
  console.log('❌ Namespace /signaling might not be configured');
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Connection timeout');
  socket.disconnect();
  process.exit(1);
}, 10000);
