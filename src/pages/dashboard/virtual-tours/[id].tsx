import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VirtualTour } from '@/types/virtualTour';
import TourEditor from '@/components/virtualTour/TourEditor';

export default function EditTourPage() {
  const router = useRouter();
  const { id } = router.query;
  const [tour, setTour] = useState<VirtualTour | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTour = async () => {
      if (!id) return;
      
      try {
        const tourDoc = await getDoc(doc(db, 'virtualTours', id as string));
        if (tourDoc.exists()) {
          setTour({ id: tourDoc.id, ...tourDoc.data() } as VirtualTour);
        }
      } catch (error) {
        console.error('Error fetching tour:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [id]);

  const handleSave = async (updatedTour: VirtualTour) => {
    try {
      console.log('Saving tour update:', updatedTour);
      
      // Remove id before updating Firestore
      const { id: tourId, ...tourData } = updatedTour;
      
      // Update timestamp
      tourData.updatedAt = new Date().toISOString();

      // Update Firestore
      await updateDoc(doc(db, 'virtualTours', id as string), tourData);
      
      // Update local state
      setTour(updatedTour);
      console.log('Tour updated successfully');
    } catch (error) {
      console.error('Error updating tour:', error);
      throw error; // Re-throw to handle in the UI
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!tour) {
    return <div>Tour not found</div>;
  }

  return <TourEditor tour={tour} onSave={handleSave} />;
}
