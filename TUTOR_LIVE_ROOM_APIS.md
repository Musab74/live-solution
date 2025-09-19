# 🎓 Tutor Live Room APIs - Complete Frontend Integration Guide

## 📋 **Overview**
This document provides all GraphQL APIs and data structures available for tutors in live rooms. All APIs require authentication via `Authorization: Bearer <token>` header.

---

## 🔐 **Authentication APIs**

### **Login as Tutor**
```graphql
mutation {
  tutorLogin(input: {
    email: "tutor@example.com"
    password: "password123"
  }) {
    success
    message
    token
    user {
      _id
      email
      displayName
      systemRole
      avatarUrl
    }
  }
}
```

### **Get Current User Profile**
```graphql
query {
  me {
    _id
    email
    displayName
    systemRole
    avatarUrl
    lastSeenAt
    createdAt
  }
}
```

---

## 🏠 **Meeting Management APIs**

### **Create Meeting**
```graphql
mutation {
  createMeeting(input: {
    title: "Math Tutoring Session"
    scheduledFor: "2025-09-20T14:00:00Z"
    isPrivate: false
  }) {
    success
    message
    meeting {
      _id
      title
      status
      inviteCode
      isPrivate
      isLocked
      scheduledFor
      hostId
      createdAt
    }
  }
}
```

### **Start Meeting**
```graphql
mutation {
  startMeeting(meetingId: "MEETING_ID") {
    success
    message
    meeting {
      _id
      status
      actualStartAt
      inviteCode
    }
  }
}
```

### **End Meeting**
```graphql
mutation {
  endMeeting(meetingId: "MEETING_ID") {
    success
    message
    meeting {
      _id
      status
      endedAt
      durationMin
    }
  }
}
```

### **Lock/Unlock Room**
```graphql
# Lock room (no new participants can join)
mutation {
  lockRoom(meetingId: "MEETING_ID") {
    success
    message
  }
}

# Unlock room
mutation {
  unlockRoom(meetingId: "MEETING_ID") {
    success
    message
  }
}
```

### **Get Meeting Info**
```graphql
query {
  getMeetingById(meetingId: "MEETING_ID") {
    _id
    title
    status
    inviteCode
    isPrivate
    isLocked
    scheduledFor
    actualStartAt
    endedAt
    durationMin
    participantCount
    hostId {
      _id
      displayName
      email
    }
    createdAt
    updatedAt
  }
}
```

---

## 👥 **Participant Management APIs**

### **Get All Participants in Meeting**
```graphql
query {
  getParticipantsByMeeting(meetingId: "MEETING_ID") {
    _id
    displayName
    role
    micState
    cameraState
    screenState
    screenShareInfo
    hasHandRaised
    handRaisedAt
    status
    sessions {
      joinedAt
      leftAt
      durationSec
    }
    totalDurationSec
    createdAt
  }
}
```

### **Get Waiting Room Participants**
```graphql
query {
  getWaitingParticipants(meetingId: "MEETING_ID") {
    _id
    displayName
    email
    role
    micState
    cameraState
    status
    createdAt
  }
}
```

### **Approve Participant (Let them in)**
```graphql
mutation {
  approveParticipant(input: {
    participantId: "PARTICIPANT_ID"
    reason: "Welcome to the session"
  }) {
    success
    message
    participant {
      _id
      displayName
      status
    }
  }
}
```

### **Reject Participant**
```graphql
mutation {
  rejectParticipant(input: {
    participantId: "PARTICIPANT_ID"
    reason: "Session is full"
  }) {
    success
    message
  }
}
```

### **Remove Participant from Meeting**
```graphql
mutation {
  removeParticipant(participantId: "PARTICIPANT_ID") {
    success
    message
  }
}
```

---

## 🎤 **Media Control APIs (Host Powers)**

### **Force Mute Participant**
```graphql
mutation {
  forceMute(input: {
    meetingId: "MEETING_ID"
    participantId: "PARTICIPANT_ID"
    micState: MUTED_BY_HOST
    reason: "Please mute your microphone"
  }) {
    success
    message
    participant {
      _id
      displayName
      micState
    }
  }
}
```

### **Force Camera Off**
```graphql
mutation {
  forceCameraOff(input: {
    meetingId: "MEETING_ID"
    participantId: "PARTICIPANT_ID"
    cameraState: OFF_BY_HOST
    reason: "Please turn off your camera"
  }) {
    success
    message
    participant {
      _id
      displayName
      cameraState
    }
  }
}
```

### **Transfer Host Role**
```graphql
mutation {
  transferHost(input: {
    meetingId: "MEETING_ID"
    newHostId: "NEW_HOST_ID"
    reason: "Transferring host role"
  }) {
    success
    message
    meeting {
      _id
      hostId
    }
  }
}
```

---

## 🖥️ **Screen Sharing Control APIs**

### **Force Screen Share Control**
```graphql
mutation {
  forceScreenShareControl(input: {
    meetingId: "MEETING_ID"
    participantId: "PARTICIPANT_ID"
    screenState: ON
    reason: "Please share your screen"
    screenShareInfo: "Desktop 1"
  }) {
    success
    message
    participant {
      _id
      displayName
      screenState
      screenShareInfo
    }
  }
}
```

### **Get Screen Share Status**
```graphql
query {
  getScreenShareStatus(input: {
    meetingId: "MEETING_ID"
  }) {
    meetingId
    participants {
      participantId
      displayName
      screenState
      screenShareInfo
      screenShareStartedAt
      screenShareDuration
      isCurrentlySharing
    }
    totalParticipants
    currentlySharingCount
  }
}
```

### **Get Active Screen Sharers**
```graphql
query {
  getActiveScreenSharers(meetingId: "MEETING_ID") {
    participantId
    displayName
    screenState
    screenShareInfo
    screenShareStartedAt
    screenShareDuration
    isCurrentlySharing
  }
}
```

---

## 🙋‍♂️ **Raise Hand Management APIs**

### **Get All Raised Hands**
```graphql
query {
  getRaisedHands(input: {
    meetingId: "MEETING_ID"
    includeLowered: false
  }) {
    raisedHands {
      participantId
      displayName
      hasHandRaised
      handRaisedAt
      handLoweredAt
      handRaiseDuration
      isWaitingForResponse
    }
    totalRaisedHands
    meetingId
    timestamp
  }
}
```

### **Host Lower Participant's Hand**
```graphql
mutation {
  hostLowerHand(input: {
    meetingId: "MEETING_ID"
    participantId: "PARTICIPANT_ID"
    reason: "Calling on participant"
  }) {
    success
    message
    participantId
    hasHandRaised
    handLoweredAt
  }
}
```

### **Lower All Hands**
```graphql
mutation {
  lowerAllHands(meetingId: "MEETING_ID") {
    success
    message
    participantId
    hasHandRaised
    handLoweredAt
  }
}
```

---

## 💬 **Chat APIs**

### **Get Chat History**
```graphql
query {
  getChatHistory(input: {
    meetingId: "MEETING_ID"
    limit: 50
    offset: 0
  }) {
    messages {
      _id
      content
      senderId {
        _id
        displayName
        avatarUrl
      }
      senderType
      messageType
      createdAt
    }
    totalCount
    hasMore
  }
}
```

### **Search Chat Messages**
```graphql
query {
  searchChatMessages(input: {
    meetingId: "MEETING_ID"
    query: "homework"
    limit: 20
  }) {
    messages {
      _id
      content
      senderId {
        _id
        displayName
      }
      createdAt
    }
    totalCount
  }
}
```

### **Delete Chat Message (Moderation)**
```graphql
mutation {
  deleteChatMessage(input: {
    messageId: "MESSAGE_ID"
    reason: "Inappropriate content"
  }) {
    success
    message
  }
}
```

### **Get Chat Stats**
```graphql
query {
  getChatStats(meetingId: "MEETING_ID") {
    totalMessages
    messagesByType
    activeParticipants
    lastMessageAt
  }
}
```

---

## 📹 **Recording APIs**

### **Start Meeting Recording**
```graphql
mutation {
  startMeetingRecording(input: {
    meetingId: "MEETING_ID"
    recordingType: "FULL_SESSION"
    quality: "HD"
  }) {
    success
    message
    recordingId
    status
    startedAt
  }
}
```

### **Stop Meeting Recording**
```graphql
mutation {
  stopMeetingRecording(input: {
    meetingId: "MEETING_ID"
    reason: "Session ended"
  }) {
    success
    message
    recordingId
    status
    stoppedAt
    durationSec
  }
}
```

### **Pause Meeting Recording**
```graphql
mutation {
  pauseMeetingRecording(input: {
    meetingId: "MEETING_ID"
    reason: "Break time"
  }) {
    success
    message
    recordingId
    status
    pausedAt
  }
}
```

### **Resume Meeting Recording**
```graphql
mutation {
  resumeMeetingRecording(input: {
    meetingId: "MEETING_ID"
  }) {
    success
    message
    recordingId
    status
    resumedAt
  }
}
```

### **Get Recording Info**
```graphql
query {
  getRecordingInfo(input: {
    meetingId: "MEETING_ID"
  }) {
    recordingId
    status
    recordingType
    quality
    startedAt
    stoppedAt
    pausedAt
    resumedAt
    durationSec
    fileSize
    downloadUrl
  }
}
```

---

## 🎥 **LiveKit Integration APIs**

### **Create LiveKit Token**
```graphql
mutation {
  createLivekitToken(meetingId: "MEETING_ID") {
    token
    roomName
    participantName
    participantIdentity
  }
}
```

### **End LiveKit Room**
```graphql
mutation {
  endLivekitRoom(meetingId: "MEETING_ID") {
    success
    message
  }
}
```

### **Kick LiveKit Participant**
```graphql
mutation {
  kickLivekitParticipant(
    meetingId: "MEETING_ID"
    identity: "participant_identity"
  ) {
    success
    message
  }
}
```

---

## 📊 **Analytics & Stats APIs**

### **Get Meeting Attendance**
```graphql
query {
  getMeetingAttendance(meetingId: "MEETING_ID") {
    totalParticipants
    currentlyOnline
    averageDuration
    attendanceHistory {
      timestamp
      participantCount
    }
  }
}
```

### **Get Participant Stats**
```graphql
query {
  getParticipantStats(meetingId: "MEETING_ID") {
    totalParticipants
    activeParticipants
    mutedParticipants
    cameraOffParticipants
    raisedHandsCount
    screenSharersCount
  }
}
```

### **Get Meeting Stats**
```graphql
query {
  getMeetingStats {
    totalMeetings
    activeMeetings
    completedMeetings
    totalParticipants
    averageDuration
  }
}
```

---

## 🎯 **Data Structures for Frontend**

### **Participant Object**
```typescript
interface Participant {
  _id: string;
  displayName: string;
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT';
  micState: 'ON' | 'OFF' | 'MUTED' | 'MUTED_BY_HOST';
  cameraState: 'ON' | 'OFF' | 'OFF_BY_HOST';
  screenState: 'ON' | 'OFF' | 'OFF_BY_HOST';
  screenShareInfo?: string;
  hasHandRaised: boolean;
  handRaisedAt?: Date;
  handLoweredAt?: Date;
  status: 'WAITING' | 'APPROVED' | 'REJECTED' | 'ADMITTED' | 'LEFT';
  sessions: Session[];
  totalDurationSec: number;
  createdAt: Date;
}

interface Session {
  joinedAt: Date;
  leftAt?: Date;
  durationSec: number;
}
```

### **Meeting Object**
```typescript
interface Meeting {
  _id: string;
  title: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  inviteCode: string;
  isPrivate: boolean;
  isLocked: boolean;
  scheduledFor?: Date;
  actualStartAt?: Date;
  endedAt?: Date;
  durationMin?: number;
  participantCount: number;
  hostId: {
    _id: string;
    displayName: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### **Chat Message Object**
```typescript
interface ChatMessage {
  _id: string;
  content: string;
  senderId: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  senderType: 'PARTICIPANT' | 'SYSTEM';
  messageType: 'TEXT' | 'FILE' | 'IMAGE' | 'SYSTEM';
  createdAt: Date;
}
```

### **Recording Object**
```typescript
interface Recording {
  recordingId: string;
  status: 'STARTING' | 'RECORDING' | 'PAUSED' | 'STOPPING' | 'COMPLETED' | 'FAILED';
  recordingType: 'FULL_SESSION' | 'SCREEN_ONLY' | 'AUDIO_ONLY';
  quality: 'SD' | 'HD' | 'FHD';
  startedAt: Date;
  stoppedAt?: Date;
  pausedAt?: Date;
  resumedAt?: Date;
  durationSec: number;
  fileSize?: number;
  downloadUrl?: string;
}
```

---

## 🚀 **Frontend Integration Examples**

### **Real-time Participant Monitoring**
```javascript
// Get all participants and monitor their status
const { data, loading, error } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
  variables: { meetingId: meetingId },
  pollInterval: 5000, // Poll every 5 seconds
});

// Monitor raised hands
const { data: raisedHands } = useQuery(GET_RAISED_HANDS, {
  variables: { 
    input: { 
      meetingId: meetingId, 
      includeLowered: false 
    } 
  },
  pollInterval: 2000, // Poll every 2 seconds for raised hands
});
```

### **Media Controls**
```javascript
// Force mute a participant
const [forceMute] = useMutation(FORCE_MUTE);
await forceMute({
  variables: {
    input: {
      meetingId: meetingId,
      participantId: participantId,
      micState: 'MUTED_BY_HOST',
      reason: 'Please mute your microphone'
    }
  }
});
```

### **Screen Share Management**
```javascript
// Get active screen sharers
const { data: screenSharers } = useQuery(GET_ACTIVE_SCREEN_SHARERS, {
  variables: { meetingId: meetingId },
  pollInterval: 3000,
});

// Force screen share control
const [forceScreenShare] = useMutation(FORCE_SCREEN_SHARE_CONTROL);
await forceScreenShare({
  variables: {
    input: {
      meetingId: meetingId,
      participantId: participantId,
      screenState: 'ON',
      reason: 'Please share your screen'
    }
  }
});
```

---

## 📝 **Important Notes**

1. **Authentication**: All APIs require a valid JWT token in the Authorization header
2. **Real-time Updates**: Use polling or WebSocket connections for real-time updates
3. **Error Handling**: Always handle GraphQL errors and network failures
4. **Permissions**: Only tutors/hosts can use control APIs (mute, camera, etc.)
5. **Rate Limiting**: Implement proper rate limiting for frequent API calls
6. **LiveKit Integration**: Use LiveKit tokens for actual video/audio streaming

---

## 🔗 **GraphQL Endpoint**
```
http://localhost:3007/graphql
```

All APIs are available at this endpoint with proper authentication headers.
