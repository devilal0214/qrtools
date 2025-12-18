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

import { EyeIcon, PencilIcon, PauseIcon } from "@heroicons/react/24/outline";
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
  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: string;
    logoImage?: string | null; // dataURL
    logoPreset?: string | null;
    patternStyle?: PatternStyle;
    frameStyle?: FrameStyle;
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

export default function ActiveCodes() {
  const router = useRouter();
  const { user } = useAuth();
  const { canUseFeature } = usePlanFeatures();

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

  // Socials
  const [socialMainUrl, setSocialMainUrl] = useState<string>("");
  const [socialInstagram, setSocialInstagram] = useState<string>("");
  const [socialFacebook, setSocialFacebook] = useState<string>("");
  const [socialX, setSocialX] = useState<string>("");
  const [socialLinkedIn, setSocialLinkedIn] = useState<string>("");

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
  const [multiUrls, setMultiUrls] = useState<Array<{url: string, title: string}>>([{url: "", title: ""}]);
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

  // for styled preview + download
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);
  const qrCodeInstanceRef = useRef<any>(null);

  // ✅ Frame container ref (THIS is what we export for download)
  const frameExportRef = useRef<HTMLDivElement | null>(null);

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;

    const isPng =
      file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const isSvg =
      file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

    if (!isPng && !isSvg) {
      alert("Please upload only PNG or SVG.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setUploadedLogoDataUrl(dataUrl);
      setUploadedLogoName(file.name);

      // If upload logo, remove presets
      setLogoPreset(null);
    } catch (e) {
      console.error(e);
      alert("Logo upload failed. Try another file.");
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

  // ---------- LIST HANDLERS ----------
  const handleEditClick = (qrCode: QRCode) => {
    setSelectedQR(qrCode);
    setShowEditModal(true);
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
      case "Socials":
        return (
          socialMainUrl.trim().length > 0 ||
          socialInstagram.trim().length > 0 ||
          socialFacebook.trim().length > 0 ||
          socialX.trim().length > 0 ||
          socialLinkedIn.trim().length > 0
        );
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
        return multiUrls.some(u => u.url.trim().length > 0);
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

    if (selectedType === "Socials") {
      const lines: string[] = [];
      if (socialMainUrl.trim()) lines.push(`Main: ${socialMainUrl.trim()}`);
      if (socialInstagram.trim())
        lines.push(`Instagram: ${socialInstagram.trim()}`);
      if (socialFacebook.trim())
        lines.push(`Facebook: ${socialFacebook.trim()}`);
      if (socialX.trim()) lines.push(`X (Twitter): ${socialX.trim()}`);
      if (socialLinkedIn.trim())
        lines.push(`LinkedIn: ${socialLinkedIn.trim()}`);
      return lines.join("\n");
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
        urls: multiUrls.filter(item => item.url.trim())
      };
      return JSON.stringify(multiUrlData);
    }

    return "";
  };

  const resetWizard = () => {
    setWizardStep(1);
    setSelectedType("URL");
    setQrTitle("");

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
    setSocialMainUrl("");
    setSocialInstagram("");
    setSocialFacebook("");
    setSocialX("");
    setSocialLinkedIn("");
    setAppUniversalLink("");
    setAppIosUrl("");
    setAppAndroidUrl("");
    setAppWebUrl("");
    setPdfUrl("");
    setFileUrl("");
    setMultiUrls([{url: "", title: ""}]);
    setMultiUrlTitle("My Links");

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
  };

  // ✅ Save function (NO auto-reset here)
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

      // Prepare campaign data if enabled for URL type
      const campaignData = (selectedType === "URL" && campaignEnabled) ? {
        enabled: true,
        utmSource: campaignSource,
        utmMedium: campaignMedium,
        utmCampaign: campaignName
      } : undefined;

      const newDoc = await addDoc(collection(db, "qrcodes"), {
        userId: user.uid,
        title: qrTitle || `${selectedType} QR Code`,
        type: selectedType,
        content,
        createdAt: now,
        updatedAt: now,
        scans: 0,
        isActive: true,
        mode,
        settings: {
          size,
          fgColor,
          bgColor,
          shape: patternStyle,
          logoPreset,
          logoImage: uploadedLogoDataUrl || null,
          frameStyle,
          patternStyle,
        },
        ...(campaignData && { campaign: campaignData }),
      });

      const newQRCode: QRCode = {
        id: newDoc.id,
        title: qrTitle || `${selectedType} QR Code`,
        type: selectedType,
        content,
        createdAt: now,
        scans: 0,
        isActive: true,
        mode,
        settings: {
          size,
          fgColor,
          bgColor,
          shape: patternStyle,
          logoPreset,
          logoImage: uploadedLogoDataUrl || null,
          frameStyle,
          patternStyle,
        },
      };

      setCodes((prev) => [newQRCode, ...prev]);
      return newQRCode;
    } catch (error) {
      console.error("Error creating QR code:", error);
      alert("Could not create QR code. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ---------- QR-CODE-STYLING PREVIEW ----------
  const qrData = getContentForType() || "https://example.com";

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
    if (!qrWrapperRef.current) return;

    const presetImage = getLogoPresetDataUrl(logoPreset, fgColor);
    const finalLogoImage = uploadedLogoDataUrl || presetImage;

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
        margin: finalLogoImage ? 6 : 0,
        imageSize: finalLogoImage ? 0.28 : 0,
        hideBackgroundDots: !!finalLogoImage,
      },

      margin: 0,
    };

    const QRStylingAny: any = QRCodeStyling;

    if (!qrCodeInstanceRef.current) {
      qrCodeInstanceRef.current = new QRStylingAny(options);
    } else {
      qrCodeInstanceRef.current.update(options);
    }

    qrWrapperRef.current.innerHTML = "";
    qrCodeInstanceRef.current.append(qrWrapperRef.current);
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

  // ✅ Download = Auto Save + Download (WITH FRAME INCLUDED)
  const handleDownload = async () => {
    const saved = await saveQRCodeToFirestore();
    if (!saved) return;

    const name = qrTitle || `${selectedType}-qr`;

    // If no frame selected, keep original qr-code-styling download
    if (frameStyle === "none") {
      if (!qrCodeInstanceRef.current) return;
      qrCodeInstanceRef.current.download({
        name,
        extension: downloadFormat,
      });
      resetWizard();
      return;
    }

    // ✅ Export full frame container (QR + footer + padding/background)
    if (!frameExportRef.current) return;

    try {
      if (downloadFormat === "png") {
        const dataUrl = await toPng(frameExportRef.current, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });
        downloadDataUrl(dataUrl, `${name}.png`);
      } else {
        const svgString = await toSvg(frameExportRef.current, {
          cacheBust: true,
          backgroundColor: "#ffffff",
        });
        downloadSvgString(svgString, `${name}.svg`);
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
      code.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.content.toLowerCase().includes(searchTerm.toLowerCase())
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
    const aVal = (a[sortField] || "") as string;
    const bVal = (b[sortField] || "") as string;
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

  // ---------- WIZARD UI ----------
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

              {/* Campaign URL Tracking */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      📊 Campaign URL Tracking
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
                      <p className="text-xs text-gray-500 mt-1">Where the traffic comes from</p>
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
                      <p className="text-xs text-gray-500 mt-1">The marketing medium</p>
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
                      <p className="text-xs text-gray-500 mt-1">The specific campaign name</p>
                    </div>

                    {campaignSource && campaignMedium && campaignName && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-xs font-medium text-blue-900 mb-1">Preview URL:</p>
                        <p className="text-xs font-mono text-blue-700 break-all">
                          {urlValue || 'https://example.com'}?utm_source={campaignSource}&utm_medium={campaignMedium}&utm_campaign={campaignName}
                        </p>
                      </div>
                    )}
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
              <p className="text-[11px] text-gray-400">
                Use either precise coordinates, address or both.
              </p>
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Company (optional)
                </label>
                <input
                  type="text"
                  value={contactCompany}
                  onChange={(e) => setContactCompany(e.target.value)}
                  placeholder="Your Brand"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Note (optional)
                </label>
                <textarea
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  rows={2}
                  placeholder="Extra details for this contact"
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Socials */}
          {selectedType === "Socials" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Bundle your social profiles
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Main link (Linktree / website)
                </label>
                <input
                  type="text"
                  value={socialMainUrl}
                  onChange={(e) => setSocialMainUrl(e.target.value)}
                  placeholder="https://yourlinktree.com/username"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Instagram
                  </label>
                  <input
                    type="text"
                    value={socialInstagram}
                    onChange={(e) => setSocialInstagram(e.target.value)}
                    placeholder="https://instagram.com/yourbrand"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Facebook
                  </label>
                  <input
                    type="text"
                    value={socialFacebook}
                    onChange={(e) => setSocialFacebook(e.target.value)}
                    placeholder="https://facebook.com/yourbrand"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    X (Twitter)
                  </label>
                  <input
                    type="text"
                    value={socialX}
                    onChange={(e) => setSocialX(e.target.value)}
                    placeholder="https://x.com/yourbrand"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    LinkedIn
                  </label>
                  <input
                    type="text"
                    value={socialLinkedIn}
                    onChange={(e) => setSocialLinkedIn(e.target.value)}
                    placeholder="https://linkedin.com/company/yourbrand"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Web / landing URL (optional)
                </label>
                <input
                  type="text"
                  value={appWebUrl}
                  onChange={(e) => setAppWebUrl(e.target.value)}
                  placeholder="https://yourapp.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
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
              <p className="text-[11px] text-gray-400">
                Upload your PDF anywhere (Drive, S3, Firebase Storage) and paste
                the public link here.
              </p>
            </div>
          )}

          {/* File */}
          {selectedType === "File" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Link to any file (image, doc, zip, etc.)
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
                type="button"
                onClick={() => setShowAddUrlModal(true)}
                className="w-full py-2 px-4 text-sm text-green-600 hover:text-green-700 font-medium flex items-center justify-center gap-2 border border-dashed border-green-600 rounded-lg hover:bg-green-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Link
              </button>
              
              <p className="text-[11px] text-gray-400">
                When scanned, users will see a landing page with all links.
              </p>
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
            <QRCodeSVG
              value={getContentForType() || "https://example.com"}
              size={size}
              fgColor={fgColor}
              bgColor={bgColor}
            />
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

    return (
      <div className="flex gap-6 p-6">
        {/* Left: design options */}
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

          {/* LOGO PRESETS + UPLOAD */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-700">
              Logo{" "}
              <span className="text-[10px] text-gray-400">
                (PNG / SVG upload)
              </span>
            </h4>

            <div className="flex gap-3 flex-wrap items-center">
              {/* Upload */}
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
        </div>

        {/* Right: styled preview + controls */}
        <div className="w-80 bg-gray-50 rounded-lg flex flex-col items-center justify-between py-6 px-4">
          {/* ✅ The export container */}
          <div
            ref={frameExportRef}
            className={`mb-4 w-full flex flex-col items-center ${frameClass} relative`}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ width: size, height: size }}
            >
              <div ref={qrWrapperRef} />
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

            {/* Watermark */}
            {watermarkSettings?.enabled && !canUseFeature('removeWatermark') && (
              <div 
                className={`absolute ${
                  watermarkSettings.position === 'bottom-right' ? 'bottom-2 right-2' :
                  watermarkSettings.position === 'bottom-left' ? 'bottom-2 left-2' :
                  'bottom-2 left-1/2 -translate-x-1/2'
                } ${
                  watermarkSettings.size === 'small' ? 'text-[8px] px-1.5 py-0.5' :
                  watermarkSettings.size === 'large' ? 'text-xs px-2.5 py-1.5' :
                  'text-[10px] px-2 py-1'
                } bg-white rounded flex items-center gap-1 shadow-sm`}
                style={{ opacity: watermarkSettings.opacity }}
              >
                {watermarkSettings.logoUrl && (
                  <img 
                    src={watermarkSettings.logoUrl} 
                    alt="watermark" 
                    className="h-3 w-auto object-contain"
                  />
                )}
                {watermarkSettings.text && (
                  <span className="text-gray-700 font-medium whitespace-nowrap">
                    {watermarkSettings.text}
                  </span>
                )}
              </div>
            )}
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
            Click <strong>Download</strong> — it will automatically save the QR
            Code in your account and download the file.
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
          {/* ✅ Export container here also (same ref) */}
          <div
            ref={frameExportRef}
            className={`w-full flex flex-col items-center ${frameClass} relative`}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ width: size, height: size }}
            >
              <div ref={qrWrapperRef} />
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

            {/* Watermark */}
            {watermarkSettings?.enabled && !canUseFeature('removeWatermark') && (
              <div 
                className={`absolute ${
                  watermarkSettings.position === 'bottom-right' ? 'bottom-2 right-2' :
                  watermarkSettings.position === 'bottom-left' ? 'bottom-2 left-2' :
                  'bottom-2 left-1/2 -translate-x-1/2'
                } ${
                  watermarkSettings.size === 'small' ? 'text-[8px] px-1.5 py-0.5' :
                  watermarkSettings.size === 'large' ? 'text-xs px-2.5 py-1.5' :
                  'text-[10px] px-2 py-1'
                } bg-white rounded flex items-center gap-1 shadow-sm`}
                style={{ opacity: watermarkSettings.opacity }}
              >
                {watermarkSettings.logoUrl && (
                  <img 
                    src={watermarkSettings.logoUrl} 
                    alt="watermark" 
                    className="h-3 w-auto object-contain"
                  />
                )}
                {watermarkSettings.text && (
                  <span className="text-gray-700 font-medium whitespace-nowrap">
                    {watermarkSettings.text}
                  </span>
                )}
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
          {/* PAGE HEADER */}
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

          {/* WIZARD */}
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
                      {paginatedCodes.map((code) => (
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
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium" title="Campaign tracking enabled">
                                  📊 UTM
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
                            {code.scans}
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
                                onClick={() => router.push(`/dashboard/qr-analytics/${code.id}`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span>Analytics</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
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
                <h3 className="text-lg font-bold text-gray-900">Add New Link</h3>
                <button onClick={() => setShowAddUrlModal(false)} className="text-gray-500 hover:text-gray-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
        setMultiUrls([...multiUrls.filter(u => u.url.trim()), { url: newUrl, title: newUrlTitle || newUrl }]);
        setNewUrl("");
        setNewUrlTitle("");
        setShowAddUrlModal(false);
      }
    };
    
    return (
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
    );
  }
}
