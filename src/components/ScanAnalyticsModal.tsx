import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { nanoid } from "nanoid";

interface QRCode {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  scans: number;
  isActive: boolean;
  title?: string;
  userId?: string;
}

interface ScanRecord {
  id: string;
  timestamp?: string;
  ipInfo?: {
    ip?: string;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  browser?: { name?: string | null; version?: string | null };
  os?: { name?: string | null; version?: string | null };
  device?: {
    type?: string | null;
    vendor?: string | null;
    model?: string | null;
  };
}

interface LocationStat {
  key: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  count: number;
}

interface ScanAnalyticsModalProps {
  qrCode: QRCode;
  onClose: () => void;
}

export default function ScanAnalyticsModal({
  qrCode,
  onClose,
}: ScanAnalyticsModalProps) {
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationStats, setLocationStats] = useState<LocationStat[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationStat | null>(
    null
  );

  // share link state
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ---- generate public analytics link ----
  const generateShareLink = async () => {
    try {
      setShareLoading(true);
      const token = nanoid(16);

      await setDoc(
        doc(db, "publicAnalytics", qrCode.id),
        {
          qrId: qrCode.id,
          token,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/public/analytics/${qrCode.id}?token=${token}`;
      setPublicUrl(url);

      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        // ignore clipboard failure
      }
    } catch (err) {
      console.error("Failed to generate public link:", err);
      alert("Failed to generate share link. Please try again.");
    } finally {
      setShareLoading(false);
    }
  };

  // ---- existing fetch scans logic ----
  useEffect(() => {
    const fetchScans = async () => {
      if (!qrCode?.id) {
        setLoading(false);
        setErrorMessage("QR ID missing – cannot load analytics.");
        return;
      }

      try {
        setLoading(true);

        const q = query(
          collection(db, "scans"),
          where("qrId", "==", qrCode.id),
          orderBy("timestamp", "desc")
        );

        const snap = await getDocs(q);
        const records: ScanRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setScans(records);

        const locationMap = new Map<string, LocationStat>();

        records.forEach((rec) => {
          const ipInfo = rec.ipInfo || {};
          const city = ipInfo.city || "Unknown city";
          const region = ipInfo.region || "";
          const country = ipInfo.country || "Unknown country";

          const key = `${city}${region ? ", " + region : ""}${
            country ? ", " + country : ""
          }`;

          if (!locationMap.has(key)) {
            locationMap.set(key, {
              key,
              city: ipInfo.city,
              region: ipInfo.region,
              country: ipInfo.country,
              count: 0,
            });
          }

          locationMap.get(key)!.count += 1;
        });

        const statsArray = Array.from(locationMap.values()).sort(
          (a, b) => b.count - a.count
        );

        setLocationStats(statsArray);
        setSelectedLocation(statsArray[0] || null);
      } catch (err: any) {
        console.error("Error fetching scan analytics:", err);
        setErrorMessage(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchScans();
  }, [qrCode.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[82vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Scan Analytics
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              QR:{" "}
              <span className="font-medium">{qrCode.title || "Untitled"}</span>{" "}
              · ID: <span className="font-mono text-gray-600">{qrCode.id}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            Close
          </button>
        </div>

        {/* Share section */}
        <div className="px-6 pt-4 pb-3 border-b bg-gray-50">
          <button
            onClick={generateShareLink}
            disabled={shareLoading}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {shareLoading ? "Generating link…" : "Share analytics"}
          </button>

          {publicUrl && (
            <div className="mt-3 text-xs bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-[11px] text-gray-500 mb-1">
                Public share link:
              </p>
              <p className="font-mono break-all text-gray-800">{publicUrl}</p>
              <p className="text-green-600 mt-1">
                {copied
                  ? "Copied to clipboard!"
                  : "Copy & send this link to your client."}
              </p>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : errorMessage ? (
            <p className="text-sm text-gray-500 text-center py-6">
              {errorMessage}
            </p>
          ) : scans.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No scans recorded yet for this QR code.
            </p>
          ) : (
            <>
              {/* Top stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Total scans</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {qrCode.scans ?? scans.length}
                  </p>
                </div>
                <div className="border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Unique locations</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {locationStats.length}
                  </p>
                </div>
                <div className="border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Most active location</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {locationStats[0]?.key || "—"}
                  </p>
                  {locationStats[0] && (
                    <p className="text-xs text-gray-500">
                      {locationStats[0].count} scans
                    </p>
                  )}
                </div>
              </div>

              {/* Locations + details */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: locations */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">
                    Scans by location
                  </h4>
                  <div className="border rounded-xl max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Location
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Scans
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {locationStats.map((loc) => (
                          <tr
                            key={loc.key}
                            onClick={() => setSelectedLocation(loc)}
                            className={`cursor-pointer hover:bg-gray-50 ${
                              selectedLocation?.key === loc.key
                                ? "bg-blue-50"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-2 text-gray-800">
                              {loc.key}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-gray-900">
                              {loc.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: individual scans */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">
                    Scans in{" "}
                    <span className="text-blue-600">
                      {selectedLocation?.key || "all locations"}
                    </span>
                  </h4>
                  <div className="border rounded-xl max-h-64 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">
                            Time
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">
                            IP
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">
                            Browser
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">
                            Device
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {scans
                          .filter((rec) => {
                            if (!selectedLocation) return true;
                            const ipInfo = rec.ipInfo || {};
                            const city = ipInfo.city || "Unknown city";
                            const region = ipInfo.region || "";
                            const country = ipInfo.country || "Unknown country";
                            const key = `${city}${region ? ", " + region : ""}${
                              country ? ", " + country : ""
                            }`;
                            return key === selectedLocation.key;
                          })
                          .map((rec) => (
                            <tr key={rec.id}>
                              <td className="px-3 py-2">
                                {rec.timestamp
                                  ? new Date(rec.timestamp).toLocaleString()
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px]">
                                {rec.ipInfo?.ip || "—"}
                              </td>
                              <td className="px-3 py-2">
                                {rec.browser?.name || "—"}{" "}
                                {rec.browser?.version
                                  ? `(${rec.browser.version})`
                                  : ""}
                              </td>
                              <td className="px-3 py-2">
                                {rec.device?.type || "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
