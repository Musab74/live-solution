# 🚀 API Mismatch Migration Guide

## 🚨 **CRITICAL FIXES APPLIED**

This guide shows how to fix the "incoming is not iterable" errors and other API mismatches.

## 📋 **BEFORE vs AFTER**

### **❌ BEFORE (Causing Errors):**

```typescript
// WRONG: Multiple conflicting queries
const GET_CHAT_HISTORY_V1 = gql`
  query GetChatHistory($meetingId: ID!, $limit: Int) {
    getChatHistory(meetingId: $meetingId, limit: $limit)
  }
`;

// WRONG: Trying to iterate over entire response
const chatMessages = chatData; // This causes "incoming is not iterable"

// WRONG: No error handling
{chatData.map(message => ...)}
```

### **✅ AFTER (Fixed):**

```typescript
// CORRECT: Single standardized query
const GET_CHAT_HISTORY = gql`
  query GetChatHistory($input: ChatHistoryInput!) {
    getChatHistory(input: $input) {
      messages { _id, text, displayName, createdAt }
      total, hasMore, limit, nextCursor
    }
  }
`;

// CORRECT: Extract messages array safely
const chatMessages = extractChatMessages(chatData);

// CORRECT: Safe iteration with error handling
{safeMap(chatMessages, message => ...)}
```

## 🔧 **STEP-BY-STEP MIGRATION**

### **Step 1: Replace All GraphQL Queries**

Replace all your existing queries with the standardized ones from `src/standardized-queries.ts`:

```typescript
// Import the correct queries
import {
  GET_CHAT_HISTORY,
  GET_PARTICIPANTS_BY_MEETING,
  JOIN_MEETING,
  START_MEETING
} from './standardized-queries';
```

### **Step 2: Use Data Extraction Helpers**

Replace direct data access with safe extraction:

```typescript
// Import helpers
import {
  extractChatMessages,
  extractParticipants,
  safeMap,
  handleGraphQLError
} from './frontend-helpers';

// In your components
const { data: chatData, error: chatError } = useQuery(GET_CHAT_HISTORY, {
  variables: { input: { meetingId, limit: 50 } },
  onCompleted: (data) => {
    // ✅ CORRECT: Extract messages array
    const messages = extractChatMessages(data);
    setChatMessages(messages);
  },
  onError: (error) => {
    handleGraphQLError(error);
    setChatMessages([]);
  }
});
```

### **Step 3: Fix All Iterations**

Replace all direct iterations with safe ones:

```typescript
// ❌ WRONG
{chatData.map(message => ...)}

// ✅ CORRECT
{safeMap(extractChatMessages(chatData), message => ...)}
```

### **Step 4: Add Error Handling**

Wrap all GraphQL operations with proper error handling:

```typescript
const { data, loading, error } = useQuery(GET_CHAT_HISTORY, {
  variables: { input: { meetingId, limit: 50 } },
  onCompleted: (data) => {
    const messages = extractChatMessages(data);
    setChatMessages(messages);
  },
  onError: (error) => {
    console.error('Query error:', error);
    setChatMessages([]);
  }
});

if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
```

## 📊 **API MAPPING REFERENCE**

### **Chat APIs:**
- `getChatHistory(input: ChatHistoryInput!)` → Returns `{ messages: [], total, hasMore, limit, nextCursor }`
- `getChatStats(meetingId: ID!)` → Returns `{ totalMessages, messagesToday, activeUsers, averageMessagesPerUser }`
- `deleteChatMessage(input: DeleteMessageInput!)` → Returns `{ success, message, messageId }`

### **Meeting APIs:**
- `getMeetingById(meetingId: ID!)` → Returns `MeetingWithHost` object
- `createMeeting(input: CreateMeetingInput!)` → Returns `MeetingWithHost` object
- `startMeeting(meetingId: ID!)` → Returns `MeetingWithHost` object

### **Participant APIs:**
- `joinMeeting(input: JoinParticipantInput!)` → Returns `ParticipantResponse` object
- `getParticipantsByMeeting(meetingId: ID!)` → Returns `ParticipantWithLoginInfo[]` array
- `getParticipantStats(meetingId: ID!)` → Returns `ParticipantStats` object

## 🎯 **COMMON FIXES**

### **Fix 1: Chat Messages Not Displaying**

```typescript
// ❌ BEFORE
const chatMessages = chatData;

// ✅ AFTER
const chatMessages = extractChatMessages(chatData);
```

### **Fix 2: Participants Not Loading**

```typescript
// ❌ BEFORE
const participants = participantsData;

// ✅ AFTER
const participants = extractParticipants(participantsData);
```

### **Fix 3: "incoming is not iterable" Error**

```typescript
// ❌ BEFORE
{data.map(item => ...)}

// ✅ AFTER
{safeMap(extractData(data), item => ...)}
```

### **Fix 4: GraphQL Variable Errors**

```typescript
// ❌ BEFORE
variables: { meetingId, limit: 50 }

// ✅ AFTER
variables: { input: { meetingId, limit: 50 } }
```

## 🚀 **QUICK START**

1. **Copy the standardized queries** from `src/standardized-queries.ts`
2. **Copy the helpers** from `src/frontend-helpers.ts`
3. **Replace all your existing queries** with the standardized ones
4. **Use the extraction helpers** for all data access
5. **Add error handling** to all GraphQL operations

## ✅ **VERIFICATION**

After migration, verify:
- [ ] No "incoming is not iterable" errors
- [ ] Chat messages display correctly
- [ ] Participants load properly
- [ ] All GraphQL queries use correct input structure
- [ ] Error handling is in place
- [ ] Console shows no GraphQL errors

## 🆘 **TROUBLESHOOTING**

### **Still getting "incoming is not iterable"?**
- Check that you're using `extractChatMessages()` or `extractParticipants()`
- Verify the GraphQL query structure matches the backend
- Add `debugDataStructure(data, 'Label')` to see the actual data structure

### **GraphQL validation errors?**
- Ensure all queries use the correct input structure
- Check that field names match the backend schema exactly
- Verify all required fields are provided

### **Data not loading?**
- Check the Network tab for GraphQL errors
- Verify the backend is running and accessible
- Add error handling to see what's failing

This migration will fix all the API mismatches and eliminate the "incoming is not iterable" errors! 🎉
