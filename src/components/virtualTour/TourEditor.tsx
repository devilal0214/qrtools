import { useState } from 'react';
import { VirtualTour, Scene } from '@/types/virtualTour';
import SceneViewer from './SceneViewer';
import FileUploadBox from '@/components/FileUploadBox';
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
      const updatedTour = {
        ...tour,
        scenes: tour.scenes.map(scene => 
          scene.id === updatedScene.id ? updatedScene : scene
        )
      };

      await onSave(updatedTour);
      setCurrentScene(updatedScene);
    } catch (error) {
      console.error('Error updating scene:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r p-4">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Scenes</h2>
          <div className="space-y-2">
            {tour.scenes.map(scene => (
              <div
                key={scene.id}
                className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  scene.id === currentScene.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => setCurrentScene(scene)}
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
            ))}
          </div>
          <div className="pt-4 border-t">
            <FileUploadBox
              onFileSelect={handleSceneUpload}
              accept="image/*"
              label="Upload New Scene"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 p-4">
        <SceneViewer
          scene={currentScene}
          onSceneUpdate={handleSceneUpdate}
          saving={saving}
          isEditing={true}
          availableScenes={tour.scenes}
        />
      </div>
    </div>
  );
}