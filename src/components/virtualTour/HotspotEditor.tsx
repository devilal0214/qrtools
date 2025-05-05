import { useState } from 'react';
import { Hotspot, Scene } from '@/types/virtualTour';

interface Props {
  hotspot: Hotspot;
  sceneId: string;
  availableScenes: Scene[];
  onUpdate: (hotspot: Hotspot) => void;
  onClose: () => void;
}

export default function HotspotEditor({ hotspot, sceneId, availableScenes, onUpdate, onClose }: Props) {
  const [formData, setFormData] = useState(hotspot);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onUpdate(formData);
      onClose();
    } catch (error) {
      console.error('Error updating hotspot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Edit Hotspot</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'info' | 'scene' })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              <option value="info">Information</option>
              <option value="scene">Scene Navigation</option>
            </select>
          </div>

          {formData.type === 'scene' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Scene</label>
              <select
                value={formData.targetSceneId}
                onChange={(e) => setFormData({ ...formData, targetSceneId: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              >
                <option value="">Select Scene</option>
                {availableScenes
                  .filter(scene => scene.id !== sceneId)
                  .map(scene => (
                    <option key={scene.id} value={scene.id}>{scene.title}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
