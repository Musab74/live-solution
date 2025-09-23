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

export const GET_CHAT_STATS = `
  query GetChatStats($meetingId: ID!) {
    getChatStats(meetingId: $meetingId) {
      totalMessages
      messagesToday
      activeUsers
      averageMessagesPerUser
    }
  }
`;

export const DELETE_CHAT_MESSAGE = `
  mutation DeleteChatMessage($input: DeleteMessageInput!) {
    deleteChatMessage(input: $input) {
      success
      message
      messageId
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

export const GET_PARTICIPANT_STATS = `
  query GetParticipantStats($meetingId: ID!) {
    getParticipantStats(meetingId: $meetingId) {
      totalParticipants
      currentlyOnline
      totalSessions
      averageSessionDuration
      totalMeetingDuration
      activeParticipants
      mutedParticipants
      cameraOffParticipants
      raisedHandsCount
      screenSharersCount
    }
  }
`;

export const GET_RAISED_HANDS = `
  query GetRaisedHands($input: RaisedHandsInput!) {
    getRaisedHands(input: $input) {
      raisedHands {
        participantId
        reason
        raisedAt
      }
      totalRaisedHands
      meetingId
      timestamp
    }
  }
`;

export const GET_WAITING_PARTICIPANTS = `
  query GetWaitingParticipants($meetingId: ID!) {
    getWaitingParticipants(meetingId: $meetingId) {
      _id
      displayName
      email
      role
    }
  }
`;

// ========================================
// SUBSCRIPTIONS
// ========================================

export const MEETING_UPDATED = `
  subscription MeetingUpdated($meetingId: ID!) {
    meetingUpdated(meetingId: $meetingId) {
      _id
      title
      status
      actualStartAt
      endedAt
    }
  }
`;

export const PARTICIPANT_JOINED = `
  subscription ParticipantJoined($meetingId: ID!) {
    participantJoined(meetingId: $meetingId) {
      _id
      displayName
      role
      micState
      cameraState
    }
  }
`;

export const PARTICIPANT_LEFT = `
  subscription ParticipantLeft($meetingId: ID!) {
    participantLeft(meetingId: $meetingId) {
      _id
      displayName
    }
  }
`;

export const CHAT_MESSAGE_ADDED = `
  subscription ChatMessageAdded($meetingId: ID!) {
    chatMessageAdded(meetingId: $meetingId) {
      _id
      text
      displayName
      userId
      createdAt
      user {
        _id
        displayName
        avatarUrl
      }
    }
  }
`;

export const HAND_RAISED = `
  subscription HandRaised($meetingId: ID!) {
    handRaised(meetingId: $meetingId) {
      participantId
      reason
      raisedAt
    }
  }
`;

export const HAND_LOWERED = `
  subscription HandLowered($meetingId: ID!) {
    handLowered(meetingId: $meetingId) {
      participantId
      reason
      loweredAt
    }
  }
`;
