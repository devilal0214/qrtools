import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
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
        // Keep loading state to show spinner
        // Don't hide immediately - let loading screen show
        
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

        const type = (data.type || "").toUpperCase();
        const content = data.content || "";
        
        // Function to handle redirect with tracking
        const redirectTo = (url: string) => {
          // Show loading state during redirect
          setStatus("loading");
          
          // Try to get browser geolocation as fallback for mobile
          const sendTrackingData = (browserGeo?: any) => {
            const trackPayload = JSON.stringify({ 
              qrId: id,
              browserGeo: browserGeo || null
            });
            
            // Fire tracking request without waiting for response
            if (typeof window !== "undefined" && (navigator as any).sendBeacon) {
              const blob = new Blob([trackPayload], { type: "application/json" });
              (navigator as any).sendBeacon("/api/track-view", blob);
            } else {
              fetch("/api/track-view", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: trackPayload,
                keepalive: true,
              }).catch(() => {});
            }
          };

          // Try to get location for better mobile tracking
          if (navigator.geolocation && /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                try {
                  // Get location info from coordinates
                  const geoRes = await fetch("/api/browser-geo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude
                    })
                  });
                  
                  const geoData = await geoRes.json();
                  sendTrackingData(geoData);
                } catch (err) {
                  console.log("Browser geo failed:", err);
                  sendTrackingData();
                }
              },
              () => {
                // Geolocation failed or denied, send without location
                sendTrackingData();
              },
              { timeout: 3000, enableHighAccuracy: false }
            );
          } else {
            // Not mobile or geolocation not available
            sendTrackingData();
          }
          
          // Redirect after showing loading screen for a moment
          setTimeout(() => {
            window.location.replace(url);
          }, 500); // Show loading for 500ms
          
          // Fallback redirect in case replace fails
          setTimeout(() => {
            window.location.href = url;
          }, 1000);
        };

        // ========== SOCIALS ==========
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

        // ========== MULTI_URL ==========
        if (type === "MULTI_URL") {
          // Your generator is using "\n" between URLs
          const urlList = content
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean);

          if (urlList.length === 0) {
            setStatus("error");
            setMessage("No URLs found for this QR.");
            return;
          }

          // If only one URL → direct redirect
          if (urlList.length === 1 && typeof window !== "undefined") {
            redirectTo(urlList[0]);
            return;
          }

          // Multiple URLs → show Multi URL viewer with QR codes
          setQrCode(data);
          setUrls(urlList);
          setStatus("done");
          return;
        }

        // ========== SIMPLE URL ==========
        if (type === "URL") {
          if (content && typeof window !== "undefined") {
            redirectTo(content);
            return;
          }
          setStatus("error");
          setMessage("No URL found for this QR.");
          return;
        }

        // ========== OTHER TYPES (PLAIN_TEXT, SMS, etc.) ==========
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
    const size = qrCode.settings?.size || 256;
    const fgColor = qrCode.settings?.fgColor || "#000000";
    const bgColor = qrCode.settings?.bgColor || "#FFFFFF";
    const shape = qrCode.settings?.shape;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-4xl w-full space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Multiple QR Codes</h2>
            <div className="flex gap-2 items-center">
              <button
                onClick={() =>
                  setCurrentUrlIndex((prev) => Math.max(0, prev - 1))
                }
                disabled={currentUrlIndex === 0}
                className="px-3 py-1 rounded-lg bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                {currentUrlIndex + 1} / {urls.length}
              </span>
              <button
                onClick={() =>
                  setCurrentUrlIndex((prev) =>
                    Math.min(urls.length - 1, prev + 1)
                  )
                }
                disabled={currentUrlIndex === urls.length - 1}
                className="px-3 py-1 rounded-lg bg-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <QRCode
              value={urls[currentUrlIndex]}
              size={size}
              fgColor={fgColor}
              bgColor={bgColor}
              level="H"
              className={`
                ${shape === "rounded" ? "rounded-2xl" : ""}
                ${shape === "dots" ? "rounded-full" : ""}
              `}
            />
          </div>

          <div className="space-y-2 text-center">
            <p className="text-sm text-gray-500 break-all">
              {urls[currentUrlIndex]}
            </p>
            <a
              href={urls[currentUrlIndex]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-blue-600 hover:underline"
            >
              Open this link
            </a>
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
