import { Types } from 'mongoose';

/**
 * Utility functions for meeting-related operations
 */
export class MeetingUtils {
  /**
   * Safely compare meeting hostId with user ID
   * Handles both populated and non-populated hostId fields
   * @param meetingHostId - The hostId from meeting document (can be ObjectId, populated object, or string)
   * @param userId - The user ID to compare (can be ObjectId or string)
   * @returns boolean
   */
  static isMeetingHost(meetingHostId: any, userId: any): boolean {
    if (!meetingHostId || !userId) return false;
    
    // Convert both to strings for comparison
    let hostIdString: string;
    let userIdString: string;
    
    // Extract hostId string
    if (typeof meetingHostId === 'object' && '_id' in meetingHostId) {
      // Populated hostId object
      hostIdString = meetingHostId._id.toString();
    } else {
      // Direct ObjectId or string
      hostIdString = meetingHostId.toString();
    }
    
    // Extract userId string
    if (typeof userId === 'object' && 'toString' in userId) {
      // ObjectId or similar object
      userIdString = userId.toString();
    } else {
      // String
      userIdString = String(userId);
    }
    
    return hostIdString === userIdString;
  }

  /**
   * Safely extract hostId string from meeting hostId field
   * @param meetingHostId - The hostId from meeting document
   * @returns string | null
   */
  static extractHostIdString(meetingHostId: any): string | null {
    if (!meetingHostId) return null;
    
    if (typeof meetingHostId === 'object' && '_id' in meetingHostId) {
      // Populated hostId object
      return meetingHostId._id.toString();
    } else {
      // Direct ObjectId or string
      return meetingHostId.toString();
    }
  }

  /**
   * Check if user is the current meeting host (for meeting management)
   * This checks both hostId (original tutor) and currentHostId (current host)
   * @param meeting - The meeting document with hostId and currentHostId
   * @param userId - The user ID to compare
   * @returns boolean
   */
  static isCurrentMeetingHost(meeting: any, userId: any): boolean {
    if (!meeting || !userId) return false;
    
    // Check if user is the original tutor (hostId)
    const isOriginalHost = this.isMeetingHost(meeting.hostId, userId);
    
    // Check if user is the current host (currentHostId)
    const isCurrentHost = meeting.currentHostId ? 
      this.isMeetingHost(meeting.currentHostId, userId) : false;
    
    // User is a host if they are either the original tutor OR the current host
    return isOriginalHost || isCurrentHost;
  }

  /**
   * Check if user is the original tutor/creator of the meeting
   * @param meeting - The meeting document
   * @param userId - The user ID to compare
   * @returns boolean
   */
  static isOriginalTutor(meeting: any, userId: any): boolean {
    if (!meeting || !userId) return false;
    return this.isMeetingHost(meeting.hostId, userId);
  }

  /**
   * Check if user is admin
   * @param userSystemRole - The user's system role
   * @returns boolean
   */
  static isAdmin(userSystemRole: string): boolean {
    return userSystemRole === 'ADMIN';
  }
}
