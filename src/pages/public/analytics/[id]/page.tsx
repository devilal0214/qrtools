// pages/public/analytics/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Head from "next/head";

interface ScanRecord {
  id: string;
  timestamp?: string;
  ipInfo?: {
    ip?: string;
    city?: string | null;
    region?: string | null;
    country?: string | null;
  };
}

interface LocationStat {
  key: string;
  count: number;
}

export default function PublicAnalyticsPage() {
  const router = useRouter();
  const { id, token } = router.query;

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [qrTitle, setQrTitle] = useState<string | null>(null);
  const [totalScans, setTotalScans] = useState(0);
  const [locationStats, setLocationStats] = useState<LocationStat[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!id || !token) return;
      try {
        setLoading(true);

        // 1) verify token
        const pubRef = doc(db, "publicAnalytics", String(id));
        const pubSnap = await getDoc(pubRef);

        if (!pubSnap.exists()) {
          setValid(false);
          return;
        }

        const data = pubSnap.data();
        if (!data || data.token !== token) {
          setValid(false);
          return;
        }

        setValid(true);

        // 2) fetch qr title
        const qrRef = doc(db, "qrcodes", String(id));
        const qrSnap = await getDoc(qrRef);
        if (qrSnap.exists()) {
          setQrTitle((qrSnap.data() as any).title || "Untitled QR");
        }

        // 3) fetch scans for this qr
        const q = query(
          collection(db, "scans"),
          where("qrId", "==", String(id)),
          orderBy("timestamp", "desc")
        );
        const snap = await getDocs(q);

        const records: ScanRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setScans(records);
        setTotalScans(records.length);

        const map = new Map<string, number>();
        records.forEach((rec) => {
          const info = rec.ipInfo || {};
          const city = info.city || "Unknown city";
          const region = info.region || "";
          const country = info.country || "Unknown country";
          const key = `${city}${region ? ", " + region : ""}${
            country ? ", " + country : ""
          }`;
          map.set(key, (map.get(key) || 0) + 1);
        });

        setLocationStats(
          Array.from(map.entries())
            .map(([key, count]) => ({ key, count }))
            .sort((a, b) => b.count - a.count)
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id, token]);

  return (
    <>
      <Head>
        <title>QR Scan Analytics</title>
      </Head>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-2xl shadow-lg max-w-3xl w-full p-6 md:p-8">
          {!valid && !loading && (
            <p className="text-center text-sm text-red-500">
              This analytics link is invalid or expired.
            </p>
          )}

          {loading && (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-sm text-gray-500">Loading analytics…</p>
            </div>
          )}

          {valid && !loading && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">
                  QR Scan Analytics
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {qrTitle ? `For: ${qrTitle}` : "Shared analytics"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Total Scans</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {totalScans}
                  </p>
                </div>
                <div className="border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Unique Locations</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {locationStats.length}
                  </p>
                </div>
              </div>

              <h2 className="text-sm font-semibold text-gray-800 mb-2">
                Scans by location
              </h2>
              <div className="border rounded-xl max-h-56 overflow-y-auto mb-6">
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
                      <tr key={loc.key}>
                        <td className="px-4 py-2 text-gray-800">{loc.key}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">
                          {loc.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="text-sm font-semibold text-gray-800 mb-2">
                Recent scans
              </h2>
              <div className="border rounded-xl max-h-56 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] text-gray-500 uppercase">
                        Time
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] text-gray-500 uppercase">
                        IP
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] text-gray-500 uppercase">
                        Location
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scans.map((rec) => {
                      const info = rec.ipInfo || {};
                      const city = info.city || "Unknown city";
                      const region = info.region || "";
                      const country = info.country || "Unknown country";
                      const loc = `${city}${region ? ", " + region : ""}${
                        country ? ", " + country : ""
                      }`;
                      return (
                        <tr key={rec.id}>
                          <td className="px-3 py-2">
                            {rec.timestamp
                              ? new Date(rec.timestamp).toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            {info.ip || "—"}
                          </td>
                          <td className="px-3 py-2">{loc}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
