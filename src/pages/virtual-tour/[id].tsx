import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VirtualTourProject, Hotspot } from '@/types/virtualTour';
import Head from 'next/head';
import SceneViewer from '@/components/virtualTour/SceneViewer';
import { Dialog } from '@headlessui/react';
import TWEEN from '@tweenjs/tween.js';

export default function TourView() {
  const router = useRouter();
  const { id } = router.query;
  const [tour, setTour] = useState<VirtualTourProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [error, setError] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  useEffect(() => {
    const fetchTour = async () => {
      if (!id) return;
      
      try {
        const tourDoc = await getDoc(doc(db, 'virtualTours', id as string));
        if (tourDoc.exists()) {
          setTour({ id: tourDoc.id, ...tourDoc.data() } as VirtualTourProject);
        } else {
          setError('Tour not found');
        }
      } catch (error) {
        console.error('Error fetching tour:', error);
        setError('Failed to load tour');
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [id]);

  const handleHotspotClick = (hotspot: Hotspot) => {
    if (hotspot.type === 'navigation' && hotspot.targetSceneId && tour) {
      const targetIndex = tour.scenes.findIndex(scene => scene.id === hotspot.targetSceneId);
      if (targetIndex !== -1) {
        // Add fade transition
        const fadeOut = () => {
          return new Promise<void>(resolve => {
            const opacity = { value: 1 };
            new TWEEN.Tween(opacity)
              .to({ value: 0 }, 500)
              .easing(TWEEN.Easing.Quadratic.InOut)
              .onComplete(() => {
                setCurrentSceneIndex(targetIndex);
                resolve();
              })
              .start();
          });
        };
        fadeOut();
      }
    } else if (hotspot.type === 'info' && hotspot.description) {
      // Show info in modal
      setActiveHotspot(hotspot);
      setShowInfoModal(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error || 'Tour Not Found'}
          </h1>
          <button
            onClick={() => router.push('/virtual-tour')}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Tours
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Head>
        <title>{tour.title} - Virtual Tour</title>
      </Head>

      {tour?.scenes && tour.scenes.length > 0 && (
        <>
          <SceneViewer
            scene={tour.scenes[currentSceneIndex]}
            availableScenes={tour.scenes}
            onHotspotClick={handleHotspotClick}
          />
          
          {/* Optional: Add scene navigation controls */}
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-lg p-2 flex gap-2">
            {tour.scenes.map((scene, index) => (
              <button
                key={scene.id}
                onClick={() => setCurrentSceneIndex(index)}
                className={`px-3 py-1 rounded ${
                  currentSceneIndex === index 
                    ? 'bg-white text-black' 
                    : 'text-white hover:bg-white/20'
                }`}
              >
                Scene {index + 1}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="fixed top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white">
        <h1 className="text-lg font-medium">{tour.title}</h1>
        {tour.description && (
          <p className="text-sm text-gray-300 mt-1">{tour.description}</p>
        )}
      </div>

      <Dialog
        open={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="relative bg-white rounded-lg p-6 max-w-md w-full">
            <Dialog.Title className="text-lg font-medium text-gray-900">
              {activeHotspot?.title}
            </Dialog.Title>
            
            <div className="mt-4">
              <p className="text-gray-600">{activeHotspot?.description}</p>
            </div>
            
            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close 
            </button>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
