import { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SendEmailModalProps {
  selectedUsers: string[]; // These are user IDs
  onClose: () => void;
  onSuccess: () => void;
}

export default function SendEmailModal({ selectedUsers, onClose, onSuccess }: SendEmailModalProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const usersSnapshot = await getDocs(
        query(
          collection(db, 'users'),
          where('__name__', 'in', selectedUsers)
        )
      );

      const userEmails = usersSnapshot.docs.map(doc => doc.data().email);

      // Create email job with actual email addresses
      const jobRef = await addDoc(collection(db, 'email_jobs'), {
        subject,
        content,
        recipients: userEmails.map(email => ({
          email: email, // Use actual email address here
          variables: {}
        })),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Process the email job immediately
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

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error sending emails:', error);
      setError(error.message || 'Failed to send emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Send Email to Selected Users</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="mt-1 w-full px-3 py-2 border rounded-lg"
              required
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : `Send Email to ${selectedUsers.length} Users`}
          </button>
        </form>
      </div>
    </div>
  );
}
