import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.query';
import { MeetingStatus } from 'src/libs/enums/enums';

export class MeetingListQuery extends PaginationQueryDto {
  @IsOptional() @IsEnum(MeetingStatus)
  status?: MeetingStatus; // 시작/예약/종료 탭 필터
}

export class AttendanceExportInput {
  meetingId!: string; // 단순 식별자 전달
}
