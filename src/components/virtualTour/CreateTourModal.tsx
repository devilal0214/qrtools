import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { uploadFile } from '@/utils/fileUpload';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tourId: string) => void;
}

export default function CreateTourModal({ isOpen, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);
      setError('');

      // Upload thumbnail if provided
      let thumbnailUrl = '';
      if (thumbnail) {
        thumbnailUrl = await uploadFile(thumbnail, {
          folder: 'virtual-tours/thumbnails',
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maxSize: 5 * 1024 * 1024 // 5MB
        });
      }

      // Create tour document
      const tourData = {
        title,
        description,
        thumbnail: thumbnailUrl,
        userId: user.uid,
        status: 'draft',
        scenes: [],
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'virtualTours'), tourData);
      onSuccess(docRef.id);
    } catch (error) {
      console.error('Error creating tour:', error);
      setError('Failed to create tour. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Create New Virtual Tour</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Thumbnail</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
              className="mt-1"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Tour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
