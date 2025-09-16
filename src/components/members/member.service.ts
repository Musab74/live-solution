import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
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
  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private authService: AuthService,
  ) {}

  // SIGN UP
  async signup(memberInput: MemberInput) {
    const { email, password, displayName, department, phone } = memberInput;

    // Check if user already exists
    const existingUser = await this.memberModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.authService.hashPassword(password);

    // Create new user
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
}