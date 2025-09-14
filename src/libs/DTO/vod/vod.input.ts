import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VodSourceType } from 'src/libs/enums/enums';

export class VodUploadInput {
  @IsEnum(VodSourceType) source!: VodSourceType; // FILE | URL
  @IsString() title!: string;                    // VOD 제목
  @IsOptional() @IsString() notes?: string;      // 비고
  @IsOptional() @IsString() url?: string;        // URL 등록 시
}

export class RecordingLinkInput {
  @IsString() meetingId!: string;
  @IsString() recordingId!: string; // 스토리지/플랫폼의 ID
}
