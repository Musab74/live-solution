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

export const safeFind = <T>(data: any, predicate: (item: T) => boolean): T | undefined => {
  if (!Array.isArray(data)) {
    console.warn('safeFind: data is not an array', data);
    return undefined;
  }
  
  try {
    return data.find(predicate);
  } catch (error) {
    console.error('safeFind: error during finding', error);
    return undefined;
  }
};

// ========================================
// ERROR HANDLING HELPERS
// ========================================

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

export const isGraphQLError = (error: any): boolean => {
  return error?.graphQLErrors?.length > 0 || error?.networkError;
};

// ========================================
// DEBUG HELPERS
// ========================================

export const debugDataStructure = (data: any, label: string = 'Data') => {
  console.log(`${label} Structure:`, {
    type: typeof data,
    isArray: Array.isArray(data),
    keys: data && typeof data === 'object' ? Object.keys(data) : 'N/A',
    length: Array.isArray(data) ? data.length : 'N/A',
    data: data
  });
};
