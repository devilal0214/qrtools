import { useState } from 'react';
import { uploadFile } from '@/utils/fileUpload';
import { Scene } from '@/types/virtualTour';
import toast from 'react-hot-toast';

interface Props {
  onSceneAdd: (scene: Scene) => void;
}

export default function SceneUploader({ onSceneAdd }: Props) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size before upload
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      setLoading(true);
      const imageUrl = await uploadFile(file, {
        folder: 'virtual-tours/scenes',
        allowedTypes: ['image/jpeg', 'image/png'],
        maxSize: MAX_FILE_SIZE
      });

      const newScene: Scene = {
        id: Math.random().toString(36).substr(2, 9),
        title: title || 'Untitled Scene',
        imageUrl,
        type: 'panorama',
        position: { x: 0, y: 0 },
        rotation: 0,
        hotspots: []
      };

      onSceneAdd(newScene);
      setTitle('');
      toast.success('Scene uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading scene:', error);
      toast.error(error.message || 'Failed to upload scene');
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Scene Title"
        className="w-full px-3 py-2 border rounded-lg"
      />
      <label className="block">
        <span className="sr-only">Choose 360° image</span>
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
            id="scene-upload"
          />
          <label
            htmlFor="scene-upload"
            className={`w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer
              ${loading ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
          >
            {loading ? 'Uploading...' : 'Upload 360° Image'}
          </label>
        </div>
      </label>
    </div>
  );
}
