import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Head from 'next/head';
import AuthGuard from '@/components/AuthGuard';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

export default function Analytics() {
  const { user } = useAuth();
  const { canUseFeature } = usePlanFeatures();
  
  // All hooks must be called before any conditional returns
  const [stats, setStats] = useState({
    totalScans: 0,
    activeQRs: 0,
    pausedQRs: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        // Get active QR codes
        const activeQR = query(
          collection(db, 'qrcodes'),
          where('userId', '==', user.uid),
          where('isActive', '==', true)
        );
        const activeSnapshot = await getDocs(activeQR);

        // Get paused QR codes
        const pausedQR = query(
          collection(db, 'qrcodes'),
          where('userId', '==', user.uid),
          where('isActive', '==', false)
        );
        const pausedSnapshot = await getDocs(pausedQR);

        // Calculate total scans
        const totalScans = activeSnapshot.docs.reduce((sum, doc) => 
          sum + (doc.data().scans || 0), 0
        ) + pausedSnapshot.docs.reduce((sum, doc) => 
          sum + (doc.data().scans || 0), 0
        );

        setStats({
          totalScans,
          activeQRs: activeSnapshot.size,
          pausedQRs: pausedSnapshot.size
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  // Conditional rendering after all hooks
  if (!canUseFeature('analytics')) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900">Analytics Feature Not Available</h2>
          <p className="mt-2 text-gray-600">
            Analytics is only available on premium plans.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Upgrade Plan
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Analytics - Dashboard</title>
        </Head>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                  <div className="h-6 w-24 bg-gray-200 rounded mb-2"></div>
                  <div className="h-8 w-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/dashboard/active" className="block">
                <div className="bg-white rounded-xl p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Total Scans</h3>
                  <p className="text-3xl font-bold text-blue-600">{stats.totalScans}</p>
                </div>
              </Link>
              <Link href="/dashboard/active" className="block">
                <div className="bg-white rounded-xl p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Active QRs</h3>
                  <p className="text-3xl font-bold text-green-600">{stats.activeQRs}</p>
                </div>
              </Link>
              <Link href="/dashboard/paused" className="block">
                <div className="bg-white rounded-xl p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Paused QRs</h3>
                  <p className="text-3xl font-bold text-gray-600">{stats.pausedQRs}</p>
                </div>
              </Link>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
