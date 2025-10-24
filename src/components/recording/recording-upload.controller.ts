import { Controller, Post, UseInterceptors, UploadedFile, Body, Logger, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
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

  @Post('client-recording')
  @UseInterceptors(FileInterceptor('recording', {
    storage: diskStorage({
      destination: '/tmp/recordings',
      filename: (req, file, cb) => {
        const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
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

      // Generate final filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalFileName = `${body.meetingId}_${timestamp}_${file.filename}`;
      
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

      return {
        success: true,
        message: 'Recording uploaded successfully',
        recordingUrl: recordingUrl,
        fileName: finalFileName,
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
      
      formData.append('recording', fs.createReadStream(localFilePath), {
        filename: fileName,
        contentType: 'video/mp4'
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
