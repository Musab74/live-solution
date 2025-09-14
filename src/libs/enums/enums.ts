export enum MeetingStatus {
    SCHEDULED = 'SCHEDULED',   // 예약된 회의
    LIVE = 'LIVE',             // 시작된 회의
    ENDED = 'ENDED',           // 종료된 회의
    CANCELED = 'CANCELED',
  }
  
  export enum Role {
    HOST = 'HOST',
    CO_HOST = 'CO_HOST',
    PRESENTER = 'PRESENTER',
    PARTICIPANT = 'PARTICIPANT',
    VIEWER = 'VIEWER',
  }
  
  export enum MediaState {
    ON = 'ON',                  // actively sending audio/video
    OFF = 'OFF',                // device disabled by the user
    MUTED = 'MUTED',            // user muted themselves (mic only)
    MUTED_BY_HOST = 'MUTED_BY_HOST',  // host/admin forced mute
    OFF_BY_HOST = 'OFF_BY_HOST',    // host/admin forced camera off
  }
  
  
  export enum VodSourceType {
    FILE = 'FILE',
    URL = 'URL',
  }

  export enum SystemRole {
    ADMIN = 'ADMIN',
    MEMBER = 'MEMBER',
  }
  
  