import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlayIcon, TrashIcon } from '@heroicons/react/24/outline';

interface QRCode {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  scans: number;
  isActive: boolean;
  title?: string;  // Add title to interface
  settings?: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    shape?: string;
    logoImage?: string | null;
    logoPreset?: string | null;
  };
}

const truncateTitle = (title: string, maxLength: number = 30) => {
  if (!title || title.length <= maxLength) return title;
  return `${title.substring(0, maxLength)}...`;
};

export default function PausedCodes() {
  const [codes, setCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'title' | 'type' | 'createdAt' | 'scans'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchPausedCodes = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const q = query(
          collection(db, 'qrcodes'),
          where('userId', '==', user.uid),
          where('isActive', '==', false)
        );

        const querySnapshot = await getDocs(q);
        const fetchedCodes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QRCode[];

        setCodes(fetchedCodes);
      } catch (error) {
        console.error('Error fetching paused QR codes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPausedCodes();
  }, [user]);

  const handleResume = async (qrCode: QRCode) => {
    try {
      const qrRef = doc(db, 'qrcodes', qrCode.id);
      await updateDoc(qrRef, {
        title: qrCode.title, // Make sure title is included in update
        isActive: true,
        updatedAt: new Date().toISOString()
      });

      // Update local state
      setCodes(prevCodes => prevCodes.filter(code => code.id !== qrCode.id));
    } catch (error) {
      console.error('Error resuming QR code:', error);
    }
  };

  const handleDelete = async (qrCode: QRCode) => {
    if (!confirm('Are you sure you want to delete this QR code? This action cannot be undone.')) {  
      return;
    }

    try {
      // Delete from Firestore
      const qrRef = doc(db, 'qrcodes', qrCode.id);
      await deleteDoc(qrRef);

      // Update local state
      setCodes(prevCodes => prevCodes.filter(code => code.id !== qrCode.id));
    } catch (error) {
      console.error('Error deleting QR code:', error);
    }
  };

  const truncateContent = (content: string, maxLength: number = 40) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const filteredCodes = codes.filter(code => 
    code.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCodes = [...filteredCodes].sort((a, b) => {
    if (sortField === 'createdAt') {
      return sortDirection === 'asc' 
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortField === 'scans') {
      return sortDirection === 'asc' 
        ? a.scans - b.scans
        : b.scans - a.scans;
    }
    return sortDirection === 'asc'
      ? (a[sortField] || '').localeCompare(b[sortField] || '')
      : (b[sortField] || '').localeCompare(a[sortField] || '');
  });

  const paginatedCodes = sortedCodes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedCodes.length / itemsPerPage);

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Paused QR Codes - Dashboard</title>
        </Head>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-800">Paused QR Codes</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : codes.length > 0 ? (
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search QR codes..."
                  className="w-full px-4 py-2 pl-10 border rounded-lg"
                />
                <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scans</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedCodes.map((code) => (
                        <tr key={code.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <div className="relative group">
                              <span className="truncate block max-w-[200px]" title={code.title}>
                                {truncateTitle(code.title || 'Untitled')}
                              </span>
                              {/* Tooltip */}
                              {code.title && code.title.length > 30 && (
                                <div className="absolute left-0 -bottom-1 translate-y-full hidden group-hover:block z-50 w-auto p-2 bg-gray-900 text-white text-sm rounded-lg">
                                  {code.title}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{code.type}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                            <div className="truncate" title={code.content}>
                              {truncateContent(code.content)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(code.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{code.scans}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleResume(code)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                                title="Resume QR Code"
                              >
                                <PlayIcon className="w-4 h-4" />
                                <span>Resume</span>
                              </button>
                              <button 
                                onClick={() => handleDelete(code)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                title="Delete QR Code"
                              >
                                <TrashIcon className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

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
          ) : (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-500">No paused QR codes found</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
