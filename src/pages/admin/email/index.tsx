import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Head from 'next/head';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { EMAIL_TEMPLATES } from '@/constants/emailTemplates';
import SendEmailModal from '@/components/admin/SendEmailModal';
import toast, { Toaster } from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  displayName?: string;
  subscription?: {
    plan: string;
    endDate: string;
    status: string;
  };
  qrCodesCount: number;
  createdAt: string;
}

export default function EmailUsers() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Get users with subscriptions
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData: User[] = [];

      for (const doc of usersSnap.docs) {
        // Get QR codes count for each user
        const qrQuery = query(
          collection(db, 'qrcodes'),
          where('userId', '==', doc.id)
        );
        const qrSnap = await getDocs(qrQuery);

        usersData.push({
          id: doc.id,
          ...doc.data(),
          qrCodesCount: qrSnap.size
        } as User);
      }

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get users based on filter
      const usersQuery = query(
        collection(db, 'users'),
        ...(filter !== 'all' ? [where('isActive', '==', filter === 'active')] : [])
      );
      
      const snapshot = await getDocs(usersQuery);
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Create email job
      await addDoc(collection(db, 'email_jobs'), {
        subject,
        content,
        recipients: users.map(user => user.email),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setSuccess('Email job created successfully!');
      setSubject('');
      setContent('');
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to create email job');
    } finally {
      setLoading(false);
    }
  };

  const sendExpiryNotifications = async () => {
    const loadingToast = toast.loading('Sending expiry notifications...');
    
    try {
      setLoading(true);
      const selectedUserData = users.filter(user => selectedUsers.includes(user.id));

      if (selectedUserData.length === 0) {
        toast.error('No users selected');
        return;
      }

      if (!auth.currentUser) {
        throw new Error('Not authenticated');
      }

      // Create email job with admin role check
      const jobRef = await addDoc(collection(db, 'email_jobs'), {
        template: 'PLAN_EXPIRY',
        recipients: selectedUserData.map(user => ({
          email: user.email,
          variables: {
            userName: user.displayName || user.email,
            planName: user.subscription?.plan || 'Free',
            expiryDate: new Date(user.subscription?.endDate || '').toLocaleDateString(),
            renewalLink: `${window.location.origin}/pricing`
          }
        })),
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: auth.currentUser.uid // Now this is properly defined
      });

      console.log('Created email job:', jobRef.id);

      // Process the email job
      const response = await fetch('/api/admin/process-email-job', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ jobId: jobRef.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to process email job');
      }

      const data = await response.json();
      toast.success(`Expiry notifications sent to ${selectedUserData.length} users`);
      setSelectedUsers([]);
    } catch (error: any) {
      console.error('Error sending notifications:', error);
      toast.error(error.message || 'Failed to send notifications');
    } finally {
      toast.dismiss(loadingToast);
      setLoading(false);
    }
  };

  // Pagination calculations
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = users.slice(startIndex, endIndex);
  const totalPages = Math.ceil(users.length / itemsPerPage);

  return (
    <AdminLayout>
      <Head>
        <title>Email Users - Admin Dashboard</title>
      </Head>

      <div><Toaster position="top-right" /></div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Email Users</h1>
          <div className="flex gap-2">
            <button
              onClick={sendExpiryNotifications}
              disabled={!selectedUsers.length || loading}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>Send Expiry Notifications ({selectedUsers.length})</>
              )}
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              disabled={!selectedUsers.length || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Send Custom Email ({selectedUsers.length})
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      setSelectedUsers(
                        e.target.checked ? users.map(u => u.id) : []
                      );
                    }}
                    className="rounded text-blue-600"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">QR Codes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedUsers.map((user) => {
                const daysUntilExpiry = user.subscription?.endDate
                  ? Math.ceil((new Date(user.subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : 0;

                return (
                  <tr key={user.id}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          setSelectedUsers(prev =>
                            e.target.checked
                              ? [...prev, user.id]
                              : prev.filter(id => id !== user.id)
                          );
                        }}
                        className="rounded text-blue-600"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.displayName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
                        {user.subscription?.plan || 'Free'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.subscription?.endDate ? (
                        <div>
                          <div className="text-sm text-gray-900">
                            {new Date(user.subscription.endDate).toLocaleDateString()}
                          </div>
                          <div className={`text-sm ${
                            daysUntilExpiry <= 7 ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {daysUntilExpiry > 0 
                              ? `${daysUntilExpiry} days left`
                              : 'Expired'
                            }
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.qrCodesCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-6 py-4 border-t flex items-center justify-between">
            {/* ...existing pagination code... */}
          </div>
        </div>

        {/* Email Modal */}
        {showEmailModal && (
          <SendEmailModal
            selectedUsers={selectedUsers}
            onClose={() => setShowEmailModal(false)}
            onSuccess={() => {
              toast.success('Email job created successfully');
              setSelectedUsers([]);
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
