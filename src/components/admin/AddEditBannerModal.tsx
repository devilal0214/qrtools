import { useState, useEffect } from 'react';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Banner } from '@/types/banner';
import { uploadFile } from '@/utils/fileUpload';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  banner?: Banner | null;
  onSave: () => void;
}

export default function AddEditBannerModal({ isOpen, onClose, banner, onSave }: Props) {
  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '',
    link: '',
    pages: [] as string[],
    width: 1920,
    height: 400,
    isActive: true,
    displayOrder: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Available pages for banner display
  const availablePages = [
    '/',
    '/units',
    '/currency',
    '/timezone',
    '/virtual-tour'
  ];

  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title || '',
        imageUrl: banner.imageUrl,
        link: banner.link || '',
        pages: banner.pages,
        width: banner.width,
        height: banner.height,
        isActive: banner.isActive,
        displayOrder: banner.displayOrder
      });
    }
  }, [banner]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const imageUrl = await uploadFile(file, {
        folder: 'banners',
        maxSize: 5 * 1024 * 1024, // 5MB limit
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif']
      });
      setFormData(prev => ({ ...prev, imageUrl }));
    } catch (error) {
      setError('Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.imageUrl) {
        throw new Error('Banner image is required');
      }

      if (banner) {
        // Update existing banner
        await setDoc(doc(db, 'banners', banner.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new banner
        await addDoc(collection(db, 'banners'), {
          ...formData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      onSave();
      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">
          {banner ? 'Edit Banner' : 'Add New Banner'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Banner Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="mt-1 block w-full"
              />
              {formData.imageUrl && (
                <img 
                  src={formData.imageUrl} 
                  alt="Banner preview" 
                  className="mt-2 h-32 object-cover rounded-lg"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Link (Optional)</label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="https://"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Display Pages</label>
              <div className="mt-2 space-y-2">
                {availablePages.map(page => (
                  <label key={page} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.pages.includes(page)}
                      onChange={(e) => {
                        const pages = e.target.checked
                          ? [...formData.pages, page]
                          : formData.pages.filter(p => p !== page);
                        setFormData({ ...formData, pages });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    {page || 'Home'}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Width (px)</label>
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData({ ...formData, width: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Height (px)</label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Display Order</label>
              <input
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : banner ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
