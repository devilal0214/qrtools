import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface QRDoc {
  type: string;
  content: string;
  isActive?: boolean;
}

export default function QRRedirectPage() {
  const router = useRouter();
  const { id } = router.query;

  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!id) return;

    const handleRedirect = async () => {
      try {
        // 1) Track scan first
        try {
          await fetch("/api/track-view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrId: id }),
          });
        } catch (trackErr) {
          console.error("Failed to track scan:", trackErr);
          // tracking fail bhi ho jaye, redirect continue karega
        }

        // 2) Load QR details from Firestore
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

        // SOCIALS
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

        // MULTI_URL (optional – if you use it)
        if (type === "MULTI_URL") {
          const urls = content
            .split("\n") // ya jo bhi separator use kar rahe ho
            .map((u) => u.trim())
            .filter(Boolean);

          if (urls.length === 1 && typeof window !== "undefined") {
            window.location.href = urls[0];
            return;
          }

          // Example: show a simple error if multiple hai and UI nahi banayi
          setStatus("error");
          setMessage("This QR contains multiple links, but no UI is set yet.");
          return;
        }

        // Simple URL
        if (type === "URL") {
          if (content && typeof window !== "undefined") {
            window.location.href = content;
            return;
          }
          setStatus("error");
          setMessage("No URL found for this QR.");
          return;
        }

        // Baaki types ke liye sirf content show kar do
        setStatus("done");
        setMessage(content);
      } catch (error) {
        console.error("Error loading QR:", error);
        setStatus("error");
        setMessage("Something went wrong while opening this QR.");
      }
    };

    handleRedirect();
  }, [id, router]);

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

  // Fallback: show content
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-6">
        <p className="text-gray-900 text-sm whitespace-pre-wrap break-words">
          {message}
        </p>
      </div>
    </div>
  );
}
