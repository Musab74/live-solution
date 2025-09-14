import { VodSourceType } from "src/libs/enums/enums";

export class VodDto {
  id!: string;
  title!: string;
  source!: VodSourceType;
  sizeBytes?: number;
  durationSec?: number;
  url?: string;         // CDN or storage URL
  notes?: string;
  createdAt!: string;
  updatedAt!: string;
}
