import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import QRCode from "react-qr-code";
import Head from "next/head";

interface QRData {
  title?: string;
  type: string;
  content: string;
  userId?: string; // 👈 owner userId
  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: string;
  };
}

export default function QRCodeViewer() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qrData, setQRData] = useState<QRData | null>(null);
  const [contents, setContents] = useState<string[]>([]);

  useEffect(() => {
    const fetchQRCode = async () => {
      if (!id) return;

      try {
        const docRef = doc(db, "qrcodes", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as QRData;
          setQRData(data);

          if (data.type === "MULTI_URL") {
            setContents(data.content.split("\n").filter(Boolean));
          } else {
            setContents([data.content]);
          }

          // ---------- TRACK SCAN DIRECTLY IN FIRESTORE ----------
          try {
            const userAgent =
              typeof navigator !== "undefined" ? navigator.userAgent : "";
            const referrer =
              typeof document !== "undefined" ? document.referrer : "";

            await addDoc(collection(db, "scans"), {
              qrId: id,
              userId: data.userId || null, // 👈 owner id store
              timestamp: new Date().toISOString(),
              ipInfo: {
                ip: null,
                city: null,
                region: null,
                country: null,
                latitude: null,
                longitude: null,
                org: null,
              },
              browser: {
                name: userAgent,
                version: null,
              },
              os: {},
              device: {},
              referrer,
            });

            await updateDoc(docRef, {
              scans: increment(1),
              updatedAt: new Date().toISOString(),
            });
          } catch (trackErr) {
            console.error("Error tracking view / writing scan doc:", trackErr);
          }
          // ------------------------------------------------------
        } else {
          setError("QR code not found");
        }
      } catch (error) {
        console.error("Error:", error);
        setError("Failed to fetch QR code");
      } finally {
        setLoading(false);
      }
    };

    fetchQRCode();
  }, [id]);

  const handleNext = () => {
    if (currentIndex < contents.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !qrData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Head>
        <title>{qrData.title || "View QR Code"}</title>
      </Head>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {qrData.title && (
            <h1 className="text-2xl font-bold text-center mb-8">
              {qrData.title}
            </h1>
          )}

          <div className="flex flex-col items-center space-y-8">
            <div className="relative w-full flex items-center justify-center">
              {contents.length > 1 && currentIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="absolute left-0 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}

              <QRCode
                value={contents[currentIndex]}
                size={qrData.settings?.size || 180}
                bgColor={qrData.settings?.bgColor || "#FFFFFF"}
                fgColor={qrData.settings?.fgColor || "#000000"}
                level="L"
                style={{
                  width: qrData.settings?.size || 180,
                  height: qrData.settings?.size || 180,
                }}
                viewBox={`0 0 ${qrData.settings?.size || 180} ${
                  qrData.settings?.size || 180
                }`}
                className={`
                  ${qrData.settings?.shape === "rounded" ? "rounded-2xl" : ""}
                  ${qrData.settings?.shape === "dots" ? "rounded-3xl" : ""}
                `}
              />

              {contents.length > 1 && currentIndex < contents.length - 1 && (
                <button
                  onClick={handleNext}
                  className="absolute right-0 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50"
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
            </div>

            {contents.length > 1 && (
              <div className="text-center text-sm text-gray-500">
                QR Code {currentIndex + 1} of {contents.length}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
