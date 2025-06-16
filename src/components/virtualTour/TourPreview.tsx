import { useEffect, useState, useRef } from 'react';
import { VirtualTourProject, Scene, Hotspot } from '@/types/virtualTour';
import SceneViewer from './SceneViewer';
import { Dialog } from '@headlessui/react';
import * as TWEEN from '@tweenjs/tween.js';

interface Props {
  tour: VirtualTourProject;
}

export default function TourPreview({ tour }: Props) {
  const [currentScene, setCurrentScene] = useState<Scene>(tour.scenes[0]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Set up TWEEN animation loop
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      TWEEN.update();
    };
    animate();
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  // Handle scene changes
  useEffect(() => {
    if (!currentScene) {
      setCurrentScene(tour.scenes[0]);
    }
  }, [tour.scenes, currentScene]);
  const handleHotspotClick = async (hotspot: Hotspot) => {    if (transitioning) return;
    
    console.log('Hotspot clicked:', hotspot);

    if (hotspot.type === 'navigation' && hotspot.targetSceneId) {
      console.log('Navigation hotspot detected, target scene ID:', hotspot.targetSceneId);
      const targetScene = tour.scenes.find(scene => scene.id === hotspot.targetSceneId);
      console.log('Target scene found:', targetScene);
      
      // Debug alert to show navigation details
      alert(`Navigating to scene:\nID: ${hotspot.targetSceneId}\nTitle: ${targetScene?.title || 'Not found'}`);
      
      if (!targetScene) {
        console.error('Target scene not found:', hotspot.targetSceneId);
        return;
      }setTransitioning(true);
      try {
        // Set the target scene first
        setCurrentScene(targetScene);
        
        // Fade out animation
        await new Promise<void>((resolve) => {
          new TWEEN.Tween({ value: 1 })
            .to({ value: 0 }, 500)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(({ value }) => {
              if (containerRef.current) {
                containerRef.current.style.opacity = value.toString();
              }
            })
            .onComplete(() => {
              resolve();
            })
            .start();
        });

        // Short delay to ensure scene has loaded
        await new Promise(resolve => setTimeout(resolve, 100));

        // Reset opacity and fade in
        if (containerRef.current) {
          containerRef.current.style.opacity = '0';
        }
        
        await new Promise<void>((resolve) => {
          new TWEEN.Tween({ value: 0 })
            .to({ value: 1 }, 500)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(({ value }) => {
              if (containerRef.current) {
                containerRef.current.style.opacity = value.toString();
              }
            })
            .onComplete(() => resolve())
            .start();
        });
      } finally {
        setTransitioning(false);
      }
    } else if (hotspot.type === 'info' && hotspot.description) {
      setActiveHotspot(hotspot);
      setShowInfoModal(true);
    }
  };

  return (
    <div className="relative">
      <div 
        ref={containerRef}
        className="w-[864px] h-[600px] relative bg-black rounded-lg overflow-hidden shadow-xl"
      >
        {currentScene && (
          <SceneViewer
            scene={currentScene}
            onHotspotClick={handleHotspotClick}
            isEditing={false} // Explicitly set viewing mode
          />
        )}
      </div>

      <Dialog
        open={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg p-6 max-w-md w-full">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-2">
              {activeHotspot?.title}
            </Dialog.Title>
            <div className="mt-2">
              <p className="text-gray-600">{activeHotspot?.description}</p>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}