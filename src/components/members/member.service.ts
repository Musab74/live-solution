import { Injectable, ConflictException, UnauthorizedException, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { AuthService } from '../auth/auth.service';
import { MemberInput } from '../../libs/DTO/member/member.input';
import { UpdateMemberInput } from '../../libs/DTO/member/member.update';
import { SystemRole } from '../../libs/enums/enums';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);

  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private authService: AuthService,
  ) {}

  // USER SIGN UP (MEMBER role)
  async signup(memberInput: MemberInput) {
    const { email, password, displayName, department, phone } = memberInput;

    // Check if user already exists
    const existingUser = await this.memberModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.authService.hashPassword(password);

    // Create new user as MEMBER
    const newUser = new this.memberModel({
      email,
      passwordHash,
      displayName,
      department,
      phone,
      systemRole: SystemRole.MEMBER,
      lastSeenAt: new Date(),
    });

    const savedUser = await newUser.save();

    // Generate JWT token
    const token = await this.authService.createToken(savedUser);

    // Return user data without password
    const { passwordHash: _, ...userWithoutPassword } = savedUser.toObject();
    
    this.logger.log(`[USER_SIGNUP] Success - Email: ${email}, Role: MEMBER`);
    
    return {
      user: userWithoutPassword,
      token,
    };
  }

  // TUTOR SIGN UP (TUTOR role)
  async tutorSignup(memberInput: MemberInput) {
    const { email, password, displayName, department, phone } = memberInput;

    // Check if user already exists
    const existingUser = await this.memberModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.authService.hashPassword(password);

    // Create new user as TUTOR
    const newUser = new this.memberModel({
      email,
      passwordHash,
      displayName,
      department,
      phone,
      systemRole: SystemRole.TUTOR,
      lastSeenAt: new Date(),
    });

    const savedUser = await newUser.save();

    // Generate JWT token
    const token = await this.authService.createToken(savedUser);

    // Return user data without password
    const { passwordHash: _, ...userWithoutPassword } = savedUser.toObject();
    
    this.logger.log(`[TUTOR_SIGNUP] Success - Email: ${email}, Role: TUTOR`);
    
    return {
      user: userWithoutPassword,
      token,
    };
  }

  // LOGIN
  async login(loginInput: { email: string; password: string }) {
    const { email, password } = loginInput;

    // Find user by email
    const user = await this.memberModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.authService.comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last seen
    user.lastSeenAt = new Date();
    await user.save();

    // Generate JWT token
    const token = await this.authService.createToken(user);

    // Return user data without password
    const { passwordHash: _, ...userWithoutPassword } = user.toObject();
    
    return {
      user: userWithoutPassword,
      token,
    };
  }

  // TUTOR LOGIN (Role-specific login)
  async tutorLogin(loginInput: { email: string; password: string }) {
    const { email, password } = loginInput;

    // Find user by email
    const user = await this.memberModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is TUTOR or ADMIN
    if (user.systemRole !== SystemRole.TUTOR && user.systemRole !== SystemRole.ADMIN) {
      throw new UnauthorizedException('Access denied. Tutor role required.');
    }

    // Verify password
    const isPasswordValid = await this.authService.comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last seen
    user.lastSeenAt = new Date();
    await user.save();

    // Generate JWT token
    const token = await this.authService.createToken(user);

    // Return user data without password
    const { passwordHash: _, ...userWithoutPassword } = user.toObject();
    
    this.logger.log(`[TUTOR_LOGIN] Success - Email: ${email}, Role: ${user.systemRole}`);
    
    return {
      user: userWithoutPassword,
      token,
    };
  }

  // ADMIN LOGIN (Role-specific login)
  async adminLogin(loginInput: { email: string; password: string }) {
    const { email, password } = loginInput;

    // Find user by email
    const user = await this.memberModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is ADMIN
    if (user.systemRole !== SystemRole.ADMIN) {
      throw new UnauthorizedException('Access denied. Admin role required.');
    }

    // Verify password
    const isPasswordValid = await this.authService.comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last seen
    user.lastSeenAt = new Date();
    await user.save();

    // Generate JWT token
    const token = await this.authService.createToken(user);

    // Return user data without password
    const { passwordHash: _, ...userWithoutPassword } = user.toObject();
    
    this.logger.log(`[ADMIN_LOGIN] Success - Email: ${email}, Role: ${user.systemRole}`);
    
    return {
      user: userWithoutPassword,
      token,
    };
  }

  // GET PROFILE
  async getProfile(userId: string) {
    const user = await this.memberModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Return user data without password
    const { passwordHash: _, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  // UPDATE PROFILE
  async updateProfile(userId: string, updateData: UpdateMemberInput) {
    const user = await this.memberModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update allowed fields
    if (updateData.displayName) user.displayName = updateData.displayName;
    if (updateData.avatarUrl) user.avatarUrl = updateData.avatarUrl;
    if (updateData.department) user.department = updateData.department;
    if (updateData.phone) user.phone = updateData.phone;
    if (updateData.language) user.language = updateData.language;
    if (updateData.timezone) user.timezone = updateData.timezone;

    await user.save();

    // Return updated user data without password
    const { passwordHash: _, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  // CHANGE PASSWORD
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.memberModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.authService.comparePassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await this.authService.hashPassword(newPassword);
    user.passwordHash = newPasswordHash;
    await user.save();

    return { message: 'Password changed successfully' };
  }

  
  async getAllMembers() {
    const users = await this.memberModel.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
    return users;
  }

  async deleteMember(userId: string) {
    const user = await this.memberModel.findByIdAndDelete(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { message: 'User deleted successfully' };
  }

  // LOGOUT
  async logout(userId: string) {
    // Update lastSeenAt timestamp
    await this.memberModel.findByIdAndUpdate(userId, {
      lastSeenAt: new Date()
    });

    // In a real application, you might want to:
    // 1. Add token to blacklist
    // 2. Clear user sessions
    // 3. Notify other services about logout
    
    return { 
      success: true, 
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    };
  }

  // UPLOAD PROFILE IMAGE
  async uploadProfileImage(userId: string, file: any) {
    const user = await this.memberModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate file object
    if (!file) {
      throw new Error('No file provided');
    }

    // Handle different file object structures
    const originalName = file.originalname || file.filename || 'image';
    const fileBuffer = file.buffer || file.data;
    
    if (!fileBuffer) {
      throw new Error('File buffer is empty');
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename with safe extension
    const fileExtension = originalName ? path.extname(originalName) : '.jpg';
    const fileName = `avatar_${userId}_${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file
    fs.writeFileSync(filePath, fileBuffer);

    // Generate URL
    const avatarUrl = `/uploads/avatars/${fileName}`;

    // Update user's avatar URL
    user.avatarUrl = avatarUrl;
    await user.save();

    // Return updated user data without password
    const { passwordHash: _, ...userWithoutPassword } = user.toObject();
    
    return {
      success: true,
      message: 'Profile image uploaded successfully',
      avatarUrl,
      user: userWithoutPassword
    };
  }

  // DELETE PROFILE IMAGE
  async deleteProfileImage(userId: string) {
    const user = await this.memberModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete old image file if it exists
    if (user.avatarUrl) {
      const oldFilePath = path.join(process.cwd(), user.avatarUrl);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Clear avatar URL
    user.avatarUrl = undefined;
    await user.save();

    // Return updated user data without password
    const { passwordHash: _, ...userWithoutPassword } = user.toObject();
    
    return {
      success: true,
      message: 'Profile image deleted successfully',
      user: userWithoutPassword
    };
  }

  // ADMIN: PROMOTE USER ROLE
  async promoteUserRole(userId: string, newRole: SystemRole, adminId: string) {
    this.logger.log(`[PROMOTE_USER_ROLE] Attempt - User ID: ${userId}, New Role: ${newRole}, Admin ID: ${adminId}`);
    
    try {
      // Verify admin has permission
      const admin = await this.memberModel.findById(adminId);
      if (!admin || admin.systemRole !== SystemRole.ADMIN) {
        throw new ForbiddenException('Only admins can promote users');
      }

      // Find user to promote
      const user = await this.memberModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Update user role
      const oldRole = user.systemRole;
      user.systemRole = newRole;
      await user.save();

      this.logger.log(`[PROMOTE_USER_ROLE] Success - User ID: ${userId}, ${oldRole} → ${newRole}`);
      return { 
        success: true, 
        message: `User role updated from ${oldRole} to ${newRole}`,
        user: {
          _id: user._id,
          email: user.email,
          displayName: user.displayName,
          systemRole: user.systemRole
        }
      };
    } catch (error) {
      this.logger.error(`[PROMOTE_USER_ROLE] Failed - User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // ADMIN: DELETE USER
  async deleteUser(userId: string, adminId: string) {
    this.logger.log(`[DELETE_USER] Attempt - User ID: ${userId}, Admin ID: ${adminId}`);
    
    try {
      // Verify admin has permission
      const admin = await this.memberModel.findById(adminId);
      if (!admin || admin.systemRole !== SystemRole.ADMIN) {
        throw new ForbiddenException('Only admins can delete users');
      }

      // Find user to delete
      const user = await this.memberModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prevent admin from deleting themselves
      if (userId === adminId) {
        throw new ForbiddenException('Admins cannot delete themselves');
      }

      // Prevent deleting other admins
      if (user.systemRole === SystemRole.ADMIN) {
        throw new ForbiddenException('Cannot delete other admin users');
      }

      // Delete user
      await this.memberModel.findByIdAndDelete(userId);

      this.logger.log(`[DELETE_USER] Success - User ID: ${userId}, Email: ${user.email}`);
      return { 
        success: true, 
        message: `User ${user.email} deleted successfully`
      };
    } catch (error) {
      this.logger.error(`[DELETE_USER] Failed - User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // ADMIN: BLOCK USER
  async blockUser(userId: string, adminId: string, reason?: string) {
    this.logger.log(`[BLOCK_USER] Attempt - User ID: ${userId}, Admin ID: ${adminId}, Reason: ${reason || 'No reason provided'}`);
    
    try {
      // Verify admin has permission
      const admin = await this.memberModel.findById(adminId);
      if (!admin || admin.systemRole !== SystemRole.ADMIN) {
        throw new ForbiddenException('Only admins can block users');
      }

      // Find user to block
      const user = await this.memberModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prevent admin from blocking themselves
      if (userId === adminId) {
        throw new ForbiddenException('Admins cannot block themselves');
      }

      // Prevent blocking other admins
      if (user.systemRole === SystemRole.ADMIN) {
        throw new ForbiddenException('Cannot block other admin users');
      }

      // Block user
      user.isBlocked = true;
      user.blockedAt = new Date();
      user.blockedBy = adminId;
      user.blockReason = reason || 'No reason provided';
      await user.save();

      this.logger.log(`[BLOCK_USER] Success - User ID: ${userId}, Email: ${user.email}`);
      return { 
        success: true, 
        message: `User ${user.email} blocked successfully`,
        user: {
          _id: user._id,
          email: user.email,
          displayName: user.displayName,
          systemRole: user.systemRole,
          isBlocked: user.isBlocked,
          blockedAt: user.blockedAt,
          blockReason: user.blockReason
        }
      };
    } catch (error) {
      this.logger.error(`[BLOCK_USER] Failed - User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // ADMIN: UNBLOCK USER
  async unblockUser(userId: string, adminId: string) {
    this.logger.log(`[UNBLOCK_USER] Attempt - User ID: ${userId}, Admin ID: ${adminId}`);
    
    try {
      // Verify admin has permission
      const admin = await this.memberModel.findById(adminId);
      if (!admin || admin.systemRole !== SystemRole.ADMIN) {
        throw new ForbiddenException('Only admins can unblock users');
      }

      // Find user to unblock
      const user = await this.memberModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user is actually blocked
      if (!user.isBlocked) {
        throw new BadRequestException('User is not currently blocked');
      }

      // Unblock user
      user.isBlocked = false;
      user.unblockedAt = new Date();
      user.unblockedBy = adminId;
      user.blockedAt = undefined;
      user.blockedBy = undefined;
      user.blockReason = undefined;
      await user.save();

      this.logger.log(`[UNBLOCK_USER] Success - User ID: ${userId}, Email: ${user.email}`);
      return { 
        success: true, 
        message: `User ${user.email} unblocked successfully`,
        user: {
          _id: user._id,
          email: user.email,
          displayName: user.displayName,
          systemRole: user.systemRole,
          isBlocked: user.isBlocked,
          unblockedAt: user.unblockedAt
        }
      };
    } catch (error) {
      this.logger.error(`[UNBLOCK_USER] Failed - User ID: ${userId}, Error: ${error.message}`);
      throw error;
    }
  }

  // CREATE FIRST ADMIN (for initial setup only)
  async createFirstAdmin(adminInput: MemberInput) {
    this.logger.log(`[CREATE_FIRST_ADMIN] Attempt - Email: ${adminInput.email}`);
    
    try {
      const { email, password, displayName, department, phone } = adminInput;

      // Check if any admin already exists
      const existingAdmin = await this.memberModel.findOne({ systemRole: SystemRole.ADMIN });
      if (existingAdmin) {
        throw new ForbiddenException('Admin already exists. Use promoteUserRole instead.');
      }

      // Check if user already exists
      const existingUser = await this.memberModel.findOne({ email });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const passwordHash = await this.authService.hashPassword(password);

      // Create admin user
      const newAdmin = new this.memberModel({
        email,
        passwordHash,
        displayName,
        department,
        phone,
        systemRole: SystemRole.ADMIN, // Create as ADMIN
        lastSeenAt: new Date(),
      });

      const savedAdmin = await newAdmin.save();

      // Generate JWT token
      const token = await this.authService.createToken(savedAdmin);

      this.logger.log(`[CREATE_FIRST_ADMIN] Success - Admin ID: ${savedAdmin._id}, Email: ${email}`);
      
      return {
        token,
        user: {
          _id: savedAdmin._id,
          email: savedAdmin.email,
          displayName: savedAdmin.displayName,
          systemRole: savedAdmin.systemRole,
          department: savedAdmin.department,
          phone: savedAdmin.phone,
        }
      };
    } catch (error) {
      this.logger.error(`[CREATE_FIRST_ADMIN] Failed - Email: ${adminInput.email}, Error: ${error.message}`);
      throw error;
    }
  }
}