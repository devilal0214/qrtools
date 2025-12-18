import { useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { useRouter } from "next/router";

interface QRCodeData {
  id: string;
  type: string; // "URL", "MULTI_URL", etc.
  content: string;
  title?: string;
  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: string;
    logoImage?: string | null; // dataURL
    logoPreset?: string | null; // "none" | ...
  };
}

interface ViewQRModalProps {
  qrCode: QRCodeData;
  onClose: () => void;

  // ✅ premium flag
  isPremium: boolean;

  // optional: if you want Track scans to open your analytics modal/page
  onTrackScans?: (qrId: string) => void;

  // optional: open upgrade modal/page
  onUpgradeClick?: () => void;
}

// Optional logo presets (you can expand)
const LOGO_PRESETS_META: Record<string, { color: string; label: string }> = {
  whatsapp: { color: "#25D366", label: "WA" },
  link: { color: "#6366F1", label: "Link" },
  location: { color: "#F97373", label: "Loc" },
  wifi: { color: "#14B8A6", label: "WiFi" },
};

const svgToDataUrl = (svg: string) => {
  if (typeof window === "undefined") return null;
  const base64 = window.btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
};

// Convert SVG/remote/dataURL -> PNG dataURL (for safe embed into exported SVG/PNG)
const convertLogoToPngDataUrl = async (logoUrl: string, outSize = 256) => {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:image/png")) return logoUrl;

  const loadImageToPng = (src: string) =>
    new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
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
          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = src;
    });

  try {
    return await loadImageToPng(logoUrl);
  } catch (e) {
    console.error("convertLogoToPngDataUrl failed:", e);
    return null;
  }
};

// Build a small preset logo as SVG dataURL (so it exports too)
const getPresetLogoDataUrl = (preset: string, fg = "#111827") => {
  const meta = LOGO_PRESETS_META[preset];
  if (!meta) return null;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <rect x="0" y="0" width="160" height="160" rx="80" fill="white"/>
      <rect x="0.5" y="0.5" width="159" height="159" rx="80" fill="white" stroke="#E5E7EB"/>
      <circle cx="80" cy="80" r="52" fill="${meta.color}"/>
      <text x="80" y="86" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="26" font-weight="800" fill="white">${meta.label}</text>
    </svg>
  `;
  return svgToDataUrl(svg);
};

export default function ViewQRModal({
  qrCode,
  onClose,
  onTrackScans,
  isPremium,
  onUpgradeClick,
}: ViewQRModalProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // UI controls like screenshot
  const [imageFormat, setImageFormat] = useState<"png" | "svg">("png");
  const [imageSize, setImageSize] = useState<number>(1000);

  // Use saved styling (fallbacks)
  const fgColor = qrCode.settings?.fgColor || "#000000";
  const bgColor = qrCode.settings?.bgColor || "#FFFFFF";

  const logoImage = qrCode.settings?.logoImage || null;
  const logoPreset = qrCode.settings?.logoPreset || null;

  // MULTI_URL support if needed (still encode tracking URL in QR)
  const urls = useMemo(() => {
    if (qrCode.type === "MULTI_URL") {
      return qrCode.content
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
    }
    return [qrCode.content || ""];
  }, [qrCode.type, qrCode.content]);

  const destinationUrl = urls[0] || "";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shortUrl = origin ? `${origin}/qr/${qrCode.id}` : `/qr/${qrCode.id}`;
  const currentValue = shortUrl;

  const showUpgrade = (message: string) => {
    if (onUpgradeClick) return onUpgradeClick();
    alert(message);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("copy failed", e);
    }
  };

  // Inject logo into exported SVG (center)
  const getLogoMarkup = (
    logoPngDataUrl: string | null,
    preset: string | null,
    svgSize: number
  ) => {
    if (!logoPngDataUrl && (!preset || preset === "none")) return "";

    // Prefer uploaded logo; else preset circle+text
    if (logoPngDataUrl) {
      return `
        <g transform="translate(${svgSize / 2}, ${svgSize / 2})">
          <circle cx="0" cy="0" r="${Math.floor(
            svgSize * 0.09
          )}" fill="white" />
          <image
            width="${Math.floor(svgSize * 0.16)}"
            height="${Math.floor(svgSize * 0.16)}"
            x="${-Math.floor(svgSize * 0.08)}"
            y="${-Math.floor(svgSize * 0.08)}"
            xlink:href="${logoPngDataUrl}"
            href="${logoPngDataUrl}"
          />
        </g>
      `;
    }

    const meta = preset ? LOGO_PRESETS_META[preset] : null;
    if (!meta) return "";

    return `
      <g transform="translate(${svgSize / 2}, ${svgSize / 2})">
        <circle cx="0" cy="0" r="${Math.floor(svgSize * 0.09)}" fill="white" />
        <circle cx="0" cy="0" r="${Math.floor(svgSize * 0.07)}" fill="${
      meta.color
    }" />
        <text fill="white" font-size="${Math.floor(svgSize * 0.05)}"
          font-family="Arial" font-weight="800" text-anchor="middle" alignment-baseline="central">${
            meta.label
          }</text>
      </g>
    `;
  };

  const downloadQR = async () => {
    // ✅ SVG download premium-only
    if (imageFormat === "svg" && !isPremium) {
      return showUpgrade(
        "SVG download is available only for Premium accounts."
      );
    }

    const svgElement = document.querySelector(
      "#qr-view-preview svg"
    ) as SVGSVGElement | null;
    if (!svgElement) return;

    try {
      // Prepare final logo dataURL
      let finalLogoDataUrl: string | null = null;

      if (logoImage) {
        finalLogoDataUrl = await convertLogoToPngDataUrl(logoImage, 256);
      } else if (logoPreset && logoPreset !== "none") {
        const presetUrl = getPresetLogoDataUrl(logoPreset, fgColor);
        if (presetUrl)
          finalLogoDataUrl = await convertLogoToPngDataUrl(presetUrl, 256);
      }

      // --- SVG download ---
      if (imageFormat === "svg") {
        let svgData = new XMLSerializer().serializeToString(svgElement);

        // ensure xlink namespace
        if (!svgData.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
          svgData = svgData.replace(
            "<svg",
            '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
          );
        }

        // Force export size
        const exportSize = imageSize || 1000;
        svgData = svgData.replace(/width="[^"]*"/, `width="${exportSize}"`);
        svgData = svgData.replace(/height="[^"]*"/, `height="${exportSize}"`);
        if (!svgData.includes("viewBox")) {
          svgData = svgData.replace(
            "<svg",
            `<svg viewBox="0 0 ${exportSize} ${exportSize}"`
          );
        }

        const logoMarkup = getLogoMarkup(
          finalLogoDataUrl,
          logoPreset,
          exportSize
        );
        if (logoMarkup)
          svgData = svgData.replace("</svg>", `${logoMarkup}</svg>`);

        const blob = new Blob([svgData], {
          type: "image/svg+xml;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `qrcode-${qrCode.id}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      // --- PNG download ---
      const exportSize = imageSize || 1000;

      // Serialize SVG, inject logo for PNG too
      let svgData = new XMLSerializer().serializeToString(svgElement);
      if (!svgData.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
        svgData = svgData.replace(
          "<svg",
          '<svg xmlns:xlink="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
        );
      }
      // set export size
      svgData = svgData.replace(/width="[^"]*"/, `width="${exportSize}"`);
      svgData = svgData.replace(/height="[^"]*"/, `height="${exportSize}"`);

      const logoMarkup = getLogoMarkup(
        finalLogoDataUrl,
        logoPreset,
        exportSize
      );
      if (logoMarkup)
        svgData = svgData.replace("</svg>", `${logoMarkup}</svg>`);

      const canvas = document.createElement("canvas");
      canvas.width = exportSize;
      canvas.height = exportSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, exportSize, exportSize);
      ctx.drawImage(img, 0, 0, exportSize, exportSize);

      URL.revokeObjectURL(url);

      const a = document.createElement("a");
      a.download = `qrcode-${qrCode.id}.png`;
      a.href = canvas.toDataURL("image/png");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("download failed:", e);
    }
  };

  // ✅ premium gating for Track scans
  const handleTrackScans = () => {
    if (!isPremium) {
      return showUpgrade(
        "Scan tracking is available only for Premium accounts."
      );
    }

    if (onTrackScans) return onTrackScans(qrCode.id);

    router.push(`/dashboard/analytics?qr=${qrCode.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center ">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative mx-auto mt-10 w-[95%] max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6">
            {/* LEFT: QR Preview */}
            <div className="flex flex-col items-center">
              <div
                id="qr-view-preview"
                className="w-full rounded-xl border bg-white p-4 flex items-center justify-center"
              >
                <div className="relative">
                  <QRCode
                    value={currentValue}
                    size={320}
                    fgColor={fgColor}
                    bgColor={bgColor}
                    level="L"
                    style={{ width: 320, height: 320 }}
                  />

                  {(logoImage || (logoPreset && logoPreset !== "none")) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden">
                        {logoImage ? (
                          <img
                            src={logoImage}
                            alt="logo"
                            className="w-11 h-11 object-contain"
                          />
                        ) : (
                          logoPreset &&
                          logoPreset !== "none" && (
                            <div
                              className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-extrabold text-white"
                              style={{
                                backgroundColor:
                                  LOGO_PRESETS_META[logoPreset]?.color ||
                                  "#9CA3AF",
                              }}
                            >
                              {LOGO_PRESETS_META[logoPreset]?.label || ""}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Controls like screenshot */}
            <div className="flex justify-between flex-col">
              <h2 className="text-2xl font-semibold text-gray-900">
                Name your QR Code and <br className="hidden md:block" />
                share it! ✨
              </h2>

              <div className="mt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span>{qrCode.title || "URL QR Code"}</span>
                  <span className="text-green-600">✎</span>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700"
                    value={currentValue}
                    readOnly
                  />
                  <button
                    onClick={copyToClipboard}
                    className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                    title="Copy"
                  >
                    {copied ? "✓" : "⧉"}
                  </button>
                </div>

                {/* Format + Size row */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">
                      Image Format
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={imageFormat}
                      onChange={(e) => {
                        const next = e.target.value as "png" | "svg";
                        // ✅ if trying to select svg without premium, block
                        if (next === "svg" && !isPremium) {
                          showUpgrade(
                            "SVG format is available only for Premium accounts."
                          );
                          return;
                        }
                        setImageFormat(next);
                      }}
                    >
                      <option value="png">PNG</option>
                      <option value="svg">
                        SVG {isPremium ? "" : "(Premium)"}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Image Size</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={imageSize}
                      onChange={(e) => setImageSize(Number(e.target.value))}
                    >
                      <option value={256}>256px</option>
                      <option value={512}>512px</option>
                      <option value={1000}>1000px</option>
                    </select>
                  </div>
                </div>

                {/* Download button like screenshot */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={downloadQR}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-white font-semibold hover:bg-green-700"
                  >
                    ⬇ Download
                  </button>

                  {/* Secondary icon button (optional) */}
                  <button
                    onClick={copyToClipboard}
                    className="rounded-lg border bg-white px-4 py-3 hover:bg-gray-50"
                    title="Copy link"
                  >
                    ⧉
                  </button>
                </div>

                {/* Optional: show destination reference (multi url) */}
                {qrCode.type === "MULTI_URL" && destinationUrl && (
                  <p className="mt-3 text-xs text-gray-500 break-all">
                    Destination: {destinationUrl}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar like screenshot */}
        <div className="mt-6 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white border flex items-center justify-center">
              <span className="text-xs font-bold">QR</span>
            </div>
            <span>
              Scan the QR Code with your device&apos;s camera to start tracking.
            </span>
          </div>

          <button
            onClick={handleTrackScans}
            className={`rounded-lg border px-4 py-2 font-semibold ${
              isPremium
                ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                : "border-gray-300 text-gray-400 cursor-not-allowed"
            }`}
            title={isPremium ? "Track scans" : "Premium only"}
          >
            Track scans {isPremium ? "" : "(Premium)"}
          </button>
        </div>
      </div>
    </div>
  );
}
