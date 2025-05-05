import { Scene } from '@/types/virtualTour';
import FileUploadBox from '@/components/FileUploadBox';

interface Props {
  scenes: Scene[];
  currentSceneId?: string;
  onSceneSelect: (scene: Scene) => void;
  onSceneDelete?: (sceneId: string) => Promise<void>;
  onSceneUpload?: (file: File) => Promise<void>; // Made optional
}

export default function SceneList({ 
  scenes, 
  currentSceneId, 
  onSceneSelect, 
  onSceneDelete,
  onSceneUpload 
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Scenes</h2>
      
      <div className="space-y-2">
        {scenes.map(scene => (
          <div
            key={scene.id}
            className={`flex items-center justify-between p-3 rounded-lg ${
              scene.id === currentSceneId ? 'bg-blue-50' : 'bg-gray-50'
            }`}
          >
            <button
              onClick={() => onSceneSelect(scene)}
              className={`w-full text-left transition-colors ${
                scene.id === currentSceneId
                  ? 'text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              {scene.title}
            </button>
            {onSceneDelete && (
              <button
                onClick={() => onSceneDelete(scene.id)}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="pt-4 border-t">
        <FileUploadBox
          onFileSelect={onSceneUpload}
          accept="image/*"
          label="Upload New Scene"
        />
      </div>
    </div>
  );
}
