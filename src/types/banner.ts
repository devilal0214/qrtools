export interface Banner {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  link?: string;
  pages: string[];
  width: number;
  height: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}
