// src/types/flipbook.ts

export interface Flipbook {
  id: string;
  userId: string;
  title: string;
  description?: string;
  pdfUrl: string;
  thumbnailUrl?: string;
  pageCount?: number;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  views: number;
}

export interface FlipbookSettings {
  autoFlip?: boolean;
  autoFlipInterval?: number; // seconds
  showToolbar?: boolean;
  allowDownload?: boolean;
  backgroundColor?: string;
}
