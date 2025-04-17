import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/AdminLayout';
import Head from 'next/head';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EMAIL_TEMPLATES } from '@/constants/emailTemplates';

// Dynamic import of react-quill
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="h-64 border rounded-lg animate-pulse bg-gray-50" />
});
import 'react-quill/dist/quill.snow.css';

// Define proper interfaces for settings
interface SMTPConfig {
  host: string;
  port: number;
  auth: {
    user: string;
    pass: string;
  };
  secure: boolean;
  fromName: string;
  fromEmail: string;
}

interface EmailTemplate {
  enabled: boolean;
  subject: string;
  content: string;
}

interface EmailConfig {
  enabled: boolean;
  fromEmail: string;
  templates: {
    [key: string]: EmailTemplate;
  };
}

interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number;
}

interface QRLimits {
  maxDailyQRFree: number;
  maxDailyQRPro: number;
  maxDailyQRBusiness: number;
}

interface GlobalSettings extends QRLimits {
  smtp: SMTPConfig;
  emailNotifications: EmailConfig;
  security: SecurityConfig;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>({
    smtp: {
      host: '',
      port: 587,
      auth: {
        user: '',
        pass: ''
      },
      secure: false,
      fromName: '',
      fromEmail: ''
    },
    emailNotifications: {
      enabled: false,
      fromEmail: '',
      templates: {}
    },
    security: {
      maxLoginAttempts: 5,
      lockoutDuration: 15
    },
    maxDailyQRFree: 3,
    maxDailyQRPro: 25,
    maxDailyQRBusiness: 100
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as GlobalSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('Failed to fetch settings');
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const flattenedSettings = {
        smtp: settings.smtp,
        emailNotifications: settings.emailNotifications,
        security: settings.security,
        maxDailyQRFree: settings.maxDailyQRFree,
        maxDailyQRPro: settings.maxDailyQRPro,
        maxDailyQRBusiness: settings.maxDailyQRBusiness
      };

      await updateDoc(doc(db, 'settings', 'global'), flattenedSettings);
      setSuccess('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSmtp = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // Create the document if it doesn't exist
        await setDoc(docRef, {
          smtp: settings.smtp,
          emailNotifications: settings.emailNotifications,
          security: settings.security,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        // Update existing document
        await updateDoc(docRef, {
          smtp: settings.smtp,
          updatedAt: new Date().toISOString()
        });
      }
      
      setSuccess('SMTP settings saved successfully!');
    } catch (error) {
      console.error('Error saving SMTP:', error);
      setError('Failed to save SMTP settings');
    } finally {
      setLoading(false);
    }
  };

  const testEmailConfig = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.smtp)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to send test email');
      }

      setSuccess('Test email sent successfully! Please check your inbox.');
    } catch (error: any) {
      console.error('Test email error:', error);
      setError(`Failed to send test email: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Head>
        <title>Settings - Admin Dashboard</title>
      </Head>

      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">System Settings</h1>

        {(error || success) && (
          <div className={`p-4 rounded-lg ${
            error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            {error || success}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-8">
          {/* SMTP Settings */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-semibold">SMTP Configuration</h2>

            {/* Save SMTP Settings Form */}
            <div className="space-y-6 border-b pb-6">
              <h3 className="text-md font-medium">Save SMTP Settings</h3>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SMTP Host</label>
                    <input
                      type="text"
                      value={settings.smtp.host}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { ...prev.smtp, host: e.target.value }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SMTP Port</label>
                    <input
                      type="number"
                      value={settings.smtp.port}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { ...prev.smtp, port: Number(e.target.value) }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="587"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">From Email</label>
                    <input
                      type="email"
                      value={settings.smtp.fromEmail}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { ...prev.smtp, fromEmail: e.target.value }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="noreply@yourdomain.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">From Name</label>
                    <input
                      type="text"
                      value={settings.smtp.fromName}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { ...prev.smtp, fromName: e.target.value }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="QR Generator"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SMTP Username</label>
                    <input
                      type="text"
                      value={settings.smtp.auth.user}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: {
                          ...prev.smtp,
                          auth: {
                            ...prev.smtp.auth,
                            user: e.target.value
                          }
                        }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      value={settings.smtp.auth.pass}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { 
                          ...prev.smtp, 
                          auth: { ...prev.smtp.auth, pass: e.target.value }
                        }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="App Password or SMTP Password"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.smtp.secure}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { ...prev.smtp, secure: e.target.checked }
                      }))}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Use SSL/TLS</span>
                  </label>
                </div>

                <button
                  onClick={handleSaveSmtp}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save SMTP Settings'}
                </button>
              </div>
            </div>

            {/* Test SMTP Form */}
            <div className="space-y-6 pt-4">
              <h3 className="text-md font-medium">Test SMTP Configuration</h3>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Test SMTP Host</label>
                    <input
                      type="text"
                      value={settings.smtp.host}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { ...prev.smtp, host: e.target.value }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Test SMTP Port</label>
                    <input
                      type="number"
                      value={settings.smtp.port}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { ...prev.smtp, port: Number(e.target.value) }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="587"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Test Username</label>
                    <input
                      type="text"
                      value={settings.smtp.auth.user}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: {
                          ...prev.smtp,
                          auth: {
                            ...prev.smtp.auth,
                            user: e.target.value
                          }
                        }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Test Password</label>
                    <input
                      type="password"
                      value={settings.smtp.auth.pass}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { 
                          ...prev.smtp, 
                          auth: { ...prev.smtp.auth, pass: e.target.value }
                        }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="App Password or SMTP Password"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                  <button
                    onClick={testEmailConfig}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {loading ? 'Testing...' : 'Send Test Email'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Email Templates */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Email Templates</h2>
            
            <div className="space-y-6">
              {Object.entries(EMAIL_TEMPLATES).map(([key, template]) => (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">{template.name}</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.emailNotifications.templates[key.toLowerCase()]?.enabled}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications,
                            templates: {
                              ...prev.emailNotifications.templates,
                              [key.toLowerCase()]: {
                                ...prev.emailNotifications.templates[key.toLowerCase()],
                                enabled: e.target.checked
                              }
                            }
                          }
                        }))}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Subject</label>
                      <input
                        type="text"
                        value={settings.emailNotifications.templates[key.toLowerCase()]?.subject}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications,
                            templates: {
                              ...prev.emailNotifications.templates,
                              [key.toLowerCase()]: {
                                ...prev.emailNotifications.templates[key.toLowerCase()],
                                subject: e.target.value
                              }
                            }
                          }
                        }))}
                        className="mt-1 w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Content
                        <span className="text-xs text-gray-500 ml-2">
                          Available variables: {template.variables.join(', ')}
                        </span>
                      </label>
                      <ReactQuill
                        value={settings.emailNotifications.templates[key.toLowerCase()]?.content}
                        onChange={(content) => setSettings(prev => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications,
                            templates: {
                              ...prev.emailNotifications.templates,
                              [key.toLowerCase()]: {
                                ...prev.emailNotifications.templates[key.toLowerCase()],
                                content
                              }
                            }
                          }
                        }))}
                        theme="snow"
                        modules={{
                          toolbar: [
                            ['bold', 'italic', 'underline'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link'],
                            ['clean']
                          ]
                        }}
                        className="h-64"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Settings Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Security Settings</h2>
            
            {/* Login Attempts */}
            <div className="space-y-4 mb-6">
              <h3 className="text-md font-medium">Login Attempt Limits</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.security.maxLoginAttempts > 0}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        maxLoginAttempts: e.target.checked ? 5 : 0
                      }
                    }))}
                    className="rounded text-blue-600"
                  />
                  <span>Enable login attempt limits</span>
                </label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Attempts</label>
                  <input
                    type="number"
                    value={settings.security.maxLoginAttempts}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        maxLoginAttempts: Number(e.target.value)
                      }
                    }))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Block Duration (minutes)</label>
                  <input
                    type="number"
                    value={settings.security.lockoutDuration}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        lockoutDuration: Number(e.target.value)
                      }
                    }))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Password Policy */}
            <div className="space-y-4 mb-6">
              <h3 className="text-md font-medium">Password Policy</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Minimum Length</label>
                  <input
                    type="number"
                    value={settings.security.maxLoginAttempts}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        maxLoginAttempts: Number(e.target.value)
                      }
                    }))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                    min="6"
                  />
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'requireUppercase', label: 'Require Uppercase' },
                    { key: 'requireLowercase', label: 'Require Lowercase' },
                    { key: 'requireNumbers', label: 'Require Numbers' },
                    { key: 'requireSpecialChars', label: 'Require Special Characters' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.security.maxLoginAttempts > 0}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          security: {
                            ...prev.security,
                            maxLoginAttempts: e.target.checked ? 5 : 0
                          }
                        }))}
                        className="rounded text-blue-600"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Session Timeout */}
            <div className="space-y-4 mb-6">
              <h3 className="text-md font-medium">Session Settings</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Session Timeout (minutes)</label>
                <input
                  type="number"
                  value={settings.security.lockoutDuration}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    security: {
                      ...prev.security,
                      lockoutDuration: Number(e.target.value)
                    }
                  }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  min="5"
                />
              </div>
            </div>

            {/* IP Whitelist */}
            <div className="space-y-4">
              <h3 className="text-md font-medium">IP Restrictions</h3>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.security.maxLoginAttempts > 0}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        maxLoginAttempts: e.target.checked ? 5 : 0
                      }
                    }))}
                    className="rounded text-blue-600"
                  />
                  <span>Enable IP restrictions for admin access</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Allowed IP Addresses</label>
                <textarea
                  value={settings.security.maxLoginAttempts.toString()}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    security: {
                      ...prev.security,
                      maxLoginAttempts: Number(e.target.value)
                    }
                  }))}
                  placeholder="Enter one IP address per line"
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
