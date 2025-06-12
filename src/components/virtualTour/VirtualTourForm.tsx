import { useState } from 'react';
import { uploadFile } from '@/utils/fileUpload';
import { VirtualTourProject } from '@/types/virtualTour';

interface Props {
  onSubmit: (data: Partial<VirtualTourProject>) => Promise<void>;
  initialData?: Partial<VirtualTourProject>;
  isLoading?: boolean;
}

export default function VirtualTourForm({ onSubmit, initialData, isLoading }: Props) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [thumbnail, setThumbnail] = useState(initialData?.thumbnail || '');
  const [uploading, setUploading] = useState(false);

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const url = await uploadFile(file, {
        folder: 'virtual-tours/thumbnails',
        maxSize: 2 * 1024 * 1024 // 2MB
      });
      setThumbnail(url);
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !thumbnail) return;

    await onSubmit({
      title,
      description,
      thumbnail,
      scenes: [],
      startingSceneId: ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Thumbnail</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleThumbnailUpload}
          className="mt-1"
        />
        {thumbnail && (
          <img
            src={thumbnail}
            alt="Tour thumbnail"
            className="mt-2 h-32 w-32 object-cover rounded-lg"
          />
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || uploading || !title || !thumbnail}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Creating...' : 'Create Virtual Tour'}
      </button>
    </form>
  );
}
