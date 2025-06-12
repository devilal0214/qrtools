import { useState } from 'react';
import { useRouter } from 'next/router';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import AuthGuard from '@/components/AuthGuard';
import VirtualTourForm from '@/components/virtualTour/VirtualTourForm';
import { VirtualTourProject } from '@/types/virtualTour';

export default function CreateVirtualTour() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const handleSubmit = async (data: Partial<VirtualTourProject>) => {
    if (!user) return;

    try {
      setLoading(true);
      const tourData = {
        ...data,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft'
      };

      const docRef = await addDoc(collection(db, 'virtualTours'), tourData);
      router.push(`/dashboard/virtual-tours/${docRef.id}`);
    } catch (error) {
      console.error('Error creating tour:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-6">Create Virtual Tour</h1>
          <VirtualTourForm onSubmit={handleSubmit} isLoading={loading} />
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
