export const ContentTypes = {
  PLAIN_TEXT: 'PLAIN_TEXT',
  TEXT: 'TEXT',  // Add TEXT type
  URL: 'URL',
  MULTI_URL: 'MULTI_URL',
  CONTACT: 'CONTACT',
  SMS: 'SMS',
  PHONE: 'PHONE',
  LOCATION: 'LOCATION',
  PDF: 'PDF',
  FILE: 'FILE',
  SOCIALS: 'SOCIALS'
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
  };
}
