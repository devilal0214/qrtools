import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';

export function RecentActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        // Fetch recent scans
        const scansQuery = query(
          collection(db, 'scans'),
          orderBy('timestamp', 'desc'),
          limit(5)
        );
        
        const scanSnapshot = await getDocs(scansQuery);
        const scanActivities = await Promise.all(scanSnapshot.docs.map(async (scanDoc) => {
          const scanData = scanDoc.data();
          // Get QR code details using proper doc reference
          const qrDocRef = doc(db, 'qrcodes', scanData.qrId);
          const qrSnap = await getDoc(qrDocRef);
          const qrData = qrSnap.data();
          
          return {
            id: scanDoc.id,
            type: 'scan',
            description: `QR code "${qrData?.title || scanData.qrId}" was scanned`,
            createdAt: scanData.timestamp,
            metadata: {
              qrTitle: qrData?.title,
              qrId: scanData.qrId,
              userAgent: scanData.userAgent
            }
          };
        }));

        // Fetch recent subscriptions
        const subsQuery = query(
          collection(db, 'subscriptions'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        
        const subsSnapshot = await getDocs(subsQuery);
        const subActivities = await Promise.all(subsSnapshot.docs.map(async (docSnapshot) => {
          const subData = docSnapshot.data();
          // Fix: Use doc() correctly by passing reference path parts separately
          const userDocRef = doc(db, 'users', subData.userId);
          const userDoc = await getDoc(userDocRef);
          const userData = userDoc.data();
          
          return {
            id: docSnapshot.id,
            type: 'subscription',
            description: `${userData?.email || 'A user'} subscribed to ${subData.plan}`,
            createdAt: subData.createdAt,
            metadata: {
              plan: subData.plan,
              userId: subData.userId,
              userEmail: userData?.email
            }
          };
        }));

        // Combine and sort activities
        const allActivities = [...scanActivities, ...subActivities]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);

        setActivities(allActivities);
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-1/4 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              {getActivityIcon(activity.type)}
            </div>
            <div>
              <p className="text-sm text-gray-600">{activity.description}</p>
              <p className="text-xs text-gray-400 mt-1">
                {formatTimestamp(activity.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getActivityIcon(type: string) {
  // Add icons based on activity type
  return <span>•</span>;
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}
