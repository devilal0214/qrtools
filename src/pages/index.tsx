import { useState, useRef, useEffect } from 'react';
import QRCode, { QRCodeProps } from 'react-qr-code';
import Head from 'next/head';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/hooks/useAuth';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/router';
import { ContentType, ContentTypes } from '@/types/qr';
import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';
import { uploadFile } from '@/utils/fileUpload';
import FileUploadBox from '@/components/FileUploadBox';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

// Add contact prefix options
const PREFIX_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];

// Add these SVG icons at the top of the file
const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ContentTypeIcons = {
  PLAIN_TEXT: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  URL: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  MULTI_URL: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  PDF: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  FILE: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
    </svg>
  ),
  CONTACT: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  SMS: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  PHONE: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  LOCATION: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  SOCIALS: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
} as const;

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
  { key: 'snapchat', label: 'Snapchat', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.425.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>
    </svg>
  )},
  { key: 'tiktok', label: 'TikTok', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )},
  { key: 'spotify', label: 'Spotify', icon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )}
] as const;

export default function Home() {
  const [text, setText] = useState('');
  const [size, setSize] = useState(256);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [fgColor, setFgColor] = useState('#000000');
  const [downloadHeight, setDownloadHeight] = useState(1024);
  const qrRef = useRef<QRCode & SVGSVGElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [style, setStyle] = useState({
    shape: 'square', // square, rounded, dots
  });
  const [contentType, setContentType] = useState<ContentType>(ContentTypes.URL);
  const [contactInfo, setContactInfo] = useState({
    prefix: '',
    firstName: '',
    lastName: '',
    organization: '',
    title: '',
    email: '',
    phone: '',
    mobile: '',
    street: '',
    city: '',
    region: '',
    postcode: '',
    country: '',
    website: ''
  });
  const [multiUrls, setMultiUrls] = useState<string[]>(['']);
  const [smsInfo, setSmsInfo] = useState({ number: '', message: '' });
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { enabledContentTypes, canUseContentType } = usePlanFeatures();
  const router = useRouter();
  const contentTypeRef = useRef<HTMLDivElement>(null);
  const [selectedPlatform, setSelectedPlatform] = useState('facebook');
  const [scrollPosition, setScrollPosition] = useState(0);
  const socialScrollContainerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const socialContainerRef = useRef<HTMLDivElement>(null);
  const { canCreateMoreQR, loading: planLoading, qrLimit, remainingQRs } = usePlanFeatures();

  const resetForm = () => {
    setText('');
    setSize(256);
    setBgColor('#FFFFFF');
    setFgColor('#000000');
    setDownloadHeight(1024);
    setStyle({
      shape: 'square',
    });
    setError('');
    setContentType(ContentTypes.PLAIN_TEXT);
    setContactInfo({
      prefix: '',
      firstName: '',
      lastName: '',
      organization: '',
      title: '',
      email: '',
      phone: '',
      mobile: '',
      street: '',
      city: '',
      region: '',
      postcode: '',
      country: '',
      website: ''
    });
    setMultiUrls(['']);
    setSmsInfo({ number: '', message: '' });
    setFile(null);
    setFileUrl('');
  };

  const handleContentTypeChange = (newType: ContentType) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    setContentType(newType);
    setError('');
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!contentTypeRef.current) return;
    const scrollAmount = 200;
    contentTypeRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    let generatedText = '';
    
    switch (contentType) {
      case ContentTypes.CONTACT:
        generatedText = generateVCard();
        break;
      case ContentTypes.MULTI_URL:
        generatedText = multiUrls.filter(url => url.trim()).join('\n');
        break;
      case ContentTypes.SMS:
        generatedText = `SMSTO:${smsInfo.number}:${smsInfo.message}`;
        break;
      default:
        break;
    }

    if (generatedText) setText(generatedText);
  }, [contentType, contactInfo, multiUrls, smsInfo]);

  useEffect(() => {
    if (text) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [text, size, bgColor, fgColor]);

  const generateVCard = () => {
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${contactInfo.lastName};${contactInfo.firstName};${contactInfo.prefix};;`,
      `FN:${[contactInfo.prefix, contactInfo.firstName, contactInfo.lastName].filter(Boolean).join(' ')}`,
      contactInfo.organization && `ORG:${contactInfo.organization}`,
      contactInfo.title && `TITLE:${contactInfo.title}`,
      contactInfo.email && `EMAIL:${contactInfo.email}`,
      contactInfo.phone && `TEL;TYPE=WORK,VOICE:${contactInfo.phone}`,
      contactInfo.mobile && `TEL;TYPE=CELL,VOICE:${contactInfo.mobile}`,
      contactInfo.street && `ADR;TYPE=WORK:;;${contactInfo.street};${contactInfo.city};${contactInfo.region};${contactInfo.postcode};${contactInfo.country}`,
      contactInfo.website && `URL:${contactInfo.website}`,
      'END:VCARD'
    ].filter(Boolean).join('\n');

    return vCard;
  };

  const generateContent = () => {
    const content = {
      type: contentType.toUpperCase(), // Convert to match EditQRModal format
      content: text
    };
    return content;
  };

  const saveQRCode = async () => {
    if (!user || !text) {
      setError('Please sign in to save QR codes');
      return false;
    }

    try {
      setIsLoading(true);
      const qrData = {
        userId: user.uid,
        title, // Add title to QR data
        type: contentType.toUpperCase(), // Store standardized content type
        content: text,
        createdAt: new Date().toISOString(),
        scans: 0,
        isActive: true,
        settings: {
          size,
          fgColor,
          bgColor,
          shape: style.shape
        }
      };

      await addDoc(collection(db, 'qrcodes'), qrData);
      return true;
    } catch (error: any) {
      console.error('Error saving QR code:', error);
      setError('Failed to save QR code: ' + (error.message || 'Unknown error'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const downloadQR = async (format: 'png' | 'svg') => {
    if (!qrRef.current) {
      setError('QR code not ready');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const svgElement = qrRef.current;
      
      if (format === 'svg') {
        // Create a clone of the SVG to modify
        const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
        // Add necessary SVG attributes
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const svgData = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(svgBlob);

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `qrcode.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } else {
        // For PNG download
        const canvas = document.createElement('canvas');
        canvas.width = downloadHeight;
        canvas.height = downloadHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Create a proper SVG string with namespaces
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        // Create an image from the SVG
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });

        // Draw and download
        ctx.drawImage(img, 0, 0, downloadHeight, downloadHeight);
        URL.revokeObjectURL(url);

        const link = document.createElement('a');
        link.download = `qrcode.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Save to database after successful download
      await saveQRCode();
      router.push('/dashboard/active');
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to process QR code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const fileUrl = await uploadFile(file);
      setFileUrl(fileUrl);
      setText(fileUrl);
    } catch (error) {
      setError(error.message);
    }
  };

  const scrollSocials = (direction: 'left' | 'right') => {
    if (!socialContainerRef.current) return;
    const scrollAmount = 200;
    socialContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const renderSocialsInput = () => {
    let socialData = {};
    try {
      socialData = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error('Error parsing social data:', e);
    }
    
    const handleSocialUrlChange = (platform: string, url: string) => {
      try {
        const currentData = text ? JSON.parse(text) : {};
        setText(JSON.stringify({
          ...currentData,
          selectedPlatform: platform, // Store selected platform
          [platform]: url
        }));
      } catch (e) {
        console.error('Error updating social data:', e);
      }
    };

    return (
      <div className="space-y-6">
        {/* Platform Selection with Navigation Arrows */}
        <div className="relative">
          <button
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
                onClick={() => setSelectedPlatform(key)}
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
          />
        </div>
      </div>
    );
  };

  const handleInputInteraction = (e: React.SyntheticEvent) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
      return;
    }
  };

  const renderContentInput = () => {
    switch (contentType) {
      case ContentTypes.PLAIN_TEXT:
        return (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleInputInteraction}
            rows={5}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Enter your text"
          />
        );

      case ContentTypes.PDF:
      case ContentTypes.FILE:
        return (
          <FileUploadBox
            onFileSelect={handleFileUpload}
            accept={contentType === ContentTypes.PDF ? "application/pdf" : undefined}
            fileUrl={fileUrl}
          />
        );

      case ContentTypes.SOCIALS:
        return renderSocialsInput();

      case ContentTypes.LOCATION:
        return (
          <PlaceAutocomplete
            value={text}
            onChange={setText}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
          />
        );

      case ContentTypes.PHONE:
        return (
          <input
            type="tel"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleInputInteraction}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Enter phone number"
          />
        );

      case ContentTypes.CONTACT:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Prefix</label>
              <select
                value={contactInfo.prefix}
                onChange={(e) => setContactInfo({ ...contactInfo, prefix: e.target.value })}
                onFocus={handleInputInteraction}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="">Select Prefix</option>
                {PREFIX_OPTIONS.map(prefix => (
                  <option key={prefix} value={prefix}>{prefix}</option>
                ))}
              </select>
            </div>
            {Object.entries({
              firstName: 'First Name',
              lastName: 'Last Name',
              organization: 'Organization',
              title: 'Title',
              email: 'Email',
              phone: 'Phone',
              mobile: 'Mobile Phone',
              street: 'Street',
              city: 'City',
              region: 'Region',
              postcode: 'Postcode',
              country: 'Country',
              website: 'Website'
            }).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={contactInfo[key]}
                  onChange={(e) => setContactInfo({ ...contactInfo, [key]: e.target.value })}
                  onFocus={handleInputInteraction}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            ))}
          </div>
        );

      case ContentTypes.MULTI_URL:
        return (
          <div className="space-y-3">
            {multiUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    const newUrls = [...multiUrls];
                    newUrls[index] = e.target.value;
                    setMultiUrls(newUrls);
                  }}
                  onFocus={handleInputInteraction}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder={`URL ${index + 1}`}
                />
                <button
                  onClick={() => {
                    const newUrls = multiUrls.filter((_, i) => i !== index);
                    setMultiUrls(newUrls.length ? newUrls : ['']);
                  }}
                  className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => setMultiUrls([...multiUrls, ''])}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add URL
            </button>
          </div>
        );

      case ContentTypes.SMS:
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Phone Number</label>
              <input
                type="tel"
                value={smsInfo.number}
                onChange={(e) => setSmsInfo({ ...smsInfo, number: e.target.value })}
                onFocus={handleInputInteraction}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Message</label>
              <textarea
                value={smsInfo.message}
                onChange={(e) => setSmsInfo({ ...smsInfo, message: e.target.value })}
                onFocus={handleInputInteraction}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return (
          <input
            type={contentType === ContentTypes.URL ? 'url' : 'text'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleInputInteraction}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={`Enter ${contentType}`}
          />
        );
      }
    };

  const handleDownloadAndNext = async (format: 'png' | 'svg') => {
    if (planLoading) {
      setError('Loading plan details...');
      return;
    }

    if (!canCreateMoreQR()) {
      setError(`You've reached your daily limit of ${qrLimit} QR codes. Please upgrade your plan to create more.`);
      router.push('/dashboard/plans');
      return;
    }

    try {
      await downloadQR(format);
      router.push('/dashboard/active');
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to process QR code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center p-4 gap-6">
      <Head>
        <title>QR Code Generator</title>
      </Head>

      {/* Content Type Selection Card */}
      <div className="w-full max-w-5xl bg-white/80 backdrop-blur-lg rounded-3xl p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => scroll('left')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div 
            ref={contentTypeRef}
            className="flex-1 overflow-x-auto flex gap-3 scrollbar-hide scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {Object.entries(ContentTypes).map(([label, value]) => (
              <button
                key={value}
                onClick={() => handleContentTypeChange(value as ContentType)}
                className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl transition-all
                  ${contentType === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                {ContentTypeIcons[value]}
                <span className="text-sm font-medium whitespace-nowrap">
                  {label.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>

          <button 
            onClick={() => scroll('right')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="w-full max-w-5xl bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-lg">
       
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left Panel - Form Controls */}
          <div className="lg:col-span-3 space-y-6">
            {/* Add title input at the top */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={handleInputInteraction}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter QR code title"
              />
            </div>

            {/* Content Input */}
            <div className="space-y-4">
              {renderContentInput()}
            </div>

            {/* Size Control */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 block">Preview Size</label>
              <input
                type="range"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full"
                min="128"
                max="512"
              />
              <span className="text-sm text-gray-500">{size}px</span>
            </div>

            {/* QR Style */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-600">QR Style</h3>
              <div>
                <label className="text-xs text-gray-500">Shape</label>
                <select
                  value={style.shape}
                  onChange={(e) => setStyle({ shape: e.target.value })}
                  onFocus={handleInputInteraction}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="square">Square</option>
                  <option value="rounded">Rounded</option>
                  <option value="dots">Circle</option>
                </select>
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-600">Colors</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-xs text-gray-500">Background Color</label>
                  <div className="relative">
                    <div 
                      className="w-full h-10 rounded-lg border border-gray-200"
                      style={{ backgroundColor: bgColor }}
                      onClick={handleInputInteraction}
                    />
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      onFocus={handleInputInteraction}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={bgColor.toUpperCase()}
                    onChange={(e) => setBgColor(e.target.value)}
                    onFocus={handleInputInteraction}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-xs text-gray-500">QR Code Color</label>
                  <div className="relative">
                    <div 
                      className="w-full h-10 rounded-lg border border-gray-200"
                      style={{ backgroundColor: fgColor }}
                      onClick={handleInputInteraction}
                    />
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      onFocus={handleInputInteraction}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={fgColor.toUpperCase()}
                    onChange={(e) => setFgColor(e.target.value)}
                    onFocus={handleInputInteraction}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 font-mono"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview and Download */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 space-y-6">
              {/* QR Preview */}
              <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[256px]">
                {isLoading ? (
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="w-32 h-32 bg-gray-200 rounded-lg"></div>
                    <p className="mt-4 text-sm text-gray-400">Generating QR code...</p>
                  </div>
                ) : text ? (
                  <div className="flex flex-col items-center">
                    <div className={`transition-all duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
                      <QRCode
                        value={text}
                        size={size}
                        bgColor={bgColor}
                        fgColor={fgColor}
                        level="H"
                        ref={qrRef}
                        style={{
                          width: '100%',
                          height: '100%',
                          maxWidth: size,
                          maxHeight: size,
                        }}
                        viewBox={`0 0 ${size} ${size}`}
                        className={`
                          ${style.shape === 'rounded' ? 'rounded-2xl' : ''}
                          ${style.shape === 'dots' ? 'rounded-full' : ''}
                        `}
                      />
                    </div>
                    {error && !user && (
                      <div className="mt-4 text-center">
                        <p className="text-sm text-gray-600">{error}</p>
                        <button
                          onClick={() => setShowAuthModal(true)}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Sign in now
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-center flex flex-col items-center">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Enter content to generate QR code
                  </div>
                )}
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              </div>

              {/* Download Options */}
              {text && (
                <div className="space-y-4 bg-white p-6 rounded-2xl shadow-sm">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600 block">Download Size</label>
                    <input
                      type="range"
                      value={downloadHeight}
                      onChange={(e) => setDownloadHeight(Number(e.target.value))}
                      className="w-full"
                      min="512"
                      max="4096"
                    />
                    <span className="text-sm text-gray-500">{downloadHeight}px</span>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => handleDownloadAndNext('png')}
                      className="flex-1 btn-download gradient-blue text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 h-[42px]"
                    >
                      <DownloadIcon />
                      <span>PNG & Next</span>
                    </button>
                    <button
                      onClick={() => handleDownloadAndNext('svg')}
                      className="flex-1 btn-download gradient-indigo text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 h-[42px]"
                    >
                      <DownloadIcon />
                      <span>SVG & Next</span>
                    </button>
                  </div>
                  {/* Add QR limit warning near the download buttons */}
                  {user && remainingQRs <= 3 && remainingQRs > 0 && (
                    <div className="bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg mb-4">
                      You have {remainingQRs} QR code generation{remainingQRs === 1 ? '' : 's'} remaining today
                    </div>
                  )}
                  {user && remainingQRs <= 0 && (
                    <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4">
                      You've reached your daily limit. Please upgrade your plan for more QR codes.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  );
}
