import { Types } from 'mongoose';
import { Logger } from '@nestjs/common';
import { MeetingUtils } from './meeting-utils';

export interface HostValidationResult {
  isAuthorized: boolean;
  isMeetingHost: boolean;
  isHostParticipant: boolean;
  isAdmin: boolean;
  reason?: string;
}

export class HostValidationUtil {
  private static readonly logger = new Logger(HostValidationUtil.name);

  /**
   * Comprehensive host validation that checks multiple authorization methods
   * @param meetingHostId - The host ID from the meeting document (original tutor)
   * @param userId - The user ID to validate
   * @param userSystemRole - The user's system role
   * @param participantModel - Mongoose model for participants
   * @param meetingId - The meeting ID for participant lookup
   * @param currentHostId - Optional current host ID (for transferred host)
   * @returns Promise<HostValidationResult>
   */
  static async validateHost(
    meetingHostId: any,
    userId: any,
    userSystemRole: string,
    participantModel: any,
    meetingId: string,
    currentHostId?: any
  ): Promise<HostValidationResult> {
    // Method 1: Check if user is admin
    const isAdmin = userSystemRole === 'ADMIN';

    // Method 2: Check if user is the original meeting host
    const isMeetingHost = MeetingUtils.isMeetingHost(meetingHostId, userId);

    // Method 2b: Check if user is the current host (for transferred host)
    const isCurrentHost = currentHostId ? MeetingUtils.isMeetingHost(currentHostId, userId) : false;

    // Method 3: Check if user has HOST role in participants
    let isHostParticipant = false;
    try {
      const hostParticipant = await participantModel.findOne({
        meetingId: new Types.ObjectId(meetingId),
        $or: [
          { userId: new Types.ObjectId(userId) },
          { 'userId._id': new Types.ObjectId(userId) }
        ],
        role: 'HOST',
      });
      
      isHostParticipant = !!hostParticipant;
    } catch (error) {
      this.logger.warn(`[HOST_VALIDATION] Error checking host participant:`, error);
    }

    const isAuthorized = isAdmin || isMeetingHost || isCurrentHost || isHostParticipant;
    
    const result: HostValidationResult = {
      isAuthorized,
      isMeetingHost: isMeetingHost || isCurrentHost,
      isHostParticipant,
      isAdmin,
      reason: isAuthorized ? 'User is authorized' : 'User is not authorized to perform this action'
    };

    return result;
  }

  /**
   * Simple host ID comparison utility
   * @param meetingHostId - The host ID from the meeting document
   * @param userId - The user ID to compare
   * @returns boolean
   */
  static isMeetingHost(meetingHostId: any, userId: string): boolean {
    if (!meetingHostId) return false;
    
    if (typeof meetingHostId === 'object' && '_id' in meetingHostId) {
      // Populated hostId object
      return meetingHostId._id.toString() === userId.toString();
    } else {
      // Direct ObjectId or string
      return meetingHostId.toString() === userId.toString();
    }
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
