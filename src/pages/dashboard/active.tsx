/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

import DashboardLayout from "@/components/DashboardLayout";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

import EditQRModal from "@/components/EditQRModal";
import ViewQRModal from "@/components/ViewQRModal";
import ScanAnalyticsModal from "@/components/ScanAnalyticsModal";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadFile } from "../../utils/fileUpload";

import { EyeIcon, PencilIcon, PauseIcon } from "@heroicons/react/24/outline";
import { MdOutlineBrandingWatermark, MdCampaign } from "react-icons/md";
import { QRCodeSVG } from "qrcode.react";

// @ts-ignore – qr-code-styling has no official TS types in many setups
import QRCodeStyling from "qr-code-styling";

// ✅ For downloading the FULL FRAME (not just QR)
import { toPng, toSvg } from "html-to-image";

type SortField = "title" | "type" | "createdAt" | "scans";
type FrameStyle = "none" | "soft-card" | "dark-badge" | "outline-tag";
type PatternStyle = "classic" | "rounded" | "thin" | "smooth" | "circles";

interface QRCode {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  scans: number;
  isActive: boolean;
  title?: string;
  mode?: "static" | "dynamic";
  trackScans?: boolean;

  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: string;
    logoImage?: string | null; // dataURL
    logoPreset?: string | null;
    patternStyle?: PatternStyle;
    frameStyle?: FrameStyle;
    watermarkEnabled?: boolean;
  };

  campaign?: {
    enabled: boolean;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

const truncateTitle = (title: string, maxLength: number = 30) => {
  if (!title || title.length <= maxLength) return title;
  return `${title.substring(0, maxLength)}...`;
};

const truncateContent = (content: string, maxLength: number = 40) => {
  if (!content) return "";
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + "...";
};

/* ---------------- preset logo SVG → data URL (qr-code-styling image) ---------------- */
const svgToDataUrl = (svg: string) => {
  if (typeof window === "undefined") return undefined;
  const base64 = window.btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
};

const getLogoPresetDataUrl = (preset: string | null, fg: string) => {
  if (!preset) return undefined;

  if (preset === "scan-me") {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
        <rect x="0" y="0" width="160" height="160" rx="24" fill="white"/>
        <rect x="0.5" y="0.5" width="159" height="159" rx="24" fill="white" stroke="#E5E7EB"/>
        <text x="80" y="90" text-anchor="middle" font-family="Arial, sans-serif"
              font-size="28" font-weight="700" fill="${fg}">SCAN</text>
        <text x="80" y="120" text-anchor="middle" font-family="Arial, sans-serif"
              font-size="28" font-weight="700" fill="${fg}">ME</text>
      </svg>
    `;
    return svgToDataUrl(svg);
  }

  if (preset === "camera") {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
        <rect x="0" y="0" width="160" height="160" rx="80" fill="white"/>
        <rect x="0.5" y="0.5" width="159" height="159" rx="80" fill="white" stroke="#E5E7EB"/>
        <g transform="translate(38,52)">
          <rect x="0" y="10" width="84" height="56" rx="12" fill="${fg}"/>
          <rect x="14" y="0" width="20" height="16" rx="6" fill="${fg}"/>
          <circle cx="50" cy="38" r="16" fill="white"/>
          <circle cx="50" cy="38" r="10" fill="${fg}"/>
          <circle cx="72" cy="24" r="4" fill="white"/>
        </g>
      </svg>
    `;
    return svgToDataUrl(svg);
  }

  return undefined;
};

/* ---------------- Upload PNG/SVG → dataURL ---------------- */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (
      file.type === "image/svg+xml" ||
      file.name.toLowerCase().endsWith(".svg")
    ) {
      const textReader = new FileReader();
      textReader.onload = () => {
        try {
          const svgText = textReader.result as string;
          const url = svgToDataUrl(svgText);
          if (!url) return reject(new Error("Failed to convert SVG"));
          resolve(url);
        } catch (e) {
          reject(e);
        }
      };
      textReader.onerror = reject;
      textReader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const downloadSvgString = (svgString: string, filename: string) => {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ------------------------------------------------------------------ */
/* ✅ SAME SOCIAL TAB UI (icons + scroll + selected platform)          */
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
        <path d="M12 2c-2.716 0-3.056.012-4.123.06-1.064.049-1.791.218-2.427.465a4.901 4.901 0 0 0-1.772 1.153A4.902 4.902 0 0 0 2.525 5.45c-.247.636-.416 1.363-.465 2.427C2.012 8.944 2 9.284 2 12s.012 3.056.06 4.123c.049 1.064.218 1.791.465 2.427a4.902 4.902 0 0 0 1.153 1.772 4.901 4.901 0 0 0 1.772 1.153c.636.247 1.363.416 2.427.465 1.067.048 1.407.06 4.123.06s3.056-.012 4.123-.06c1.064-.049 1.791-.218 2.427-.465a4.902 4.902 0 0 0 1.772-1.153 4.902 4.902 0 0 0 1.153-1.772c.247-.636.416-1.363.465-2.427.048-1.067.06-1.407.06-4.123s-.012-3.056-.06-4.123c-.049-1.064-.218-1.791-.465-2.427a4.902 4.902 0 0 0-1.153-1.772 4.901 4.901 0 0 0-1.772-1.153c-.636-.247-1.363-.416-2.427-.465C15.056 2.012 14.716 2 12 2zm0 1.802c2.67 0 2.986.01 4.04.058.975.045 1.505.207 1.858.344.467.182.8.399 1.15.748.35.35.566.683.748 1.15.137.353.3.883.344 1.857.048 1.055.058 1.37.058 4.041 0 2.67-.01 2.986-.058 4.04-.045.975-.207 1.505-.344 1.858a3.1 3.1 0 0 1-.748 1.15c-.35.35-.683.566-1.15.748-.353.137-.883.3-1.857.344-1.054.048-1.37.058-4.041.058-2.67 0-2.987-.01-4.04-.058-.975-.045-1.505-.207-1.858-.344a3.098 3.098 0 0 1-1.15-.748 3.098 3.098 0 0 1-.748-1.15c-.137-.353-.3-.883-.344-1.857-.048-1.055-.058-1.37-.058-4.041 0-2.67.01-2.986.058-4.04.045-.975.207-1.505.344-1.858.182-.467.399-.8.748-1.15.35-.35.683-.566 1.15-.748.353-.137.883-.3 1.857-.344 1.055-.048 1.37-.058 4.041-.058zM12 15.333a3.333 3.333 0 1 1 0-6.666 3.333 3.333 0 0 1 0 6.666zM12 6.865a5.135 5.135 0 1 0 0 10.27 5.135 5.135 0 0 0 0-10.27zM18.538 6.662a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" />
      </svg>
    ),
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
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
] as const;

type SocialKey = (typeof SOCIAL_PLATFORMS)[number]["key"];
type SocialData = { selectedPlatform: SocialKey } & Partial<
  Record<SocialKey, string>
>;

export default function ActiveCodes() {
  const router = useRouter();
  const { user } = useAuth();
  const { canUseFeature, planName, isTrialActive } = usePlanFeatures();
  const isPremium = planName !== "Free" || isTrialActive;

  // ---------- LIST STATE ----------
  const [codes, setCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedViewQR, setSelectedViewQR] = useState<QRCode | null>(null);
  const [selectedAnalyticsQR, setSelectedAnalyticsQR] = useState<QRCode | null>(
    null
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const itemsPerPage = 5;

  // ---------- WIZARD STATE ----------
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<string>("URL");
  const [qrTitle, setQrTitle] = useState<string>("");

  // ✅ Edit mode (wizard edit)
  const [editingId, setEditingId] = useState<string | null>(null);

  // URL
  const [urlValue, setUrlValue] = useState<string>("");

  // Plain Text
  const [plainTextValue, setPlainTextValue] = useState<string>("");

  // Email
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailBody, setEmailBody] = useState<string>("");

  // SMS
  const [smsNumber, setSmsNumber] = useState<string>("");
  const [smsMessage, setSmsMessage] = useState<string>("");

  // Location
  const [locationLat, setLocationLat] = useState<string>("");
  const [locationLng, setLocationLng] = useState<string>("");
  const [locationAddress, setLocationAddress] = useState<string>("");

  // Contact (vCard)
  const [contactName, setContactName] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactCompany, setContactCompany] = useState<string>("");
  const [contactNote, setContactNote] = useState<string>("");

  // ✅ Socials (NEW: same UI behaviour)
  const [selectedSocialPlatform, setSelectedSocialPlatform] =
    useState<SocialKey>("facebook");
  const socialContainerRef = useRef<HTMLDivElement | null>(null);
  const [socialsData, setSocialsData] = useState<SocialData>({
    selectedPlatform: "facebook",
  });

  // App
  const [appUniversalLink, setAppUniversalLink] = useState<string>("");
  const [appIosUrl, setAppIosUrl] = useState<string>("");
  const [appAndroidUrl, setAppAndroidUrl] = useState<string>("");
  const [appWebUrl, setAppWebUrl] = useState<string>("");

  // PDF
  const [pdfUrl, setPdfUrl] = useState<string>("");

  // File
  const [fileUrl, setFileUrl] = useState<string>("");

  // Multi-URL with titles
  const [multiUrls, setMultiUrls] = useState<
    Array<{ url: string; title: string }>
  >([{ url: "", title: "" }]);
  const [multiUrlTitle, setMultiUrlTitle] = useState("My Links");
  const [showAddUrlModal, setShowAddUrlModal] = useState(false);

  // Campaign URL tracking
  const [campaignEnabled, setCampaignEnabled] = useState(false);
  const [campaignSource, setCampaignSource] = useState("");
  const [campaignMedium, setCampaignMedium] = useState("");
  const [campaignName, setCampaignName] = useState("");

  // Mode + design
  const [mode, setMode] = useState<"static" | "dynamic">("dynamic");
  const [fgColor, setFgColor] = useState<string>("#000000");
  const [bgColor, setBgColor] = useState<string>("#ffffff");
  const [size, setSize] = useState<number>(256);

  const [logoPreset, setLogoPreset] = useState<string | null>(null);
  const [frameStyle, setFrameStyle] = useState<FrameStyle>("none");
  const [patternStyle, setPatternStyle] = useState<PatternStyle>("classic");

  // ✅ UPLOADED LOGO
  const [uploadedLogoDataUrl, setUploadedLogoDataUrl] = useState<string | null>(
    null
  );
  const [uploadedLogoName, setUploadedLogoName] = useState<string>("");

  // ✅ DOWNLOAD FORMAT
  const [downloadFormat, setDownloadFormat] = useState<"png" | "svg">("png");

  // Watermark settings from admin
  const [watermarkSettings, setWatermarkSettings] = useState<{
    enabled: boolean;
    logoUrl: string;
    text: string;
    position: string;
    size: string;
    opacity: number;
  } | null>(null);

  // ✅ NEW: two toggles (per-QR)
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [scanTrackingEnabled, setScanTrackingEnabled] = useState<boolean>(true);

  // ✅ preview/export refs
  const qrWrapperPreviewRef = useRef<HTMLDivElement | null>(null);
  const qrWrapperExportRef = useRef<HTMLDivElement | null>(null);

  const qrPreviewInstanceRef = useRef<any>(null);
  const qrExportInstanceRef = useRef<any>(null);

  const framePreviewRef = useRef<HTMLDivElement | null>(null);
  const frameExportRef = useRef<HTMLDivElement | null>(null);

  const PREVIEW_MAX = 240;
  const previewScale = Math.min(1, PREVIEW_MAX / (size || 256));

  const scrollSocials = (direction: "left" | "right") => {
    if (!socialContainerRef.current) return;
    const scrollAmount = 200;
    socialContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleSocialUrlChange = (platform: SocialKey, url: string) => {
    setSocialsData((prev) => ({
      ...prev,
      selectedPlatform: platform,
      [platform]: url,
    }));
  };

  const renderSocialsInput = () => {
    const activeLabel =
      SOCIAL_PLATFORMS.find((p) => p.key === selectedSocialPlatform)?.label ||
      "Social";

    return (
      <div className="space-y-6">
        <div className="relative">
          <button
            type="button"
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
                type="button"
                key={key}
                onClick={() => {
                  setSelectedSocialPlatform(key);
                  setSocialsData((prev) => ({
                    ...prev,
                    selectedPlatform: key,
                  }));
                }}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all w-20
                  ${
                    selectedSocialPlatform === key
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
            type="button"
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
            {activeLabel} URL
          </label>
          <input
            type="url"
            value={(socialsData[selectedSocialPlatform] as string) || ""}
            onChange={(e) =>
              handleSocialUrlChange(selectedSocialPlatform, e.target.value)
            }
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={`Enter your ${activeLabel} profile URL`}
          />

          <p className="text-[11px] text-gray-500">
            Tip: Add multiple platforms (switch icons, paste links). QR will
            store all links.
          </p>
        </div>
      </div>
    );
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;

    const isPng =
      file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const isJpeg =
      file.type === "image/jpeg" || file.type === "image/jpg" ||
      file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg");
    const isSvg =
      file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

    if (!isPng && !isJpeg && !isSvg) {
      alert("Please upload PNG, JPEG, or SVG images only.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      
      // Load image to get actual dimensions
      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;
        console.log(`Logo dimensions: ${width}x${height}`);
        
        setUploadedLogoDataUrl(dataUrl);
        setUploadedLogoName(file.name);
        setLogoPreset(null);
      };
      img.src = dataUrl;
    } catch (e) {
      console.error(e);
      alert("Logo upload failed. Try another file.");
    }
  };

  const handlePdfUpload = async (file: File | null) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }

    try {
      const url = await uploadFile(file, {
        allowedTypes: ["application/pdf"],
        folder: "pdfs",
      } as any);
      setPdfUrl(url);
    } catch (e) {
      console.error(e);
      alert("PDF upload failed. Try again.");
    }
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    try {
      const url = await uploadFile(file, {
        allowedTypes: ["*/*"],
        folder: "files",
      } as any);
      setFileUrl(url);
    } catch (e) {
      console.error(e);
      alert("File upload failed. Try again.");
    }
  };

  // ---------- FETCH ACTIVE CODES ----------
  useEffect(() => {
    const fetchQRCodes = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, "qrcodes"),
          where("userId", "==", user.uid),
          where("isActive", "==", true)
        );

        const querySnapshot = await getDocs(q);
        const fetchedCodes = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<QRCode, "id">),
        })) as QRCode[];

        setCodes(fetchedCodes);
      } catch (error) {
        console.error("Error fetching QR codes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQRCodes();
  }, [user]);

  // Fetch watermark settings from Firestore
  useEffect(() => {
    const fetchWatermarkSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "config"));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.watermark) setWatermarkSettings(data.watermark);
        }
      } catch (error) {
        console.error("Dashboard - Error fetching watermark settings:", error);
      }
    };
    fetchWatermarkSettings();
  }, []);

  // ✅ If admin disabled watermark, force OFF locally too
  useEffect(() => {
    if (watermarkSettings && watermarkSettings.enabled === false) {
      setWatermarkEnabled(false);
    }
  }, [watermarkSettings]);

  // ---------- LIST HANDLERS ----------
  const resetWizard = () => {
    setWizardStep(1);
    setSelectedType("URL");
    setQrTitle("");
    setEditingId(null);

    setUrlValue("");
    setPlainTextValue("");
    setEmailAddress("");
    setEmailSubject("");
    setEmailBody("");
    setSmsNumber("");
    setSmsMessage("");
    setLocationLat("");
    setLocationLng("");
    setLocationAddress("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setContactCompany("");
    setContactNote("");

    // ✅ socials reset
    setSelectedSocialPlatform("facebook");
    setSocialsData({ selectedPlatform: "facebook" });

    setAppUniversalLink("");
    setAppIosUrl("");
    setAppAndroidUrl("");
    setAppWebUrl("");
    setPdfUrl("");
    setFileUrl("");
    setMultiUrls([{ url: "", title: "" }]);
    setMultiUrlTitle("My Links");

    setCampaignEnabled(false);
    setCampaignSource("");
    setCampaignMedium("");
    setCampaignName("");

    setMode("dynamic");
    setFgColor("#000000");
    setBgColor("#ffffff");
    setSize(256);
    setLogoPreset(null);
    setFrameStyle("none");
    setPatternStyle("classic");

    setUploadedLogoDataUrl(null);
    setUploadedLogoName("");

    setDownloadFormat("png");

    setScanTrackingEnabled(true);
    setWatermarkEnabled(watermarkSettings?.enabled === false ? false : true);
  };

  // ✅ Wizard edit
  const handleEditClick = (qrCode: QRCode) => {
    resetWizard();
    setEditingId(qrCode.id);
    setWizardStep(1);

    setSelectedType(qrCode.type || "URL");
    setQrTitle(qrCode.title || "");
    setMode((qrCode.mode as any) || "dynamic");

    setSize(qrCode.settings?.size || 256);
    setFgColor(qrCode.settings?.fgColor || "#000000");
    setBgColor(qrCode.settings?.bgColor || "#ffffff");

    setPatternStyle((qrCode.settings?.patternStyle as any) || "classic");
    setFrameStyle((qrCode.settings?.frameStyle as any) || "none");

    setLogoPreset(qrCode.settings?.logoPreset || null);
    setUploadedLogoDataUrl(qrCode.settings?.logoImage || null);
    setUploadedLogoName(qrCode.settings?.logoImage ? "uploaded-logo" : "");

    const wm = qrCode.settings?.watermarkEnabled;
    setWatermarkEnabled(
      watermarkSettings?.enabled === false
        ? false
        : wm === undefined
        ? true
        : !!wm
    );

    setScanTrackingEnabled(
      qrCode.trackScans === undefined ? true : !!qrCode.trackScans
    );

    setCampaignEnabled(!!qrCode.campaign?.enabled);
    setCampaignSource(qrCode.campaign?.utmSource || "");
    setCampaignMedium(qrCode.campaign?.utmMedium || "");
    setCampaignName(qrCode.campaign?.utmCampaign || "");

    const content = qrCode.content || "";

    if (qrCode.type === "URL") setUrlValue(content);
    if (qrCode.type === "Plain Text") setPlainTextValue(content);

    if (qrCode.type === "Email") {
      const raw = content.replace("mailto:", "");
      const [addr, qs] = raw.split("?");
      setEmailAddress(addr || "");
      const params = new URLSearchParams(qs || "");
      setEmailSubject(decodeURIComponent(params.get("subject") || ""));
      setEmailBody(decodeURIComponent(params.get("body") || ""));
    }

    if (qrCode.type === "SMS") {
      const raw = content.replace("sms:", "");
      const [num, qs] = raw.split("?");
      setSmsNumber(num || "");
      const params = new URLSearchParams(qs || "");
      setSmsMessage(decodeURIComponent(params.get("body") || ""));
    }

    if (qrCode.type === "Location") {
      if (content.startsWith("geo:")) {
        const geoRaw = content.replace("geo:", "");
        const [coords, qs] = geoRaw.split("?");
        const [lat, lng] = (coords || "").split(",");
        setLocationLat(lat || "");
        setLocationLng(lng || "");
        const params = new URLSearchParams(qs || "");
        setLocationAddress(decodeURIComponent(params.get("q") || ""));
      } else if (content.includes("maps.google.com/?q=")) {
        setLocationAddress(decodeURIComponent(content.split("q=")[1] || ""));
      } else {
        setLocationAddress(content);
      }
    }

    if (qrCode.type === "Contact") {
      setContactName((content.match(/FN:(.*)/)?.[1] || "").trim());
      setContactPhone((content.match(/TEL;TYPE=CELL:(.*)/)?.[1] || "").trim());
      setContactEmail(
        (content.match(/EMAIL;TYPE=INTERNET:(.*)/)?.[1] || "").trim()
      );
      setContactCompany((content.match(/ORG:(.*)/)?.[1] || "").trim());
      setContactNote((content.match(/NOTE:(.*)/)?.[1] || "").trim());
    }

    // ✅ Socials: NEW format JSON first, fallback to old line format
    if (qrCode.type === "Socials") {
      try {
        const parsed = JSON.parse(content || "{}") as SocialData;
        const selected = (parsed.selectedPlatform || "facebook") as SocialKey;
        setSelectedSocialPlatform(selected);
        setSocialsData({
          selectedPlatform: selected,
          ...parsed,
        });
      } catch {
        // old format fallback
        const lines = content.split("\n");
        const obj: SocialData = { selectedPlatform: "facebook" };
        for (const line of lines) {
          const [k, ...rest] = line.split(":");
          const v = rest.join(":").trim();
          if (!v) continue;
          if (k.trim().toLowerCase() === "instagram") obj.instagram = v;
          if (k.trim().toLowerCase() === "facebook") obj.facebook = v;
          if (k.trim().toLowerCase().includes("twitter")) obj.twitter = v;
          if (k.trim().toLowerCase() === "linkedin") obj.linkedin = v;
          if (k.trim().toLowerCase() === "whatsapp") obj.whatsapp = v;
        }
        setSelectedSocialPlatform("facebook");
        setSocialsData(obj);
      }
    }

    if (qrCode.type === "App") {
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.startsWith("Universal:"))
          setAppUniversalLink(line.replace("Universal:", "").trim());
        if (line.startsWith("iOS:"))
          setAppIosUrl(line.replace("iOS:", "").trim());
        if (line.startsWith("Android:"))
          setAppAndroidUrl(line.replace("Android:", "").trim());
        if (line.startsWith("Web:"))
          setAppWebUrl(line.replace("Web:", "").trim());
      }
    }

    if (qrCode.type === "PDF") setPdfUrl(content);
    if (qrCode.type === "File") setFileUrl(content);

    if (qrCode.type === "Multi-URL") {
      try {
        const parsed = JSON.parse(content || "{}");
        setMultiUrlTitle(parsed.title || "My Links");
        const urls = Array.isArray(parsed.urls) ? parsed.urls : [];
        if (urls.length) {
          setMultiUrls(
            urls.map((u: any) => ({
              url: String(u.url || ""),
              title: String(u.title || ""),
            }))
          );
        } else {
          setMultiUrls([{ url: "", title: "" }]);
        }
      } catch {
        setMultiUrls([{ url: "", title: "" }]);
      }
    }

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleUpdateQR = async (updatedQR: QRCode) => {
    try {
      setLoading(true);
      const qrRef = doc(db, "qrcodes", updatedQR.id);
      await updateDoc(qrRef, {
        title: updatedQR.title,
        type: updatedQR.type,
        content: updatedQR.content,
        settings: updatedQR.settings,
        mode: updatedQR.mode || "dynamic",
        trackScans: updatedQR.trackScans ?? true,
        updatedAt: new Date().toISOString(),
      });

      setCodes((prevCodes) =>
        prevCodes.map((code) =>
          code.id === updatedQR.id ? { ...code, ...updatedQR } : code
        )
      );
      setShowEditModal(false);
      setSelectedQR(null);
    } catch (error) {
      console.error("Error updating QR code:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (qrCode: QRCode) => {
    try {
      const qrRef = doc(db, "qrcodes", qrCode.id);
      await updateDoc(qrRef, {
        isActive: false,
        updatedAt: new Date().toISOString(),
      });

      setCodes((prevCodes) =>
        prevCodes.filter((code) => code.id !== qrCode.id)
      );
    } catch (error) {
      console.error("Error pausing QR code:", error);
    }
  };

  // ---------- WIZARD LOGIC ----------
  const canGoNextFromStep1 = () => {
    switch (selectedType) {
      case "URL":
        return urlValue.trim().length > 0;
      case "Plain Text":
        return plainTextValue.trim().length > 0;
      case "Email":
        return emailAddress.trim().length > 0;
      case "SMS":
        return smsNumber.trim().length > 0;
      case "Location":
        return (
          (locationLat.trim() && locationLng.trim()) ||
          locationAddress.trim().length > 0
        );
      case "Contact":
        return contactName.trim().length > 0 || contactPhone.trim().length > 0;
      case "Socials": {
        const anyUrl = SOCIAL_PLATFORMS.some((p) => {
          const v = (socialsData[p.key] as string) || "";
          return v.trim().length > 0;
        });
        return anyUrl;
      }
      case "App":
        return (
          appUniversalLink.trim().length > 0 ||
          appIosUrl.trim().length > 0 ||
          appAndroidUrl.trim().length > 0 ||
          appWebUrl.trim().length > 0
        );
      case "PDF":
        return pdfUrl.trim().length > 0;
      case "File":
        return fileUrl.trim().length > 0;
      case "Multi-URL":
        return multiUrls.some((u) => u.url.trim().length > 0);
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    if (wizardStep === 1) {
      if (!canGoNextFromStep1()) return;
      setWizardStep(2);
    } else if (wizardStep === 2) {
      setWizardStep(3);
    }
  };

  const handlePrevStep = () => {
    if (wizardStep === 2) setWizardStep(1);
    if (wizardStep === 3) setWizardStep(2);
  };

  const getContentForType = (): string => {
    if (selectedType === "URL") return urlValue.trim();
    if (selectedType === "Plain Text") return plainTextValue.trim();

    if (selectedType === "Email") {
      const address = emailAddress.trim();
      const subject = encodeURIComponent(emailSubject.trim());
      const body = encodeURIComponent(emailBody.trim());
      if (!address) return "";
      let mailto = `mailto:${address}`;
      const params: string[] = [];
      if (subject) params.push(`subject=${subject}`);
      if (body) params.push(`body=${body}`);
      if (params.length) mailto += `?${params.join("&")}`;
      return mailto;
    }

    if (selectedType === "SMS") {
      const num = smsNumber.trim();
      const msg = encodeURIComponent(smsMessage.trim());
      if (!num) return "";
      let sms = `sms:${num}`;
      if (msg) sms += `?body=${msg}`;
      return sms;
    }

    if (selectedType === "Location") {
      const lat = locationLat.trim();
      const lng = locationLng.trim();
      const addr = locationAddress.trim();

      if (lat && lng) {
        return `geo:${lat},${lng}${
          addr ? `?q=${encodeURIComponent(addr)}` : ""
        }`;
      }
      if (addr) return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
      return "";
    }

    if (selectedType === "Contact") {
      const name = contactName.trim() || "Unnamed";
      const phone = contactPhone.trim();
      const email = contactEmail.trim();
      const company = contactCompany.trim();
      const note = contactNote.trim();

      let vcard = "BEGIN:VCARD\nVERSION:3.0\n";
      vcard += `FN:${name}\n`;
      vcard += `N:${name};;;;\n`;
      if (company) vcard += `ORG:${company}\n`;
      if (phone) vcard += `TEL;TYPE=CELL:${phone}\n`;
      if (email) vcard += `EMAIL;TYPE=INTERNET:${email}\n`;
      if (note) vcard += `NOTE:${note}\n`;
      vcard += "END:VCARD";
      return vcard;
    }

    // ✅ Socials content now stored as JSON (so it works like your other Social tab)
    if (selectedType === "Socials") {
      const payload: SocialData = {
        selectedPlatform: selectedSocialPlatform,
      };

      SOCIAL_PLATFORMS.forEach((p) => {
        const v = (socialsData[p.key] as string) || "";
        if (v.trim()) (payload as any)[p.key] = v.trim();
      });

      return JSON.stringify(payload);
    }

    if (selectedType === "App") {
      const lines: string[] = [];
      if (appUniversalLink.trim())
        lines.push(`Universal: ${appUniversalLink.trim()}`);
      if (appIosUrl.trim()) lines.push(`iOS: ${appIosUrl.trim()}`);
      if (appAndroidUrl.trim()) lines.push(`Android: ${appAndroidUrl.trim()}`);
      if (appWebUrl.trim()) lines.push(`Web: ${appWebUrl.trim()}`);
      return lines.join("\n");
    }

    if (selectedType === "PDF") return pdfUrl.trim();
    if (selectedType === "File") return fileUrl.trim();

    if (selectedType === "Multi-URL") {
      const multiUrlData = {
        title: multiUrlTitle || "My Links",
        urls: multiUrls.filter((item) => item.url.trim()),
      };
      return JSON.stringify(multiUrlData);
    }

    return "";
  };

  // ✅ Save / Update
  const saveQRCodeToFirestore = async (): Promise<QRCode | null> => {
    if (!user) {
      alert("You must be logged in to create a QR code.");
      return null;
    }

    const content = getContentForType();
    if (!content) {
      alert("Please fill in the required fields.");
      return null;
    }

    try {
      setLoading(true);
      const now = new Date().toISOString();

      const campaignData =
        selectedType === "URL" && campaignEnabled
          ? {
              enabled: true,
              utmSource: campaignSource,
              utmMedium: campaignMedium,
              utmCampaign: campaignName,
            }
          : undefined;

      const payload: any = {
        userId: user.uid,
        title: qrTitle || `${selectedType} QR Code`,
        type: selectedType,
        content,
        updatedAt: now,
        mode,
        trackScans: scanTrackingEnabled,
        settings: {
          size,
          fgColor,
          bgColor,
          shape: patternStyle,
          logoPreset,
          logoImage: uploadedLogoDataUrl || null,
          frameStyle,
          patternStyle,
          watermarkEnabled:
            watermarkSettings?.enabled === false ? false : watermarkEnabled,
        },
        ...(campaignData && { campaign: campaignData }),
      };

      if (editingId) {
        const qrRef = doc(db, "qrcodes", editingId);
        await updateDoc(qrRef, payload);

        setCodes((prev) =>
          prev.map((c) =>
            c.id === editingId ? ({ ...c, ...payload } as any) : c
          )
        );

        const existing = codes.find((c) => c.id === editingId);
        return {
          id: editingId,
          createdAt: existing?.createdAt || now,
          scans: existing?.scans || 0,
          isActive: true,
          ...payload,
        } as QRCode;
      }

      const newDoc = await addDoc(collection(db, "qrcodes"), {
        ...payload,
        createdAt: now,
        scans: 0,
        isActive: true,
      });

      const newQRCode: QRCode = {
        id: newDoc.id,
        createdAt: now,
        scans: 0,
        isActive: true,
        ...payload,
      };

      setCodes((prev) => [newQRCode, ...prev]);
      return newQRCode;
    } catch (error) {
      console.error("Error creating/updating QR code:", error);
      alert("Could not save QR code. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ---------- QR-CODE-STYLING PREVIEW ----------
  // For dynamic QRs, always use the redirect URL, not the actual content
  const getQRData = (): string => {
    if (mode === "dynamic" && editingId) {
      // If editing a dynamic QR, use its redirect URL
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      return `${baseUrl}/qr/${editingId}`;
    }
    // For static QRs or new dynamic QRs (no ID yet), use the actual content
    return getContentForType() || "https://example.com";
  };
  
  const qrData = getQRData();

  const buildDotsOptions = (pattern: PatternStyle, color: string) => {
    switch (pattern) {
      case "rounded":
        return { color, type: "rounded" };
      case "thin":
        return { color, type: "extra-rounded" };
      case "smooth":
        return { color, type: "classy-rounded" };
      case "circles":
        return { color, type: "dots" };
      case "classic":
      default:
        return { color, type: "square" };
    }
  };

  const buildCornersSquareOptions = (pattern: PatternStyle, color: string) => {
    switch (pattern) {
      case "rounded":
      case "smooth":
        return { color, type: "extra-rounded" };
      case "circles":
        return { color, type: "rounded" };
      case "thin":
        return { color, type: "classy" };
      case "classic":
      default:
        return { color, type: "square" };
    }
  };

  useEffect(() => {
    if (wizardStep === 1) return;
    if (typeof window === "undefined") return;

    const presetImage = getLogoPresetDataUrl(logoPreset, fgColor);
    const finalLogoImage = uploadedLogoDataUrl || presetImage;

    // Calculate optimal logo size based on image dimensions for scannability
    let logoSize = 0;
    let logoMargin = 0;
    
    if (finalLogoImage) {
      // Load image to check dimensions
      const img = new Image();
      img.src = finalLogoImage;
      
      // For scannability, logo should be dynamically sized
      // Smaller logos can be slightly larger, larger logos must be smaller
      img.onload = () => {
        const maxDimension = Math.max(img.width || 100, img.height || 100);
        
        if (maxDimension < 100) {
          logoSize = 0.20; // 20% for small logos
          logoMargin = 8;
        } else if (maxDimension < 200) {
          logoSize = 0.15; // 15% for medium logos
          logoMargin = 10;
        } else {
          logoSize = 0.12; // 12% for large logos to ensure scannability
          logoMargin = 12;
        }
        
        // Update QR after calculating logo size
        if (qrPreviewInstanceRef.current) {
          qrPreviewInstanceRef.current.update({
            imageOptions: {
              crossOrigin: "anonymous",
              margin: logoMargin,
              imageSize: logoSize,
              hideBackgroundDots: true,
            },
          });
        }
      };
      
      // Set default values immediately
      logoSize = 0.15;
      logoMargin = 10;
    }

    const options: any = {
      width: size,
      height: size,
      data: qrData,
      backgroundOptions: { color: bgColor },
      dotsOptions: buildDotsOptions(patternStyle, fgColor),
      cornersSquareOptions: buildCornersSquareOptions(patternStyle, fgColor),
      cornersDotOptions: { color: fgColor, type: "dots" },
      image: finalLogoImage,
      imageOptions: {
        crossOrigin: "anonymous",
        margin: logoMargin,
        imageSize: logoSize,
        hideBackgroundDots: !!finalLogoImage,
      },
      margin: 0,
    };

    const QRStylingAny: any = QRCodeStyling;

    if (!qrPreviewInstanceRef.current) {
      qrPreviewInstanceRef.current = new QRStylingAny(options);
    } else {
      qrPreviewInstanceRef.current.update(options);
    }
    if (qrWrapperPreviewRef.current) {
      qrWrapperPreviewRef.current.innerHTML = "";
      qrPreviewInstanceRef.current.append(qrWrapperPreviewRef.current);
    }

    if (!qrExportInstanceRef.current) {
      qrExportInstanceRef.current = new QRStylingAny(options);
    } else {
      qrExportInstanceRef.current.update(options);
    }
    if (qrWrapperExportRef.current) {
      qrWrapperExportRef.current.innerHTML = "";
      qrExportInstanceRef.current.append(qrWrapperExportRef.current);
    }
  }, [
    wizardStep,
    size,
    fgColor,
    bgColor,
    patternStyle,
    qrData,
    logoPreset,
    uploadedLogoDataUrl,
  ]);

  const handleDownload = async () => {
    const saved = await saveQRCodeToFirestore();
    if (!saved) return;

    // Update editingId if this was a new QR code
    if (!editingId && saved.id) {
      setEditingId(saved.id);
    }

    const safeName = (qrTitle || `${selectedType}-qr`).replace(/\s+/g, "-");

    if (frameStyle === "none") {
      if (!qrExportInstanceRef.current) return;
      qrExportInstanceRef.current.download({
        name: safeName,
        extension: downloadFormat,
      });
      resetWizard();
      return;
    }

    if (!frameExportRef.current) return;

    try {
      if (downloadFormat === "png") {
        const dataUrl = await toPng(frameExportRef.current, {
          cacheBust: true,
          pixelRatio: 1,
          backgroundColor: "#ffffff",
        });
        downloadDataUrl(dataUrl, `${safeName}.png`);
      } else {
        const svgString = await toSvg(frameExportRef.current, {
          cacheBust: true,
          backgroundColor: "#ffffff",
        });
        downloadSvgString(svgString, `${safeName}.svg`);
      }

      resetWizard();
    } catch (e) {
      console.error(e);
      alert("Download failed. Please try again.");
    }
  };

  // ---------- LIST DERIVED DATA ----------
  const filteredCodes = codes.filter(
    (code) =>
      (code.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (code.type || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (code.content || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCodes = [...filteredCodes].sort((a, b) => {
    if (sortField === "createdAt") {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    }
    if (sortField === "scans") {
      return sortDirection === "asc" ? a.scans - b.scans : b.scans - a.scans;
    }
    const aVal = ((a as any)[sortField] || "") as string;
    const bVal = ((b as any)[sortField] || "") as string;
    return sortDirection === "asc"
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  });

  const paginatedCodes = sortedCodes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedCodes.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderStepNav = () => (
    <div className="flex items-center justify-center gap-6 py-3 border-b bg-white rounded-t-xl">
      {[
        { step: 1, label: "Select QR Code type" },
        { step: 2, label: "Customize QR Code" },
        { step: 3, label: "Download QR Code" },
      ].map(({ step, label }, index) => {
        const isActive = wizardStep === step;
        const isCompleted = wizardStep > step;

        return (
          <div key={index} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${
                isActive
                  ? "bg-emerald-500 text-white"
                  : isCompleted
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {step}
            </div>
            <span
              className={`text-sm ${
                isActive ? "font-semibold text-gray-900" : "text-gray-600"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
      {editingId && (
        <span className="ml-4 px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
          Editing existing QR
        </span>
      )}
    </div>
  );

  // ---------- STEP 1 ----------
  const renderStep1 = () => {
    const typeOptions = [
      { key: "URL", label: "URL" },
      { key: "Plain Text", label: "Plain Text" },
      { key: "Email", label: "Email" },
      { key: "SMS", label: "SMS" },
      { key: "Location", label: "Location" },
      { key: "Contact", label: "Contact" },
      { key: "Socials", label: "Socials" },
      { key: "App", label: "App" },
      { key: "PDF", label: "PDF" },
      { key: "File", label: "File" },
      { key: "Multi-URL", label: "Multi-URL" },
    ];

    const step1Max = 220;
    const step1Scale = Math.min(1, step1Max / (size || 256));

    return (
      <div className="flex gap-6 p-6">
        <div className="flex-1 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {typeOptions.map(({ key, label }) => {
              const isActive = selectedType === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedType(key)}
                  className={`flex flex-col items-center justify-center w-24 h-16 rounded-lg border text-xs gap-1 transition ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="font-semibold">{label}</span>
                </button>
              );
            })}
          </div>

          {/* URL */}
          {selectedType === "URL" && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  Redirect to an existing web URL
                </p>
                <label className="block text-xs text-gray-500 mb-1">
                  Enter URL
                </label>
                <input
                  type="text"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 flex gap-1">
                      <MdCampaign />
                      Campaign URL Tracking
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Add UTM parameters to track this QR code in analytics
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={campaignEnabled}
                      onChange={(e) => setCampaignEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {campaignEnabled && (
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Campaign Source (utm_source)
                      </label>
                      <input
                        type="text"
                        value={campaignSource}
                        onChange={(e) => setCampaignSource(e.target.value)}
                        placeholder="e.g., newsletter, facebook, poster"
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Where the traffic comes from
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Campaign Medium (utm_medium)
                      </label>
                      <input
                        type="text"
                        value={campaignMedium}
                        onChange={(e) => setCampaignMedium(e.target.value)}
                        placeholder="e.g., qr_code, email, social"
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The marketing medium
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Campaign Name (utm_campaign)
                      </label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="e.g., summer_sale, product_launch"
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The specific campaign name
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plain Text */}
          {selectedType === "Plain Text" && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">
                Show a plain text message when scanned
              </p>
              <label className="block text-xs text-gray-500 mb-1">
                Enter text
              </label>
              <textarea
                value={plainTextValue}
                onChange={(e) => setPlainTextValue(e.target.value)}
                rows={4}
                placeholder="Thank you for visiting our store!"
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
          )}

          {/* Email */}
          {selectedType === "Email" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Create an email QR (mailto link)
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="hello@yourbrand.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Feedback from QR code"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Body (optional)
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={3}
                  placeholder="Hi, I scanned your QR code and..."
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* SMS */}
          {selectedType === "SMS" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Send SMS when user scans
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Phone number
                </label>
                <input
                  type="tel"
                  value={smsNumber}
                  onChange={(e) => setSmsNumber(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Message (optional)
                </label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={3}
                  placeholder="Hi, I am interested in your services."
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Location */}
          {selectedType === "Location" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Open a map location when scanned
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Latitude (optional)
                  </label>
                  <input
                    type="text"
                    value={locationLat}
                    onChange={(e) => setLocationLat(e.target.value)}
                    placeholder="28.6139"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Longitude (optional)
                  </label>
                  <input
                    type="text"
                    value={locationLng}
                    onChange={(e) => setLocationLng(e.target.value)}
                    placeholder="77.2090"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Address / Place name (optional but recommended)
                </label>
                <input
                  type="text"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder="Your store address or landmark"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* Contact */}
          {selectedType === "Contact" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Save contact to phone
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="email@yourbrand.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* ✅ Socials (NEW UI) */}
          {selectedType === "Socials" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Bundle your social profiles
              </p>
              {renderSocialsInput()}
              <p className="text-[11px] text-gray-400">
                When scanned, this QR will contain your saved social URLs
                (JSON).
              </p>
            </div>
          )}

          {/* App */}
          {selectedType === "App" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Link to your app
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Universal / Deep link (optional)
                </label>
                <input
                  type="text"
                  value={appUniversalLink}
                  onChange={(e) => setAppUniversalLink(e.target.value)}
                  placeholder="myapp://open"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    iOS App Store URL
                  </label>
                  <input
                    type="text"
                    value={appIosUrl}
                    onChange={(e) => setAppIosUrl(e.target.value)}
                    placeholder="https://apps.apple.com/..."
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Android Play Store URL
                  </label>
                  <input
                    type="text"
                    value={appAndroidUrl}
                    onChange={(e) => setAppAndroidUrl(e.target.value)}
                    placeholder="https://play.google.com/..."
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PDF */}
          {selectedType === "PDF" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Open a PDF file when scanned
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  PDF URL
                </label>
                <input
                  type="text"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="https://yourcdn.com/file.pdf"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Or upload PDF
                </label>
                <label className="w-[200px] bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-emerald-700 inline-block text-center">
                  Choose PDF File
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      handlePdfUpload(e.target.files?.[0] || null)
                    }
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* File */}
          {selectedType === "File" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Link to any file
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  File URL
                </label>
                <input
                  type="text"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://yourcdn.com/file.ext"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Or upload file
                </label>
                <label className="w-[200px] bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-emerald-700 inline-block text-center">
                  Choose File
                  <input
                    type="file"
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0] || null)
                    }
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Multi-URL */}
          {selectedType === "Multi-URL" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Multiple links with titles
              </p>

              <div>
                <label className="text-xs text-gray-500">Page Title</label>
                <input
                  type="text"
                  value={multiUrlTitle}
                  onChange={(e) => setMultiUrlTitle(e.target.value)}
                  placeholder="Your title here"
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500">
                  Links ({multiUrls.filter((u) => u.url.trim()).length})
                </label>
                {multiUrls.map((item, index) => {
                  if (!item.url.trim()) return null;
                  return (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded-lg flex items-start justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.title || "Untitled"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {item.url}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const copy = multiUrls.filter((_, i) => i !== index);
                          setMultiUrls(
                            copy.length ? copy : [{ url: "", title: "" }]
                          );
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
                type="button"
                onClick={() => setShowAddUrlModal(true)}
                className="w-full py-2 px-4 text-sm text-green-600 hover:text-green-700 font-medium flex items-center justify-center gap-2 border border-dashed border-green-600 rounded-lg hover:bg-green-50"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Link
              </button>
            </div>
          )}

          {/* Static / Dynamic toggle */}
          <div className="mt-6 flex items-center gap-6 border-t pt-4">
            <button
              type="button"
              onClick={() => setMode("static")}
              className={`px-4 py-1.5 rounded-full text-sm border ${
                mode === "static"
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              Static
            </button>
            <button
              type="button"
              onClick={() => setMode("dynamic")}
              className={`px-4 py-1.5 rounded-full text-sm border flex items-center gap-1 ${
                mode === "dynamic"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              Dynamic
            </button>
          </div>
        </div>

        {/* Right: simple SVG preview + next */}
        <div className="w-80 bg-gray-50 rounded-lg flex flex-col items-center justify-between py-6 px-4">
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <div
              style={{
                width: (size || 256) * step1Scale,
                height: (size || 256) * step1Scale,
              }}
            >
              <div
                style={{
                  transform: `scale(${step1Scale})`,
                  transformOrigin: "top left",
                  width: size,
                  height: size,
                }}
              >
                <QRCodeSVG
                  value={getContentForType() || "https://example.com"}
                  size={size}
                  fgColor={fgColor}
                  bgColor={bgColor}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextStep}
            disabled={!canGoNextFromStep1()}
            className="w-full bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // ---------- STEP 2 ----------
  const renderStep2 = () => {
    const frameOptions: { key: FrameStyle; label: string }[] = [
      { key: "none", label: "None" },
      { key: "soft-card", label: "Soft card" },
      { key: "dark-badge", label: "Dark badge" },
      { key: "outline-tag", label: "Outline tag" },
    ];

    const patternOptions: { key: PatternStyle; label: string }[] = [
      { key: "classic", label: "Classic" },
      { key: "rounded", label: "Rounded" },
      { key: "thin", label: "Thin" },
      { key: "smooth", label: "Smooth" },
      { key: "circles", label: "Circles" },
    ];

    const frameClass =
      frameStyle === "soft-card"
        ? "p-4 bg-white rounded-3xl shadow-sm border border-gray-100"
        : frameStyle === "dark-badge"
        ? "p-5 bg-slate-900 rounded-3xl shadow-md"
        : frameStyle === "outline-tag"
        ? "p-4 bg-white rounded-3xl border-2 border-emerald-500"
        : "p-0 bg-transparent";

    const showFooter =
      frameStyle === "dark-badge" || frameStyle === "outline-tag";

    const showWatermark =
      !!watermarkSettings?.enabled && watermarkEnabled && !!watermarkSettings;

    return (
      <div className="flex gap-6 p-6">
        {/* Left */}
        <div className="flex-1 space-y-6">
          {/* COLORS */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">
              Design options
            </h3>
            <div className="grid grid-cols-3 gap-4 max-w-md">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Background
                </label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-full h-9 cursor-pointer rounded border border-gray-200"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Squares
                </label>
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="w-full h-9 cursor-pointer rounded border border-gray-200"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Size (px)
                </label>
                <input
                  type="number"
                  min={128}
                  max={768}
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value) || 256)}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          </section>

          {/* LOGO */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-700">
              Logo{" "}
              <span className="text-[10px] text-gray-400">
                (PNG / SVG upload)
              </span>
            </h4>

            <div className="flex gap-3 flex-wrap items-center">
              <label className="flex flex-col items-center justify-center w-20 h-16 rounded-lg border border-dashed border-gray-300 text-[11px] text-gray-700 bg-gray-50 cursor-pointer hover:bg-gray-100">
                <span className="text-lg mb-1">⬆️</span>
                <span>Upload</span>
                <input
                  type="file"
                  accept=".png,.svg,image/png,image/svg+xml"
                  className="hidden"
                  onChange={(e) =>
                    handleLogoUpload(e.target.files?.[0] || null)
                  }
                />
              </label>

              {uploadedLogoDataUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedLogoDataUrl(null);
                    setUploadedLogoName("");
                  }}
                  className="text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
                  title={uploadedLogoName}
                >
                  Remove
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setLogoPreset(null);
                  setUploadedLogoDataUrl(null);
                  setUploadedLogoName("");
                }}
                className={`flex flex-col items-center justify-center w-20 h-16 rounded-lg border text-[11px] ${
                  logoPreset === null && !uploadedLogoDataUrl
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                <span className="text-lg mb-1">🚫</span>
                <span>No logo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLogoPreset("scan-me");
                  setUploadedLogoDataUrl(null);
                  setUploadedLogoName("");
                }}
                className={`flex flex-col items-center justify-center w-20 h-16 rounded-lg border text-[11px] ${
                  logoPreset === "scan-me"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                <span className="text-xs font-bold border border-gray-300 px-1.5 py-0.5 rounded-full">
                  SCAN
                </span>
                <span className="text-xs font-bold mt-0.5">ME</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLogoPreset("camera");
                  setUploadedLogoDataUrl(null);
                  setUploadedLogoName("");
                }}
                className={`flex flex-col items-center justify-center w-20 h-16 rounded-lg border text-[11px] ${
                  logoPreset === "camera"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                <span className="text-lg mb-1">📷</span>
                <span>Camera</span>
              </button>
            </div>

            {uploadedLogoDataUrl && (
              <p className="text-[11px] text-gray-500">
                Uploaded:{" "}
                <span className="font-medium">{uploadedLogoName}</span>
              </p>
            )}
          </section>

          {/* FRAMES */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-700">
              Frames ✨{" "}
              <span className="text-[10px] text-emerald-500">NEW</span>
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {frameOptions.map((opt) => {
                const isActive = frameStyle === opt.key;
                const base =
                  "w-16 h-16 rounded-xl border flex items-center justify-center bg-white";

                let innerBox = "w-10 h-10 bg-black rounded-lg";
                if (opt.key === "soft-card") {
                  innerBox =
                    "w-10 h-10 bg-black rounded-2xl shadow-[0_0_0_3px_rgba(255,255,255,1)]";
                } else if (opt.key === "dark-badge") {
                  innerBox =
                    "w-10 h-10 bg-black rounded-[22px] shadow-[0_0_0_4px_rgba(15,23,42,1)]";
                } else if (opt.key === "outline-tag") {
                  innerBox =
                    "w-10 h-10 bg-black rounded-xl shadow-[0_0_0_3px_rgba(16,185,129,1)]";
                }

                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFrameStyle(opt.key)}
                    className={`flex flex-col items-center text-[11px] ${
                      isActive ? "text-emerald-700" : "text-gray-600"
                    }`}
                  >
                    <div
                      className={`${
                        isActive
                          ? "border-emerald-500 ring-2 ring-emerald-200"
                          : "border-gray-200"
                      } ${base}`}
                    >
                      <div className={innerBox} />
                    </div>
                    <span className="mt-1">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* PATTERN */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-700">
              Pattern & Shape
            </h4>
            <div className="flex gap-3 flex-wrap">
              {patternOptions.map((opt) => {
                const isActive = patternStyle === opt.key;

                const dotClass =
                  opt.key === "circles"
                    ? "rounded-full"
                    : opt.key === "rounded" || opt.key === "smooth"
                    ? "rounded-[4px]"
                    : opt.key === "thin"
                    ? "rounded-[6px] scale-90"
                    : "rounded-none";

                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPatternStyle(opt.key)}
                    className={`flex flex-col items-center text-[11px] ${
                      isActive ? "text-emerald-700" : "text-gray-600"
                    }`}
                  >
                    <div
                      className={`w-16 h-16 rounded-xl border bg-white flex items-center justify-center ${
                        isActive
                          ? "border-emerald-500 ring-2 ring-emerald-200"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="grid grid-cols-3 grid-rows-3 gap-[2px]">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 bg-black ${dotClass}`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="mt-1">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* TOGGLES */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-700">
              Premium option
            </h4>

            <div className="flex flex-col justify-between gap-5">
              <div className="flex items-center justify-between w-[440px] p-4 bg-gray-50 rounded-lg border">
                <div>
                  <p className="text-sm font-semibold text-gray-800 flex gap-1">
                    <MdOutlineBrandingWatermark />
                    Watermark
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Turn off to remove watermark from preview + downloaded file.
                  </p>
                  {watermarkSettings?.enabled === false && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Admin has disabled watermark globally.
                    </p>
                  )}
                </div>

                <label
                  className={`relative inline-flex items-center ${
                    watermarkSettings?.enabled === false
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={watermarkEnabled}
                    onChange={(e) => setWatermarkEnabled(e.target.checked)}
                    disabled={watermarkSettings?.enabled === false}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between w-[440px] p-4 bg-gray-50 rounded-lg border">
                <div>
                  <p className="text-sm font-semibold flex gap-1 text-gray-800">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Track scans
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    When OFF, scan counts + analytics button will be disabled
                    for this QR.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanTrackingEnabled}
                    onChange={(e) => setScanTrackingEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Right: preview */}
        <div className="w-80 bg-gray-50 rounded-lg flex flex-col items-center justify-between py-6 px-4">
          <div
            ref={framePreviewRef}
            className={`mb-4 w-full flex flex-col items-center ${frameClass}`}
          >
            <div
              className="relative"
              style={{
                width: (size || 256) * previewScale,
                height: (size || 256) * previewScale,
              }}
            >
              <div
                className="relative"
                style={{
                  width: size,
                  height: size,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  className="bg-white rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{ width: size, height: size }}
                >
                  <div ref={qrWrapperPreviewRef} />
                </div>

                {showWatermark && (
                  <div
                    className={`absolute ${
                      watermarkSettings!.position === "bottom-right"
                        ? "bottom-2 right-2"
                        : watermarkSettings!.position === "bottom-left"
                        ? "bottom-2 left-2"
                        : "bottom-2 left-1/2 -translate-x-1/2"
                    } ${
                      watermarkSettings!.size === "small"
                        ? "text-[8px] px-1.5 py-0.5"
                        : watermarkSettings!.size === "large"
                        ? "text-xs px-2.5 py-1.5"
                        : "text-[10px] px-2 py-1"
                    } bg-white rounded flex items-center gap-1 shadow-sm z-10`}
                    style={{ opacity: watermarkSettings!.opacity }}
                  >
                    {watermarkSettings!.logoUrl && (
                      <img
                        src={watermarkSettings!.logoUrl}
                        alt="watermark"
                        className="h-3 w-auto object-contain"
                        crossOrigin="anonymous"
                      />
                    )}
                    {watermarkSettings!.text && (
                      <span className="text-gray-700 font-medium whitespace-nowrap">
                        {watermarkSettings!.text}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showFooter && (
              <div
                className={`mt-3 text-[10px] tracking-[0.16em] uppercase text-center ${
                  frameStyle === "dark-badge"
                    ? "text-gray-300"
                    : "text-gray-400"
                }`}
              >
                POWERED BY YOUR BRAND
              </div>
            )}
          </div>

          {/* Hidden export DOM */}
          <div className="fixed -left-[99999px] top-0 opacity-0 pointer-events-none">
            <div
              ref={frameExportRef}
              className={`w-fit flex flex-col items-center ${frameClass}`}
            >
              <div className="relative">
                <div
                  className="bg-white rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{ width: size, height: size }}
                >
                  <div ref={qrWrapperExportRef} />
                </div>

                {showWatermark && (
                  <div
                    className={`absolute ${
                      watermarkSettings!.position === "bottom-right"
                        ? "bottom-2 right-2"
                        : watermarkSettings!.position === "bottom-left"
                        ? "bottom-2 left-2"
                        : "bottom-2 left-1/2 -translate-x-1/2"
                    } ${
                      watermarkSettings!.size === "small"
                        ? "text-[8px] px-1.5 py-0.5"
                        : watermarkSettings!.size === "large"
                        ? "text-xs px-2.5 py-1.5"
                        : "text-[10px] px-2 py-1"
                    } bg-white rounded flex items-center gap-1 shadow-sm z-10`}
                    style={{ opacity: watermarkSettings!.opacity, maxWidth: '20%', maxHeight: '10%' }}
                  >
                    {watermarkSettings!.logoUrl && (
                      <img
                        src={watermarkSettings!.logoUrl}
                        alt="watermark"
                        className="h-2 w-auto object-contain"
                        style={{ maxWidth: '24px', maxHeight: '24px' }}
                        crossOrigin="anonymous"
                      />
                    )}
                    {watermarkSettings!.text && (
                      <span className="text-gray-700 font-medium whitespace-nowrap">
                        {watermarkSettings!.text}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {showFooter && (
                <div
                  className={`mt-3 text-[10px] tracking-[0.16em] uppercase text-center ${
                    frameStyle === "dark-badge"
                      ? "text-gray-300"
                      : "text-gray-400"
                  }`}
                >
                  POWERED BY YOUR BRAND
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full gap-2 mt-2">
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 border border-gray-300 text-sm py-2 rounded-lg bg-white hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="flex-1 bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---------- STEP 3 ----------
  const renderStep3 = () => {
    const frameClass =
      frameStyle === "soft-card"
        ? "p-4 bg-white rounded-3xl shadow-sm border border-gray-100"
        : frameStyle === "dark-badge"
        ? "p-5 bg-slate-900 rounded-3xl shadow-md"
        : frameStyle === "outline-tag"
        ? "p-4 bg-white rounded-3xl border-2 border-emerald-500"
        : "p-0 bg-transparent";

    const showFooter =
      frameStyle === "dark-badge" || frameStyle === "outline-tag";

    const showWatermark =
      !!watermarkSettings?.enabled && watermarkEnabled && !!watermarkSettings;

    return (
      <div className="flex gap-6 p-6">
        <div className="flex-1 space-y-4 max-w-xl">
          <h3 className="text-sm font-semibold text-gray-800">
            Name your QR Code and download it
          </h3>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Title</label>
            <input
              type="text"
              value={qrTitle}
              onChange={(e) => setQrTitle(e.target.value)}
              placeholder={`${selectedType} QR Code`}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Image format
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={downloadFormat}
                onChange={(e) =>
                  setDownloadFormat(e.target.value as "png" | "svg")
                }
              >
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Image size
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              >
                <option value={256}>256 px</option>
                <option value={512}>512 px</option>
                <option value={768}>768 px</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Click <strong>Download</strong> — it will{" "}
            <strong>{editingId ? "update" : "save"}</strong> the QR Code in your
            account and download the file.
          </p>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold"
            >
              Download
            </button>
          </div>
        </div>

        <div className="w-80 bg-gray-50 rounded-lg flex flex-col items-center justify-center py-6 px-4">
          <div className={`w-full flex flex-col items-center ${frameClass}`}>
            <div
              className="relative"
              style={{
                width: (size || 256) * previewScale,
                height: (size || 256) * previewScale,
              }}
            >
              <div
                className="relative"
                style={{
                  width: size,
                  height: size,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  className="bg-white rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{ width: size, height: size }}
                >
                  <div ref={qrWrapperPreviewRef} />
                </div>

                {showWatermark && (
                  <div
                    className={`absolute ${
                      watermarkSettings!.position === "bottom-right"
                        ? "bottom-2 right-2"
                        : watermarkSettings!.position === "bottom-left"
                        ? "bottom-2 left-2"
                        : "bottom-2 left-1/2 -translate-x-1/2"
                    } ${
                      watermarkSettings!.size === "small"
                        ? "text-[8px] px-1.5 py-0.5"
                        : watermarkSettings!.size === "large"
                        ? "text-xs px-2.5 py-1.5"
                        : "text-[10px] px-2 py-1"
                    } bg-white rounded flex items-center gap-1 shadow-sm z-10`}
                    style={{ opacity: watermarkSettings!.opacity }}
                  >
                    {watermarkSettings!.logoUrl && (
                      <img
                        src={watermarkSettings!.logoUrl}
                        alt="watermark"
                        className="h-3 w-auto object-contain"
                        crossOrigin="anonymous"
                      />
                    )}
                    {watermarkSettings!.text && (
                      <span className="text-gray-700 font-medium whitespace-nowrap">
                        {watermarkSettings!.text}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showFooter && (
              <div
                className={`mt-3 text-[10px] tracking-[0.16em] uppercase text-center ${
                  frameStyle === "dark-badge"
                    ? "text-gray-300"
                    : "text-gray-400"
                }`}
              >
                POWERED BY YOUR BRAND
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderWizard = () => (
    <div className="bg-white rounded-xl shadow-sm border mb-8">
      {renderStepNav()}
      {wizardStep === 1 && renderStep1()}
      {wizardStep === 2 && renderStep2()}
      {wizardStep === 3 && renderStep3()}
    </div>
  );

  // ---------- MAIN RENDER ----------
  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Active QR Codes - Dashboard</title>
        </Head>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">
              Active QR Codes
            </h2>
            <button
              onClick={() => {
                resetWizard();
                setWizardStep(1);
              }}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-semibold"
            >
              + Create QR Code
            </button>
          </div>

          {renderWizard()}

          {/* SEARCH BAR */}
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search QR codes..."
                className="w-full px-4 py-2 pl-10 border rounded-lg text-sm"
              />
              <svg
                className="w-5 h-5 absolute left-3 top-2.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* LIST */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : codes.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Title", "Type", "Content", "Created", "Scans"].map(
                          (label, index) => {
                            const field =
                              label.toLowerCase() === "created"
                                ? ("createdAt" as SortField)
                                : (label.toLowerCase() as SortField);

                            return (
                              <th
                                key={index}
                                onClick={() =>
                                  ["Content"].includes(label)
                                    ? undefined
                                    : handleSort(field)
                                }
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              >
                                <div className="flex items-center gap-1">
                                  {label}
                                  {sortField === field &&
                                    label !== "Content" && (
                                      <svg
                                        className={`w-3 h-3 transform ${
                                          sortDirection === "desc"
                                            ? "rotate-180"
                                            : ""
                                        }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 15l7-7 7 7"
                                        />
                                      </svg>
                                    )}
                                </div>
                              </th>
                            );
                          }
                        )}
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">
                      {paginatedCodes.map((code) => {
                        const isScanOn = code.trackScans !== false;
                        return (
                          <tr key={code.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <div className="relative group">
                                <span
                                  className="truncate block max-w-[200px]"
                                  title={code.title}
                                >
                                  {truncateTitle(code.title || "Untitled")}
                                </span>
                                {code.title && code.title.length > 30 && (
                                  <div className="absolute left-0 -bottom-1 translate-y-full hidden group-hover:block z-50 w-auto p-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap">
                                    {code.title}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <span>{code.type}</span>
                                {code.campaign?.enabled && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                                    title="Campaign tracking enabled"
                                  >
                                    📊 UTM
                                  </span>
                                )}
                                {!isScanOn && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                                    title="Scan tracking is disabled"
                                  >
                                    📈 OFF
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                              <div className="truncate" title={code.content}>
                                {truncateContent(code.content)}
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(code.createdAt).toLocaleDateString()}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-700">
                              {isScanOn ? code.scans : "—"}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => setSelectedViewQR(code)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                >
                                  <EyeIcon className="w-4 h-4" />
                                  <span>View</span>
                                </button>

                                <button
                                  onClick={() => handleEditClick(code)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  onClick={() => handlePause(code)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                                >
                                  <PauseIcon className="w-4 h-4" />
                                  <span>Pause</span>
                                </button>

                                <button
                                  onClick={() => {
                                    if (!isScanOn) return;
                                    router.push(
                                      `/dashboard/qr-analytics/${code.id}`
                                    );
                                  }}
                                  disabled={!isScanOn}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                                    isScanOn
                                      ? "text-purple-600 bg-purple-50 hover:bg-purple-100"
                                      : "text-gray-400 bg-gray-100 cursor-not-allowed"
                                  }`}
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                    />
                                  </svg>
                                  <span>Analytics</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4 pb-6">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-lg bg-gray-100 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded-lg text-sm ${
                            currentPage === page
                              ? "bg-emerald-600 text-white"
                              : "bg-gray-100"
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-lg bg-gray-100 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl">
                <p className="text-gray-500">No active QR codes found.</p>
                <button
                  onClick={() => {
                    resetWizard();
                    setWizardStep(1);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 mt-2 inline-block text-sm font-semibold"
                >
                  Create your first QR code
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MODALS */}
        {showEditModal && selectedQR && (
          <EditQRModal
            qrCode={selectedQR}
            onClose={() => {
              setShowEditModal(false);
              setSelectedQR(null);
            }}
            onUpdate={handleUpdateQR}
          />
        )}

        {selectedViewQR && (
          <ViewQRModal
            qrCode={selectedViewQR}
            onClose={() => setSelectedViewQR(null)}
            isPremium={isPremium}
          />
        )}

        {selectedAnalyticsQR && (
          <ScanAnalyticsModal
            qrCode={selectedAnalyticsQR}
            onClose={() => setSelectedAnalyticsQR(null)}
          />
        )}

        {/* Add URL Modal for Multi-URL */}
        {showAddUrlModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Add New Link
                </h3>
                <button
                  onClick={() => setShowAddUrlModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <AddUrlModalContent />
            </div>
          </div>
        )}
      </DashboardLayout>
    </AuthGuard>
  );

  function AddUrlModalContent() {
    const [newUrl, setNewUrl] = useState("");
    const [newUrlTitle, setNewUrlTitle] = useState("");

    const handleAddUrl = () => {
      if (newUrl.trim()) {
        setMultiUrls([
          ...multiUrls.filter((u) => u.url.trim()),
          { url: newUrl, title: newUrlTitle || newUrl },
        ]);
        setNewUrl("");
        setNewUrlTitle("");
        setShowAddUrlModal(false);
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Link Title
          </label>
          <input
            type="text"
            value={newUrlTitle}
            onChange={(e) => setNewUrlTitle(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g., My Website"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL
          </label>
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
    );
  }
}
