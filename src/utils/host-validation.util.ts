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
    this.logger.debug(`[HOST_VALIDATION] Starting validation:`, {
      meetingHostId,
      meetingHostIdType: typeof meetingHostId,
      meetingHostIdString: meetingHostId?.toString(),
      currentHostId,
      currentHostIdType: typeof currentHostId,
      currentHostIdString: currentHostId?.toString(),
      userId,
      userIdType: typeof userId,
      userIdString: userId?.toString(),
      userSystemRole,
      meetingId
    });

    // Method 1: Check if user is admin
    const isAdmin = userSystemRole === 'ADMIN';
    this.logger.debug(`[HOST_VALIDATION] Admin check: ${isAdmin}`);

    // Method 2: Check if user is the original meeting host
    const isMeetingHost = MeetingUtils.isMeetingHost(meetingHostId, userId);
    this.logger.debug(`[HOST_VALIDATION] Original host check: ${isMeetingHost}`, {
      meetingHostIdString: meetingHostId?.toString(),
      userIdString: userId?.toString(),
      comparison: `${meetingHostId?.toString()} === ${userId?.toString()}`
    });

    // Method 2b: Check if user is the current host (for transferred host)
    const isCurrentHost = currentHostId ? MeetingUtils.isMeetingHost(currentHostId, userId) : false;
    this.logger.debug(`[HOST_VALIDATION] Current host check: ${isCurrentHost}`, {
      currentHostIdString: currentHostId?.toString(),
      userIdString: userId?.toString(),
      comparison: currentHostId ? `${currentHostId?.toString()} === ${userId?.toString()}` : 'No currentHostId'
    });

    // Method 3: Check if user has HOST role in participants
    let isHostParticipant = false;
    try {
      this.logger.debug(`[HOST_VALIDATION] Searching for host participant with userId: ${userId}`);
      
      const hostParticipant = await participantModel.findOne({
        meetingId: new Types.ObjectId(meetingId),
        $or: [
          { userId: new Types.ObjectId(userId) },
          { 'userId._id': new Types.ObjectId(userId) }
        ],
        role: 'HOST',
      });
      
      isHostParticipant = !!hostParticipant;
      this.logger.debug(`[HOST_VALIDATION] Host participant check: ${isHostParticipant}`, {
        foundParticipant: !!hostParticipant,
        participantId: hostParticipant?._id,
        participantUserId: hostParticipant?.userId,
        participantRole: hostParticipant?.role
      });
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

    this.logger.debug(`[HOST_VALIDATION] Final result:`, result);

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
