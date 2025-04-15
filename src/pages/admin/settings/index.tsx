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

interface Settings {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    fromEmail: string;
    fromName: string;
  };
  emailNotifications: {
    [key: string]: {
      enabled: boolean;
      subject: string;
      content: string;
    };
  };
  security: SecuritySettings;
}

interface SecuritySettings {
  loginAttempts: {
    maxAttempts: number;
    blockDuration: number;
    enabled: boolean;
  };
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  sessionTimeout: number;
  ipWhitelist: string[];
  adminIpRestriction: boolean;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({
    smtp: {
      host: '',
      port: 587,
      secure: true,
      auth: { user: '', pass: '' },
      fromEmail: '',
      fromName: ''
    },
    emailNotifications: Object.keys(EMAIL_TEMPLATES).reduce((acc, key) => ({
      ...acc,
      [key.toLowerCase()]: {
        enabled: false,
        subject: EMAIL_TEMPLATES[key].subject,
        content: EMAIL_TEMPLATES[key].defaultContent
      }
    }), {}),
    security: {
      loginAttempts: {
        maxAttempts: 5,
        blockDuration: 30,
        enabled: true
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      },
      sessionTimeout: 60,
      ipWhitelist: [],
      adminIpRestriction: false
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Add new test SMTP state
  const [testSmtp, setTestSmtp] = useState({
    host: '',
    port: 587,
    secure: true,
    auth: { user: '', pass: '' },
    fromEmail: '',
    fromName: ''
  });
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(docSnap.data() as Settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateDoc(doc(db, 'settings', 'global'), settings);
      setSuccess('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSmtp = async () => {
    setSaving(true);
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
      setSaving(false);
    }
  };

  const testEmailConfig = async () => {
    try {
      setTestLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testSmtp)
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
      setTestLoading(false);
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
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                      type="text"
                      value={settings.smtp.auth.user}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        smtp: { 
                          ...prev.smtp, 
                          auth: { ...prev.smtp.auth, user: e.target.value }
                        }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="your@email.com"
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
                  disabled={saving}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save SMTP Settings'}
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
                      value={testSmtp.host}
                      onChange={(e) => setTestSmtp(prev => ({
                        ...prev,
                        host: e.target.value
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Test SMTP Port</label>
                    <input
                      type="number"
                      value={testSmtp.port}
                      onChange={(e) => setTestSmtp(prev => ({
                        ...prev,
                        port: Number(e.target.value)
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
                      value={testSmtp.auth.user}
                      onChange={(e) => setTestSmtp(prev => ({
                        ...prev,
                        auth: { ...prev.auth, user: e.target.value }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Test Password</label>
                    <input
                      type="password"
                      value={testSmtp.auth.pass}
                      onChange={(e) => setTestSmtp(prev => ({
                        ...prev,
                        auth: { ...prev.auth, pass: e.target.value }
                      }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                      placeholder="App Password or SMTP Password"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                  <button
                    onClick={testEmailConfig}
                    disabled={testLoading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {testLoading ? 'Testing...' : 'Send Test Email'}
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
                        checked={settings.emailNotifications[key.toLowerCase()]?.enabled}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications,
                            [key.toLowerCase()]: {
                              ...prev.emailNotifications[key.toLowerCase()],
                              enabled: e.target.checked
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
                        value={settings.emailNotifications[key.toLowerCase()]?.subject}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications,
                            [key.toLowerCase()]: {
                              ...prev.emailNotifications[key.toLowerCase()],
                              subject: e.target.value
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
                        value={settings.emailNotifications[key.toLowerCase()]?.content}
                        onChange={(content) => setSettings(prev => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications,
                            [key.toLowerCase()]: {
                              ...prev.emailNotifications[key.toLowerCase()],
                              content
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
                    checked={settings.security.loginAttempts.enabled}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        loginAttempts: {
                          ...prev.security.loginAttempts,
                          enabled: e.target.checked
                        }
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
                    value={settings.security.loginAttempts.maxAttempts}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        loginAttempts: {
                          ...prev.security.loginAttempts,
                          maxAttempts: Number(e.target.value)
                        }
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
                    value={settings.security.loginAttempts.blockDuration}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        loginAttempts: {
                          ...prev.security.loginAttempts,
                          blockDuration: Number(e.target.value)
                        }
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
                    value={settings.security.passwordPolicy.minLength}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        passwordPolicy: {
                          ...prev.security.passwordPolicy,
                          minLength: Number(e.target.value)
                        }
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
                        checked={settings.security.passwordPolicy[key]}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          security: {
                            ...prev.security,
                            passwordPolicy: {
                              [key]: e.target.checked
                            }
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
                  value={settings.security.sessionTimeout}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    security: {
                      ...prev.security,
                      sessionTimeout: Number(e.target.value)
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
                    checked={settings.security.adminIpRestriction}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        adminIpRestriction: e.target.checked
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
                  value={settings.security.ipWhitelist.join('\n')}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    security: {
                      ...prev.security,
                      ipWhitelist: e.target.value.split('\n').map(ip => ip.trim()).filter(Boolean)
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
            disabled={saving}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
