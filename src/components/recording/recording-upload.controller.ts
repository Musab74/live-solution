import { Controller, Post, UseInterceptors, UploadedFile, Body, Logger, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vod, VodDocument } from '../../schemas/Vod.model';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { VodSourceType } from '../../libs/enums/enums';
const FormData = require('form-data');

// Fix for Multer type
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

interface RecordingUploadDto {
  meetingId: string;
  userId: string;
  recordingName?: string;
  duration?: number;
}

@Controller('recording-upload')
export class RecordingUploadController {
  private readonly logger = new Logger(RecordingUploadController.name);

  constructor(
    @InjectModel(Vod.name) private vodModel: Model<VodDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
  ) {}

  @Post('client-recording')
  @UseInterceptors(FileInterceptor('recording', {
    storage: diskStorage({
      destination: '/tmp/recordings',
      filename: (req, file, cb) => {
        const uniqueName = `${randomUUID()}`;
        cb(null, uniqueName);
      },
    }),
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB limit
    },
  }))
  async uploadClientRecording(
    @UploadedFile() file: MulterFile,
    @Body() body: RecordingUploadDto,
  ) {
    try {
      this.logger.log(`[CLIENT_RECORDING] Upload started:`, {
        meetingId: body.meetingId,
        userId: body.userId,
        fileName: file.filename,
        originalName: file.originalname,
        size: file.size,
      });

      if (!file) {
        throw new BadRequestException('No recording file provided');
      }

      if (!body.meetingId || !body.userId) {
        throw new BadRequestException('Meeting ID and User ID are required');
      }

      // Generate final filename with readable format
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const fileExtension = file.originalname.split('.').pop() || 'webm';
      
      // Create readable filename: MeetingName_YYYY-MM-DD_HH-MM-SS.webm
      const meetingName = body.recordingName || body.meetingId || 'Meeting';
      const finalFileName = `${meetingName}_${dateStr}_${timeStr}.${fileExtension}`;
      
      this.logger.log(`[CLIENT_RECORDING] Generated filename: ${finalFileName}`);

      // Upload to VOD server
      const vodUploadSuccess = await this.uploadToVodServer(file.path, finalFileName);
      
      if (!vodUploadSuccess) {
        throw new BadRequestException('Failed to upload recording to VOD server');
      }

      // Clean up local file immediately
      try {
        fs.unlinkSync(file.path);
        this.logger.log(`[CLIENT_RECORDING] Local file cleaned up: ${file.path}`);
      } catch (cleanupError) {
        this.logger.warn(`[CLIENT_RECORDING] Warning: Could not clean up local file: ${cleanupError.message}`);
      }

      // Generate VOD server URL
      const vodServerUrl = process.env.VOD_SERVER_RECORDINGS_URL || 'https://i-vod1.hrdeedu.co.kr/recordings';
      const recordingUrl = `${vodServerUrl}/${finalFileName}`;

      this.logger.log(`[CLIENT_RECORDING] ✅ Recording uploaded successfully: ${recordingUrl}`);

      // Auto-create VOD entry in database
      try {
        const meeting = await this.meetingModel.findById(body.meetingId);
        const recordingDuration = body.duration || 0; // Duration in seconds
        
        const newVod = new this.vodModel({
          title: `${meeting?.title || 'Meeting'} - Recording`,
          notes: `Automatically created from client recording on ${new Date().toLocaleDateString()}. Uploaded to VOD server.`,
          meetingId: body.meetingId,
          source: VodSourceType.FILE,
          storageKey: `recordings/${finalFileName}`,
          sizeBytes: file.size,
          durationSec: recordingDuration,
          url: recordingUrl,
        });

        await newVod.save();
        this.logger.log(`[CLIENT_RECORDING] ✅ VOD entry created: ${newVod._id} for meeting ${body.meetingId}`);
      } catch (vodError) {
        this.logger.error(`[CLIENT_RECORDING] ❌ Failed to create VOD entry: ${vodError.message}`);
        // Don't fail the upload if VOD creation fails
      }

      return {
        success: true,
        message: 'Recording saved successfully!',
        recordingId: finalFileName.split('.')[0], // Just the ID without extension
        size: file.size,
        meetingId: body.meetingId,
        userId: body.userId,
      };

    } catch (error) {
      this.logger.error(`[CLIENT_RECORDING] ❌ Upload failed:`, error.message);
      
      // Clean up local file on error
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          this.logger.warn(`[CLIENT_RECORDING] Could not clean up file on error: ${cleanupError.message}`);
        }
      }

      throw error;
    }
  }

  private async uploadToVodServer(localFilePath: string, fileName: string): Promise<boolean> {
    try {
      this.logger.log(`[VOD_UPLOAD] Uploading to VOD server: ${fileName}`);

      const FormData = require('form-data');
      const formData = new FormData();
      
      // Determine content type based on file extension
      const isMP4 = fileName.toLowerCase().endsWith('.mp4');
      const contentType = isMP4 ? 'video/mp4' : 'video/webm';
      
      formData.append('recording', fs.createReadStream(localFilePath), {
        filename: fileName,
        contentType: contentType
      });

      const response = await axios.post('https://i-vod1.hrdeedu.co.kr/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minutes timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (response.status === 200 || response.status === 201) {
        this.logger.log(`[VOD_UPLOAD] ✅ Upload successful: ${fileName}`);
        return true;
      } else {
        this.logger.error(`[VOD_UPLOAD] ❌ VOD server returned status: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`[VOD_UPLOAD] ❌ Upload failed:`, error.message);
      return false;
    }
  }
}
