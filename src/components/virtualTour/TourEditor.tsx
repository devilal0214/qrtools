import { useState } from 'react';
import { VirtualTour, Scene } from '@/types/virtualTour';
import SceneViewer from './SceneViewer';
import SceneList from './SceneList';
import { uploadFile } from '@/utils/fileUpload';

interface Props {
  tour: VirtualTour;
  onSave: (tour: VirtualTour) => Promise<void>;
}

export default function TourEditor({ tour, onSave }: Props) {
  const [currentScene, setCurrentScene] = useState<Scene>(
    tour.scenes.find(scene => scene.id === tour.startingSceneId) || tour.scenes[0]
  );
  const [saving, setSaving] = useState(false);

  const handleSceneUpload = async (file: File) => {
    try {
      const url = await uploadFile(file, {
        folder: 'virtual-tours/scenes',
        maxSize: 10 * 1024 * 1024 // 10MB
      });

      const newScene: Scene = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name.split('.')[0],
        imageUrl: url,
        hotspots: []
      };

      const updatedTour = {
        ...tour,
        scenes: [...tour.scenes, newScene],
        startingSceneId: tour.startingSceneId || newScene.id
      };

      await onSave(updatedTour);
      setCurrentScene(newScene);
    } catch (error) {
      console.error('Error uploading scene:', error);
    }
  };

  const handleSceneUpdate = async (updatedScene: Scene) => {
    try {
      setSaving(true);
      console.log('Handling scene update:', updatedScene);

      const updatedTour = {
        ...tour,
        scenes: tour.scenes.map(scene => 
          scene.id === updatedScene.id ? updatedScene : scene
        )
      };

      // Ensure onSave is available
      if (typeof onSave !== 'function') {
        throw new Error('Tour save handler not available');
      }

      await onSave(updatedTour);
      setCurrentScene(updatedScene);
      console.log('Scene updated successfully');
    } catch (error) {
      console.error('Error updating scene:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r p-4">
        <SceneList
          scenes={tour.scenes}
          currentSceneId={currentScene.id}
          onSceneSelect={setCurrentScene}
          onSceneUpload={handleSceneUpload}
        />
      </div>
      
      <div className="flex-1">
        <SceneViewer
          scene={currentScene}
          availableScenes={tour.scenes.filter(s => s.id !== currentScene.id)}
          onSceneUpdate={handleSceneUpdate}
          isEditing={true}
          key={currentScene.id} // Add key to force re-render on scene change
        />
      </div>

      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}
