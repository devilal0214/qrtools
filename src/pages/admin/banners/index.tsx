import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Banner } from '@/types/banner';
import AddEditBannerModal from '@/components/admin/AddEditBannerModal';
import Head from 'next/head';

export default function BannerManagement() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const q = query(collection(db, 'banners'));
      const snapshot = await getDocs(q);
      const bannerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Banner[];
      setBanners(bannerData.sort((a, b) => a.displayOrder - b.displayOrder));
    } catch (error) {
      console.error('Error fetching banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bannerId: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    
    try {
      await deleteDoc(doc(db, 'banners', bannerId));
      await fetchBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
    }
  };

  return (
    <AdminLayout>
      <Head>
        <title>Banner Management - Admin Dashboard</title>
      </Head>

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
          <button
            onClick={() => {
              setSelectedBanner(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add New Banner
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : banners.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {banners.map((banner) => (
                  <tr key={banner.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <img 
                        src={banner.imageUrl} 
                        alt={banner.title || 'Banner'} 
                        className="h-16 w-32 object-cover rounded-lg"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{banner.title || 'Untitled'}</div>
                      {banner.link && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">{banner.link}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {banner.pages.map((page) => (
                          <span 
                            key={page}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {page}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        banner.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {banner.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {banner.displayOrder}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedBanner(banner);
                          setShowAddModal(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(banner.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">No banners found. Create your first banner!</p>
          </div>
        )}
      </div>

      <AddEditBannerModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedBanner(null);
        }}
        banner={selectedBanner}
        onSave={fetchBanners}
      />
    </AdminLayout>
  );
}
