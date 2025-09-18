# Room Locking API Documentation

## Overview
The Room Locking API allows meeting hosts and admins to lock/unlock meeting rooms to prevent new participants from joining. When a room is locked, no new members can join using the invite code, but existing participants can continue to participate.

## Features
- **Lock Room**: Prevent new participants from joining
- **Unlock Room**: Allow new participants to join again
- **Join Protection**: Automatic blocking of join attempts when room is locked
- **Permission Control**: Only meeting hosts and admins can lock/unlock rooms
- **Status Tracking**: Room lock status is visible in meeting data

## GraphQL Mutations

### 1. Lock Room
```graphql
mutation LockRoom($meetingId: ID!) {
  lockRoom(meetingId: $meetingId) {
    success
    message
    meetingId
  }
}
```

### 2. Unlock Room
```graphql
mutation UnlockRoom($meetingId: ID!) {
  unlockRoom(meetingId: $meetingId) {
    success
    message
    meetingId
  }
}
```

## API Examples

### 1. Lock a Meeting Room
```bash
curl -X POST http://localhost:3007/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation LockRoom($meetingId: ID!) { lockRoom(meetingId: $meetingId) { success message meetingId } }",
    "variables": {
      "meetingId": "68cb734d0d96a87a2d5f5803"
    }
  }'
```

**Response:**
```json
{
  "data": {
    "lockRoom": {
      "success": true,
      "message": "Room locked successfully. No new participants can join.",
      "meetingId": "68cb734d0d96a87a2d5f5803"
    }
  }
}
```

### 2. Unlock a Meeting Room
```bash
curl -X POST http://localhost:3007/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation UnlockRoom($meetingId: ID!) { unlockRoom(meetingId: $meetingId) { success message meetingId } }",
    "variables": {
      "meetingId": "68cb734d0d96a87a2d5f5803"
    }
  }'
```

**Response:**
```json
{
  "data": {
    "unlockRoom": {
      "success": true,
      "message": "Room unlocked successfully. New participants can now join.",
      "meetingId": "68cb734d0d96a87a2d5f5803"
    }
  }
}
```

### 3. Check Room Lock Status
```bash
curl -X POST http://localhost:3007/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "query GetMeeting($meetingId: ID!) { getMeetingById(meetingId: $meetingId) { _id title status isLocked inviteCode } }",
    "variables": {
      "meetingId": "68cb734d0d96a87a2d5f5803"
    }
  }'
```

**Response:**
```json
{
  "data": {
    "getMeetingById": {
      "_id": "68cb734d0d96a87a2d5f5803",
      "title": "Scheduled Team Meeting",
      "status": "CREATED",
      "isLocked": true,
      "inviteCode": "LNZ8A1ET"
    }
  }
}
```

### 4. Attempt to Join Locked Room
```bash
curl -X POST http://localhost:3007/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation JoinMeeting($input: JoinMeetingInput!) { joinMeetingByCode(input: $input) { success message } }",
    "variables": {
      "input": {
        "inviteCode": "LNZ8A1ET"
      }
    }
  }'
```

**Response (Locked Room):**
```json
{
  "errors": [
    {
      "message": "This room is currently locked. No new participants can join.",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

**Response (Unlocked Room):**
```json
{
  "data": {
    "joinMeetingByCode": {
      "success": true,
      "message": "Successfully joined meeting",
      "meeting": {
        "_id": "68cb734d0d96a87a2d5f5803",
        "title": "Scheduled Team Meeting",
        "status": "CREATED",
        "isLocked": false
      }
    }
  }
}
```

## Error Responses

### 1. Meeting Not Found
```json
{
  "errors": [
    {
      "message": "Meeting not found",
      "extensions": {
        "code": "NOT_FOUND"
      }
    }
  ]
}
```

### 2. Permission Denied
```json
{
  "errors": [
    {
      "message": "Only the meeting host can lock the room",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

### 3. Meeting Ended
```json
{
  "errors": [
    {
      "message": "Cannot lock a meeting that has ended",
      "extensions": {
        "code": "BAD_REQUEST"
      }
    }
  ]
}
```

### 4. Room Already Locked/Unlocked
```json
{
  "errors": [
    {
      "message": "Room is already locked",
      "extensions": {
        "code": "BAD_REQUEST"
      }
    }
  ]
}
```

## Business Rules

1. **Permissions**: Only meeting hosts and admins can lock/unlock rooms
2. **Status Restrictions**: Cannot lock/unlock meetings that have ended
3. **Join Protection**: Locked rooms prevent new participants from joining
4. **Existing Participants**: Current participants are not affected by room locking
5. **Real-time Updates**: Lock status is immediately reflected in meeting data
6. **Invite Code**: Locked rooms still have valid invite codes, but joining is blocked

## Frontend Integration

### React/Next.js Example
```typescript
const lockRoom = async (meetingId: string) => {
  const mutation = `
    mutation LockRoom($meetingId: ID!) {
      lockRoom(meetingId: $meetingId) {
        success
        message
        meetingId
      }
    }
  `;

  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: mutation,
      variables: { meetingId }
    })
  });

  return response.json();
};

const unlockRoom = async (meetingId: string) => {
  const mutation = `
    mutation UnlockRoom($meetingId: ID!) {
      unlockRoom(meetingId: $meetingId) {
        success
        message
        meetingId
      }
    }
  `;

  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: mutation,
      variables: { meetingId }
    })
  });

  return response.json();
};

// Usage in component
const handleLockToggle = async () => {
  try {
    if (meeting.isLocked) {
      await unlockRoom(meeting._id);
      setMeeting({ ...meeting, isLocked: false });
    } else {
      await lockRoom(meeting._id);
      setMeeting({ ...meeting, isLocked: true });
    }
  } catch (error) {
    console.error('Failed to toggle room lock:', error);
  }
};
```

### Frontend Button Component
```jsx
const LockRoomButton = ({ meeting, onLockChange }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      if (meeting.isLocked) {
        await unlockRoom(meeting._id);
        onLockChange(false);
      } else {
        await lockRoom(meeting._id);
        onLockChange(true);
      }
    } catch (error) {
      alert('Failed to toggle room lock');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`px-4 py-2 rounded-md font-medium ${
        meeting.isLocked
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-red-600 text-white hover:bg-red-700'
      }`}
    >
      {isLoading ? 'Loading...' : meeting.isLocked ? 'Unlock Room' : 'Lock Room'}
    </button>
  );
};
```

## Database Schema

### Meeting Model Updates
```typescript
@Schema({ timestamps: true })
export class Meeting {
  // ... existing fields ...
  
  @Field({ nullable: true })
  @Prop({ default: false }) isLocked?: boolean;
  
  // ... other fields ...
}
```

## WebSocket Events (Optional Enhancement)

For real-time updates, you can add WebSocket events:

```typescript
// In signaling gateway
@WebSocketGateway()
export class SignalingGateway {
  @SubscribeMessage('LOCK_ROOM')
  async handleLockRoom(client: Socket, data: { meetingId: string }) {
    // Emit to all participants in the meeting
    client.to(data.meetingId).emit('ROOM_LOCKED', {
      meetingId: data.meetingId,
      isLocked: true,
      message: 'Room has been locked by the host'
    });
  }

  @SubscribeMessage('UNLOCK_ROOM')
  async handleUnlockRoom(client: Socket, data: { meetingId: string }) {
    // Emit to all participants in the meeting
    client.to(data.meetingId).emit('ROOM_UNLOCKED', {
      meetingId: data.meetingId,
      isLocked: false,
      message: 'Room has been unlocked by the host'
    });
  }
}
```

## Testing with Postman

1. **Set Headers**:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_JWT_TOKEN`

2. **Lock Room Body** (raw JSON):
```json
{
  "query": "mutation LockRoom($meetingId: ID!) { lockRoom(meetingId: $meetingId) { success message meetingId } }",
  "variables": {
    "meetingId": "YOUR_MEETING_ID"
  }
}
```

3. **Unlock Room Body** (raw JSON):
```json
{
  "query": "mutation UnlockRoom($meetingId: ID!) { unlockRoom(meetingId: $meetingId) { success message meetingId } }",
  "variables": {
    "meetingId": "YOUR_MEETING_ID"
  }
}
```

## Available Meeting IDs for Testing
- `68cb734d0d96a87a2d5f5803` - Admin meeting (tested)
- `68ca40f6638593a6ba193d54` - Tutor meeting
- `68ca3f2b638593a6ba193d47` - Meeting with null host

## Security Considerations

1. **Authentication Required**: All lock/unlock operations require valid JWT token
2. **Permission Validation**: Only hosts and admins can modify room lock status
3. **Meeting Status Check**: Cannot lock/unlock ended meetings
4. **Input Validation**: Meeting ID format validation prevents injection attacks
5. **Audit Logging**: All lock/unlock operations are logged for security auditing

## Notes
- Room locking is immediate and affects all new join attempts
- Existing participants are not affected by room locking
- Lock status is persisted in the database
- The `isLocked` field is included in all meeting queries
- Room locking works with both private and public meetings
- Lock status is visible to all users who can view the meeting

