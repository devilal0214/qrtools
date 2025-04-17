import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminLayout from '@/components/AdminLayout';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    smtp: {
      host: '',
      port: '',
      user: '',
      password: '',
      from: ''
    },
    emailTemplates: {
      welcome: {
        subject: 'Welcome to QR Generator',
        body: 'Thank you for joining QR Generator. We\'re excited to have you on board!'
      },
      passwordReset: {
        subject: 'Password Reset Request',
        body: 'You requested a password reset. Click the link below to reset your password:'
      },
      verifyEmail: {
        subject: 'Verify Your Email',
        body: 'Please verify your email address by clicking the link below:'
      }
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
        if (settingsDoc.exists()) {
          setSettings(prevSettings => ({
            ...prevSettings,
            ...settingsDoc.data()
          }));
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await setDoc(doc(db, 'settings', 'config'), settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse">Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Head>
        <title>Admin Settings - Dashboard</title>
      </Head>

      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* SMTP Settings */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">SMTP Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">SMTP Host</label>
              <input
                type="text"
                value={settings.smtp.host}
                onChange={(e) => setSettings({
                  ...settings,
                  smtp: { ...settings.smtp, host: e.target.value }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">SMTP Port</label>
              <input
                type="text"
                value={settings.smtp.port}
                onChange={(e) => setSettings({
                  ...settings,
                  smtp: { ...settings.smtp, port: e.target.value }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">SMTP User</label>
              <input
                type="text"
                value={settings.smtp.user}
                onChange={(e) => setSettings({
                  ...settings,
                  smtp: { ...settings.smtp, user: e.target.value }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">SMTP Password</label>
              <input
                type="password"
                value={settings.smtp.password}
                onChange={(e) => setSettings({
                  ...settings,
                  smtp: { ...settings.smtp, password: e.target.value }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">From Email</label>
              <input
                type="email"
                value={settings.smtp.from}
                onChange={(e) => setSettings({
                  ...settings,
                  smtp: { ...settings.smtp, from: e.target.value }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Email Templates */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Email Templates</h2>
          {Object.entries(settings.emailTemplates).map(([key, template]) => (
            <div key={key} className="space-y-4 pb-4 border-b last:border-0">
              <h3 className="text-sm font-medium text-gray-900 capitalize">{key} Email</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  value={template.subject}
                  onChange={(e) => setSettings({
                    ...settings,
                    emailTemplates: {
                      ...settings.emailTemplates,
                      [key]: { ...template, subject: e.target.value }
                    }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Body</label>
                <textarea
                  value={template.body}
                  onChange={(e) => setSettings({
                    ...settings,
                    emailTemplates: {
                      ...settings.emailTemplates,
                      [key]: { ...template, body: e.target.value }
                    }
                  })}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
