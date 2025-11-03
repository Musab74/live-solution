// ========================================
// DATA EXTRACTION UTILITIES
// ========================================
// These utilities fix the "incoming is not iterable" errors

// ========================================
// CHAT DATA EXTRACTION
// ========================================

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

export const extractChatStats = (chatData: any) => {
  return chatData?.getChatStats || chatData || {
    totalMessages: 0,
    messagesToday: 0,
    activeUsers: 0,
    averageMessagesPerUser: 0
  };
};

// ========================================
// MEETING DATA EXTRACTION
// ========================================

export const extractMeeting = (meetingData: any) => {
  return meetingData?.getMeetingById || meetingData || null;
};

export const extractCreatedMeeting = (meetingData: any) => {
  return meetingData?.createMeeting || meetingData || null;
};

export const extractStartedMeeting = (meetingData: any) => {
  return meetingData?.startMeeting || meetingData || null;
};

// ========================================
// PARTICIPANT DATA EXTRACTION
// ========================================

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

export const extractJoinedParticipant = (joinData: any) => {
  return joinData?.joinMeeting || joinData || null;
};

export const extractParticipantStats = (statsData: any) => {
  return statsData?.getParticipantStats || statsData || {
    totalParticipants: 0,
    currentlyOnline: 0,
    activeParticipants: 0,
    mutedParticipants: 0,
    cameraOffParticipants: 0,
    raisedHandsCount: 0,
    screenSharersCount: 0
  };
};

export const extractRaisedHands = (handsData: any) => {
  return handsData?.getRaisedHands?.raisedHands || handsData?.raisedHands || [];
};

export const extractWaitingParticipants = (waitingData: any): any[] => {
  if (Array.isArray(waitingData)) {
    return waitingData;
  }
  
  return waitingData?.getWaitingParticipants || waitingData?.waitingParticipants || [];
};

// ========================================
// SAFE ITERATION HELPERS
// ========================================

export const safeMap = <T>(data: any, mapper: (item: T, index: number) => any): any[] => {
  if (!Array.isArray(data)) {
    return [];
  }
  
  try {
    return data.map(mapper);
  } catch (error) {
    return [];
  }
};

export const safeFilter = <T>(data: any, predicate: (item: T) => boolean): T[] => {
  if (!Array.isArray(data)) {
    return [];
  }
  
  try {
    return data.filter(predicate);
  } catch (error) {
    return [];
  }
};

export const safeFind = <T>(data: any, predicate: (item: T) => boolean): T | undefined => {
  if (!Array.isArray(data)) {
    return undefined;
  }
  
  try {
    return data.find(predicate);
  } catch (error) {
    return undefined;
  }
};

// ========================================
// ERROR HANDLING HELPERS
// ========================================

export const handleGraphQLError = (error: any, fallback: any = null) => {
  return fallback;
};

export const isGraphQLError = (error: any): boolean => {
  return error?.graphQLErrors?.length > 0 || error?.networkError;
};

