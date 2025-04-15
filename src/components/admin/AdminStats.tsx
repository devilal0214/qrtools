import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, getDoc, doc, Timestamp } from 'firebase/firestore';

interface StatCardProps {
  title: string;
  value: string | number;
  type: string;
}

function StatCard({ title, value, type }: StatCardProps) {
  // Format the value based on type
  const formattedValue = typeof value === 'number' ? 
    value.toLocaleString() : 
    value;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold mt-2">{formattedValue}</h3>
        </div>
        {/* Add appropriate icon based on type */}
        <span className="text-blue-600">
          {getCardIcon(type)}
        </span>
      </div>
    </div>
  );
}

function getCardIcon(type: string) {
  // Add icons for different card types
  switch (type) {
    case 'users':
      return '👥';
    case 'qrcodes':
      return '📱';
    case 'scans':
      return '📊';
    case 'subscriptions':
      return '⭐';
    case 'revenue':
      return '💰';
    default:
      return null;
  }
}

export function AdminStats() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalQRCodes: 0,
    totalScans: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    currency: 'INR'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get total users (all users from users collection)
        const usersCollRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollRef);
        const totalUsers = usersSnapshot.docs.length;

        // Get total QR codes (all documents from qrcodes collection)
        const qrCodesCollRef = collection(db, 'qrcodes');
        const qrCodesSnapshot = await getDocs(qrCodesCollRef);
        const totalQRCodes = qrCodesSnapshot.docs.length;

        // Get total scans in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const scansQuery = query(
          collection(db, 'scans'),
          where('timestamp', '>=', thirtyDaysAgo.toISOString())
        );
        const scansSnapshot = await getDocs(scansQuery);
        const totalScans = scansSnapshot.size;

        // Get active subscriptions
        const now = new Date().toISOString();
        const subsQuery = query(
          collection(db, 'subscriptions'),
          where('status', '==', 'active'),
          where('endDate', '>=', now)
        );
        const subsSnapshot = await getDocs(subsQuery);
        const activeSubscriptions = subsSnapshot.size;

        // Get monthly revenue
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const transCollRef = collection(db, 'transactions');
        const transQuery = query(
          transCollRef,
          where('status', '==', 'completed'),
          where('createdAt', '>=', monthStart.toISOString())
        );
        const transSnapshot = await getDocs(transQuery);
        const monthlyRevenue = transSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          return sum + (Number(data.amount) || 0);
        }, 0);

        // Get currency from settings
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        const defaultCurrency = settingsDoc.data()?.currency || 'INR';

        console.log('Stats fetched:', {
          totalUsers,
          totalQRCodes,
          totalScans,
          activeSubscriptions,
          monthlyRevenue
        });

        setStats({
          totalUsers,
          totalQRCodes,
          totalScans,
          activeSubscriptions,
          monthlyRevenue,
          currency: defaultCurrency
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        // Add more detailed error logging
        if (error.code === 'failed-precondition') {
          console.log('Please create the required indexes for collections');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="grid grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-xl animate-pulse">
          <div className="h-4 w-24 bg-gray-200 rounded mb-3"></div>
          <div className="h-8 w-16 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Users"
        value={stats.totalUsers}
        type="users"
      />
      <StatCard
        title="Total QR Codes"
        value={stats.totalQRCodes}
        type="qrcodes"
      />
      <StatCard
        title="Total Scans (30 Days)"
        value={stats.totalScans}
        type="scans"
      />
      <StatCard
        title="Active Subscriptions"
        value={stats.activeSubscriptions}
        type="subscriptions"
      />
      <StatCard
        title="Monthly Revenue"
        value={new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: stats.currency || 'INR'
        }).format(stats.monthlyRevenue)}
        type="revenue"
      />
    </div>
  );
}
