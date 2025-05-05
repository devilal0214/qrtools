import { useState, useEffect } from 'react';
import { Scene, Hotspot } from '@/types/virtualTour';
import { uploadFile } from '@/utils/fileUpload';
import FileUploadBox from '@/components/FileUploadBox';
import * as THREE from 'three';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Hotspot>) => void;
  availableScenes?: Scene[];
  position?: THREE.Vector3;
  currentHotspot?: Hotspot | null; // Changed from editingHotspot to currentHotspot
}

export default function HotspotModal({ 
  isOpen, 
  onClose, 
  onSave, 
  availableScenes = [], 
  position,
  currentHotspot 
}: Props) {
  const [type, setType] = useState<'info' | 'navigation'>(currentHotspot?.type || 'info');
  const [title, setTitle] = useState(currentHotspot?.title || '');
  const [description, setDescription] = useState(currentHotspot?.description || '');
  const [targetSceneId, setTargetSceneId] = useState(currentHotspot?.targetSceneId || '');
  const [iconUrl, setIconUrl] = useState(currentHotspot?.iconUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [iconSize, setIconSize] = useState({
    width: currentHotspot?.iconSize?.width || 20,
    height: currentHotspot?.iconSize?.height || 20
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && currentHotspot) {
      setType(currentHotspot.type);
      setTitle(currentHotspot.title);
      setDescription(currentHotspot.description || '');
      setTargetSceneId(currentHotspot.targetSceneId || '');
      setIconUrl(currentHotspot.iconUrl || '');
      // Set icon size from current hotspot or use defaults
      setIconSize({
        width: currentHotspot.iconSize?.width || 20,
        height: currentHotspot.iconSize?.height || 20
      });
    } else {
      // Reset to defaults when adding new hotspot
      setType('info');
      setTitle('');
      setDescription('');
      setTargetSceneId('');
      setIconUrl('');
      setIconSize({ width: 20, height: 20 });
    }
  }, [isOpen, currentHotspot]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting form data:', { type, title, description, targetSceneId, iconUrl, iconSize });

    const hotspotData: Partial<Hotspot> = {
      type,
      title,
      description: type === 'info' ? description : null,
      targetSceneId: type === 'navigation' ? targetSceneId : null,
      iconUrl,
      iconSize: iconUrl ? iconSize : undefined
    };

    onSave(hotspotData);
  };

  const resetForm = () => {
    setType('info');
    setTitle('');
    setDescription('');
    setTargetSceneId('');
    setIconUrl('');
  };

  if (!isOpen) return null;

  const renderIconSection = () => (
    <div className="space-y-4 max-h-[300px] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Custom Icon (optional)
        </label>
        <FileUploadBox
          onFileSelect={async (file) => {
            try {
              setIsUploading(true);
              const url = await uploadFile(file, {
                folder: 'virtual-tours/hotspots',
                allowedTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
                maxSize: 2 * 1024 * 1024
              });
              setIconUrl(url);
            } catch (error) {
              console.error('Error uploading icon:', error);
            } finally {
              setIsUploading(false);
            }
          }}
          accept="image/png,image/jpeg,image/svg+xml"
          fileUrl={iconUrl}
        />
      </div>

      {iconUrl && (
        <div className="border rounded-lg p-3 bg-gray-50 space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Icon Size</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  value={iconSize.width}
                  onChange={(e) => setIconSize(prev => ({
                    ...prev,
                    width: Math.max(10, Math.min(100, Number(e.target.value)))
                  }))}
                  min="10"
                  max="100"
                  className="flex-1"
                />
                <input
                  type="number"
                  value={iconSize.width}
                  onChange={(e) => setIconSize(prev => ({
                    ...prev,
                    width: Math.max(10, Math.min(100, Number(e.target.value)))
                  }))}
                  min="10"
                  max="100"
                  className="w-16 px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Height</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  value={iconSize.height}
                  onChange={(e) => setIconSize(prev => ({
                    ...prev,
                    height: Math.max(10, Math.min(100, Number(e.target.value)))
                  }))}
                  min="10"
                  max="100"
                  className="flex-1"
                />
                <input
                  type="number"
                  value={iconSize.height}
                  onChange={(e) => setIconSize(prev => ({
                    ...prev,
                    height: Math.max(10, Math.min(100, Number(e.target.value)))
                  }))}
                  min="10"
                  max="100"
                  className="w-16 px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview with actual size */}
          <div className="mt-4">
            <label className="block text-xs text-gray-500 mb-2">Preview</label>
            <div className="border rounded p-4 bg-white flex items-center justify-center">
              <div style={{ 
                width: `${iconSize.width}px`, 
                height: `${iconSize.height}px`,
                backgroundImage: `url(${iconUrl})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Hotspot</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'info' | 'navigation')}
              className="mt-1 w-full px-3 py-2 border rounded-lg"
            >
              <option value="info">Information</option>
              <option value="navigation">Navigation</option>
            </select>
          </div>

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

          {type === 'info' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  required
                />
              </div>
              {renderIconSection()} {/* Add icon section for info type */}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Target Scene</label>
                <select
                  value={targetSceneId}
                  onChange={(e) => setTargetSceneId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select scene</option>
                  {availableScenes.map(scene => (
                    <option key={scene.id} value={scene.id}>
                      {scene.title}
                    </option>
                  ))}
                </select>
              </div>
              {renderIconSection()} {/* Add icon section for navigation type */}
            </>
          )}

          <div className="sticky bottom-0 bg-white pt-4 mt-4 border-t">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : currentHotspot ? 'Update' : 'Add'} Hotspot
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
