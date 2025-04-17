import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { ContentTypes as QRContentTypes } from '@/types/qr'; // Rename import to avoid conflict
import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';
import FileUploadBox from '@/components/FileUploadBox';
import { uploadFile } from '@/utils/fileUpload';  // Add this import at the top with other imports

const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/>
    </svg>
  )},
  { key: 'twitter', label: 'Twitter/X', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )},
  { key: 'instagram', label: 'Instagram', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2c-2.716 0-3.056.012-4.123.06-1.064.049-1.791.218-2.427.465a4.901 4.901 0 0 0-1.772 1.153A4.902 4.902 0 0 0 2.525 5.45c-.247.636-.416 1.363-.465 2.427C2.012 8.944 2 9.284 2 12s.012 3.056.06 4.123c.049 1.064.218 1.791.465 2.427a4.902 4.902 0 0 0 1.153 1.772 4.901 4.901 0 0 0 1.772 1.153c.636.247 1.363.416 2.427.465 1.067.048 1.407.06 4.123.06s3.056-.012 4.123-.06c1.064-.049 1.791-.218 2.427-.465a4.902 4.902 0 0 0 1.772-1.153 4.902 4.902 0 0 0 1.153-1.772c.247-.636.416-1.363.465-2.427.048-1.067.06-1.407.06-4.123s-.012-3.056-.06-4.123c-.049-1.064-.218-1.791-.465-2.427a4.902 4.902 0 0 0-1.153-1.772 4.901 4.901 0 0 0-1.772-1.153c-.636-.247-1.363-.416-2.427-.465C15.056 2.012 14.716 2 12 2zm0 1.802c2.67 0 2.986.01 4.04.058.975.045 1.505.207 1.858.344.467.182.8.399 1.15.748.35.35.566.683.748 1.15.137.353.3.883.344 1.857.048 1.055.058 1.37.058 4.041 0 2.67-.01 2.986-.058 4.04-.045.975-.207 1.505-.344 1.858a3.1 3.1 0 0 1-.748 1.15c-.35.35-.683.566-1.15.748-.353.137-.883.3-1.857.344-1.054.048-1.37.058-4.041.058-2.67 0-2.987-.01-4.04-.058-.975-.045-1.505-.207-1.858-.344a3.098 3.098 0 0 1-1.15-.748 3.098 3.098 0 0 1-.748-1.15c-.137-.353-.3-.883-.344-1.857-.048-1.055-.058-1.37-.058-4.041 0-2.67.01-2.986.058-4.04.045-.975.207-1.505.344-1.858.182-.467.399-.8.748-1.15.35-.35.683-.566 1.15-.748.353-.137.883-.3 1.857-.344 1.055-.048 1.37-.058 4.041-.058zm0 11.531a3.333 3.333 0 1 1 0-6.666 3.333 3.333 0 0 1 0 6.666zm0-8.468a5.135 5.135 0 1 0 0 10.27 5.135 5.135 0 0 0 0-10.27zm6.538-.203a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/>
    </svg>
  )},
  { key: 'whatsapp', label: 'WhatsApp', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  )},
  { key: 'linkedin', label: 'LinkedIn', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )},
  { key: 'tiktok', label: 'TikTok', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )},
  { key: 'youtube', label: 'YouTube', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )}
];

// Rename QRCode interface to QRCodeData
interface QRCodeData {
  id: string;
  title?: string; // Make sure title is included in interface
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

interface ContentTypes {
  URL: string;
  MULTI_URL: { urls: string[] };
  CONTACT: {
    prefix?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    organization?: string;
    title?: string;
    website?: string;
    address?: {
      street?: string;
      city?: string;
      region?: string;
      postcode?: string;
      country?: string;
    };
  };
  SMS: { number: string; message: string };
  MESSAGE: string;
  TEXT: string;
}

interface EditQRModalProps {
  qrCode: QRCodeData; // Update the type here
  onClose: () => void;
  onUpdate: (updatedQR: QRCodeData) => void; // And here
}

interface ContactData {
  prefix?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postcode?: string;
    country?: string;
  };
}

// Add SocialData type
interface SocialData {
  selectedPlatform?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  // ... other social platforms
}

interface PhoneContent {
  phone: string;
}

// Add LocationContent interface
interface LocationContent {
  address: string;
}

// Update ContentData type to include LocationContent
type ContentData = 
  | ContactData 
  | TextContent
  | { urls: string[] }
  | SmsContentData
  | { url: string }
  | SocialContentData
  | PhoneContent
  | LocationContent;

interface TextContent {
  content: string;
}

interface SocialContentData {
  content: string;
  selectedPlatform: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  whatsapp?: string;
  tiktok?: string;
  youtube?: string;
}

interface SmsContentData {
  number: string;
  message: string;
}

export default function EditQRModal({ qrCode, onClose, onUpdate }: EditQRModalProps) {
  const [loading, setLoading] = useState(false);
  const [contentType, setContentType] = useState(qrCode.type);
  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    // Initialize selected platform from QR code content
    if (qrCode.type === 'SOCIALS') {
      try {
        const data = JSON.parse(qrCode.content);
        return data.selectedPlatform || 'facebook';
      } catch (e) {
        return 'facebook';
      }
    }
    return 'facebook';
  });
  const [title, setTitle] = useState(qrCode.title || '');
  const socialContainerRef = useRef<HTMLDivElement>(null);

  const scrollSocials = (direction: 'left' | 'right') => {
    if (!socialContainerRef.current) return;
    const scrollAmount = 200;
    socialContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Initialize content data based on the QR code's existing content
  const [contentData, setContentData] = useState<ContentData>(() => {
    try {
      switch (qrCode.type) {
        case 'TEXT':
        case 'MESSAGE':
        case 'URL':
          return { content: qrCode.content } as TextContent;
        case 'SOCIALS':
          try {
            return { content: qrCode.content };
          } catch (e) {
            console.error('Error parsing social data:', e);
            return { content: '{}' };
          }
        case 'CONTACT':
          const contactData: ContactData = {};
          const lines = qrCode.content.split('\n');
          
          lines.forEach(line => {
            if (line.startsWith('N:')) {
              const [lastName = '', firstName = '', prefix = ''] = line.split(':')[1].split(';');
              contactData.lastName = lastName.trim();
              contactData.firstName = firstName.trim();
              contactData.prefix = prefix.trim();
            } else if (line.startsWith('EMAIL:')) {
              contactData.email = line.split(':')[1].trim();
            } else if (line.startsWith('TEL;TYPE=WORK,VOICE:')) {
              contactData.phone = line.split(':')[1].trim();
            } else if (line.startsWith('TEL;TYPE=CELL,VOICE:')) {
              contactData.mobile = line.split(':')[1].trim();
            } else if (line.startsWith('ORG:')) {
              contactData.organization = line.split(':')[1].trim();
            } else if (line.startsWith('TITLE:')) {
              contactData.title = line.split(':')[1].trim();
            } else if (line.startsWith('URL:')) {
              contactData.website = line.split(':')[1].trim();
            }
          });
          return contactData;

        case 'MULTI_URL':
          return { urls: qrCode.content.split('\n').filter(Boolean) };

        case 'SMS':
          const match = qrCode.content.match(/SMSTO:(.+?):(.+)/);
          return {
            number: match?.[1] || '',
            message: match?.[2] || ''
          };

        default:
          return { content: qrCode.content } as TextContent;
      }
    } catch (error) {
      console.error('Error parsing content:', error);
      return { content: qrCode.content } as TextContent;
    }
  });

  useEffect(() => {
    // Reset content data when switching types
    if (contentType !== qrCode.type) {
      switch (contentType) {
        case 'MULTI_URL':
          setContentData({ urls: [''] });
          break;
        case 'CONTACT':
          setContentData({
            prefix: '',
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            mobile: '',
            organization: '',
            title: '',
            website: ''
          });
          break;
        case 'SMS':
          setContentData({ number: '', message: '' });
          break;
        default:
          setContentData({ content: '' });
      }
    }
  }, [contentType, qrCode.type]);

  const handleContentTypeChange = (newType: string) => {
    setContentType(newType);
  };

  const generateContent = (): string => {
    switch (contentType) {
      case 'MULTI_URL':
        return 'urls' in contentData ? contentData.urls.filter(Boolean).join('\n') : '';
      case 'CONTACT':
        return generateVCard(contentData as ContactData);
      case 'SMS':
        if (!('number' in contentData && 'message' in contentData)) return '';
        return `SMSTO:${contentData.number}:${contentData.message}`;
      default:
        return 'content' in contentData ? contentData.content : '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const updatedQR = {
      ...qrCode,
      title, // Make sure title is included in the update
      type: contentType,
      content: generateContent(),
    };

    await onUpdate(updatedQR);
    setLoading(false);
  };

  const renderContactFields = () => {
    return (
      <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
        {[
          { key: 'prefix', label: 'Prefix', type: 'text', span: 1 },
          { key: 'firstName', label: 'First Name', type: 'text', span: 1 },
          { key: 'lastName', label: 'Last Name', type: 'text', span: 1 },
          { key: 'email', label: 'Email', type: 'email', span: 1 },
          { key: 'phone', label: 'Phone', type: 'tel', span: 1 },
          { key: 'mobile', label: 'Mobile', type: 'tel', span: 1 },
          { key: 'organization', label: 'Organization', type: 'text', span: 2 },
          { key: 'title', label: 'Job Title', type: 'text', span: 2 },
          { key: 'website', label: 'Website', type: 'url', span: 2 }
        ].map(({ key, label, type, span }) => (
          <div key={key} className={`${span === 2 ? 'col-span-2' : ''}`}>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input
              type={type}
              value={contentData[key] || ''}
              onChange={(e) => {
                setContentData(prev => ({
                  ...prev,
                  [key]: e.target.value
                }));
              }}
              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        ))}
      </div>
    );
  };

  const renderSocialsInput = () => {
    const handleSocialUrlChange = (platform: string, value: string) => {
      if ('content' in contentData) {
        try {
          const currentData = JSON.parse(contentData.content || '{}');
          const newData = {
            ...currentData,
            selectedPlatform: platform,
            [platform]: value
          };
          setContentData({ content: JSON.stringify(newData) });
        } catch (e) {
          console.error('Error updating social data:', e);
        }
      }
    };

    let socialData: Record<string, string> = {};
    try {
      if ('content' in contentData) {
        socialData = JSON.parse(contentData.content || '{}');
      }
    } catch (e) {
      console.error('Error parsing social data:', e);
    }

    return (
      <div className="space-y-6" onClick={(e) => e.stopPropagation()}>
        {/* Platform Selection with Navigation Arrows */}
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollSocials('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 rounded-full shadow-md hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div 
            ref={socialContainerRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-10"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {SOCIAL_PLATFORMS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedPlatform(key);
                }}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all w-20
                  ${selectedPlatform === key 
                    ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-600 ring-offset-2' 
                    : 'text-gray-500 hover:bg-gray-50'
                  }
                `}
              >
                <div className="w-6 h-6">{icon}</div>
                <span className="text-xs font-medium whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollSocials('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 rounded-full shadow-md hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {SOCIAL_PLATFORMS.find(p => p.key === selectedPlatform)?.label} URL
          </label>
          <input
            type="url"
            value={socialData[selectedPlatform] || ''}
            onChange={(e) => handleSocialUrlChange(selectedPlatform, e.target.value)}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={`Enter your ${SOCIAL_PLATFORMS.find(p => p.key === selectedPlatform)?.label} profile URL`}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    );
  };

  const renderContentInput = () => {
    switch (contentType) {
      case 'PDF':
      case 'FILE': {
        const fileData = contentData as { url: string };
        return (
          <FileUploadBox
            onFileSelect={async (file: File) => {
              try {
                const uploadedUrl = await uploadFile(file);
                setContentData({ content: uploadedUrl, url: uploadedUrl });
              } catch (error) {
                console.error('Error uploading file:', error);
              }
            }}
            accept={contentType === 'PDF' ? "application/pdf" : undefined}
            fileUrl={fileData.url}
          />
        );
      }

      case 'LOCATION': {
        const locationData = contentData as LocationContent;
        return (
          <PlaceAutocomplete
            value={locationData.address || ''}
            onChange={(address) => setContentData({ address } as LocationContent)}
            className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        );
      }

      case 'PHONE': {
        const phoneData = contentData as PhoneContent;
        return (
          <input
            type="tel"
            value={phoneData.phone || ''}
            onChange={(e) => setContentData({ phone: e.target.value } as PhoneContent)}
            className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Enter phone number"
          />
        );
      }

      case 'URL':
      case 'TEXT':
      case 'MESSAGE': {
        // Use a single consistent approach for text content
        const currentContent = 'content' in contentData ? (contentData as TextContent).content : '';
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <input
              type={contentType === 'URL' ? 'url' : 'text'}
              value={currentContent}
              onChange={(e) => setContentData({ content: e.target.value } as TextContent)}
              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        );
      }

      case 'CONTACT': {
        const contactData = contentData as ContactData;
        return (
          <div className="grid grid-cols-2 gap-4">
            {/* Contact form fields */}
            {/* ...existing contact form implementation... */}
          </div>
        );
      }

      case 'SMS': {
        const smsData = contentData as SmsContentData;
        return (
          <div className="space-y-4">
            {/* SMS form fields */}
            {/* ...existing SMS form implementation... */}
          </div>
        );
      }

      case 'SOCIALS': {
        const socialData = contentData as SocialContentData;
        return (
          <div className="space-y-4">
            {/* Social media form fields */}
            {/* ...existing social media form implementation... */}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 flex items-center justify-center">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header with fixed close button */}
          <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
            <h2 className="text-xl font-semibold text-gray-900">Edit QR Code</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Add title input at the top */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter QR code title"
                  className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={contentType}
                  onChange={(e) => handleContentTypeChange(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="PLAIN_TEXT">Plain Text</option>
                  <option value="URL">URL</option>
                  <option value="MULTI_URL">Multi URL</option>
                  <option value="CONTACT">Contact</option>
                  <option value="SMS">SMS</option>
                  <option value="PDF">PDF</option>
                  <option value="FILE">File</option>
                  <option value="SOCIALS">Social Media</option>
                  <option value="LOCATION">Location</option>
                  <option value="PHONE">Phone</option>
                </select>
              </div>

              {renderContentInput()}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Content'}
              </button>
            </form>
          </div>

          {/* Sticky footer for actions */}
          <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Content'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateVCard(info: any) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${info.lastName || ''};${info.firstName || ''};${info.prefix || ''};;;`,
    `FN:${[info.prefix, info.firstName, info.lastName].filter(Boolean).join(' ')}`,
    info.organization && `ORG:${info.organization}`,
    info.title && `TITLE:${info.title}`,
    info.email && `EMAIL:${info.email}`,
    info.phone && `TEL;TYPE=WORK,VOICE:${info.phone}`,
    info.mobile && `TEL;TYPE=CELL,VOICE:${info.mobile}`,
    info.website && `URL:${info.website}`,
    'END:VCARD'
  ].filter(Boolean);

  return lines.join('\n');
}
