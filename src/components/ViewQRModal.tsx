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
    logoImage?: string | null;
    logoPreset?: string | null;
  };
}

interface ViewQRModalProps {
  qrCode: QRCodeData;
  onClose: () => void;
}

// Logo presets meta for SVG export & UI
const LOGO_PRESETS_META: Record<string, { color: string; label: string }> = {
  none: { color: "#E5E7EB", label: "None" },
  whatsapp: { color: "#25D366", label: "WA" },
  link: { color: "#6366F1", label: "Link" },
  location: { color: "#F97373", label: "Loc" },
  wifi: { color: "#14B8A6", label: "WiFi" },
};

export default function ViewQRModal({ qrCode, onClose }: ViewQRModalProps) {
  // default to 180 to match the index page QR density
  const [size, setSize] = useState(qrCode.settings?.size || 180);
  const [fgColor, setFgColor] = useState(qrCode.settings?.fgColor || "#000000");
  const [bgColor, setBgColor] = useState(qrCode.settings?.bgColor || "#FFFFFF");
  const [shape, setShape] = useState(qrCode.settings?.shape || "square");
  const [copied, setCopied] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  
  // Logo settings from saved QR code
  const logoImage = qrCode.settings?.logoImage || null;
  const logoPreset = qrCode.settings?.logoPreset || null;

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

  // 👉 Destination URL (for your own reference / future use if needed)
  const destinationUrl = urls[currentUrlIndex] || "";

  // 👉 Tracking short URL (this is what we want in the QR for analytics)
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shortUrl = origin ? `${origin}/qr/${qrCode.id}` : `/qr/${qrCode.id}`;

  // This is the value we encode in the QR + copy + open
  const currentValue = shortUrl;

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

  // Convert a logo (data URL or remote URL) to a PNG data URL for embedding
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
      return await loadImageToPng(logoUrl);
    } catch (err) {
      console.error("convertLogoToPngDataUrl failed:", err);
      return null;
    }
  };

  // Generate logo markup for SVG export
  const getLogoMarkup = (
    logoImage: string | null,
    logoPreset: string | null,
    svgSize = 256
  ) => {
    if (!logoImage && (!logoPreset || logoPreset === "none")) return "";

    let content = "";

    if (logoImage) {
      content = `
        <image
          width="60"
          height="60"
          x="-30"
          y="-30"
          xlink:href="${logoImage}"
          href="${logoImage}"
        />
      `;
    } else if (logoPreset && logoPreset !== "none") {
      const meta = LOGO_PRESETS_META[logoPreset];
      content = `
        <circle cx="0" cy="0" r="30" fill="${meta.color}" />
        <text
          fill="white"
          font-size="18"
          font-family="Arial"
          text-anchor="middle"
          alignment-baseline="central"
        >${meta.label}</text>
      `;
    }

    return `
      <g transform="translate(${svgSize / 2}, ${svgSize / 2})">
        <circle cx="0" cy="0" r="34" fill="white" />
        ${content}
      </g>
    `;
  };

  const downloadQR = async (format: "png" | "svg") => {
    const svgElement = document.querySelector("#qr-preview svg");
    if (!svgElement) return;

    try {
      if (format === "svg") {
        // SVG EXPORT WITH LOGO
        let svgData = new XMLSerializer().serializeToString(svgElement);

        // Ensure xmlns:xlink is present if not already
        if (!svgData.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
          svgData = svgData.replace(
            "<svg",
            '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
          );
        }

        // Convert SVG logo to PNG and generate logo markup
        let logoForInjection = logoImage;
        if (logoImage) {
          try {
            const converted = await convertLogoToPngDataUrl(logoImage, 60);
            if (converted) logoForInjection = converted;
          } catch (err) {
            console.warn("logo conversion failed, will attempt to embed original:", err);
          }
        }

        // Generate logo markup
        const logoMarkup = getLogoMarkup(
          logoForInjection,
          logoPreset,
          (svgElement as SVGSVGElement).viewBox.baseVal.width || size || 256
        );

        console.log("SVG export debug:", {
          hasLogoImage: !!logoImage,
          hasLogoPreset: !!(logoPreset && logoPreset !== "none"),
          logoForInjection: logoForInjection?.slice(0, 100),
          logoMarkupLength: logoMarkup?.length || 0
        });

        // Inject logo markup before closing </svg> tag
        if (logoMarkup) {
          try {
            // Use DOM methods for proper namespace handling
            const clone = (svgElement as SVGSVGElement).cloneNode(true) as SVGSVGElement;
            const parser = new DOMParser();
            const parsed = parser.parseFromString(logoMarkup, "image/svg+xml");
            
            if (parsed.documentElement && !parsed.querySelector('parsererror')) {
              const groupNode = parsed.documentElement;
              const imported = document.importNode(groupNode, true);
              if (!clone.hasAttribute("xmlns:xlink")) {
                clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
              }
              clone.appendChild(imported);
              svgData = new XMLSerializer().serializeToString(clone);
              console.log("SVG export: Successfully injected logo via DOM methods");
            } else {
              throw new Error("Failed to parse logo markup");
            }
          } catch (err) {
            console.warn("DOM injection failed, falling back to string replacement", err);
            svgData = svgData.replace("</svg>", `${logoMarkup}</svg>`);
            console.log("SVG export: Used string replacement fallback");
          }
          
          // Verify logo was injected
          if (!svgData.includes("<image") && !svgData.includes("<circle")) {
            console.warn("SVG export: No logo elements found in final SVG");
          } else {
            console.log("SVG export: Logo successfully included in final SVG");
          }
        } else if (logoImage || (logoPreset && logoPreset !== "none")) {
          console.warn("SVG export: Logo was expected but no logoMarkup generated");
        }

        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `qrcode-${qrCode.id}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // PNG EXPORT WITH LOGO
        console.log("PNG export debug:", {
          hasLogoImage: !!logoImage,
          hasLogoPreset: !!(logoPreset && logoPreset !== "none"),
          logoImage: logoImage?.slice(0, 100),
          logoPreset
        });

        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // First render QR code
        const img = new Image();
        let svgData = new XMLSerializer().serializeToString(svgElement);

        // Add logo to SVG for PNG export too
        let logoForInjection = logoImage;
        if (logoImage) {
          try {
            const converted = await convertLogoToPngDataUrl(logoImage, 60);
            if (converted) {
              logoForInjection = converted;
              console.log("PNG export: Logo converted to PNG successfully");
            }
          } catch (err) {
            console.warn("logo conversion failed for PNG export", err);
          }
        }

        const logoMarkup = getLogoMarkup(
          logoForInjection,
          logoPreset,
          (svgElement as SVGSVGElement).viewBox.baseVal.width || size || 256
        );

        console.log("PNG export logoMarkup length:", logoMarkup?.length || 0);

        if (logoMarkup) {
          if (!svgData.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
            svgData = svgData.replace(
              "<svg",
              '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
            );
          }
          svgData = svgData.replace("</svg>", `${logoMarkup}</svg>`);
          console.log("PNG export: Logo markup injected into SVG");
        }

        const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);

        await new Promise((resolve, reject) => {
          img.onload = () => {
            console.log("PNG export: SVG image loaded successfully");
            resolve(true);
          };
          img.onerror = (err) => {
            console.error("PNG export: Failed to load SVG image", err);
            reject(err);
          };
          img.src = url;
        });

        // Fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 1024, 1024);
        ctx.drawImage(img, 0, 0, 1024, 1024);
        URL.revokeObjectURL(url);

        const link = document.createElement("a");
        link.download = `qrcode-${qrCode.id}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log("PNG export: Download completed");
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
                {/* Short URL (tracking URL) */}
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

                  {/* (Optional) show destination for reference if MULTI_URL */}
                  {qrCode.type === "MULTI_URL" && destinationUrl && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">
                        Selected destination URL (for this QR logic):
                      </p>
                      <p className="text-xs text-gray-600 break-all">
                        {destinationUrl}
                      </p>
                    </div>
                  )}
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

                {/* URL selector for MULTI_URL (still useful to see destination) */}
                {qrCode.type === "MULTI_URL" && urls.length > 1 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select destination (for reference)
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

                {/* Open in new page – uses tracking URL so analytics work */}
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
                  <div className="relative inline-block">
                    <QRCode
                      value={currentValue}
                      size={size}
                      fgColor={fgColor}
                      bgColor={bgColor}
                      // low error correction = less dense
                      level="L"
                      style={{ width: size, height: size }}
                      viewBox={`0 0 ${size} ${size}`}
                      className={`
                        ${shape === "rounded" ? "rounded-2xl" : ""}
                        ${shape === "dots" ? "rounded-3xl" : ""}
                      `}
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
                          ) : (
                            logoPreset && logoPreset !== "none" && (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{ backgroundColor: LOGO_PRESETS_META[logoPreset]?.color || "#E5E7EB" }}
                              >
                                {LOGO_PRESETS_META[logoPreset]?.label || ""}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
