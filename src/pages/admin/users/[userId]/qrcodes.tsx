import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import Head from 'next/head';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface QRCode {
  id: string;
  title: string;
  type: string;
  content: string;
  scans: number;
  isActive: boolean;
  createdAt: string;
}

export default function UserQRCodes() {
  const router = useRouter();
  const { userId } = router.query;
  const [qrCodes, setQRCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (!userId) return;

    const fetchQRCodes = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch user details
        const response = await fetch(`/api/admin/users/${userId}`);
        const userData = await response.json();
        setUserEmail(userData.email);

        // Fetch QR codes with indexed query
        const q = query(
          collection(db, 'qrcodes'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const qrCodesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QRCode[];
        
        setQRCodes(qrCodesData);
      } catch (error: any) {
        console.error('Error fetching QR codes:', error);
        if (error.code === 'failed-precondition') {
          setError('Please wait while the database index is being created. This may take a few minutes.');
        } else {
          setError('Failed to fetch QR codes');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQRCodes();
  }, [userId]);

  const paginatedQRCodes = qrCodes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(qrCodes.length / itemsPerPage);

  return (
    <AdminLayout>
      <Head>
        <title>User QR Codes - Admin Dashboard</title>
      </Head>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Users
            </button>
            <h1 className="text-2xl font-bold mt-2">
              QR Codes for {userEmail}
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            {error && (
              <p className="mt-4 text-sm text-gray-600">
                {error}
              </p>
            )}
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            {error}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedQRCodes.map((qr) => (
                  <tr key={qr.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="relative group">
                        <span title={qr.content}>{qr.title || 'Untitled'}</span>
                        {/* Tooltip */}
                        <div className="absolute left-0 -bottom-1 translate-y-full hidden group-hover:block z-50 w-auto p-2 bg-gray-900 text-white text-sm rounded-lg max-w-xs break-all">
                          {qr.content}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{qr.type}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${qr.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {qr.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => router.push(`/dashboard/qr-analytics/${qr.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        title="View Analytics"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Analytics
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{qr.scans}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(qr.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, qrCodes.length)} of {qrCodes.length} QR codes
                </div>
                <div className="flex gap-2">
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
              </div>
            )}

            {qrCodes.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No QR codes found for this user
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
