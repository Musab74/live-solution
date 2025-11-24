import { Controller, Post, UseInterceptors, UploadedFile, Body, Logger, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vod, VodDocument } from '../../schemas/Vod.model';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { VodSourceType } from '../../libs/enums/enums';
const FormData = require('form-data');

const execAsync = promisify(exec);

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
      const originalExtension = file.originalname.split('.').pop() || 'webm';
      const isWebM = originalExtension.toLowerCase() === 'webm';
      
      // Create readable filename: MeetingName_YYYY-MM-DD_HH-MM-SS.mp4 (always MP4 for better seeking)
      const meetingName = body.recordingName || body.meetingId || 'Meeting';
      const finalFileName = `${meetingName}_${dateStr}_${timeStr}.mp4`;
      
      this.logger.log(`[CLIENT_RECORDING] Generated filename: ${finalFileName}`);
      this.logger.log(`[CLIENT_RECORDING] Original file: ${file.originalname}, isWebM: ${isWebM}`);

      // Convert WebM to MP4 for better seeking support
      let finalFilePath = file.path;
      if (isWebM) {
        try {
          finalFilePath = await this.convertWebMToMP4(file.path, finalFileName);
          this.logger.log(`[CLIENT_RECORDING] ✅ Converted WebM to MP4: ${finalFilePath}`);
        } catch (conversionError) {
          this.logger.warn(`[CLIENT_RECORDING] ⚠️ WebM to MP4 conversion failed, using original: ${conversionError.message}`);
          // If conversion fails, use original file but change extension in filename
          // The file will still work, just might not have optimal seeking
        }
      }

      // Get final file size BEFORE cleanup (converted file if conversion happened, original otherwise)
      const finalFileSize = fs.existsSync(finalFilePath) 
        ? fs.statSync(finalFilePath).size 
        : file.size;

      // Upload to VOD server
      const vodUploadSuccess = await this.uploadToVodServer(finalFilePath, finalFileName);
      
      if (!vodUploadSuccess) {
        throw new BadRequestException('Failed to upload recording to VOD server');
      }

      // Clean up local files immediately after successful upload
      try {
        // Clean up original file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          this.logger.log(`[CLIENT_RECORDING] Original file cleaned up: ${file.path}`);
        }
        // Clean up converted file if different from original
        if (finalFilePath !== file.path && fs.existsSync(finalFilePath)) {
          fs.unlinkSync(finalFilePath);
          this.logger.log(`[CLIENT_RECORDING] Converted file cleaned up: ${finalFilePath}`);
        }
      } catch (cleanupError) {
        this.logger.warn(`[CLIENT_RECORDING] Warning: Could not clean up local file: ${cleanupError.message}`);
      }

      // Generate VOD server URL
      const vodServerUrl = process.env.VOD_SERVER_RECORDINGS_URL || 'https://i-vod1.hrdeedu.co.kr/recordings';
      const recordingUrl = `${vodServerUrl}/${finalFileName}`;

      this.logger.log(`[CLIENT_RECORDING] ✅ Recording uploaded successfully: ${recordingUrl}`);
      this.logger.log(`[CLIENT_RECORDING] Final file size: ${finalFileSize} bytes (original: ${file.size} bytes)`);

      // Auto-create VOD entry in database
      try {
        const meeting = await this.meetingModel.findById(body.meetingId);
        const recordingDuration = body.duration || 0; // Duration in seconds
        
        const newVod = new this.vodModel({
          title: `${meeting?.title || 'Meeting'} - Recording`,
          notes: `Automatically created from client recording on ${new Date().toLocaleDateString()}. Uploaded to VOD server.${isWebM ? ' Converted from WebM to MP4 for better seeking support.' : ''}`,
          meetingId: body.meetingId,
          source: VodSourceType.FILE,
          storageKey: `recordings/${finalFileName}`,
          sizeBytes: finalFileSize,
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
        size: finalFileSize,
        meetingId: body.meetingId,
        userId: body.userId,
      };

    } catch (error) {
      this.logger.error(`[CLIENT_RECORDING] ❌ Upload failed:`, error.message);
      
      // Clean up local files on error
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          this.logger.warn(`[CLIENT_RECORDING] Could not clean up original file on error: ${cleanupError.message}`);
        }
      }
      // Also clean up converted file if it exists (check if finalFileName was defined)
      try {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const meetingName = body?.recordingName || body?.meetingId || 'Meeting';
        const possibleFileName = `${meetingName}_${dateStr}_${timeStr}.mp4`;
        const convertedPath = path.join('/tmp/recordings', possibleFileName);
        if (fs.existsSync(convertedPath)) {
          fs.unlinkSync(convertedPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Convert WebM file to MP4 using FFmpeg for better seeking support
   * MP4 format has proper metadata structure that allows video players to seek
   */
  private async convertWebMToMP4(inputPath: string, outputFileName: string): Promise<string> {
    const outputPath = path.join('/tmp/recordings', outputFileName);
    
    // Check if FFmpeg is available
    try {
      await execAsync('which ffmpeg');
    } catch (error) {
      throw new Error('FFmpeg is not installed. Please install FFmpeg to enable video conversion.');
    }

    // FFmpeg command to convert WebM to MP4 with proper metadata for seeking
    // -movflags +faststart: Moves metadata to the beginning of the file for better streaming/seeking
    // -c:v libx264: Use H.264 codec (widely supported)
    // -c:a aac: Use AAC audio codec (widely supported)
    // -preset medium: Balance between speed and compression
    // -crf 23: Good quality setting (lower = better quality, higher = smaller file)
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -c:v libx264 -c:a aac -preset medium -crf 23 -movflags +faststart -y "${outputPath}"`;
    
    this.logger.log(`[FFMPEG] Converting WebM to MP4: ${inputPath} -> ${outputPath}`);
    
    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
        timeout: 600000, // 10 minutes timeout for long videos
      });
      
      if (stderr) {
        this.logger.log(`[FFMPEG] FFmpeg stderr: ${stderr}`);
      }
      
      if (!fs.existsSync(outputPath)) {
        throw new Error('FFmpeg conversion completed but output file not found');
      }
      
      const inputStats = fs.statSync(inputPath);
      const outputStats = fs.statSync(outputPath);
      this.logger.log(`[FFMPEG] ✅ Conversion complete. Input: ${inputStats.size} bytes, Output: ${outputStats.size} bytes`);
      
      return outputPath;
    } catch (error) {
      this.logger.error(`[FFMPEG] ❌ Conversion failed: ${error.message}`);
      throw error;
    }
  }

  private async uploadToVodServer(localFilePath: string, fileName: string): Promise<boolean> {
    try {
      this.logger.log(`[VOD_UPLOAD] Uploading to VOD server: ${fileName}`);

      const FormData = require('form-data');
      const formData = new FormData();
      
      // Determine content type based on file extension
      // All files are now MP4 after conversion
      const contentType = 'video/mp4';
      
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
