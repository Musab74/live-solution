# Update Meeting API Documentation

## Overview
The Update Meeting API allows users to modify scheduled meetings, including updating the title, scheduled time, duration, and other meeting details. Only meeting hosts and admins can update meetings.

## GraphQL Mutation

```graphql
mutation UpdateMeeting($meetingId: ID!, $input: UpdateMeetingInput!) {
  updateMeeting(meetingId: $meetingId, input: $input) {
    _id
    title
    notes
    isPrivate
    scheduledFor
    durationMin
    duration
    maxParticipants
    status
    inviteCode
    participantCount
    host {
      _id
      email
      displayName
      systemRole
      avatarUrl
    }
    updatedAt
  }
}
```

## Input Parameters

### UpdateMeetingInput
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | String | No | Meeting title (max 200 characters) |
| `notes` | String | No | Meeting notes/description (max 1000 characters) |
| `isPrivate` | Boolean | No | Whether the meeting is private |
| `scheduledFor` | String | No | Scheduled date/time (ISO string) or null to remove scheduling |
| `duration` | Int | No | Meeting duration in minutes (min 1) |
| `maxParticipants` | Int | No | Maximum number of participants (min 1) |

## API Examples

### 1. Update Meeting Title
```bash
curl -X POST http://localhost:3007/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation UpdateMeeting($meetingId: ID!, $input: UpdateMeetingInput!) { updateMeeting(meetingId: $meetingId, input: $input) { _id title status scheduledFor } }",
    "variables": {
      "meetingId": "68cb734d0d96a87a2d5f5803",
      "input": {
        "title": "Updated Meeting Title"
      }
    }
  }'
```

### 2. Reschedule Meeting
```bash
curl -X POST http://localhost:3007/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation UpdateMeeting($meetingId: ID!, $input: UpdateMeetingInput!) { updateMeeting(meetingId: $meetingId, input: $input) { _id title status scheduledFor duration } }",
    "variables": {
      "meetingId": "68cb734d0d96a87a2d5f5803",
      "input": {
        "scheduledFor": "2025-09-20T14:00:00.000Z",
        "duration": 90
      }
    }
  }'
```

### 3. Update Multiple Fields
```bash
curl -X POST http://localhost:3007/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation UpdateMeeting($meetingId: ID!, $input: UpdateMeetingInput!) { updateMeeting(meetingId: $meetingId, input: $input) { _id title notes isPrivate scheduledFor duration maxParticipants status } }",
    "variables": {
      "meetingId": "68cb734d0d96a87a2d5f5803",
      "input": {
        "title": "Team Standup Meeting",
        "notes": "Daily standup for the development team",
        "isPrivate": true,
        "scheduledFor": "2025-09-19T09:00:00.000Z",
        "duration": 30,
        "maxParticipants": 15
      }
    }
  }'
```

### 4. Remove Scheduling (Make it Instant Meeting)
```bash
curl -X POST http://localhost:3007/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation UpdateMeeting($meetingId: ID!, $input: UpdateMeetingInput!) { updateMeeting(meetingId: $meetingId, input: $input) { _id title status scheduledFor } }",
    "variables": {
      "meetingId": "68cb734d0d96a87a2d5f5803",
      "input": {
        "scheduledFor": null
      }
    }
  }'
```

## Response Format

### Success Response
```json
{
  "data": {
    "updateMeeting": {
      "_id": "68cb734d0d96a87a2d5f5803",
      "title": "Updated Meeting Title",
      "notes": "Meeting description",
      "isPrivate": false,
      "scheduledFor": "2025-09-20T14:00:00.000Z",
      "durationMin": 90,
      "duration": 90,
      "maxParticipants": 100,
      "status": "SCHEDULED",
      "inviteCode": "ABC12345",
      "participantCount": 0,
      "host": {
        "_id": "68cb4ebd2090d04b045548d7",
        "email": "admin@example.com",
        "displayName": "Admin User",
        "systemRole": "ADMIN",
        "avatarUrl": null
      },
      "updatedAt": "2025-09-18T04:30:00.000Z"
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
      "message": "You can only update your own meetings",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

### 3. Meeting Cannot Be Updated (Live/Ended)
```json
{
  "errors": [
    {
      "message": "Cannot update a meeting that is currently live",
      "extensions": {
        "code": "BAD_REQUEST"
      }
    }
  ]
}
```

### 4. Invalid Date Format
```json
{
  "errors": [
    {
      "message": "Invalid date format: invalid-date. Please use a valid date string.",
      "extensions": {
        "code": "BAD_REQUEST"
      }
    }
  ]
}
```

### 5. Past Date Error
```json
{
  "errors": [
    {
      "message": "Cannot schedule a meeting in the past",
      "extensions": {
        "code": "BAD_REQUEST"
      }
    }
  ]
}
```

## Business Rules

1. **Permissions**: Only meeting hosts and admins can update meetings
2. **Status Restrictions**: Cannot update meetings that are LIVE or ENDED
3. **Date Validation**: Cannot schedule meetings in the past
4. **Status Updates**: 
   - Setting `scheduledFor` to a valid date sets status to `SCHEDULED`
   - Setting `scheduledFor` to null/empty sets status to `CREATED`
5. **Field Updates**: All fields are optional - only provided fields are updated
6. **Validation**: 
   - Title max 200 characters
   - Notes max 1000 characters
   - Duration minimum 1 minute
   - Max participants minimum 1

## Frontend Integration

### React/Next.js Example
```typescript
const updateMeeting = async (meetingId: string, updates: UpdateMeetingInput) => {
  const mutation = `
    mutation UpdateMeeting($meetingId: ID!, $input: UpdateMeetingInput!) {
      updateMeeting(meetingId: $meetingId, input: $input) {
        _id
        title
        scheduledFor
        duration
        status
        updatedAt
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
      variables: { meetingId, input: updates }
    })
  });

  return response.json();
};

// Usage
await updateMeeting('68cb734d0d96a87a2d5f5803', {
  title: 'New Meeting Title',
  scheduledFor: '2025-09-20T14:00:00.000Z',
  duration: 60
});
```

## Testing with Postman

1. **Set Headers**:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_JWT_TOKEN`

2. **Body** (raw JSON):
```json
{
  "query": "mutation UpdateMeeting($meetingId: ID!, $input: UpdateMeetingInput!) { updateMeeting(meetingId: $meetingId, input: $input) { _id title status scheduledFor duration } }",
  "variables": {
    "meetingId": "YOUR_MEETING_ID",
    "input": {
      "title": "Updated Title",
      "scheduledFor": "2025-09-20T14:00:00.000Z"
    }
  }
}
```

## Available Meeting IDs for Testing
- `68cb734d0d96a87a2d5f5803` - Admin meeting
- `68ca40f6638593a6ba193d54` - Tutor meeting
- `68ca3f2b638593a6ba193d47` - Meeting with null host

## Notes
- All date inputs should be in ISO 8601 format
- The API automatically updates the meeting status based on scheduling
- Changes are logged for audit purposes
- Only the meeting host or admin can update the meeting
