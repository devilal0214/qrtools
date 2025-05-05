import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/DashboardLayout';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { VirtualTourProject } from '@/types/virtualTour';
import CreateTourModal from '@/components/virtualTour/CreateTourModal';
import AuthGuard from '@/components/AuthGuard';

export default function VirtualTours() {
  const [tours, setTours] = useState<VirtualTourProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchTours();
  }, [user]);

  const fetchTours = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'virtualTours'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const tourData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VirtualTourProject[];
      setTours(tourData);
    } catch (error) {
      console.error('Error fetching tours:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Virtual Tours</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create New Tour
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="w-full h-48 bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : tours.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tours.map((tour) => (
                <div
                  key={tour.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <img
                    src={tour.thumbnail || '/placeholder-tour.jpg'}
                    alt={tour.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{tour.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {tour.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (tour.status || 'draft') === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {tour.status || 'Draft'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/virtual-tour/${tour.id}`)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/virtual-tours/edit/${tour.id}`)}
                          className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl">
              <h3 className="text-lg font-medium text-gray-900">No virtual tours yet</h3>
              <p className="mt-2 text-gray-500">Create your first virtual tour to get started.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Tour
              </button>
            </div>
          )}
        </div>

        <CreateTourModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(tourId) => router.push(`/dashboard/virtual-tours/edit/${tourId}`)}
        />
      </DashboardLayout>
    </AuthGuard>
  );
}
