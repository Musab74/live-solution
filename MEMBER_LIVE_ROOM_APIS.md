# 🎓 Member Live Room APIs - Complete Frontend Integration Guide

## 📋 **Overview**
This document provides all GraphQL APIs and data structures available for **members/students/participants** in live rooms. All APIs require authentication via `Authorization: Bearer <token>` header.

---

## 🔐 **Authentication APIs**

### **Login as Member**
```graphql
mutation {
  login(email: "student@example.com", password: "password123") {
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

### **Signup as Member**
```graphql
mutation {
  signup(input: {
    email: "student@example.com"
    password: "password123"
    displayName: "John Student"
    systemRole: MEMBER
  }) {
    success
    message
    token
    user {
      _id
      email
      displayName
      systemRole
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

## 🏠 **Meeting Access APIs**

### **Join Meeting by Invite Code**
```graphql
mutation {
  joinMeetingByCode(input: {
    inviteCode: "ABC123"
    displayName: "John Student"
  }) {
    success
    message
    meeting {
      _id
      title
      status
      isPrivate
      isLocked
      hostId {
        _id
        displayName
        email
      }
    }
    participant {
      _id
      displayName
      role
      status
    }
  }
}
```

### **Join Meeting (if already have meeting ID)**
```graphql
mutation {
  joinMeeting(input: {
    meetingId: "MEETING_ID"
    displayName: "John Student"
  }) {
    success
    message
    participant {
      _id
      displayName
      role
      status
      micState
      cameraState
      screenState
    }
  }
}
```

### **Leave Meeting**
```graphql
mutation {
  leaveMeeting(input: {
    participantId: "PARTICIPANT_ID"
  }) {
    success
    message
    participant {
      _id
      displayName
      totalDurationSec
    }
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
      avatarUrl
    }
    createdAt
  }
}
```

### **Get Available Meetings**
```graphql
query {
  getMeetings(input: {}) {
    meetings {
      _id
      title
      status
      inviteCode
      isPrivate
      isLocked
      scheduledFor
      participantCount
      hostId {
        _id
        displayName
        email
      }
      createdAt
    }
    totalCount
    hasMore
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

**Note:** Members can now view all participants in meetings they are part of (not just hosts).

### **Get Waiting Participants**
```graphql
query {
  getWaitingParticipants(meetingId: "MEETING_ID") {
    _id
    displayName
    role
    micState
    cameraState
    status
    createdAt
  }
}
```

**Note:** Members can see who is waiting to join the meeting.

---

## 👤 **My Participant Management APIs**

### **Get My Participant Status**
```graphql
query {
  getParticipantById(participantId: "PARTICIPANT_ID") {
    _id
    displayName
    role
    micState
    cameraState
    screenState
    screenShareInfo
    hasHandRaised
    handRaisedAt
    handLoweredAt
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

### **Update My Participant Info**
```graphql
mutation {
  updateParticipant(input: {
    participantId: "PARTICIPANT_ID"
    displayName: "John Student Updated"
  }) {
    success
    message
    participant {
      _id
      displayName
      role
    }
  }
}
```

### **Update My Session (when rejoining)**
```graphql
mutation {
  updateSession(input: {
    participantId: "PARTICIPANT_ID"
    action: "JOIN" # or "LEAVE"
  }) {
    success
    message
    participant {
      _id
      displayName
      sessions {
        joinedAt
        leftAt
        durationSec
      }
      totalDurationSec
    }
  }
}
```

---

## 🎤 **Media Control APIs (Self-Management)**

### **Update My Microphone State**
```graphql
mutation {
  updateParticipant(input: {
    participantId: "PARTICIPANT_ID"
    micState: ON # ON, OFF
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

### **Update My Camera State**
```graphql
mutation {
  updateParticipant(input: {
    participantId: "PARTICIPANT_ID"
    cameraState: ON # ON, OFF
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

### **Update My Screen Share Info**
```graphql
mutation {
  updateScreenShareInfo(input: {
    participantId: "PARTICIPANT_ID"
    screenState: ON # ON, OFF
    screenShareInfo: "Desktop 1" # Optional: which screen/window
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

---

## 🙋‍♂️ **Raise Hand APIs**

### **Raise My Hand**
```graphql
mutation {
  raiseHand(input: {
    participantId: "PARTICIPANT_ID"
    reason: "I have a question about slide 5"
  }) {
    success
    message
    participantId
    hasHandRaised
    handRaisedAt
    reason
  }
}
```

### **Lower My Hand**
```graphql
mutation {
  lowerHand(input: {
    participantId: "PARTICIPANT_ID"
    reason: "Question answered"
  }) {
    success
    message
    participantId
    hasHandRaised
    handLoweredAt
    reason
  }
}
```

### **Get My Hand Status**
```graphql
query {
  getParticipantHandStatus(participantId: "PARTICIPANT_ID") {
    participantId
    displayName
    hasHandRaised
    handRaisedAt
    handLoweredAt
    handRaiseDuration
    isWaitingForResponse
  }
}
```

### **Get All Raised Hands (to see queue)**
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
      handRaiseDuration
      isWaitingForResponse
    }
    totalRaisedHands
    meetingId
    timestamp
  }
}
```

---

## 💬 **Chat APIs**

### **Send Chat Message**
```graphql
mutation {
  # This would be implemented in your chat resolver
  sendMessage(input: {
    meetingId: "MEETING_ID"
    content: "Hello everyone!"
    messageType: TEXT
  }) {
    success
    message
    chatMessage {
      _id
      content
      senderId {
        _id
        displayName
        avatarUrl
      }
      messageType
      createdAt
    }
  }
}
```

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

## 🎥 **LiveKit Integration APIs**

### **Get LiveKit Token (for video/audio)**
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

---

## 📊 **Meeting Analytics APIs**

### **Get Meeting Attendance (my participation)**
```graphql
query {
  getMeetingAttendance(meetingId: "MEETING_ID") {
    totalParticipants
    currentlyOnline
    averageDuration
    myParticipation {
      totalDurationSec
      sessions {
        joinedAt
        leftAt
        durationSec
      }
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
    myStats {
      isOnline
      micState
      cameraState
      hasHandRaised
      totalDurationSec
    }
  }
}
```

---

## 🔧 **Device Testing APIs**

### **Test My Device**
```graphql
query {
  testDevice(input: {
    testMic: true
    testCamera: true
    testSpeaker: true
  }) {
    success
    message
    results {
      micWorking
      cameraWorking
      speakerWorking
      micLevel
      cameraResolution
    }
  }
}
```

---

## 📱 **Profile Management APIs**

### **Update My Profile**
```graphql
mutation {
  updateProfile(input: {
    displayName: "John Student Updated"
    email: "john.updated@example.com"
  }) {
    success
    message
    user {
      _id
      displayName
      email
      avatarUrl
    }
  }
}
```

### **Upload Profile Image**
```graphql
mutation {
  uploadProfileImage(file: "FILE_UPLOAD") {
    success
    message
    avatarUrl
    user {
      _id
      displayName
      avatarUrl
    }
  }
}
```

### **Change Password**
```graphql
mutation {
  changePassword(input: {
    currentPassword: "oldpassword"
    newPassword: "newpassword"
  }) {
    success
    message
  }
}
```

---

## 🎯 **Data Structures for Frontend**

### **Participant Object (My Status)**
```typescript
interface MyParticipant {
  _id: string;
  displayName: string;
  role: 'PARTICIPANT';
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
    avatarUrl?: string;
  };
  createdAt: Date;
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

### **Raise Hand Object**
```typescript
interface HandRaiseInfo {
  participantId: string;
  displayName: string;
  hasHandRaised: boolean;
  handRaisedAt?: Date;
  handLoweredAt?: Date;
  handRaiseDuration?: number;
  isWaitingForResponse: boolean;
}
```

---

## 🚀 **Frontend Integration Examples**

### **Join Meeting Flow**
```javascript
// 1. Join meeting with invite code
const [joinMeeting] = useMutation(JOIN_MEETING_BY_CODE);
const { data: joinResult } = await joinMeeting({
  variables: {
    input: {
      inviteCode: "ABC123",
      displayName: "John Student"
    }
  }
});

// 2. Get LiveKit token for video/audio
const [getToken] = useMutation(CREATE_LIVEKIT_TOKEN);
const { data: tokenData } = await getToken({
  variables: { meetingId: joinResult.joinMeetingByCode.meeting._id }
});

// 3. Connect to LiveKit room
const room = new Room();
await room.connect(tokenData.createLivekitToken.token);
```

### **Real-time Status Monitoring**
```javascript
// Monitor my participant status
const { data: myStatus, loading } = useQuery(GET_PARTICIPANT_BY_ID, {
  variables: { participantId: participantId },
  pollInterval: 5000, // Poll every 5 seconds
});

// Monitor raised hands queue
const { data: raisedHands } = useQuery(GET_RAISED_HANDS, {
  variables: { 
    input: { 
      meetingId: meetingId, 
      includeLowered: false 
    } 
  },
  pollInterval: 2000,
});

// Check my position in queue
const myHandRaise = raisedHands?.getRaisedHands.raisedHands.find(
  hand => hand.participantId === participantId
);
```

### **Raise Hand Management**
```javascript
// Raise hand
const [raiseHand] = useMutation(RAISE_HAND);
await raiseHand({
  variables: {
    input: {
      participantId: participantId,
      reason: "I have a question about the material"
    }
  }
});

// Lower hand
const [lowerHand] = useMutation(LOWER_HAND);
await lowerHand({
  variables: {
    input: {
      participantId: participantId,
      reason: "Question answered"
    }
  }
});
```

### **Media Controls**
```javascript
// Toggle microphone
const [updateParticipant] = useMutation(UPDATE_PARTICIPANT);
await updateParticipant({
  variables: {
    input: {
      participantId: participantId,
      micState: isMicOn ? 'OFF' : 'ON'
    }
  }
});

// Toggle camera
await updateParticipant({
  variables: {
    input: {
      participantId: participantId,
      cameraState: isCameraOn ? 'OFF' : 'ON'
    }
  }
});
```

### **Chat Integration**
```javascript
// Send message
const [sendMessage] = useMutation(SEND_MESSAGE);
await sendMessage({
  variables: {
    input: {
      meetingId: meetingId,
      content: messageText,
      messageType: 'TEXT'
    }
  }
});

// Get chat history
const { data: chatHistory } = useQuery(GET_CHAT_HISTORY, {
  variables: {
    input: {
      meetingId: meetingId,
      limit: 50,
      offset: 0
    }
  },
  pollInterval: 3000, // Poll for new messages
});
```

---

## 🎮 **Member Dashboard Features**

### **Meeting Status Card**
```javascript
const MeetingStatusCard = ({ meetingId }) => {
  const { data: meeting } = useQuery(GET_MEETING_BY_ID, {
    variables: { meetingId }
  });
  
  const { data: myStatus } = useQuery(GET_PARTICIPANT_BY_ID, {
    variables: { participantId: myParticipantId },
    pollInterval: 5000
  });

  return (
    <div className="meeting-status-card">
      <h3>{meeting?.getMeetingById.title}</h3>
      <p>Status: {meeting?.getMeetingById.status}</p>
      <p>My Status: {myStatus?.getParticipantById.status}</p>
      <p>Duration: {myStatus?.getParticipantById.totalDurationSec}s</p>
    </div>
  );
};
```

### **Raise Hand Queue**
```javascript
const RaiseHandQueue = ({ meetingId }) => {
  const { data: raisedHands } = useQuery(GET_RAISED_HANDS, {
    variables: { 
      input: { 
        meetingId, 
        includeLowered: false 
      } 
    },
    pollInterval: 2000
  });

  const myPosition = raisedHands?.getRaisedHands.raisedHands.findIndex(
    hand => hand.participantId === myParticipantId
  ) + 1;

  return (
    <div className="raise-hand-queue">
      <h4>Raise Hand Queue</h4>
      {myPosition > 0 && (
        <p>Your position: {myPosition}</p>
      )}
      <div className="queue-list">
        {raisedHands?.getRaisedHands.raisedHands.map((hand, index) => (
          <div key={hand.participantId} className={`queue-item ${hand.participantId === myParticipantId ? 'my-hand' : ''}`}>
            <span>{index + 1}. {hand.displayName}</span>
            <span>{hand.handRaiseDuration}s</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 📝 **Important Notes for Members**

1. **Authentication**: All APIs require a valid JWT token
2. **Permissions**: Members can only control their own media and raise hand
3. **Waiting Room**: Members may need to wait for host approval
4. **Real-time Updates**: Use polling for status updates
5. **LiveKit Integration**: Use tokens for video/audio streaming
6. **Error Handling**: Handle meeting locks, rejections, and network issues
7. **Reconnection**: Handle session updates when rejoining

---

## 🔗 **GraphQL Endpoint**
```
http://localhost:3007/graphql
```

All APIs are available at this endpoint with proper authentication headers.

---

## 🎯 **Key Member Features Summary**

- ✅ **Join meetings** with invite codes
- ✅ **Control own media** (mic, camera)
- ✅ **Raise hand** with reasons
- ✅ **View raise hand queue**
- ✅ **Chat** with other participants
- ✅ **Get LiveKit tokens** for video/audio
- ✅ **Monitor own status** and participation
- ✅ **Update profile** and settings
- ✅ **Test devices** before joining
- ✅ **Real-time status** monitoring
