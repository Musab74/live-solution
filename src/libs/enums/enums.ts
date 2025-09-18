export enum MeetingStatus {
  CREATED = 'CREATED', // Created but not started
  SCHEDULED = 'SCHEDULED', // 예약된 회의
  LIVE = 'LIVE', // 시작된 회의
  ENDED = 'ENDED', // 종료된 회의
  CANCELED = 'CANCELED',
}

export enum Role {
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  PRESENTER = 'PRESENTER',
  PARTICIPANT = 'PARTICIPANT',
  VIEWER = 'VIEWER',
}

export enum MediaTrack {
  MIC = 'MIC',
  CAMERA = 'CAMERA',
  SCREEN = 'SCREEN',
}

export enum MediaState {
  ON = 'ON', // actively sending audio/video
  OFF = 'OFF', // device disabled by the user
  MUTED = 'MUTED', // user muted themselves (mic only)
  MUTED_BY_HOST = 'MUTED_BY_HOST', // host/admin forced mute
  OFF_BY_HOST = 'OFF_BY_HOST', // host/admin forced camera off
}

export enum VodSourceType {
  FILE = 'FILE',
  URL = 'URL',
}

export enum SystemRole {
  ADMIN = 'ADMIN',
  TUTOR = 'TUTOR',
  MEMBER = 'MEMBER',
}

export enum ParticipantStatus {
  WAITING = 'WAITING', // In waiting room
  APPROVED = 'APPROVED', // Approved by host
  REJECTED = 'REJECTED', // Rejected by host
  ADMITTED = 'ADMITTED', // Admitted to meeting
  LEFT = 'LEFT', // Left the meeting
}

export enum RecordingStatus {
  RECORDING = 'RECORDING', // Currently recording
  PAUSED = 'PAUSED', // Recording paused
  STOPPED = 'STOPPED', // Recording stopped
  PROCESSING = 'PROCESSING', // Processing recording
  FAILED = 'FAILED', // Recording failed
}

// Register enums with GraphQL
import { registerEnumType } from '@nestjs/graphql';

registerEnumType(MediaTrack, {
  name: 'MediaTrack',
  description: 'Media track types for force mute operations',
});

registerEnumType(Role, {
  name: 'Role',
  description: 'Participant roles in meetings',
});

registerEnumType(MediaState, {
  name: 'MediaState',
  description: 'Media state for audio/video controls',
});

registerEnumType(SystemRole, {
  name: 'SystemRole',
  description: 'System-wide user roles',
});

registerEnumType(ParticipantStatus, {
  name: 'ParticipantStatus',
  description: 'Participant status in waiting room',
});

registerEnumType(RecordingStatus, {
  name: 'RecordingStatus',
  description: 'Recording status for meetings',
});
