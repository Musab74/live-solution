import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { InjectModel } from '@nestjs/mongoose';
import { Meeting, MeetingDocument } from '../../schemas/Meeting.model';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { extname } from 'path';
import { Response } from 'express';

const MATERIALS_DIR = path.join(process.cwd(), 'uploads', 'meeting-materials');

// Ensure upload directory exists
if (!fs.existsSync(MATERIALS_DIR)) {
  fs.mkdirSync(MATERIALS_DIR, { recursive: true });
}

@Controller('meeting-materials')
export class MeetingMaterialController {
  private readonly logger = new Logger(MeetingMaterialController.name);

  constructor(
    @InjectModel(Meeting.name) private readonly meetingModel: Model<MeetingDocument>,
  ) {}

  @Post(':meetingId')
  @UseInterceptors(
    FileInterceptor('material', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, MATERIALS_DIR);
        },
        filename: (req, file, cb) => {
          const meetingId =
            (req.params && req.params.meetingId) || 'meeting';
          const fileExt = extname(file.originalname) || '';
          const sanitizedExt = fileExt.replace(/[^a-zA-Z0-9.\-]/g, '');
          const finalExt = sanitizedExt || '.bin';
          const uniqueName = `${meetingId}-${Date.now()}${finalExt}`;
          cb(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit for class materials
      },
    }),
  )
  async uploadMaterial(
    @Param('meetingId') meetingId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No material file uploaded');
    }

    const meeting = await this.meetingModel.findById(meetingId);

    if (!meeting) {
      // Clean up uploaded file if meeting not found
      const uploadedPath = path.join(MATERIALS_DIR, file.filename);
      if (fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }
      throw new NotFoundException('Meeting not found');
    }

    // If a material already exists, remove the old file
    if (meeting.materialStoredName) {
      const previousPath = path.join(
        MATERIALS_DIR,
        meeting.materialStoredName,
      );
      if (fs.existsSync(previousPath)) {
        try {
          fs.unlinkSync(previousPath);
        } catch (error) {
          this.logger.warn(
            `Failed to remove previous material for meeting ${meetingId}: ${error}`,
          );
        }
      }
    }

    meeting.materialOriginalName = file.originalname;
    meeting.materialStoredName = file.filename;
    meeting.materialMimeType = file.mimetype;
    meeting.materialSize = file.size;
    meeting.materialUploadedAt = new Date();
    meeting.materialUrl = `/meeting-materials/${file.filename}`;

    await meeting.save();

    this.logger.log(
      `Material uploaded for meeting ${meetingId}: ${file.originalname}`,
    );

    return {
      success: true,
      meetingId,
      material: {
        originalName: meeting.materialOriginalName,
        storedName: meeting.materialStoredName,
        mimeType: meeting.materialMimeType,
        size: meeting.materialSize,
        uploadedAt: meeting.materialUploadedAt,
        url: meeting.materialUrl,
      },
    };
  }

  @Get(':meetingId')
  async downloadMaterial(
    @Param('meetingId') meetingId: string,
    @Res() res: Response,
  ) {
    const meeting = await this.meetingModel
      .findById(meetingId)
      .lean()
      .exec();

    if (!meeting || !meeting.materialStoredName) {
      throw new NotFoundException('No material uploaded for this meeting');
    }

    const materialPath = path.join(
      MATERIALS_DIR,
      meeting.materialStoredName,
    );

    if (!fs.existsSync(materialPath)) {
      throw new NotFoundException('Material file not found on server');
    }

    res.setHeader(
      'Content-Type',
      meeting.materialMimeType || 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${
        encodeURIComponent(
          meeting.materialOriginalName || meeting.materialStoredName,
        )
      }"`,
    );

    return res.sendFile(materialPath);
  }
}


