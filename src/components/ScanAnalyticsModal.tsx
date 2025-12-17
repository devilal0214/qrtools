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

interface DeviceStat {
  type: string;
  count: number;
}

interface BrowserStat {
  name: string;
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
  const [deviceStats, setDeviceStats] = useState<DeviceStat[]>([]);
  const [browserStats, setBrowserStats] = useState<BrowserStat[]>([]);
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

        // Process device stats
        const deviceMap = new Map<string, number>();
        records.forEach((rec) => {
          const deviceType = rec.device?.type || 'Unknown';
          deviceMap.set(deviceType, (deviceMap.get(deviceType) || 0) + 1);
        });
        setDeviceStats(
          Array.from(deviceMap.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
        );

        // Process browser stats
        const browserMap = new Map<string, number>();
        records.forEach((rec) => {
          const browserName = rec.browser?.name || 'Unknown';
          browserMap.set(browserName, (browserMap.get(browserName) || 0) + 1);
        });
        setBrowserStats(
          Array.from(browserMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        );

        setLoading(false);
      } catch (err: any) {
        console.error("Fetch scans error:", err);
        setErrorMessage("Failed to load scan analytics.");
        setLoading(false);
      }
    };

    fetchScans();
  }, [qrCode.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              📊 Scan Analytics
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-semibold">{qrCode.title || "Untitled"}</span>
              {" · "}
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{qrCode.id}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={generateShareLink}
              disabled={shareLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {shareLoading ? "Generating..." : "Share"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Share Link Display */}
        {publicUrl && (
          <div className="px-6 py-3 bg-green-50 border-b border-green-100">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-900 mb-1">
                  {copied ? "✓ Link copied to clipboard!" : "Share this link with anyone"}
                </p>
                <p className="font-mono text-xs bg-white border border-green-200 rounded px-3 py-2 break-all text-gray-700">
                  {publicUrl}
                </p>
              </div>
            </div>
          </div>
        )}

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
              No scans recorded yet.
            </p>
          ) : (
            <>
              {/* Top stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="border rounded-xl p-4 bg-gradient-to-br from-blue-50 to-blue-100">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Total Scans</p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">
                    {qrCode.scans ?? scans.length}
                  </p>
                </div>
                <div className="border rounded-xl p-4 bg-gradient-to-br from-purple-50 to-purple-100">
                  <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Unique Locations</p>
                  <p className="text-3xl font-bold text-purple-900 mt-2">
                    {locationStats.length}
                  </p>
                </div>
                <div className="border rounded-xl p-4 bg-gradient-to-br from-green-50 to-green-100">
                  <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Device Types</p>
                  <p className="text-3xl font-bold text-green-900 mt-2">
                    {deviceStats.length}
                  </p>
                </div>
                <div className="border rounded-xl p-4 bg-gradient-to-br from-orange-50 to-orange-100">
                  <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">Most Active</p>
                  <p className="text-sm font-bold text-orange-900 mt-2 truncate" title={locationStats[0]?.key}>
                    {locationStats[0]?.city || "—"}
                  </p>
                  {locationStats[0] && (
                    <p className="text-xs text-orange-700 mt-1">
                      {locationStats[0].count} scans
                    </p>
                  )}
                </div>
              </div>

              {/* Main Grid - 2 columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Locations */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">📍 Scans by Location</h4>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Location
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Scans
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {locationStats.map((loc) => (
                          <tr
                            key={loc.key}
                            onClick={() => setSelectedLocation(loc)}
                            className={`cursor-pointer hover:bg-blue-50 ${
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
                            <td className="px-4 py-2 text-right text-gray-500">
                              {((loc.count / scans.length) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Devices */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">📱 Scans by Device</h4>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Device Type
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Scans
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {deviceStats.map((device) => (
                          <tr key={device.type}>
                            <td className="px-4 py-2 text-gray-800 capitalize">
                              {device.type}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-gray-900">
                              {device.count}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-500">
                              {((device.count / scans.length) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Browsers */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">🌐 Scans by Browser</h4>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Browser
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Scans
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {browserStats.map((browser) => (
                          <tr key={browser.name}>
                            <td className="px-4 py-2 text-gray-800">
                              {browser.name}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-gray-900">
                              {browser.count}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-500">
                              {((browser.count / scans.length) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Scans */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">
                      🕒 Recent Scans
                      {selectedLocation && (
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          in {selectedLocation.city}
                        </span>
                      )}
                    </h4>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">
                            Time
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">
                            Device
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">
                            Browser
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
                          .slice(0, 50)
                          .map((rec) => (
                            <tr key={rec.id}>
                              <td className="px-3 py-2 text-gray-700">
                                {rec.timestamp
                                  ? new Date(rec.timestamp).toLocaleString()
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-700 capitalize">
                                {rec.device?.type || "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {rec.browser?.name || "—"}
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
