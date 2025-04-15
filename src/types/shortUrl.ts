export interface ShortUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  createdAt: string;
  userId: string;
  clicks: number;
  title?: string;
}
