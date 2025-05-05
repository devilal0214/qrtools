import { Scene } from '@/types/virtualTour';
import FileUploadBox from '@/components/FileUploadBox';

interface Props {
  scenes: Scene[];
  currentSceneId: string;
  onSceneSelect: (scene: Scene) => void;
  onSceneUpload: (file: File) => Promise<void>;
}

export default function SceneList({ scenes, currentSceneId, onSceneSelect, onSceneUpload }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Scenes</h2>
      
      <div className="space-y-2">
        {scenes.map(scene => (
          <button
            key={scene.id}
            onClick={() => onSceneSelect(scene)}
            className={`w-full p-2 text-left rounded-lg transition-colors ${
              scene.id === currentSceneId
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-gray-50'
            }`}
          >
            {scene.title}
          </button>
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
