export enum ContentTypes {
  PLAIN_TEXT = 'PLAIN_TEXT',
  URL = 'URL',
  MULTI_URL = 'MULTI_URL',
  PDF = 'PDF',
  FILE = 'FILE',
  CONTACT = 'CONTACT',
  SMS = 'SMS',
  PHONE = 'PHONE',
  LOCATION = 'LOCATION',
  SOCIALS = 'SOCIALS'
}

export type ContentType = keyof typeof ContentTypes;

export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  whatsapp?: string;
  linkedin?: string;
  spotify?: string;
  youtube?: string;
}
