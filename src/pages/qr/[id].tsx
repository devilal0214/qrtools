import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import QRCode from "react-qr-code";
import Head from "next/head";

interface QRDoc {
  type: string;
  content: string;
  isActive?: boolean;
  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: "square" | "rounded" | "dots";
  };
  campaign?: {
    enabled: boolean;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

interface CampaignSettings {
  enabled: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

/**
 * Append campaign UTM parameters to URL
 */
function appendCampaignParams(url: string, campaignSettings: CampaignSettings): string {
  if (!campaignSettings.enabled) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    
    // Add UTM parameters
    if (campaignSettings.utmSource) {
      urlObj.searchParams.set('utm_source', campaignSettings.utmSource);
    }
    if (campaignSettings.utmMedium) {
      urlObj.searchParams.set('utm_medium', campaignSettings.utmMedium);
    }
    if (campaignSettings.utmCampaign) {
      urlObj.searchParams.set('utm_campaign', campaignSettings.utmCampaign);
    }
    
    return urlObj.toString();
  } catch (error) {
    // If URL is invalid, return as-is
    console.error('Invalid URL for campaign tracking:', error);
    return url;
  }
}

export default function QRPage() {
  const router = useRouter();
  const { id } = router.query;

  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = useState<string>("");
  const [qrCode, setQrCode] = useState<QRDoc | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

  useEffect(() => {
    if (!id) return;

    const handleQR = async () => {
      try {
        // Fetch campaign settings
        let campaignSettings: CampaignSettings = {
          enabled: false,
          utmSource: '',
          utmMedium: '',
          utmCampaign: ''
        };

        try {
          const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
          if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            if (data.campaignUrls) {
              campaignSettings = data.campaignUrls;
            }
          }
        } catch (err) {
          console.log('Campaign settings not available:', err);
        }
        
        const ref = doc(db, "qrcodes", id as string);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setStatus("error");
          setMessage("QR code not found.");
          return;
        }

        const data = snap.data() as QRDoc;

        if (data.isActive === false) {
          setStatus("error");
          setMessage("This QR code is inactive.");
          return;
        }

        // Override campaign settings if QR code has its own campaign data
        if (data.campaign && data.campaign.enabled) {
          campaignSettings = {
            enabled: true,
            utmSource: data.campaign.utmSource || '',
            utmMedium: data.campaign.utmMedium || '',
            utmCampaign: data.campaign.utmCampaign || ''
          };
        }

        const type = (data.type || "").toUpperCase();
        const content = data.content || "";

        // ---------- shared redirect helper ----------
        const redirectTo = (url: string) => {
          // Append campaign parameters if enabled
          const finalUrl = appendCampaignParams(url, campaignSettings);
          // Track detailed view (IP, browser, etc) via API using sendBeacon for instant redirect
          
          // Try to get GPS coordinates if available
          const trackWithGPS = async () => {
            let trackPayload: any = { qrId: id };
            
            // Check if GPS tracking is enabled - we'll try to get coordinates
            if (typeof navigator !== "undefined" && "geolocation" in navigator) {
              try {
                // Use Promise with timeout to avoid hanging
                const position = await Promise.race([
                  new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      timeout: 3000,
                      maximumAge: 60000,
                      enableHighAccuracy: false
                    });
                  }),
                  new Promise<null>((_, reject) => 
                    setTimeout(() => reject(new Error('GPS timeout')), 3000)
                  )
                ]);

                if (position && 'coords' in position) {
                  trackPayload.browserGeo = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                  };
                  console.log("[QR Scan] GPS coordinates collected:", trackPayload.browserGeo);
                }
              } catch (gpsError) {
                // GPS collection failed or timed out - continue without GPS data
                console.log("[QR Scan] GPS not available:", gpsError);
              }
            }

            // Fire tracking request without blocking redirect
            try {
              if (
                typeof window !== "undefined" &&
                (navigator as any).sendBeacon
              ) {
                const blob = new Blob([JSON.stringify(trackPayload)], {
                  type: "application/json",
                });
                (navigator as any).sendBeacon("/api/track-view", blob);
              } else {
                fetch("/api/track-view", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(trackPayload),
                  keepalive: true,
                }).catch(() => {});
              }
            } catch (e) {
              // tracking failure is non-fatal for redirect
              console.error("Error firing track-view:", e);
            }
          };

          // Start tracking (async, non-blocking)
          trackWithGPS();
          
          // Immediate redirect using multiple methods for maximum compatibility
          setTimeout(() => {
            window.location.replace(finalUrl);
          }, 0);
          window.location.href = finalUrl;
        };

        // ---------- SOCIALS ----------
        if (type === "SOCIALS") {
          try {
            const socials = JSON.parse(content || "{}");
            const platform = socials.selectedPlatform;
            const url = platform ? socials[platform] : "";

            if (url && typeof window !== "undefined") {
              redirectTo(url);
              return;
            } else {
              setStatus("error");
              setMessage("No social media URL found for this QR.");
              return;
            }
          } catch (e) {
            console.error("Error parsing socials JSON:", e);
            setStatus("error");
            setMessage("Invalid social links stored for this QR.");
            return;
          }
        }

        // ---------- MULTI_URL ----------
        if (type === "MULTI_URL") {
          let urlList: string[] = [];
          let pageTitle = "My Links";
          
          try {
            const parsed = JSON.parse(content);
            if (parsed.urls && Array.isArray(parsed.urls)) {
              urlList = parsed.urls.map((item: any) => item.url).filter(Boolean);
              pageTitle = parsed.title || "My Links";
            } else {
              // Fallback for old format
              urlList = content.split("\n").map((u) => u.trim()).filter(Boolean);
            }
          } catch {
            // Fallback for old format
            urlList = content.split("\n").map((u) => u.trim()).filter(Boolean);
          }

          if (urlList.length === 0) {
            setStatus("error");
            setMessage("No URLs found for this QR.");
            return;
          }

          // Single URL → redirect directly
          if (urlList.length === 1 && typeof window !== "undefined") {
            redirectTo(urlList[0]);
            return;
          }

          // Multiple URLs → show viewer
          setQrCode(data);
          setUrls(urlList);
          setStatus("done");
          return;
        }

        // ---------- SIMPLE URL ----------
        if (type === "URL") {
          if (content && typeof window !== "undefined") {
            redirectTo(content);
            return;
          }
          setStatus("error");
          setMessage("No URL found for this QR.");
          return;
        }

        // ---------- OTHER TYPES (PLAIN_TEXT, SMS, etc.) ----------
        setQrCode(data);
        setMessage(content);
        setStatus("done");
      } catch (error) {
        console.error("Error loading QR:", error);
        setStatus("error");
        setMessage("Something went wrong while opening this QR.");
      }
    };

    handleQR();
  }, [id]);

  // ================== RENDER STATES ==================

  if (status === "loading") {
    return (
      <>
        <Head>
          <style>{`
            html { 
              background-color: #000 !important; 
            }
            body { 
              background-color: #000 !important; 
              overflow: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
              height: 100vh !important;
            }
            body * { 
              display: none !important;
              visibility: hidden !important;
            }
            .qr-redirect-overlay {
              display: block !important;
              visibility: visible !important;
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              background-color: #000 !important;
              z-index: 999999 !important;
            }
            .qr-redirect-overlay * {
              display: flex !important;
              visibility: visible !important;
            }
            .qr-redirect-loader {
              position: absolute !important;
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              flex-direction: row !important;
            }
            .qr-spinner {
              border: 2px solid rgba(255, 255, 255, 0.3) !important;
              border-top: 2px solid #ffffff !important;
              border-radius: 50% !important;
              width: 24px !important;
              height: 24px !important;
              animation: qr-spin 1s linear infinite !important;
              margin-right: 12px !important;
            }
            @keyframes qr-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .qr-redirect-text {
              color: #ffffff !important;
              font-size: 16px !important;
              font-weight: 500 !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          `}</style>
        </Head>
        <div className="qr-redirect-overlay">
          <div className="qr-redirect-loader">
            <div className="qr-spinner"></div>
            <span className="qr-redirect-text">Redirecting...</span>
          </div>
        </div>
      </>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-6 text-center">
          <p className="text-red-500 font-semibold mb-2">QR Error</p>
          <p className="text-gray-700 text-sm">{message}</p>
        </div>
      </div>
    );
  }

  // ================== MULTI_URL VIEWER (WITH QR) ==================

  if (qrCode && qrCode.type === "MULTI_URL" && urls.length > 1) {
    let parsedData: { title: string; urls: Array<{ url: string; title: string }> } = {
      title: "My Links",
      urls: urls.map(url => ({ url, title: url }))
    };
    
    try {
      const parsed = JSON.parse(qrCode.content);
      if (parsed.title && parsed.urls) {
        parsedData = parsed;
      }
    } catch {
      // Use default
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Head>
          <title>{parsedData.title}</title>
        </Head>
        <div className="max-w-2xl mx-auto pt-8 pb-16">
          {/* Header with Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{parsedData.title}</h1>
            <p className="text-gray-600 text-sm">Click any link below to visit</p>
          </div>

          {/* Links Grid */}
          <div className="space-y-3">
            {parsedData.urls.map((item, index) => (
              <a
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{item.url}</p>
                  </div>
                  <svg 
                    className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </a>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center mt-12">
            <p className="text-xs text-gray-400">Powered by QR Tools</p>
          </div>
        </div>
      </div>
    );
  }

  // ================== FALLBACK: SHOW CONTENT TEXT ==================

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-6">
        <p className="text-gray-900 text-sm whitespace-pre-wrap break-words">
          {message || "No content available for this QR."}
        </p>
      </div>
    </div>
  );
}
