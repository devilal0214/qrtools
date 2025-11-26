import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface QRCode {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  scans: number;
  isActive: boolean;
  title?: string;
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
  browser?: {
    name?: string | null;
    version?: string | null;
  };
  os?: {
    name?: string | null;
    version?: string | null;
  };
  device?: {
    type?: string | null;
    vendor?: string | null;
    model?: string | null;
  };
}

interface LocationStat {
  key: string; // formatted label
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
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationStats, setLocationStats] = useState<LocationStat[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationStat | null>(
    null
  );

  useEffect(() => {
    const fetchScans = async () => {
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

        // Aggregate by location
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

          const obj = locationMap.get(key)!;
          obj.count += 1;
        });

        const statsArray = Array.from(locationMap.values()).sort(
          (a, b) => b.count - a.count
        );

        setLocationStats(statsArray);
        setSelectedLocation(statsArray[0] || null);
      } catch (err: any) {
        console.error("Error fetching scan analytics:", err);
        setErrorMessage(err?.message || String(err));
        // If the Firestore client read fails due to security rules, surface a
        // friendly message so users know why analytics might be empty.
        if (err?.code === "permission-denied") {
          setPermissionDenied(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchScans();
  }, [qrCode.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : permissionDenied ? (
            <p className="text-sm text-gray-500 text-center py-6">
              You don't have permission to view analytics for this QR code.
              Ensure you are the owner of the QR or your plan includes
              analytics.
            </p>
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
                  <p className="text-xs text-gray-500">Total Scans</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {qrCode.scans ?? scans.length}
                  </p>
                </div>
                <div className="border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Unique Locations</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {locationStats.length}
                  </p>
                </div>
                <div className="border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Most Active Location</p>
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

              {/* Locations list & detail */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: aggregated list */}
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

                {/* Right: raw scan list filtered by selected location */}
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
