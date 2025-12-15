export const ContentTypes = {
  URL: 'URL',
  PDF: 'PDF',
  MULTI_URL: 'MULTI_URL',
  CONTACT: 'CONTACT',
  PLAIN_TEXT: 'PLAIN_TEXT',
  APP: 'APP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  // Hidden for now
  // LOCATION: 'LOCATION',
  // FILE: 'FILE',
  // SOCIALS: 'SOCIALS'
} as const;

export type ContentType = typeof ContentTypes[keyof typeof ContentTypes];

export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  whatsapp?: string;
  linkedin?: string;
  spotify?: string;
  youtube?: string;
}

export interface QRCode {
  id: string;
  title?: string;
  type: string;
  content: string;
  createdAt: string;
  scans: number;
  isActive: boolean;
  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: string;
    logoImage?: string | null;
    logoPreset?: string | null;
  };
}
