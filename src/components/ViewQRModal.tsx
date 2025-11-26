import { useState, useMemo } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";

interface QRCodeData {
  id: string;
  type: string; // e.g. "URL", "MULTI_URL", etc.
  content: string;
  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: string;
  };
}

interface ViewQRModalProps {
  qrCode: QRCodeData;
  onClose: () => void;
}

export default function ViewQRModal({ qrCode, onClose }: ViewQRModalProps) {
  // default to 180 to match the index page QR density
  const [size, setSize] = useState(qrCode.settings?.size || 180);
  const [fgColor, setFgColor] = useState(qrCode.settings?.fgColor || "#000000");
  const [bgColor, setBgColor] = useState(qrCode.settings?.bgColor || "#FFFFFF");
  const [shape, setShape] = useState(qrCode.settings?.shape || "square");
  const [copied, setCopied] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

  // For MULTI_URL we split by newlines, otherwise it's a single value
  const urls = useMemo(() => {
    if (qrCode.type === "MULTI_URL") {
      return qrCode.content
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
    }
    return [qrCode.content || ""];
  }, [qrCode.type, qrCode.content]);

  // This is the **only** value we show + copy + encode in QR
  const currentValue = urls[currentUrlIndex] || "";

  const copyToClipboard = async () => {
    if (!currentValue) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadQR = async (format: "png" | "svg") => {
    const svgElement = document.querySelector("#qr-preview svg");
    if (!svgElement) return;

    try {
      if (format === "svg") {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `qrcode-${qrCode.id}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const img = new Image();
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });

        ctx.drawImage(img, 0, 0, 1024, 1024);
        URL.revokeObjectURL(url);

        const link = document.createElement("a");
        link.download = `qrcode-${qrCode.id}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Error downloading QR code:", err);
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
        <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Content */}
          <div className="mt-6">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left: Controls */}
              <div className="space-y-6">
                {/* “Short URL” = actual stored value */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Short URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={currentValue}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? (
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
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
                            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Size
                  </label>
                  <input
                    type="range"
                    min="128"
                    max="512"
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{size}px</span>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Foreground
                    </label>
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Background
                    </label>
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="mt-1 w-full"
                    />
                  </div>
                </div>

                {/* Shape */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Shape
                  </label>
                  <select
                    value={shape}
                    onChange={(e) => setShape(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="square">Square</option>
                    <option value="rounded">Rounded</option>
                    <option value="dots">Dots</option>
                  </select>
                </div>

                {/* URL selector for MULTI_URL */}
                {qrCode.type === "MULTI_URL" && urls.length > 1 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select URL
                    </label>
                    <select
                      value={currentUrlIndex}
                      onChange={(e) =>
                        setCurrentUrlIndex(Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {urls.map((url, idx) => (
                        <option key={idx} value={idx}>
                          URL {idx + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Download buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => downloadQR("png")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Download PNG
                  </button>
                  <button
                    onClick={() => downloadQR("svg")}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Download SVG
                  </button>
                </div>

                {/* Open in new page – uses same value */}
                {currentValue && (
                  <Link
                    href={currentValue}
                    target="_blank"
                    className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Open in New Page
                  </Link>
                )}
              </div>

              {/* Right: QR preview */}
              <div
                id="qr-preview"
                className="flex items-center justify-center bg-gray-50 p-8 rounded-xl"
              >
                {currentValue ? (
                  <QRCode
                    value={currentValue}
                    size={size}
                    fgColor={fgColor}
                    bgColor={bgColor}
                    // Use low error correction level and explicit sizing/viewBox
                    // so the QR density matches the index page which uses a short URL
                    // and level L (7% error correction)
                    level="L"
                    style={{ width: size, height: size }}
                    viewBox={`0 0 ${size} ${size}`}
                    className={`
                      ${shape === "rounded" ? "rounded-2xl" : ""}
                      ${shape === "dots" ? "rounded-3xl" : ""}
                    `}
                  />
                ) : (
                  <p className="text-sm text-gray-400">
                    No content found for this QR.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
