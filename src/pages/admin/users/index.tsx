import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Head from 'next/head';
import { collection, getDocs, query, doc, updateDoc, where, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast, { Toaster } from 'react-hot-toast'; // Add this import
import { useRouter } from 'next/router';

interface User {
  id: string;
  email: string;
  displayName?: string;
  isActive: boolean;
  subscription?: {
    plan: string;
    status: string;
    endDate: string;
  };
  qrCodesCount: number;
  createdAt: string;
  lastLoginAt?: string;
  photoURL?: string;
  provider?: string;
  role?: 'admin' | 'user';  // Add role property
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'email' | 'createdAt' | 'qrCodesCount'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const router = useRouter();
  const [error, setError] = useState(''); // Add error state

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users from our admin API endpoint
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      const usersData = data.users;

      // Get QR codes count for each user
      for (const user of usersData) {
        const qrQuery = query(
          collection(db, 'qrcodes'),
          where('userId', '==', user.id)
        );
        const qrSnapshot = await getDocs(qrQuery);
        user.qrCodesCount = qrSnapshot.size;
      }

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const updateUserStatus = async (userId: string, isActive: boolean) => {
    setUpdatingUserId(userId); // Set loading state for specific user
    
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          isActive,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, {
          isActive,
          updatedAt: serverTimestamp()
        });
      }
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isActive } : user
      ));

      // Show success message
      toast.success(isActive ? 'User enabled successfully' : 'User disabled successfully', {
        duration: 3000,
        position: 'top-right',
      });

    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status', {
        duration: 3000,
        position: 'top-right',
      });
    } finally {
      setUpdatingUserId(null); // Clear loading state
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? user.isActive :
      !user.isActive;

    return matchesSearch && matchesStatus;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'email':
        return direction * (a.email || '').localeCompare(b.email || '');
      case 'qrCodesCount':
        return direction * ((a.qrCodesCount || 0) - (b.qrCodesCount || 0));
      default:
        return direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  });

  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);

  const renderUserRow = (user) => (
    <tr key={user.id}>
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || user.email} 
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="text-blue-600 font-medium">
                {user.displayName?.[0] || user.email?.[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {user.displayName || 'N/A'}
            </div>
            <div className="text-sm text-gray-500">
              {user.email}
              <span className="ml-2 px-2 py-1 text-xs rounded-full bg-gray-100">
                {user.provider === 'google.com' ? 'Google' : 'Email'}
              </span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{user.subscription?.plan || 'Free'}</div>
        {user.subscription?.endDate && (
          <div className="text-xs text-gray-500">
            Expires: {new Date(user.subscription.endDate).toLocaleDateString()}
          </div>
        )}
      </td>
      <td 
        onClick={() => router.push(`/admin/users/${user.id}/qrcodes`)}
        className="px-6 py-4 text-sm text-gray-900 hover:text-blue-600 cursor-pointer"
      >
        <div className="flex items-center gap-1">
          {user.qrCodesCount}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
      </td>
      <td className="px-6 py-4 text-right text-sm font-medium">
        {user.role !== 'admin' && (  // Only show button if user is not admin
          <button
            onClick={() => updateUserStatus(user.id, !user.isActive)}
            disabled={updatingUserId === user.id}
            className={`px-3 py-1 rounded-lg text-sm font-medium inline-flex items-center gap-2
              ${user.isActive 
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
              }
              ${updatingUserId === user.id ? 'opacity-75 cursor-not-allowed' : ''}
            `}
          >
            {updatingUserId === user.id ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <span>{user.isActive ? 'Disable' : 'Enable'}</span>
            )}
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <AdminLayout>
      <Head>
        <title>User Management - Admin Dashboard</title>
      </Head>
      
      {/* Add the Toaster component */}
      <div><Toaster/></div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">User Management</h1>
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Users</option>
              <option value="active">Active Users</option>
              <option value="inactive">Inactive Users</option>
            </select>
            <input
              type="search"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('email')}>
                      <div className="flex items-center gap-2">
                        User
                        {sortField === 'email' && (
                          <svg className={`w-4 h-4 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('qrCodesCount')}>
                      <div className="flex items-center gap-2">
                        QR Codes
                        {sortField === 'qrCodesCount' && (
                          <svg className={`w-4 h-4 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('createdAt')}>
                      <div className="flex items-center gap-2">
                        Joined
                        {sortField === 'createdAt' && (
                          <svg className={`w-4 h-4 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedUsers.map((user) => renderUserRow(user))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedUsers.length)} of {sortedUsers.length} users
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
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
