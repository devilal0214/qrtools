import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Subscription {
  id: string;
  planId: string;
  userId: string;
  status: string;
}

export default function AdminEmailPage() {
  return (
    <AdminLayout>
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Email Management</h1>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-yellow-800">
            Email functionality is temporarily disabled for maintenance.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}

const fetchPlans = async (subscription: Subscription) => {
  try {
    const planRef = doc(db, 'plans', subscription.planId);
    const planDoc = await getDoc(planRef);
    const planData = planDoc.data();
    // ...rest of function
  } catch (error) {
    console.error('Error fetching plans:', error);
  }
};

// When calling fetchPlans, pass the subscription object
const handleSubscriptionData = (subscription: Subscription) => {
  fetchPlans(subscription);
};
