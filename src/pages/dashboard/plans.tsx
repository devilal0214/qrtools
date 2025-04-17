import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { collection, query, where, getDocs, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface Subscription {
  id: string;
  planId: string;
  userId: string;
  status: string;
  createdAt: string;
  endDate?: string;
}

export default function MyPlans() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    fetchSubscriptions();
  }, [user]);

  const fetchSubscriptions = async () => {
    try {
      const q = query(
        collection(db, 'subscriptions'),
        where('userId', '==', user.uid),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      const subsData = await Promise.all(snapshot.docs.map(async (doc) => {
        const sub = doc.data();
        
        // Get plan details
        const planRef = firestoreDoc(db, 'plans', sub.planId);
        const planDoc = await getDoc(planRef);
        const planData = planDoc.data();
        
        // Get QR code count
        const qrQuery = query(
          collection(db, 'qrcodes'),
          where('userId', '==', user.uid),
          where('planId', '==', sub.planId)
        );
        const qrSnapshot = await getDocs(qrQuery);
        
        return {
          id: doc.id,
          ...sub,
          plan: planData,
          qrCodesUsed: qrSnapshot.size,
          qrCodesRemaining: planData.qrLimit - qrSnapshot.size
        };
      }));
      
      setSubscriptions(subsData);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Plans</h1>
          <Link
            href="/pricing"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Upgrade Plan
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-6 animate-pulse">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-40 bg-white rounded-xl"></div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="bg-white rounded-xl p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{sub.plan.name}</h3>
                    <p className="text-sm text-gray-500">
                      Expires: {new Date(sub.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {sub.qrCodesUsed} / {sub.plan.qrLimit}
                    </div>
                    <p className="text-sm text-gray-500">QR Codes Used</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(sub.qrCodesUsed / sub.plan.qrLimit) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {sub.qrCodesRemaining} QR codes remaining
                  </p>
                </div>

                {/* Features */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {sub.plan.features.map((feature) => (
                    <div key={feature.key} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {subscriptions.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl">
                <p className="text-gray-500">No active plans</p>
                <Link
                  href="/pricing"
                  className="text-blue-600 hover:text-blue-700 mt-2 inline-block"
                >
                  View Available Plans →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const fetchSubscriptionData = async (userId: string) => {
  try {
    const subsSnapshot = await getDocs(collection(db, 'subscriptions'));
    const subscriptions = subsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Subscription[];

    for (const sub of subscriptions) {
      const planRef = firestoreDoc(db, 'plans', sub.planId);
      const planDoc = await getDoc(planRef);
      const planData = planDoc.data();
      // ...rest of the function
    }
  } catch (error) {
    console.error('Error fetching subscription data:', error);
  }
};
