import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import AuthGuard from '@/components/AuthGuard';
import Head from 'next/head';
import { nanoid } from 'nanoid';
import Link from 'next/link';

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
  device?: { type?: string | null; vendor?: string | null; model?: string | null };
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

export default function QRAnalyticsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<any>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [locationStats, setLocationStats] = useState<LocationStat[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStat[]>([]);
  const [browserStats, setBrowserStats] = useState<BrowserStat[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationStat | null>(null);
  const [publicLink, setPublicLink] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!id || !user) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);

        // Fetch QR code details
        const qrRef = doc(db, 'qrcodes', String(id));
        const qrSnap = await getDoc(qrRef);

        if (!qrSnap.exists()) {
          router.push('/dashboard/active');
          return;
        }

        const qrData = qrSnap.data();

        // Verify ownership
        if (qrData.userId !== user.uid) {
          router.push('/dashboard/active');
          return;
        }

        setQrCode({ id: qrSnap.id, ...qrData });

        // Fetch scans
        const scansQuery = query(
          collection(db, 'scans'),
          where('qrId', '==', String(id)),
          orderBy('timestamp', 'desc')
        );

        const scansSnap = await getDocs(scansQuery);
        const scansData: ScanRecord[] = scansSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as any
        }));

        setScans(scansData);

        // Process location stats
        const locationMap = new Map<string, LocationStat>();
        scansData.forEach(scan => {
          const ipInfo = scan.ipInfo || {};
          const city = ipInfo.city || 'Unknown city';
          const region = ipInfo.region || '';
          const country = ipInfo.country || 'Unknown country';
          const key = `${city}${region ? ', ' + region : ''}${country ? ', ' + country : ''}`;

          if (!locationMap.has(key)) {
            locationMap.set(key, {
              key,
              city: ipInfo.city,
              region: ipInfo.region,
              country: ipInfo.country,
              count: 0
            });
          }
          locationMap.get(key)!.count += 1;
        });

        const locations = Array.from(locationMap.values()).sort((a, b) => b.count - a.count);
        setLocationStats(locations);
        setSelectedLocation(locations[0] || null);

        // Process device stats
        const deviceMap = new Map<string, number>();
        scansData.forEach(scan => {
          const deviceType = scan.device?.type || 'Unknown';
          deviceMap.set(deviceType, (deviceMap.get(deviceType) || 0) + 1);
        });
        setDeviceStats(
          Array.from(deviceMap.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
        );

        // Process browser stats
        const browserMap = new Map<string, number>();
        scansData.forEach(scan => {
          const browserName = scan.browser?.name || 'Unknown';
          browserMap.set(browserName, (browserMap.get(browserName) || 0) + 1);
        });
        setBrowserStats(
          Array.from(browserMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        );

        // Check if public link already exists
        const publicRef = doc(db, 'publicAnalytics', String(id));
        const publicSnap = await getDoc(publicRef);
        if (publicSnap.exists()) {
          const pubData = publicSnap.data();
          const baseUrl = window.location.origin;
          setPublicLink(`${baseUrl}/public/analytics/${id}?token=${pubData.token}`);
        }

      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [id, user, router]);

  const handleGeneratePublicLink = async () => {
    if (!id) return;

    try {
      setGeneratingLink(true);
      const token = nanoid(16);
      const publicRef = doc(db, 'publicAnalytics', String(id));
      
      await setDoc(publicRef, {
        qrId: String(id),
        token,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid
      });

      const baseUrl = window.location.origin;
      const link = `${baseUrl}/public/analytics/${id}?token=${token}`;
      setPublicLink(link);
      setShowShareModal(true);
    } catch (error) {
      console.error('Error generating public link:', error);
      alert('Failed to generate public link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <AuthGuard>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  if (!qrCode) {
    return (
      <AuthGuard>
        <DashboardLayout>
          <div className="text-center py-12">
            <p className="text-gray-600">QR Code not found</p>
          </div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Analytics - {qrCode.title || 'QR Code'}</title>
        </Head>

        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <Link href="/dashboard/active" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
                ← Back to QR Codes
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Analytics: {qrCode.title || 'Untitled QR Code'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{qrCode.content}</p>
            </div>
            <button
              onClick={publicLink ? () => setShowShareModal(true) : handleGeneratePublicLink}
              disabled={generatingLink}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {generatingLink ? 'Generating...' : publicLink ? 'View Share Link' : 'Generate Share Link'}
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-sm text-gray-500">Total Scans</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{scans.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-sm text-gray-500">Unique Locations</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{locationStats.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-sm text-gray-500">Most Active Location</p>
              <p className="text-lg font-semibold text-gray-900 mt-2 truncate">
                {locationStats[0]?.city || '—'}
              </p>
              {locationStats[0] && (
                <p className="text-xs text-gray-500">{locationStats[0].count} scans</p>
              )}
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 ${
                qrCode.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {qrCode.isActive ? 'Active' : 'Paused'}
              </span>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scans by Location */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Scans by Location</h2>
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Scans</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {locationStats.map((loc) => (
                      <tr 
                        key={loc.key}
                        onClick={() => setSelectedLocation(loc)}
                        className={`cursor-pointer hover:bg-blue-50 ${
                          selectedLocation?.key === loc.key ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">{loc.key}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{loc.count}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">
                          {((loc.count / scans.length) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scans by Device */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Scans by Device</h2>
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Scans</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deviceStats.map((device) => (
                      <tr key={device.type}>
                        <td className="px-4 py-3 text-sm text-gray-900 capitalize">{device.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{device.count}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">
                          {((device.count / scans.length) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scans by Browser */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Scans by Browser</h2>
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Browser</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Scans</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {browserStats.map((browser) => (
                      <tr key={browser.name}>
                        <td className="px-4 py-3 text-sm text-gray-900">{browser.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{browser.count}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">
                          {((browser.count / scans.length) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Scans {selectedLocation && (
                  <span className="text-sm font-normal text-gray-500">
                    in {selectedLocation.city}
                  </span>
                )}
              </h2>
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Browser</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {scans
                      .filter(scan => {
                        if (!selectedLocation) return true;
                        const ipInfo = scan.ipInfo || {};
                        const city = ipInfo.city || 'Unknown city';
                        const region = ipInfo.region || '';
                        const country = ipInfo.country || 'Unknown country';
                        const key = `${city}${region ? ', ' + region : ''}${country ? ', ' + country : ''}`;
                        return key === selectedLocation.key;
                      })
                      .slice(0, 50)
                      .map((scan) => (
                        <tr key={scan.id}>
                          <td className="px-4 py-3 text-gray-700">
                            {scan.timestamp ? new Date(scan.timestamp).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 capitalize">
                            {scan.device?.type || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {scan.browser?.name || '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Share Modal */}
        {showShareModal && publicLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShareModal(false)}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Share Analytics</h3>
                <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Share this link to allow anyone to view basic analytics for this QR code (location and total scans only).
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 break-all text-sm font-mono">
                {publicLink}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </AuthGuard>
  );
}
