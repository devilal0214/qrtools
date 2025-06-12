import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VirtualTourProject } from '@/types/virtualTour';
import TourPreview from '@/components/virtualTour/TourPreview';

export default function TourPreviewPage() {
  const router = useRouter();
  const { id } = router.query;
  const [tour, setTour] = useState<VirtualTourProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTour = async () => {
      if (!id) return;
      
      try {
        const tourDoc = await getDoc(doc(db, 'virtualTours', id as string));
        if (tourDoc.exists()) {
          setTour({ id: tourDoc.id, ...tourDoc.data() } as VirtualTourProject);
        }
      } catch (error) {
        console.error('Error fetching tour:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tour Not Found</h1>
          <button
            onClick={() => router.push('/virtual-tours')}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Tours
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <TourPreview tour={tour} />
    </div>
  );
}
