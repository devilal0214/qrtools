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
      console.log('Updating scene:', {
        id: updatedScene.id,
        imageUrl: updatedScene.imageUrl,
        hotspotsCount: updatedScene.hotspots?.length
      });

      const updatedTour = {
        ...tour,
        scenes: tour.scenes.map(scene => 
          scene.id === updatedScene.id ? updatedScene : scene
        )
      };

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

  const SceneListItem = ({ scene, isActive, onClick }: SceneListItemProps) => {
    return (
      <div
        className={`p-4 border rounded-lg mb-4 cursor-pointer hover:bg-gray-50 ${
          isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
        }`}
        onClick={onClick}
      >
        <div className="flex items-center space-x-4">
          {scene.imageUrl && (
            <div className="w-24 h-24 relative rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={scene.imageUrl}
                alt={scene.title}
                className="object-cover w-full h-full"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-grow">
            <h3 className="font-medium text-gray-900">{scene.title}</h3>
            <p className="text-sm text-gray-500">
              {scene.hotspots?.length || 0} hotspots
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r p-4">
        <SceneList
          scenes={tour.scenes}
          currentSceneId={currentScene.id}
          onSceneSelect={setCurrentScene}
          onSceneUpload={handleSceneUpload}
          SceneListItem={SceneListItem}
        />
      </div>
      <div className="flex-1 p-4">
        <SceneViewer
          scene={currentScene}
          onUpdate={handleSceneUpdate}
          saving={saving}
          isEditing={true} // Explicitly set editing mode
        />
      </div>
    </div>
  );
}