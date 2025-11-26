import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import QRCode from "react-qr-code";

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

        //  Increment scan count on server via API (admin SDK) to keep
        //  detailed analytics in sync (do not increment client-side to
        //  avoid double counting or permission issues)

        //  Track detailed view (IP, browser, etc) via API. We use navigator.sendBeacon
        //  when possible to ensure the tracking request completes even if we
        //  immediately redirect the user (sendBeacon is more reliable for this).
        const trackPayload = JSON.stringify({ qrId: id });
        try {
          if (typeof window !== "undefined" && (navigator as any).sendBeacon) {
            const blob = new Blob([trackPayload], { type: "application/json" });
            const beaconResult = (navigator as any).sendBeacon(
              "/api/track-view",
              blob
            );
            console.log("sendBeacon result:", beaconResult);
            if (!beaconResult) {
              // If sendBeacon failed, fall back to fetch
              const resp = await fetch("/api/track-view", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: trackPayload,
              });
              const json = await resp.json().catch(() => null);
              console.log(
                "track-view response (fetch fallback):",
                resp.status,
                json
              );
              if (!resp.ok) {
                try {
                  await updateDoc(ref, { scans: increment(1) });
                } catch (e) {
                  console.error("Error incrementing scans fallback:", e);
                }
              }
            }
          } else {
            const resp = await fetch("/api/track-view", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: trackPayload,
            });
            const json = await resp.json().catch(() => null);
            console.log("track-view response:", resp.status, json);
            if (!resp.ok) {
              try {
                await updateDoc(ref, { scans: increment(1) });
              } catch (err) {
                console.error("Error incrementing scans fallback:", err);
              }
            }
          }
        } catch (e) {
          console.error("Error tracking view:", e);
          try {
            await updateDoc(ref, { scans: increment(1) });
          } catch (err) {
            console.error("Error incrementing scans fallback:", err);
          }
        }

        const type = (data.type || "").toUpperCase();
        const content = data.content || "";

        // ========== SOCIALS ==========
        if (type === "SOCIALS") {
          try {
            const socials = JSON.parse(content || "{}");
            const platform = socials.selectedPlatform;
            const url = platform ? socials[platform] : "";

            if (url && typeof window !== "undefined") {
              window.location.href = url;
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
            window.location.href = urlList[0];
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
            window.location.href = content;
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Opening your link...</p>
      </div>
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
