import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import AuthGuard from '@/components/AuthGuard';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface ShortUrl {
  id: string;
  shortCode: string;
  originalUrl: string;
  title: string;
  createdAt: string;
  clicks: number;
  isActive: boolean;
}

export default function ShortUrls() {
  const { user } = useAuth();
  const [urls, setUrls] = useState<ShortUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 8;

  useEffect(() => {
    fetchUrls();
  }, [user]);

  const fetchUrls = async () => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'shorturls'),
        where('userId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      const fetchedUrls = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ShortUrl[];
      
      setUrls(fetchedUrls.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Error fetching short URLs:', error);
      toast.error('Failed to load short URLs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (urlId: string) => {
    if (!confirm('Are you sure you want to delete this URL?')) return;
    
    try {
      await deleteDoc(doc(db, 'shorturls', urlId));
      setUrls(urls.filter(url => url.id !== urlId));
      toast.success('URL deleted successfully');
    } catch (error) {
      console.error('Error deleting URL:', error);
      toast.error('Failed to delete URL');
    }
  };

  const toggleStatus = async (url: ShortUrl) => {
    try {
      await updateDoc(doc(db, 'shorturls', url.id), {
        isActive: !url.isActive
      });
      
      setUrls(urls.map(u => 
        u.id === url.id ? { ...u, isActive: !u.isActive } : u
      ));
      
      toast.success(`URL ${url.isActive ? 'paused' : 'activated'} successfully`);
    } catch (error) {
      console.error('Error updating URL status:', error);
      toast.error('Failed to update URL status');
    }
  };

  const filteredUrls = urls.filter(url => 
    url.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    url.originalUrl.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedUrls = filteredUrls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredUrls.length / itemsPerPage);

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Short URLs - Dashboard</title>
        </Head>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Short URLs</h2>
            <Link
              href="/short-url"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create New Short URL
            </Link>
          </div>

          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search URLs..."
              className="w-full px-4 py-2 pl-10 border rounded-lg"
            />
            <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : urls.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Short URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedUrls.map((url) => (
                      <tr key={url.id}>
                        <td className="px-6 py-4 text-sm text-gray-600">{url.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <a 
                            href={`${window.location.origin}/go/${url.shortCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {`${window.location.origin}/go/${url.shortCode}`}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="max-w-xs truncate">{url.originalUrl}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-blue-600">{url.clicks}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${url.isActive ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                          >
                            {url.isActive ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleStatus(url)}
                              className={`px-3 py-1.5 rounded-lg text-sm
                                ${url.isActive 
                                  ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                                  : 'bg-green-50 text-green-600 hover:bg-green-100'
                                }`}
                            >
                              {url.isActive ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDelete(url.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-500">No short URLs found</p>
              <Link
                href="/short-url"
                className="text-blue-600 hover:text-blue-700 mt-2 inline-block"
              >
                Create your first short URL
              </Link>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded-lg ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg bg-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
