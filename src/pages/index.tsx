import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import QRCodeGenerator from "qrcode-generator";

import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { collection, addDoc, setDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ContentType, ContentTypes } from "@/types/qr";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { uploadFile } from "@/utils/fileUpload";
import FileUploadBox from "@/components/FileUploadBox";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import Banner from "@/components/Banner";
import { generateNanoCode } from "@/utils/nano";
import html2canvas from "html2canvas";

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
};

const PREFIX_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];

// "shape" types for real QR drawing
type QRShapeStyle = "classic" | "rounded" | "thin" | "smooth" | "circles";

// frame types
type FrameStyle =
  | "none"
  | "noFrame"
  | "circle"
  | "bottomYellow"
  | "topPurple"
  | "bottomBlue"
  | "bottomGreen"
  | "bottomRed";

// design tab
type DesignTab = "FRAME" | "SHAPE" | "LOGO";

// keys of ContentTypes object (PLAIN_TEXT, URL, etc.)
type ContentTypeKey = keyof typeof ContentTypes;

const DownloadIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const ContentTypeIcons: Record<ContentTypeKey, JSX.Element> = {
  PLAIN_TEXT: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2} 
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  ),
  URL: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  ),
  MULTI_URL: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
      />
    </svg>
  ),
  PDF: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  ),
  FILE: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
      />
    </svg>
  ),
  CONTACT: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  ),
  SMS: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  ),
  PHONE: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  ),
  LOCATION: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  EMAIL: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  APP: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  ),
  SOCIALS: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* social platforms meta */
/* ------------------------------------------------------------------ */

const SOCIAL_PLATFORMS = [
  {
    key: "facebook",
    label: "Facebook",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
      </svg>
    ),
  },
  {
    key: "twitter",
    label: "Twitter/X",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2c-2.716 0-3.056.012-4.123.06-1.064.049-1.791.218-2.427.465a4.901 4.901 0 0 0-1.772 1.153A4.902 4.902 0 0 0 2.525 5.45c-.247.636-.416 1.363-.465 2.427C2.012 8.944 2 9.284 2 12s.012 3.056.06 4.123c.049 1.064.218 1.791.465 2.427a4.902 4.902 0 0 0 1.153 1.772 4.901 4.901 0 0 0 1.772 1.153c.636.247 1.363.416 2.427.465 1.067.048 1.407.06 4.123.06s3.056-.012 4.123-.06c1.064-.049 1.791-.218 2.427-.465a4.902 4.902 0 0 0 1.772-1.153 4.902 4.902 0 0 0 1.153-1.772c.247-.636.416-1.363.465-2.427.048-1.067.06-1.407.06-4.123s-.012-3.056-.06-4.123c-.049-1.064-.218-1.791-.465-2.427a4.902 4.902 0 0 0-1.153-1.772 4.901 4.901 0 0 0-1.772-1.153c-.636-.247-1.363-.416-2.427-.465C15.056 2.012 14.716 2 12 2zm0 1.802c2.67 0 2.986.01 4.04.058.975.045 1.505.207 1.858.344.467.182.8.399 1.15.748.35.35.566.683.748 1.15.137.353.3.883.344 1.857.048 1.055.058 1.37.058 4.041 0 2.67-.01 2.986-.58 4.04-.045.975-.207 1.505-.344 1.858a3.1 3.1 0 0 1-.748 1.15c-.35.35-.683.566-1.15.748-.353.137-.883.3-1.857.344-1.054.048-1.37.058-4.041.058-2.67 0-2.987-.01-4.04-.058-.975-.045-1.505-.207-1.858-.344a3.098 3.098 0 0 1-1.15-.748 3.098 3.098 0 0 1-.748-1.15c-.137-.353-.3-.883-.344-1.857-.048-1.055-.058-1.37-.058-4.041 0-2.67.01-2.986.058-4.04.045-.975.207-1.505.344-1.858.182-.467.399-.8.748-1.15.35-.35.683-.566 1.15-.748.353-.137.883-.3 1.857-.344 1.055-.048 1.37-.058 4.041-.058zm0 11.531a3.333 3.333 0 1 1 0-6.666 3.333 3.333 0 0 1 0 6.666zm0-8.468a5.135 5.135 0 1 0 0 10.27 5.135 5.135 0 0 0 0-10.27zm6.538-.203a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" />
      </svg>
    ),
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    key: "snapchat",
    label: "Snapchat",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.425.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z" />
      </svg>
    ),
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05 2.02-12.07z" />
      </svg>
    ),
  },
  {
    key: "spotify",
    label: "Spotify",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    ),
  },
] as const;

/* ------------------------------------------------------------------ */
/* logo presets (with icons) */
/* ------------------------------------------------------------------ */

const LOGO_PRESETS_META: Record<
  string,
  { color: string; label: string; short: string }
> = {
  none: { color: "#E5E7EB", label: "None", short: "" },
  whatsapp: { color: "#25D366", label: "WhatsApp", short: "WA" },
  link: { color: "#6366F1", label: "Link", short: "🔗" },
  location: { color: "#F97373", label: "Location", short: "📍" },
  wifi: { color: "#14B8A6", label: "Wi-Fi", short: "Wi" },
};

const LOGO_PRESET_ICON: Record<string, JSX.Element> = {
  whatsapp: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"
      />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
      <path
        fill="currentColor"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.059-1.06-1.414-1.414-1.06 1.06A2 2 0 114.05 14.95l4-4a2 2 0 112.828 2.828l-1.06 1.06 1.414 1.415 1.06-1.061a4 4 0 000-5.657z"
      />
      <path
        fill="currentColor"
        d="M18.364 5.636a4 4 0 00-5.657 0l-1.06 1.06 1.414 1.415 1.06-1.061A2 2 0 1119.95 9.05l-4 4a2 2 0 01-2.828 0l-1.06-1.06-1.414 1.414 1.06 1.06a4 4 0 005.657-5.656l4-4a4 4 0 00-5.657-5.657z"
      />
    </svg>
  ),
  location: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
      <path
        fill="currentColor"
        d="M12 2a7 7 0 00-7 7c0 4.418 7 13 7 13s7-8.582 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 119.5 9 2.5 2.5 0 0112 11.5z"
      />
    </svg>
  ),
  wifi: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
      <path
        fill="currentColor"
        d="M12 18a1.5 1.5 0 11-1.5 1.5A1.5 1.5 0 0112 18zm0-4a5.49 5.49 0 00-3.889 1.611l1.414 1.414A3.5 3.5 0 0112 16.5a3.5 3.5 0 012.475 1.025l1.414-1.414A5.49 5.49 0 0012 14zm0-4a9.49 9.49 0 00-6.717 2.783l1.414 1.414A7.5 7.5 0 0112 12.5a7.5 7.5 0 015.303 2.197l1.414-1.414A9.49 9.49 0 0012 10zm0-4A13.48 13.48 0 001.757 8.757l1.414 1.414A11.5 11.5 0 0112 6.5a11.5 11.5 0 018.829 3.671l1.414-1.414A13.48 13.48 0 0012 6z"
      />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* custom QR renderer with shapes                                      */
/* ------------------------------------------------------------------ */

interface StyledQRCodeProps {
  value: string;
  size: number;
  bgColor: string;
  fgColor: string;
  shape: QRShapeStyle;
}

const StyledQRCode = forwardRef<SVGSVGElement, StyledQRCodeProps>(
  ({ value, size, bgColor, fgColor, shape }, ref) => {
    const qr = QRCodeGenerator(0, "L");
    qr.addData(value || " ");
    qr.make();

    const count = qr.getModuleCount();
    const cellSize = size / count;

    const modules: JSX.Element[] = [];

    const drawModule = (r: number, c: number, isDark: boolean, key: string) => {
      if (!isDark) return null;

      const x = c * cellSize;
      const y = r * cellSize;

      switch (shape) {
        case "classic":
          return (
            <rect
              key={key}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              fill={fgColor}
            />
          );

        case "rounded":
          return (
            <rect
              key={key}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={cellSize * 0.4}
              ry={cellSize * 0.4}
              fill={fgColor}
            />
          );

        case "thin":
          return (
            <rect
              key={key}
              x={x + cellSize * 0.2}
              y={y + cellSize * 0.2}
              width={cellSize * 0.6}
              height={cellSize * 0.6}
              rx={cellSize * 0.15}
              ry={cellSize * 0.15}
              fill={fgColor}
            />
          );

        case "smooth":
          return (
            <rect
              key={key}
              x={x + cellSize * 0.05}
              y={y + cellSize * 0.05}
              width={cellSize * 0.9}
              height={cellSize * 0.9}
              rx={cellSize * 0.45}
              ry={cellSize * 0.45}
              fill={fgColor}
            />
          );

        case "circles":
          return (
            <circle
              key={key}
              cx={x + cellSize / 2}
              cy={y + cellSize / 2}
              r={cellSize * 0.45}
              fill={fgColor}
            />
          );
      }
    };

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        const key = `${r}-${c}`;
        const isDark = qr.isDark(r, c);
        const node = drawModule(r, c, isDark, key);
        if (node) modules.push(node);
      }
    }

    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block" }}
      >
        <rect width={size} height={size} fill={bgColor} />
        {modules}
      </svg>
    );
  }
);
StyledQRCode.displayName = "StyledQRCode";

/* ------------------------------------------------------------------ */
/* main component                                                      */
/* ------------------------------------------------------------------ */

interface QRDoc {
  type: string;
  content: string;
  isActive?: boolean;
  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: QRShapeStyle;
  };
}

export default function Home() {
  const [text, setText] = useState("");
  const [size, setSize] = useState(256);
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [fgColor, setFgColor] = useState("#000000");
  const [downloadHeight, setDownloadHeight] = useState(1024);

  const [qrShape, setQrShape] = useState<QRShapeStyle>("classic");

  const qrRef = useRef<SVGSVGElement | null>(null);
  const qrCallbackRef = useCallback((node: SVGSVGElement | null) => {
    qrRef.current = node;
  }, []);
  const qrPreviewRef = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportValue, setExportValue] = useState<string | null>(null);
  const [nanoId, setNanoId] = useState<string | null>(null);

  const [designTab, setDesignTab] = useState<DesignTab>("FRAME");
  const [frameStyle, setFrameStyle] = useState<FrameStyle>("none");

  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoPreset, setLogoPreset] = useState<string | null>(null);

  const [contentType, setContentType] = useState<ContentType>(ContentTypes.URL);
  const [contactInfo, setContactInfo] = useState({
    prefix: "",
    firstName: "",
    lastName: "",
    organization: "",
    title: "",
    email: "",
    phone: "",
    mobile: "",
    street: "",
    city: "",
    region: "",
    postcode: "",
    country: "",
    website: "",
  });
  const [multiUrls, setMultiUrls] = useState<Array<{url: string, title: string}>>([{url: "", title: ""}]);
  const [showAddUrlModal, setShowAddUrlModal] = useState(false);
  const [smsInfo, setSmsInfo] = useState({ number: "", message: "" });
  const [fileUrl, setFileUrl] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("facebook");
  const socialContainerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const { user } = useAuth();
  const { 
    canCreateMoreQR, 
    loading: planLoading, 
    qrLimit, 
    canUseFeature,
    isTrialActive,
    trialDaysRemaining,
    planName 
  } = usePlanFeatures();
  const router = useRouter();

  // NEW: toggle states - check if user can access premium features
  const [trackScansEnabled, setTrackScansEnabled] = useState(false);
  const [removeWatermarkEnabled, setRemoveWatermarkEnabled] = useState(false);

  // Campaign URL tracking
  const [campaignEnabled, setCampaignEnabled] = useState(false);
  const [campaignSource, setCampaignSource] = useState("");
  const [campaignMedium, setCampaignMedium] = useState("");
  const [campaignName, setCampaignName] = useState("");

  // Watermark settings from admin
  const [watermarkSettings, setWatermarkSettings] = useState<{
    enabled: boolean;
    logoUrl: string;
    text: string;
    position: string;
    size: string;
    opacity: number;
  } | null>(null);

  // Fetch watermark settings from Firestore
  useEffect(() => {
    const fetchWatermarkSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.watermark) {
            setWatermarkSettings(data.watermark);
          }
        }
      } catch (error) {
        console.error('Error fetching watermark settings:', error);
      }
    };
    fetchWatermarkSettings();
  }, []);

  // Update toggle states based on plan features
  useEffect(() => {
    if (canUseFeature('tracking')) {
      // Keep current state if premium access
    } else {
      setTrackScansEnabled(false);
    }
    if (canUseFeature('removeWatermark')) {
      // Keep current state if premium access
    } else {
      setRemoveWatermarkEnabled(false);
    }
  }, [canUseFeature]);

  const handleContentTypeChange = (newType: ContentType) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setContentType(newType);
    setError("");
  };

  useEffect(() => {
    const updateQRContent = async () => {
      if (contentType === ContentTypes.CONTACT) {
        try {
          const contactId = Math.random().toString(36).substr(2, 9);
          if (user) {
            const contactData = {
              ...contactInfo,
              userId: user.uid,
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, "contacts", contactId), contactData);
            const contactViewUrl = `${window.location.origin}/c/${contactId}`;
            setText(contactViewUrl);
          } else {
            setError("Please sign in to create contact QR codes");
            setShowAuthModal(true);
          }
        } catch (error) {
          console.error("Error saving contact:", error);
          setError("Failed to save contact data. Please try again.");
        }
      } else if (contentType === ContentTypes.MULTI_URL) {
        const multiUrlData = {
          title: title || "My Links",
          urls: multiUrls.filter((item) => item.url.trim())
        };
        setText(JSON.stringify(multiUrlData));
      } else if (contentType === ContentTypes.SMS) {
        setText(`SMSTO:${smsInfo.number}:${smsInfo.message}`);
      }
    };
    updateQRContent();
  }, [contentType, contactInfo, user, multiUrls, smsInfo, title]);

  /* loading state when QR params change */
  useEffect(() => {
    if (text) {
      setIsLoading(true);
      const t = setTimeout(() => setIsLoading(false), 400);
      return () => clearTimeout(t);
    }
  }, [
    text,
    size,
    bgColor,
    fgColor,
    qrShape,
    frameStyle,
    logoImage,
    logoPreset,
  ]);

  /* -------------------------------------------------------------- */
  /* socials input renderer                                         */
  /* -------------------------------------------------------------- */

  const scrollSocials = (direction: "left" | "right") => {
    if (!socialContainerRef.current) return;
    const scrollAmount = 200;
    socialContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const renderSocialsInput = () => {
    let socialData: any = {};
    try {
      socialData = text ? JSON.parse(text) : {};
    } catch {
      socialData = {};
    }

    const handleSocialUrlChange = (platform: string, url: string) => {
      try {
        const currentData = text ? JSON.parse(text) : {};
        setText(
          JSON.stringify({
            ...currentData,
            selectedPlatform: platform,
            [platform]: url,
          })
        );
      } catch (e) {
        console.error("Error updating social data:", e);
      }
    };

    return (
      <div className="space-y-6">
        <div className="relative">
          <button
            onClick={() => scrollSocials("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 rounded-full shadow-md hover:bg-gray-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div
            ref={socialContainerRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-10"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {SOCIAL_PLATFORMS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setSelectedPlatform(key)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all w-20
                  ${
                    selectedPlatform === key
                      ? "bg-blue-50 text-blue-600 ring-2 ring-blue-600 ring-offset-2"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
              >
                <div className="w-6 h-6">{icon}</div>
                <span className="text-xs font-medium whitespace-nowrap">
                  {label}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollSocials("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 rounded-full shadow-md hover:bg-gray-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {SOCIAL_PLATFORMS.find((p) => p.key === selectedPlatform)?.label}{" "}
            URL
          </label>
          <input
            type="url"
            value={socialData[selectedPlatform] || ""}
            onChange={(e) =>
              handleSocialUrlChange(selectedPlatform, e.target.value)
            }
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={`Enter your ${
              SOCIAL_PLATFORMS.find((p) => p.key === selectedPlatform)?.label
            } profile URL`}
          />
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------- */
  /* generic input handler                                           */
  /* -------------------------------------------------------------- */

  const handleInputInteraction = (e: any) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
      return;
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const url = await uploadFile(file);
      setFileUrl(url);
      setText(url);
    } catch (error: any) {
      setError(error.message);
    }
  };

  /* -------------------------------------------------------------- */
  /* content inputs per type                                         */
  /* -------------------------------------------------------------- */

  const renderContentInput = () => {
    switch (contentType) {
      case ContentTypes.PLAIN_TEXT:
        return (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleInputInteraction}
            rows={4}
            className="w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            placeholder="Enter your text"
          />
        );

      case ContentTypes.PDF:
      case ContentTypes.FILE:
        return (
          <FileUploadBox
            onFileSelect={handleFileUpload}
            accept={
              contentType === ContentTypes.PDF ? "application/pdf" : undefined
            }
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
            className="w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        );

      case ContentTypes.PHONE:
        return (
          <input
            type="tel"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleInputInteraction}
            className="w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
                onChange={(e) =>
                  setContactInfo({ ...contactInfo, prefix: e.target.value })
                }
                onFocus={handleInputInteraction}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="">Select Prefix</option>
                {PREFIX_OPTIONS.map((prefix) => (
                  <option key={prefix} value={prefix}>
                    {prefix}
                  </option>
                ))}
              </select>
            </div>

            {Object.entries({
              firstName: "First Name",
              lastName: "Last Name",
              organization: "Organization",
              title: "Title",
              email: "Email",
              phone: "Phone",
              mobile: "Mobile Phone",
              street: "Street",
              city: "City",
              region: "Region",
              postcode: "Postcode",
              country: "Country",
              website: "Website",
            }).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input
                  type={key === "email" ? "email" : "text"}
                  value={(contactInfo as any)[key]}
                  onChange={(e) =>
                    setContactInfo({ ...contactInfo, [key]: e.target.value })
                  }
                  onFocus={handleInputInteraction}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            ))}
          </div>
        );

      case ContentTypes.MULTI_URL:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500">Page Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={handleInputInteraction}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Your title here"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Links ({multiUrls.filter(u => u.url.trim()).length})</label>
              {multiUrls.map((item, index) => {
                if (!item.url.trim()) return null;
                return (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title || 'Untitled'}</p>
                      <p className="text-xs text-gray-500 truncate">{item.url}</p>
                    </div>
                    <button
                      onClick={() => {
                        const copy = multiUrls.filter((_, i) => i !== index);
                        setMultiUrls(copy.length ? copy : [{url: "", title: ""}]);
                      }}
                      className="text-red-500 hover:text-red-700 text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            
            <button
              onClick={() => setShowAddUrlModal(true)}
              className="w-full py-2 px-4 text-sm text-green-600 hover:text-green-700 font-medium flex items-center justify-center gap-2 border border-dashed border-green-600 rounded-lg hover:bg-green-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Link
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
                onChange={(e) =>
                  setSmsInfo({ ...smsInfo, number: e.target.value })
                }
                onFocus={handleInputInteraction}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Message</label>
              <textarea
                value={smsInfo.message}
                onChange={(e) =>
                  setSmsInfo({ ...smsInfo, message: e.target.value })
                }
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
            type={contentType === ContentTypes.URL ? "url" : "text"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleInputInteraction}
            className="w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            placeholder={`Enter ${contentType}`}
          />
        );
    }
  };

  /* -------------------------------------------------------------- */
  /* logo helpers (convert + File)                                  */
  /* -------------------------------------------------------------- */

  const dataUrlToFile = (dataUrl: string, filename: string) => {
    const arr = dataUrl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const convertLogoToPngDataUrl = async (logoUrl: string, outSize = 256) => {
    if (!logoUrl) return null;
    if (logoUrl.startsWith("data:image/png")) return logoUrl;

    const loadImageToPng = (src: string) =>
      new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = outSize;
            canvas.height = outSize;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("2D context unavailable"));
            ctx.clearRect(0, 0, outSize, outSize);
            const ratio = Math.min(outSize / img.width, outSize / img.height);
            const dw = img.width * ratio;
            const dh = img.height * ratio;
            const dx = (outSize - dw) / 2;
            const dy = (outSize - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
            const png = canvas.toDataURL("image/png");
            resolve(png);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
        img.src = src;
      });

    try {
      if (
        logoUrl.startsWith("data:image/svg+xml") ||
        logoUrl.trim().startsWith("<svg")
      ) {
        return await loadImageToPng(logoUrl);
      }

      if (logoUrl.startsWith("data:")) {
        try {
          return await loadImageToPng(logoUrl);
        } catch (err) {
          console.warn("Failed to load logo dataURL", err);
        }
      }

      try {
        const resp = await fetch(logoUrl);
        if (!resp.ok) throw new Error("Failed to fetch logo");
        const contentType = resp.headers.get("Content-Type") || "";
        if (contentType.startsWith("image/")) {
          return await loadImageToPng(logoUrl);
        }
        const svgText = await resp.text();
        const blob = new Blob([svgText], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        try {
          const out = await loadImageToPng(url);
          URL.revokeObjectURL(url);
          return out;
        } catch (err) {
          URL.revokeObjectURL(url);
          throw err;
        }
      } catch (err) {
        return await loadImageToPng(logoUrl);
      }
    } catch (err) {
      console.error("convertLogoToPngDataUrl failed:", err);
      return null;
    }
  };

  const handleLogoUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload logo in SVG or PNG format only.");
      return;
    }

    const convertSvgToPngDataUrl = async (svgFile: File, outSize = 256) => {
      const readText = (f: File) =>
        new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ""));
          r.onerror = reject;
          r.readAsText(f);
        });

      const svgText = await readText(svgFile);
      const svgBlob = new Blob([svgText], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      return await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = outSize;
            canvas.height = outSize;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("2D context not available");
            ctx.clearRect(0, 0, outSize, outSize);
            const ratio = Math.min(outSize / img.width, outSize / img.height);
            const dw = img.width * ratio;
            const dh = img.height * ratio;
            const dx = (outSize - dw) / 2;
            const dy = (outSize - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
            const png = canvas.toDataURL("image/png");
            URL.revokeObjectURL(url);
            resolve(png);
          } catch (err) {
            URL.revokeObjectURL(url);
            reject(err);
          }
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      });
    };

    if (file.type === "image/svg+xml") {
      convertSvgToPngDataUrl(file, 256)
        .then((pngDataUrl) => {
          setLogoImage(pngDataUrl);
          setLogoPreset(null);
        })
        .catch((err) => {
          console.error("Failed to convert SVG to PNG:", err);
          setError(
            "Failed to process SVG logo. Please use a PNG or try a different SVG."
          );
        });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setLogoImage(reader.result as string);
        setLogoPreset(null);
      };
      reader.readAsDataURL(file);
    }
  };

  /* -------------------------------------------------------------- */
  /* save / nano / logo embed for SVG download                      */
  /* -------------------------------------------------------------- */

  const getLogoMarkup = (
    logoImage: string | null,
    logoPreset: string | null,
    svgSize = 256
  ) => {
    if (!logoImage && (!logoPreset || logoPreset === "none")) return "";

    const size = svgSize;
    const logoScale = size / 256;
    const logoSize = 80 * logoScale;
    const circleRadius = 44 * logoScale;

    let content = "";

    if (logoImage) {
      content = `
        <image
          width="${logoSize}"
          height="${logoSize}"
          x="${-logoSize / 2}"
          y="${-logoSize / 2}"
          xlink:href="${logoImage}"
          href="${logoImage}"
        />
      `;
    } else if (logoPreset && logoPreset !== "none") {
      const meta = LOGO_PRESETS_META[logoPreset];
      const presetRadius = 30 * logoScale;
      const fontSize = 18 * logoScale;
      content = `
        <circle cx="0" cy="0" r="${presetRadius}" fill="${meta.color}" />
        <text
          fill="white"
          font-size="${fontSize}"
          font-family="Arial"
          text-anchor="middle"
          alignment-baseline="central"
        >${meta.short}</text>
      `;
    }

    return `
      <g transform="translate(${size / 2}, ${size / 2})">
        <circle cx="0" cy="0" r="${circleRadius}" fill="white" />
        ${content}
      </g>
    `;
  };

  const convertAndUploadLogoForSave = async (inputLogo: string | null) => {
    if (!inputLogo) return null;
    try {
      const converted = await convertLogoToPngDataUrl(inputLogo, 256);
      const dataUrl = converted || inputLogo;
      if (dataUrl && dataUrl.startsWith("data:image/png")) {
        const file = dataUrlToFile(dataUrl, "logo.png");
        const uploadedUrl = await uploadFile(file, { folder: "logos" } as any);
        return uploadedUrl;
      }
      return inputLogo;
    } catch (err) {
      console.warn("Logo conversion/upload failed during save:", err);
      return inputLogo;
    }
  };

  const saveQRCode = async () => {
    if (!user) {
      setError("Please sign in to save QR codes");
      return null;
    }

    if (!text) {
      setError("Please enter some content first");
      return null;
    }

    try {
      setIsLoading(true);

      let logoToSave = await convertAndUploadLogoForSave(logoImage);

      const qrData = {
        userId: user.uid,
        title,
        type: contentType.toUpperCase(),
        content: text,
        createdAt: new Date().toISOString(),
        scans: 0,
        isActive: true,
        settings: {
          size,
          fgColor,
          bgColor,
          shape: qrShape,
          logoImage: logoToSave || null,
          logoPreset: logoPreset || null,
        },
        ...(campaignEnabled && {
          campaign: {
            enabled: true,
            source: campaignSource,
            medium: campaignMedium,
            name: campaignName,
          },
        }),
      };

      let finalId = nanoId;

      if (finalId) {
        const ref = doc(db, "qrcodes", finalId);
        await setDoc(ref, qrData, { merge: true });
      } else {
        while (true) {
          const candidate = generateNanoCode();
          const ref = doc(db, "qrcodes", candidate);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            await setDoc(ref, qrData);
            finalId = candidate;
            setNanoId(candidate);
            break;
          }
        }
      }

      return finalId;
    } catch (error: any) {
      console.error("Error saving QR code:", error);
      setError("Failed to save QR code: " + (error.message || "Unknown error"));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /* -------------------------------------------------------------- */
  /* download (SVG + PNG with html2canvas for full frame)           */
  /* -------------------------------------------------------------- */

  const downloadQR = async (format: "png" | "svg") => {
    if (!qrRef.current) {
      setError("QR code not ready");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Check if we have frames or watermarks - if yes, force PNG
      const hasFrames = frameStyle !== "none" && frameStyle !== "noFrame";
      const hasWatermark = watermarkSettings?.enabled && !removeWatermarkEnabled && !canUseFeature('removeWatermark');
      
      if (format === "svg" && (hasFrames || hasWatermark)) {
        // Force PNG for frames/watermarks (silently)
        format = "png";
      }

      if (format === "svg") {
        const svgElement = qrRef.current as SVGSVGElement;
        let svgData = new XMLSerializer().serializeToString(svgElement);

        if (!svgData.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
          svgData = svgData.replace(
            "<svg",
            '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
          );
        }

        let logoForInjection = logoImage;
        if (logoImage) {
          const converted = await convertLogoToPngDataUrl(logoImage, 80);
          if (converted) logoForInjection = converted;
        }

        const viewBoxSize = svgElement.viewBox?.baseVal?.width || 256;
        const logoMarkup = getLogoMarkup(
          logoForInjection,
          logoPreset,
          viewBoxSize
        );

        if (logoMarkup) {
          svgData = svgData.replace("</svg>", `${logoMarkup}</svg>`);
        }

        const svgBlob = new Blob([svgData], {
          type: "image/svg+xml;charset=utf-8",
        });
        const downloadUrl = URL.createObjectURL(svgBlob);

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `qrcode.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        return;
      }

      const previewNode = qrPreviewRef.current;
      if (!previewNode) {
        setError("QR preview not ready");
        return;
      }

      const canvas = await html2canvas(previewNode, {
        backgroundColor: null,
        scale: 4,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: previewNode.offsetWidth,
        height: previewNode.offsetHeight,
        onclone: (clonedDoc) => {
          // Ensure all images are loaded in the cloned document
          const images = clonedDoc.getElementsByTagName('img');
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            // Force reload to ensure CORS is handled
            if (img.src && !img.complete) {
              img.crossOrigin = 'anonymous';
            }
          }
        },
      });

      const link = document.createElement("a");
      link.download = `qrcode.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("QR DOWNLOAD ERROR:", err);
      setError(
        "Failed to process QR code: " + (err.message || "Unknown error")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectDownload = async (format: "png" | "svg") => {
    if (!text) {
      setError("Please enter content first");
      return;
    }
    try {
      setError("");
      await downloadQR(format);
    } catch (error: any) {
      setError(
        "Failed to download QR code: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  const handleDownloadAndNext = async (format: "png" | "svg") => {
    if (planLoading) {
      setError("Loading plan details...");
      return;
    }

    if (!canCreateMoreQR()) {
      setError(
        `You've reached your daily limit of ${qrLimit} QR codes. Please upgrade your plan to create more.`
      );
      router.push("/dashboard/plans");
      return;
    }

    if (contentType === ContentTypes.SOCIALS) {
      try {
        const data = text ? JSON.parse(text) : {};
        const platform = data.selectedPlatform;
        const url = platform ? data[platform] : "";

        if (!url) {
          setError(
            "Please add at least one social media URL before generating the QR."
          );
          return;
        }
      } catch (e) {
        setError(
          "Something went wrong with your social links. Please re-enter."
        );
        return;
      }
    }

    const id = await saveQRCode();
    if (!id) return;

    const origin =
      typeof window !== "undefined" ? window.location.origin : getBaseUrl();
    const shortUrl = `${origin}/qr/${id}`;

    try {
      setExportValue(shortUrl);
      await new Promise((res) => setTimeout(res, 50));
      await downloadQR(format);
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to process QR code");
    } finally {
      setExportValue(null);
    }
  };

  /* -------------------------------------------------------------- */
  /* Frame + Shape thumbnails + preview                             */
  /* -------------------------------------------------------------- */

  const FRAME_PRESETS: {
    id: FrameStyle;
    label: string;
    tagColor?: string;
    tagPosition?: "top" | "bottom";
  }[] = [
    { id: "none", label: "No frame" },
    // { id: "circle", label: "Circle" },
    {
      id: "bottomYellow",
      label: "Scan Me – Amber",
      tagColor: "#F59E0B",
      tagPosition: "bottom",
    },
    {
      id: "topPurple",
      label: "Scan Me – Purple",
      tagColor: "#A855F7",
      tagPosition: "top",
    },
    {
      id: "bottomBlue",
      label: "Scan Me – Blue",
      tagColor: "#3B82F6",
      tagPosition: "bottom",
    },
    {
      id: "bottomGreen",
      label: "Scan Me – Green",
      tagColor: "#15803D",
      tagPosition: "bottom",
    },
    {
      id: "bottomRed",
      label: "Scan Me – Red",
      tagColor: "#EF4444",
      tagPosition: "bottom",
    },
  ];

  const SHAPE_OPTIONS: { id: QRShapeStyle; label: string }[] = [
    { id: "classic", label: "Classic" },
    { id: "rounded", label: "Rounded" },
    { id: "thin", label: "Thin" },
    { id: "smooth", label: "Smooth" },
    { id: "circles", label: "Circles" },
  ];

  const renderShapeThumbnail = (shapeId: QRShapeStyle) => (
    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center">
      <div className="grid grid-cols-3 grid-rows-3 gap-[2px]">
        {Array.from({ length: 9 }).map((_, idx) => {
          const base = "bg-gray-800";
          switch (shapeId) {
            case "classic":
              return <div key={idx} className={`w-3 h-3 ${base}`} />;
            case "rounded":
              return <div key={idx} className={`w-3 h-3 ${base} rounded-md`} />;
            case "thin":
              return <div key={idx} className={`w-2 h-2 ${base} rounded-sm`} />;
            case "smooth":
              return (
                <div key={idx} className={`w-3 h-3 ${base} rounded-full`} />
              );
            case "circles":
              return (
                <div key={idx} className={`w-2.5 h-2.5 ${base} rounded-full`} />
              );
          }
        })}
      </div>
    </div>
  );

  const renderFrameThumbnail = (preset: (typeof FRAME_PRESETS)[number]) => {
    if (preset.id === "none") {
      return (
        <div className="w-20 h-20 rounded-xl border border-dashed border-gray-300 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="M8 8l8 8" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      );
    }

    if (preset.id === "circle") {
      return (
        <div className="w-20 h-20 rounded-xl border border-gray-300 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full border border-gray-400 flex items-center justify-center">
            <div className="w-8 h-8 bg-gray-300 rounded" />
          </div>
        </div>
      );
    }

    const tagColor = preset.tagColor || "#F97316";
    const tagPosition = preset.tagPosition || "bottom";

    return (
      <div className="w-20 h-20 rounded-xl border border-gray-300 flex flex-col items-center justify-center bg-white overflow-hidden">
        {tagPosition === "top" && (
          <div
            className="w-[80%] h-4 rounded-b-md flex items-center justify-center text-[8px] text-white"
            style={{ backgroundColor: tagColor }}
          >
            Scan Me
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 bg-gray-200 rounded" />
        </div>
        {tagPosition === "bottom" && (
          <div
            className="w-[80%] h-4 rounded-t-md flex items-center justify-center text-[8px] text-white"
            style={{ backgroundColor: tagColor }}
          >
            Scan Me
          </div>
        )}
      </div>
    );
  };

  const renderQRFrame = () => {
    if (!text) {
      return (
        <div className="flex flex-col items-center text-gray-400 gap-2">
          <span className="text-4xl leading-none">+</span>
          <p className="text-sm">Enter content to generate QR code</p>
        </div>
      );
    }

    const qrValue = (() => {
      if (
        contentType === ContentTypes.SMS ||
        contentType === ContentTypes.PHONE ||
        contentType === ContentTypes.CONTACT
      ) {
        return text || "";
      }

      const origin = getBaseUrl();

      if (exportValue) return exportValue;
      if (nanoId) return `${origin}/qr/${nanoId}`;
      return text || "";
    })();

    const QR_PIXEL_SIZE = 256;

    // Check if watermark should be shown
    const shouldShowWatermark = watermarkSettings?.enabled && 
      !removeWatermarkEnabled && 
      !canUseFeature('removeWatermark');

    // Watermark component
    const WatermarkOverlay = () => {
      if (!shouldShowWatermark) return null;

      const sizeMap = {
        small: 'text-[8px] px-1.5 py-0.5',
        medium: 'text-[10px] px-2 py-1',
        large: 'text-xs px-2.5 py-1.5'
      };

      const positionMap = {
        'bottom-right': 'bottom-2 right-2',
        'bottom-left': 'bottom-2 left-2',
        'bottom-center': 'bottom-2 left-1/2 -translate-x-1/2'
      };

      return (
        <div 
          className={`absolute ${positionMap[watermarkSettings.position as keyof typeof positionMap] || 'bottom-2 right-2'} 
            ${sizeMap[watermarkSettings.size as keyof typeof sizeMap] || 'text-[8px] px-1.5 py-0.5'}
            bg-white rounded flex items-center gap-1 shadow-sm`}
          style={{ opacity: watermarkSettings.opacity }}
        >
          {watermarkSettings.logoUrl && (
            <img 
              src={watermarkSettings.logoUrl} 
              alt="watermark" 
              className="h-3 w-auto object-contain"
              crossOrigin="anonymous"
            />
          )}
          {watermarkSettings.text && (
            <span className="text-gray-700 font-medium whitespace-nowrap">
              {watermarkSettings.text}
            </span>
          )}
        </div>
      );
    };

    const QRCore = (
      <div className="relative inline-block">
        <StyledQRCode
          ref={qrCallbackRef}
          value={qrValue}
          size={QR_PIXEL_SIZE}
          bgColor={bgColor}
          fgColor={fgColor}
          shape={qrShape}
        />

        {(logoImage || (logoPreset && logoPreset !== "none")) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-md">
              {logoImage ? (
                <img
                  src={logoImage}
                  alt="logo"
                  className="w-10 h-10 object-contain"
                />
              ) : logoPreset ? (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: LOGO_PRESETS_META[logoPreset].color,
                  }}
                >
                  {LOGO_PRESET_ICON[logoPreset] || (
                    <span className="text-xs text-white font-semibold">
                      {LOGO_PRESETS_META[logoPreset].short}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );

    const ScanMeButton = ({ color }: { color: string }) => (
      <button
        type="button"
        className="mt-3 mx-auto inline-flex items-center gap-1.5 px-3 py-1.5
               rounded-full text-xs font-medium text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h18M4 9h16M7 15h10M10 20h4"
          />
        </svg>
        <span>Scan Me</span>
      </button>
    );

    switch (frameStyle) {
      case "none":
      case "noFrame":
        return (
          <div className="relative bg-white rounded-[10px] shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-6 flex items-center justify-center">
            {QRCore}
            <WatermarkOverlay />
          </div>
        );

      case "circle":
        return (
          <div className="relative inline-flex items-center justify-center">
            <div className="rounded-full bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.25)] border border-slate-100">
              <div className="rounded-full overflow-hidden">{QRCore}</div>
            </div>
            <WatermarkOverlay />
          </div>
        );

      case "bottomYellow":
        return (
          <div className="inline-flex flex-col items-center">
            <div
              className="relative bg-white rounded-2xl shadow-xl border border-yellow-300/60
                      px-5 pt-5 pb-4 flex flex-col items-center"
            >
              {QRCore}
              <ScanMeButton color="#F59E0B" />
              <WatermarkOverlay />
            </div>
          </div>
        );

      case "topPurple":
        return (
          <div className="inline-flex flex-col items-center">
            <div
              className="relative bg-white rounded-2xl shadow-xl border border-purple-300/60
                      px-5 pb-5 pt-3 flex flex-col items-center"
            >
              <ScanMeButton color="#A855F7" />
              <div className="mt-2">{QRCore}</div>
              <WatermarkOverlay />
            </div>
          </div>
        );

      case "bottomBlue":
        return (
          <div className="inline-flex flex-col items-center">
            <div
              className="relative bg-white rounded-2xl shadow-xl border border-blue-300/60
                      px-5 pt-5 pb-4 flex flex-col items-center"
            >
              {QRCore}
              <ScanMeButton color="#3B82F6" />
              <WatermarkOverlay />
            </div>
          </div>
        );

      case "bottomGreen":
        return (
          <div className="inline-flex flex-col items-center">
            <div
              className="relative bg-white rounded-2xl shadow-xl border border-emerald-300/60
                      px-5 pt-5 pb-4 flex flex-col items-center"
            >
              {QRCore}
              <ScanMeButton color="#15803D" />
              <WatermarkOverlay />
            </div>
          </div>
        );

      case "bottomRed":
        return (
          <div className="inline-flex flex-col items-center">
            <div
              className="relative bg-white rounded-2xl shadow-xl border border-rose-300/60
                      px-5 pt-5 pb-4 flex flex-col items-center"
            >
              {QRCore}
              <ScanMeButton color="#EF4444" />
              <WatermarkOverlay />
            </div>
          </div>
        );

      default:
        return (
          <div className="relative bg-white rounded-[10px] shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-6 flex items-center justify-center">
            {QRCore}
            <WatermarkOverlay />
          </div>
        );
    }
  };

  /* -------------------------------------------------------------- */
  /* Add URL Modal for Multi-URL                                     */
  /* -------------------------------------------------------------- */
  
  const AddUrlModal = () => {
    const [newUrl, setNewUrl] = useState("");
    const [newUrlTitle, setNewUrlTitle] = useState("");
    
    const handleAddUrl = () => {
      if (newUrl.trim()) {
        setMultiUrls([...multiUrls.filter(u => u.url.trim()), { url: newUrl, title: newUrlTitle || newUrl }]);
        setNewUrl("");
        setNewUrlTitle("");
        setShowAddUrlModal(false);
      }
    };
    
    if (!showAddUrlModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Add New Link</h3>
            <button onClick={() => setShowAddUrlModal(false)} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link Title</label>
              <input
                type="text"
                value={newUrlTitle}
                onChange={(e) => setNewUrlTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g., My Website"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://example.com"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddUrlModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUrl}
                disabled={!newUrl.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------------- */
  /* main UI                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-emerald-50 to-emerald-100">
      <Head>
        <title>QR Code Generator</title>
      </Head>

      {/* Trial Banner */}
      {user && isTrialActive && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 text-center">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <span className="text-sm font-medium">
              🎉 Premium Trial Active: {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
            </span>
            <button
              onClick={() => router.push('/pricing')}
              className="bg-white text-purple-600 px-4 py-1 rounded-full text-xs font-semibold hover:bg-purple-50 transition-colors"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* Free Plan Limit Banner */}
      {user && !isTrialActive && planName === 'Free' && (
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 px-4 text-center">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <span className="text-sm font-medium">
              ⚡ Unlock Premium Features - Get tracking, remove watermarks, and more!
            </span>
            <button
              onClick={() => router.push('/pricing')}
              className="bg-white text-blue-600 px-4 py-1 rounded-full text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              View Plans
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        <header className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
            QR Code Generator
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">
            All-in-one tool to create free QR Codes, edit them, and track
            campaign performance.
          </p>
        </header>

        {!user && (
          <div className="max-w-3xl mx-auto mb-4">
            <Banner
              type="info"
              message="Sign in to save, track and manage your QR Codes across devices."
              className="w-full"
            />
          </div>
        )}

        <section className="max-w-7xl mx-auto bg-zinc-900 rounded-[32px] shadow-2xl px-4 sm:px-6 lg:px-8 py-6 md:py-7 text-white">
          {/* content type tabs */}
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-4 border-b border-zinc-700">
            {Object.entries(ContentTypes).map(([label, value]) => (
              <button
                key={value}
                onClick={() => handleContentTypeChange(value as ContentType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs md:text-sm font-medium flex-shrink-0 transition-colors
                  ${
                    contentType === value
                      ? "bg-zinc-800 text-lime-300"
                      : "bg-transparent text-lime-400/70 hover:bg-zinc-800/60 hover:text-lime-300"
                  }`}
              >
                <span className="w-4 h-4 md:w-5 md:h-5">
                  {ContentTypeIcons[label as ContentTypeKey]}
                </span>
                <span className="whitespace-nowrap">
                  {label.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>

          {/* content + preview */}
          <div className="mt-6 flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
            {/* left side */}
            <div className="flex-1 space-y-5">
              <div className="space-y-1">
                <p className="text-lg md:text-xl font-semibold text-white">
                  {contentType === ContentTypes.URL &&
                    "Redirect to an existing web URL"}
                  {contentType === ContentTypes.PDF &&
                    "Link a PDF file for easy sharing"}
                  {contentType === ContentTypes.FILE &&
                    "Link any hosted file using a QR Code"}
                  {contentType === ContentTypes.MULTI_URL &&
                    "Show multiple links on a single scan"}
                  {contentType === ContentTypes.CONTACT &&
                    "Share contact details with one scan"}
                  {contentType === ContentTypes.PLAIN_TEXT &&
                    "Display a short text message"}
                  {contentType === ContentTypes.SMS &&
                    "Create a pre-filled SMS message"}
                  {contentType === ContentTypes.PHONE &&
                    "Link a phone number for quick calls"}
                </p>
                <p className="text-[11px] md:text-xs text-zinc-300">
                  {contentType === ContentTypes.URL &&
                    "Try something like https://example.com/"}
                </p>
              </div>

              <div className="space-y-2 text-black">{renderContentInput()}</div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                {/* Track your scans */}
                <div className="flex items-center gap-2 text-xs md:text-sm text-zinc-200">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        setShowAuthModal(true);
                        return;
                      }
                      if (!canUseFeature('tracking')) {
                        router.push('/pricing');
                        return;
                      }
                      setTrackScansEnabled((prev) => !prev);
                    }}
                    className={`relative w-10 h-5 rounded-full border flex items-center transition-colors
                      ${
                        trackScansEnabled && canUseFeature('tracking')
                          ? "bg-lime-400 border-lime-300"
                          : "bg-zinc-700 border-zinc-600"
                      }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white transform transition-transform duration-200
                        ${
                          trackScansEnabled && canUseFeature('tracking')
                            ? "translate-x-[14px]"
                            : "translate-x-[2px]"
                        }`}
                    />
                  </button>
                  <span>Track your scans {!canUseFeature('tracking') && '✨'}</span>
                  {!canUseFeature('tracking') && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/60">
                      {isTrialActive ? `${trialDaysRemaining}d trial` : 'Premium'}
                    </span>
                  )}
                </div>

                {/* Remove watermark */}
                <div className="flex items-center gap-2 text-xs md:text-sm text-zinc-200">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        setShowAuthModal(true);
                        return;
                      }
                      if (!canUseFeature('removeWatermark')) {
                        router.push('/pricing');
                        return;
                      }
                      setRemoveWatermarkEnabled((prev) => !prev);
                    }}
                    className={`relative w-10 h-5 rounded-full border flex items-center transition-colors
                      ${
                        removeWatermarkEnabled && canUseFeature('removeWatermark')
                          ? "bg-lime-400 border-lime-300"
                          : "bg-zinc-700 border-zinc-600"
                      }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white transform transition-transform duration-200
                        ${
                          removeWatermarkEnabled && canUseFeature('removeWatermark')
                            ? "translate-x-[14px]"
                            : "translate-x-[2px]"
                        }`}
                    />
                  </button>
                  <span>Remove watermark {!canUseFeature('removeWatermark') && '✨'}</span>
                  {!canUseFeature('removeWatermark') && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/60">
                      {isTrialActive ? `${trialDaysRemaining}d trial` : 'Premium'}
                    </span>
                  )}
                </div>
              </div>

              {/* Campaign URL Tracking */}
              {contentType === ContentTypes.URL && (
                <div className="mt-6 border border-zinc-700 rounded-2xl p-4 bg-zinc-900/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        Campaign Tracking
                      </p>
                      <span className="text-[10px] bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/60">
                        UTM Parameters
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCampaignEnabled(!campaignEnabled)}
                      className={`relative w-10 h-5 rounded-full border flex items-center transition-colors
                        ${
                          campaignEnabled
                            ? "bg-lime-400 border-lime-300"
                            : "bg-zinc-700 border-zinc-600"
                        }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white transform transition-transform duration-200
                          ${
                            campaignEnabled
                              ? "translate-x-[14px]"
                              : "translate-x-[2px]"
                          }`}
                      />
                    </button>
                  </div>

                  {campaignEnabled && (
                    <div className="space-y-3 pt-2">
                      <p className="text-xs text-zinc-300">
                        Add UTM parameters to track your marketing campaigns
                      </p>
                      
                      <div className="grid gap-3">
                        <div>
                          <label className="block text-xs text-zinc-300 mb-1">
                            Campaign Source
                            <span className="text-zinc-500 ml-1">(e.g., google, facebook, newsletter)</span>
                          </label>
                          <input
                            type="text"
                            value={campaignSource}
                            onChange={(e) => setCampaignSource(e.target.value)}
                            placeholder="e.g., google"
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-lime-400 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-zinc-300 mb-1">
                            Campaign Medium
                            <span className="text-zinc-500 ml-1">(e.g., cpc, email, social)</span>
                          </label>
                          <input
                            type="text"
                            value={campaignMedium}
                            onChange={(e) => setCampaignMedium(e.target.value)}
                            placeholder="e.g., cpc"
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-lime-400 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-zinc-300 mb-1">
                            Campaign Name
                            <span className="text-zinc-500 ml-1">(e.g., spring_sale, product_launch)</span>
                          </label>
                          <input
                            type="text"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            placeholder="e.g., spring_sale"
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-lime-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {(campaignSource || campaignMedium || campaignName) && (
                        <div className="mt-3 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                          <p className="text-xs text-zinc-400 mb-2">Preview URL:</p>
                          <p className="text-xs text-lime-300 break-all font-mono">
                            {text}
                            {text.includes('?') ? '&' : '?'}
                            {[
                              campaignSource && `utm_source=${encodeURIComponent(campaignSource)}`,
                              campaignMedium && `utm_medium=${encodeURIComponent(campaignMedium)}`,
                              campaignName && `utm_campaign=${encodeURIComponent(campaignName)}`
                            ].filter(Boolean).join('&')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* design card */}
              <div className="mt-4 border border-zinc-700 rounded-2xl p-4 bg-zinc-900/60 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    Design your QR
                  </p>
                  <div className="flex gap-1 rounded-full bg-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
                    Optional
                  </div>
                </div>

                {/* design tabs */}
                <div className="flex gap-2 border-b border-zinc-700 pb-2 mb-3">
                  {[
                    { key: "FRAME", label: "Frames ✨", premium: true },
                    { key: "SHAPE", label: "Shape", premium: false },
                    { key: "LOGO", label: "Logo", premium: false },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        if (tab.premium && !canUseFeature('frames')) {
                          router.push('/pricing');
                          return;
                        }
                        setDesignTab(tab.key as DesignTab);
                      }}
                      className={`px-3 py-1.5 rounded-2xl text-[11px] md:text-xs font-medium relative ${
                        designTab === tab.key
                          ? "bg-lime-400 text-zinc-900"
                          : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      {tab.label}
                      {tab.premium && !canUseFeature('frames') && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full"></span>
                      )}
                    </button>
                  ))}
                </div>

                {/* frame tab */}
                {designTab === "FRAME" && (
                  <div className="space-y-3 relative">
                    {/* Premium Overlay - only show if not loading and user doesn't have access */}
                    {!planLoading && !canUseFeature('frames') && (
                      <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm rounded-2xl z-10 flex flex-col items-center justify-center gap-3 p-6">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <h3 className="text-white font-semibold mb-1">Premium Feature</h3>
                          <p className="text-zinc-300 text-xs mb-3">
                            Unlock beautiful frames with premium
                          </p>
                          <button
                            onClick={() => router.push('/pricing')}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
                          >
                            Upgrade Now
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-[11px] font-medium text-zinc-200 mb-1 flex items-center gap-2">
                      Frames
                      <span className="px-2 py-[2px] rounded-full text-[9px] bg-purple-500/20 text-purple-200 border border-purple-400/60">
                        NEW
                      </span>
                    </p>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1">
                      {FRAME_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => canUseFeature('frames') && setFrameStyle(preset.id)}
                          disabled={!canUseFeature('frames')}
                          className={`flex flex-col items-center gap-1 flex-shrink-0 px-1 pt-1 pb-2 rounded-2xl border ${
                            frameStyle === preset.id
                              ? "border-lime-400 bg-zinc-800/60"
                              : "border-zinc-700 bg-zinc-900/40 hover:bg-zinc-800/40"
                          } ${!canUseFeature('frames') ? 'opacity-50' : ''}`}
                        >
                          {renderFrameThumbnail(preset)}
                          <span className="text-[10px] text-zinc-200 mt-1">
                            {preset.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* shape tab */}
                {designTab === "SHAPE" && (
                  <div className="space-y-4">
                    <p className="text-[11px] font-medium text-zinc-200">
                      QR Shape
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      {SHAPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setQrShape(opt.id)}
                          className={`flex flex-col items-center gap-1 px-2 pt-2 pb-2 rounded-2xl border flex-shrink-0 ${
                            qrShape === opt.id
                              ? "border-lime-400 bg-zinc-800/70"
                              : "border-zinc-700 bg-zinc-900/40 hover:bg-zinc-800/40"
                          }`}
                        >
                          {renderShapeThumbnail(opt.id)}
                          <span className="text-[10px] mt-1 text-zinc-200">
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-zinc-400">
                      These styles actually change the QR modules (classic
                      squares, circles, smooth dots, etc.) instead of just
                      rounding the outer border.
                    </p>
                  </div>
                )}

                {/* logo tab */}
                {designTab === "LOGO" && (
                  <div className="space-y-4">
                    <p className="text-[11px] font-medium text-zinc-200">
                      Center logo
                    </p>

                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                      {["none", "whatsapp", "link", "location", "wifi"].map(
                        (id) => {
                          const meta = LOGO_PRESETS_META[id];
                          return (
                            <button
                              key={id}
                              onClick={() => {
                                if (id === "none") {
                                  setLogoImage(null);
                                  setLogoPreset(null);
                                } else {
                                  setLogoImage(null);
                                  setLogoPreset(id);
                                }
                              }}
                              className={`flex flex-col items-center gap-1 flex-shrink-0 px-2 py-2 rounded-2xl border ${
                                logoPreset === id
                                  ? "border-white bg-zinc-800"
                                  : "border-zinc-700 bg-zinc-900/40 hover:bg-zinc-800/40"
                              }`}
                            >
                              <div
                                className="w-11 h-11 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: meta.color }}
                              >
                                {id === "none" ? (
                                  <span className="text-xs text-zinc-700 font-semibold">
                                    ×
                                  </span>
                                ) : (
                                  LOGO_PRESET_ICON[id] || (
                                    <span className="text-xs text-white font-semibold">
                                      {meta.short}
                                    </span>
                                  )
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-200">
                                {meta.label}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>

                    <div className="mt-1 border border-dashed border-zinc-600 rounded-2xl p-4 text-center bg-zinc-900">
                      <p className="text-[11px] text-zinc-300 mb-2">
                        Upload your own brand mark (SVG or PNG). It will appear
                        in the center of the QR Code.
                      </p>
                      <label className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white text-zinc-900 text-xs font-medium cursor-pointer hover:bg-zinc-100">
                        Upload logo
                        <input
                          type="file"
                          accept="image/png,image/svg+xml"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* right side preview */}
            <div className="w-full lg:w-[320px] xl:w-[340px] flex flex-col items-center gap-4">
              <div className="w-full flex flex-col items-start lg:items-end">
                {!removeWatermarkEnabled && !canUseFeature('removeWatermark') && (
                  <p className="text-sm font-medium text-zinc-200">
                    {isTrialActive ? (
                      <>
                        <span className="text-lime-400">🎉 Trial Active!</span> Upgrade to keep tracking enabled
                      </>
                    ) : (
                      <>
                        To enable tracking,{" "}
                        <button 
                          onClick={() => router.push('/pricing')}
                          className="underline decoration-dotted underline-offset-4 hover:text-lime-400 transition-colors"
                        >
                          create a Dynamic QR Code
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="mt-2 bg-transparent rounded-2xl flex items-center justify-center">
                <div ref={qrPreviewRef}>
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-40 h-40 bg-zinc-200 rounded-xl animate-pulse" />
                      <p className="text-xs text-zinc-500">
                        Generating QR Code…
                      </p>
                    </div>
                  ) : (
                    renderQRFrame()
                  )}
                </div>
              </div>

              {text ? (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                    <span>Download as</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDirectDownload("png")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                      >
                        PNG
                      </button>
                      <button
                        onClick={() => handleDirectDownload("svg")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                      >
                        SVG
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!user) {
                        setShowAuthModal(true);
                        return;
                      }
                      handleDirectDownload("png");
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-lime-400 text-zinc-900 text-sm font-semibold hover:bg-lime-300"
                  >
                    <DownloadIcon />
                    <span>Download QR Code</span>
                  </button>

                  {error && (
                    <p className="text-[11px] text-red-400 mt-1">{error}</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-400 text-center">
                  Start by choosing a type and entering your content on the
                  left. Your QR preview will appear here.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
      
      <AddUrlModal />
    </div>
  );
}
