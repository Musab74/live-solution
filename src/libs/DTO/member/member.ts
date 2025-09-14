export class Member {
    id!: string;
    email!: string;
    displayName!: string;
    avatarUrl?: string;
    organization?: string;
    department?: string;
    phone?: string;
    language?: string;
    timezone?: string;
    createdAt!: string; // ISO
    updatedAt!: string; // ISO
  }
  