import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import EditQRModal from '@/components/EditQRModal';
import ViewQRModal from '@/components/ViewQRModal';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EyeIcon, PencilIcon, PauseIcon } from '@heroicons/react/24/outline';

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
  };
}

const truncateTitle = (title: string, maxLength: number = 30) => {
  if (!title || title.length <= maxLength) return title;
  return `${title.substring(0, maxLength)}...`;
};

export default function ActiveCodes() {
  const [codes, setCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedViewQR, setSelectedViewQR] = useState<QRCode | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'title' | 'type' | 'createdAt' | 'scans'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 5;

  useEffect(() => {
    const fetchQRCodes = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const q = query(
          collection(db, 'qrcodes'),
          where('userId', '==', user.uid),
          where('isActive', '==', true)
        );

        const querySnapshot = await getDocs(q);
        const fetchedCodes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QRCode[];

        setCodes(fetchedCodes);
      } catch (error) {
        console.error('Error fetching QR codes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQRCodes();
  }, [user]);

  const handleEditClick = (qrCode: QRCode) => {
    setSelectedQR(qrCode);
    setShowEditModal(true);
  };

  const handleUpdateQR = async (updatedQR: QRCode) => {
    try {
      setLoading(true);
      // Update in Firestore
      const qrRef = doc(db, 'qrcodes', updatedQR.id);
      await updateDoc(qrRef, {
        title: updatedQR.title, // Make sure title is included in update
        type: updatedQR.type,
        content: updatedQR.content,
        settings: updatedQR.settings,
        updatedAt: new Date().toISOString()
      });

      // Update local state with all fields including title
      setCodes(prevCodes => 
        prevCodes.map(code => 
          code.id === updatedQR.id ? {...code, ...updatedQR} : code
        )
      );
      setShowEditModal(false);
      setSelectedQR(null);
    } catch (error) {
      console.error('Error updating QR code:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (qrCode: QRCode) => {
    try {
      // Update in Firestore
      const qrRef = doc(db, 'qrcodes', qrCode.id);
      await updateDoc(qrRef, {
        isActive: false,
        updatedAt: new Date().toISOString()
      });

      // Update local state
      setCodes(prevCodes => prevCodes.filter(code => code.id !== qrCode.id));
    } catch (error) {
      console.error('Error pausing QR code:', error);
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

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Active QR Codes - Dashboard</title>
        </Head>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Active QR Codes</h2>
            <Link
              href="/"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create New QR Code
            </Link>
          </div>

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

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : codes.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Title', 'Type', 'Content', 'Created', 'Scans'].map((label, index) => (
                          <th 
                            key={index}
                            onClick={() => handleSort(label.toLowerCase() as typeof sortField)}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          >
                            <div className="flex items-center gap-1">
                              {label}
                              {sortField === label.toLowerCase() && (
                                <svg className={`w-4 h-4 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
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
                                onClick={() => setSelectedViewQR(code)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                              >
                                <EyeIcon className="w-4 h-4" />
                                <span>View</span>
                              </button>
                              <button 
                                onClick={() => handleEditClick(code)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                              >
                                <PencilIcon className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                              <button 
                                onClick={() => handlePause(code)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                              >
                                <PauseIcon className="w-4 h-4" />
                                <span>Pause</span>
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
                <p className="text-gray-500">No active QR codes found</p>
                <Link
                  href="/"
                  className="text-blue-600 hover:text-blue-700 mt-2 inline-block"
                >
                  Create your first QR code
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
        </div>

        {showEditModal && selectedQR && (
          <EditQRModal
            qrCode={selectedQR}
            onClose={() => {
              setShowEditModal(false);
              setSelectedQR(null);
            }}
            onUpdate={handleUpdateQR}
          />
        )}

        {selectedViewQR && (
          <ViewQRModal
            qrCode={selectedViewQR}
            onClose={() => setSelectedViewQR(null)}
          />
        )}
      </DashboardLayout>
    </AuthGuard>
  );
}
