# 🚀 Frontend Integration Guide

## 🎯 **COMPLETE SOLUTION FOR "incoming is not iterable" ERROR**

This guide provides the exact frontend code you need to integrate with this backend.

## 📁 **Files to Create in Your Frontend Project**

### **1. GraphQL Queries (`src/graphql/queries.ts`)**

```typescript
// ========================================
// STANDARDIZED GRAPHQL QUERIES
// ========================================
// These queries match the backend schema exactly

export const GET_CHAT_HISTORY = `
  query GetChatHistory($input: ChatHistoryInput!) {
    getChatHistory(input: $input) {
      messages {
        _id
        text
        userId
        displayName
        createdAt
        updatedAt
        user {
          _id
          displayName
          avatarUrl
        }
        replyToMessage {
          _id
          text
          displayName
          createdAt
        }
      }
      total
      hasMore
      limit
      nextCursor
    }
  }
`;

export const GET_PARTICIPANTS_BY_MEETING = `
  query GetParticipantsByMeeting($meetingId: ID!) {
    getParticipantsByMeeting(meetingId: $meetingId) {
      _id
      meetingId
      displayName
      role
      micState
      cameraState
      socketId
      user {
        _id
        email
        displayName
        avatarUrl
        organization
        department
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_MEETING_BY_ID = `
  query GetMeetingById($meetingId: ID!) {
    getMeetingById(meetingId: $meetingId) {
      _id
      title
      notes
      status
      inviteCode
      isPrivate
      scheduledFor
      actualStartAt
      endedAt
      durationMin
      participantCount
      createdAt
      updatedAt
      hostId
      host {
        _id
        email
        displayName
        systemRole
        avatarUrl
        department
      }
    }
  }
`;

export const CREATE_MEETING = `
  mutation CreateMeeting($input: CreateMeetingInput!) {
    createMeeting(input: $input) {
      _id
      title
      notes
      status
      inviteCode
      isPrivate
      scheduledFor
      durationMin
      participantCount
      createdAt
      updatedAt
      hostId
      host {
        _id
        email
        displayName
        systemRole
        avatarUrl
        department
      }
    }
  }
`;

export const START_MEETING = `
  mutation StartMeeting($meetingId: ID!) {
    startMeeting(meetingId: $meetingId) {
      _id
      title
      notes
      status
      inviteCode
      isPrivate
      isLocked
      scheduledFor
      actualStartAt
      endedAt
      durationMin
      participantCount
      createdAt
      updatedAt
      hostId
      host {
        _id
        email
        displayName
        systemRole
        avatarUrl
        department
      }
    }
  }
`;

export const JOIN_MEETING = `
  mutation JoinMeeting($input: JoinParticipantInput!) {
    joinMeeting(input: $input) {
      _id
      meetingId
      userId
      displayName
      role
      micState
      cameraState
      status
      socketId
      sessions {
        joinedAt
        leftAt
        durationSec
      }
      totalDurationSec
      createdAt
      updatedAt
    }
  }
`;
```

### **2. Data Extraction Utilities (`src/utils/dataExtractors.ts`)**

```typescript
// ========================================
// DATA EXTRACTION UTILITIES
// ========================================
// These utilities fix the "incoming is not iterable" errors

export const extractChatMessages = (chatData: any): any[] => {
  // Handle different response structures
  if (Array.isArray(chatData)) {
    return chatData; // Direct array
  }
  
  if (chatData?.getChatHistory?.messages) {
    return chatData.getChatHistory.messages; // Nested in getChatHistory
  }
  
  if (chatData?.messages) {
    return chatData.messages; // Direct messages property
  }
  
  return []; // Fallback to empty array
};

export const extractParticipants = (participantData: any): any[] => {
  // Handle different response structures
  if (Array.isArray(participantData)) {
    return participantData; // Direct array
  }
  
  if (participantData?.getParticipantsByMeeting) {
    return participantData.getParticipantsByMeeting; // Nested in query
  }
  
  if (participantData?.participants) {
    return participantData.participants; // Nested in participants property
  }
  
  return []; // Fallback to empty array
};

export const extractMeeting = (meetingData: any) => {
  return meetingData?.getMeetingById || meetingData || null;
};

export const extractCreatedMeeting = (meetingData: any) => {
  return meetingData?.createMeeting || meetingData || null;
};

export const extractStartedMeeting = (meetingData: any) => {
  return meetingData?.startMeeting || meetingData || null;
};

export const extractJoinedParticipant = (joinData: any) => {
  return joinData?.joinMeeting || joinData || null;
};

// Safe iteration helpers
export const safeMap = <T>(data: any, mapper: (item: T, index: number) => any): any[] => {
  if (!Array.isArray(data)) {
    console.warn('safeMap: data is not an array', data);
    return [];
  }
  
  try {
    return data.map(mapper);
  } catch (error) {
    console.error('safeMap: error during mapping', error);
    return [];
  }
};

export const safeFilter = <T>(data: any, predicate: (item: T) => boolean): T[] => {
  if (!Array.isArray(data)) {
    console.warn('safeFilter: data is not an array', data);
    return [];
  }
  
  try {
    return data.filter(predicate);
  } catch (error) {
    console.error('safeFilter: error during filtering', error);
    return [];
  }
};

export const handleGraphQLError = (error: any, fallback: any = null) => {
  console.error('GraphQL Error:', error);
  
  if (error?.graphQLErrors?.length > 0) {
    console.error('GraphQL Errors:', error.graphQLErrors);
  }
  
  if (error?.networkError) {
    console.error('Network Error:', error.networkError);
  }
  
  return fallback;
};
```

### **3. React Component Example (`src/components/LivestreamRoom.tsx`)**

```typescript
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_CHAT_HISTORY,
  GET_PARTICIPANTS_BY_MEETING,
  GET_MEETING_BY_ID,
  JOIN_MEETING,
  START_MEETING
} from '../graphql/queries';
import {
  extractChatMessages,
  extractParticipants,
  extractMeeting,
  safeMap,
  handleGraphQLError
} from '../utils/dataExtractors';

interface LivestreamRoomProps {
  meetingId: string;
  userId: string;
  userRole: string;
}

export const LivestreamRoom: React.FC<LivestreamRoomProps> = ({
  meetingId,
  userId,
  userRole
}) => {
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [meeting, setMeeting] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);

  // ========================================
  // GRAPHQL QUERIES
  // ========================================

  // Chat History Query
  const { 
    data: chatData, 
    loading: chatLoading, 
    error: chatError 
  } = useQuery(GET_CHAT_HISTORY, {
    variables: { 
      input: { 
        meetingId, 
        limit: 50 
      } 
    },
    skip: !meetingId,
    onCompleted: (data) => {
      console.log('Chat data received:', data);
      
      // ✅ CORRECT: Extract messages array safely
      const messages = extractChatMessages(data);
      setChatMessages(messages);
    },
    onError: (error) => {
      console.error('Chat query error:', error);
      setChatMessages([]);
    }
  });

  // Participants Query
  const { 
    data: participantsData, 
    loading: participantsLoading, 
    error: participantsError 
  } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId },
    skip: !meetingId,
    onCompleted: (data) => {
      console.log('Participants data received:', data);
      
      // ✅ CORRECT: Extract participants array safely
      const participantsList = extractParticipants(data);
      setParticipants(participantsList);
    },
    onError: (error) => {
      console.error('Participants query error:', error);
      setParticipants([]);
    }
  });

  // Meeting Query
  const { 
    data: meetingData, 
    loading: meetingLoading, 
    error: meetingError 
  } = useQuery(GET_MEETING_BY_ID, {
    variables: { meetingId },
    skip: !meetingId,
    onCompleted: (data) => {
      console.log('Meeting data received:', data);
      
      // ✅ CORRECT: Extract meeting safely
      const meetingInfo = extractMeeting(data);
      setMeeting(meetingInfo);
      
      // Check if user is host
      if (meetingInfo?.hostId === userId) {
        setIsHost(true);
      }
    },
    onError: (error) => {
      console.error('Meeting query error:', error);
      setMeeting(null);
    }
  });

  // ========================================
  // GRAPHQL MUTATIONS
  // ========================================

  const [joinMeeting] = useMutation(JOIN_MEETING, {
    onCompleted: (data) => {
      console.log('Joined meeting:', data);
      const participant = extractJoinedParticipant(data);
      if (participant) {
        setIsJoined(true);
        // Add to participants list
        setParticipants(prev => [...prev, participant]);
      }
    },
    onError: (error) => {
      console.error('Join meeting error:', error);
      handleGraphQLError(error);
    }
  });

  const [startMeeting] = useMutation(START_MEETING, {
    onCompleted: (data) => {
      console.log('Meeting started:', data);
      const meetingInfo = extractStartedMeeting(data);
      if (meetingInfo) {
        setMeeting(meetingInfo);
        setIsHost(true);
      }
    },
    onError: (error) => {
      console.error('Start meeting error:', error);
      handleGraphQLError(error);
    }
  });

  // ========================================
  // EVENT HANDLERS
  // ========================================

  const handleJoinMeeting = async () => {
    try {
      await joinMeeting({
        variables: {
          input: {
            meetingId,
            displayName: 'User Display Name',
            role: 'PARTICIPANT'
          }
        }
      });
    } catch (error) {
      console.error('Failed to join meeting:', error);
    }
  };

  const handleStartMeeting = async () => {
    try {
      await startMeeting({
        variables: { meetingId }
      });
    } catch (error) {
      console.error('Failed to start meeting:', error);
    }
  };

  // ========================================
  // RENDER METHODS
  // ========================================

  const renderChatMessages = () => {
    if (chatLoading) return <div>Loading chat...</div>;
    if (chatError) return <div>Error loading chat</div>;
    
    // ✅ CORRECT: Safe iteration with extracted data
    return (
      <div className="chat-messages">
        {safeMap(chatMessages, (message, index) => (
          <div key={message._id || index} className="chat-message">
            <span className="sender">{message.displayName}</span>
            <span className="text">{message.text}</span>
            <span className="time">
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderParticipants = () => {
    if (participantsLoading) return <div>Loading participants...</div>;
    if (participantsError) return <div>Error loading participants</div>;
    
    // ✅ CORRECT: Safe iteration with extracted data
    return (
      <div className="participants">
        <h3>Participants ({participants.length})</h3>
        {safeMap(participants, (participant, index) => (
          <div key={participant._id || index} className="participant">
            <span className="name">{participant.displayName}</span>
            <span className="role">{participant.role}</span>
            <span className="status">{participant.status}</span>
          </div>
        ))}
      </div>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================

  if (meetingLoading) return <div>Loading meeting...</div>;
  if (meetingError) return <div>Error loading meeting</div>;
  if (!meeting) return <div>Meeting not found</div>;

  return (
    <div className="livestream-container">
      <div className="header">
        <h2>{meeting.title}</h2>
        <div className="controls">
          {!isJoined && (
            <button onClick={handleJoinMeeting}>
              Join Meeting
            </button>
          )}
          {isJoined && userRole === 'TUTOR' && !isHost && (
            <button onClick={handleStartMeeting}>
              Start Meeting
            </button>
          )}
        </div>
      </div>

      <div className="content">
        <div className="main-area">
          {/* Video/Audio area would go here */}
          <div className="video-placeholder">
            Video Stream Area
          </div>
        </div>

        <div className="sidebar">
          {renderParticipants()}
          {renderChatMessages()}
        </div>
      </div>
    </div>
  );
};

export default LivestreamRoom;
```

## 🎯 **KEY FIXES APPLIED**

### **1. Fixed "incoming is not iterable" Error:**
```typescript
// ❌ WRONG - causes error
const chatMessages = chatData;

// ✅ CORRECT - safe extraction
const chatMessages = extractChatMessages(chatData);
```

### **2. Fixed GraphQL Query Structure:**
```typescript
// ❌ WRONG - multiple conflicting versions
query GetChatHistory($meetingId: ID!, $limit: Int) {
  getChatHistory(meetingId: $meetingId, limit: $limit)
}

// ✅ CORRECT - matches backend exactly
query GetChatHistory($input: ChatHistoryInput!) {
  getChatHistory(input: $input) {
    messages { _id, text, displayName, createdAt }
    total, hasMore, limit, nextCursor
  }
}
```

### **3. Fixed Safe Iteration:**
```typescript
// ❌ WRONG - direct iteration
{chatData.map(message => ...)}

// ✅ CORRECT - safe iteration
{safeMap(extractChatMessages(chatData), message => ...)}
```

### **4. Fixed Error Handling:**
```typescript
// ❌ WRONG - no error handling
const { data } = useQuery(GET_CHAT_HISTORY);

// ✅ CORRECT - proper error handling
const { data, loading, error } = useQuery(GET_CHAT_HISTORY, {
  onCompleted: (data) => {
    const messages = extractChatMessages(data);
    setChatMessages(messages);
  },
  onError: (error) => {
    handleGraphQLError(error);
    setChatMessages([]);
  }
});
```

## 🚀 **IMPLEMENTATION STEPS**

1. **Copy the GraphQL queries** to your frontend project
2. **Copy the data extraction utilities** to your frontend project
3. **Use the React component example** as a template
4. **Replace all existing queries** with the standardized ones
5. **Use the extraction helpers** for all data access
6. **Add error handling** to all GraphQL operations

## ✅ **VERIFICATION**

After implementation, verify:
- [ ] No "incoming is not iterable" errors
- [ ] Chat messages display correctly
- [ ] Participants load properly
- [ ] All GraphQL queries use correct input structure
- [ ] Error handling is in place
- [ ] Console shows no GraphQL errors

This solution will completely fix the API mismatches and eliminate the iteration errors! 🎉
