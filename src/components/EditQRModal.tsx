import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from './AuthModal';
import { PlaceAutocomplete } from './PlaceAutocomplete';
import { ContentTypes } from '@/types/qr';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Add contact prefix options
const PREFIX_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];

export default function EditQRModal({ qrCode, onClose, onUpdate }) {
  const { user, loading } = useAuth();
  const [content, setContent] = useState(qrCode.content);
  const [title, setTitle] = useState(qrCode.title || '');
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddUrlModal, setShowAddUrlModal] = useState(false);
  
  // Campaign tracking state
  const [campaignEnabled, setCampaignEnabled] = useState(qrCode.campaign?.enabled || false);
  const [campaignSource, setCampaignSource] = useState(qrCode.campaign?.utmSource || '');
  const [campaignMedium, setCampaignMedium] = useState(qrCode.campaign?.utmMedium || '');
  const [campaignName, setCampaignName] = useState(qrCode.campaign?.utmCampaign || '');
  
  // Multi-URL state
  const [multiUrlData, setMultiUrlData] = useState(() => {
    if (qrCode.type === ContentTypes.MULTI_URL) {
      try {
        const parsed = JSON.parse(qrCode.content);
        return {
          title: parsed.title || 'My Links',
          urls: parsed.urls || [{url: '', title: ''}]
        };
      } catch {
        return { title: 'My Links', urls: [{url: '', title: ''}] };
      }
    }
    return null;
  });

  // Initialize contact info from URL for contact type
  const [contactInfo, setContactInfo] = useState(() => {
    if (qrCode.type === ContentTypes.CONTACT) {
      // Extract contact ID from URL (assuming format: domain.com/c/[contactId])
      const contactId = qrCode.content.split('/').pop();
      // Fetch contact data from Firestore
      const fetchContactData = async () => {
        try {
          const contactRef = doc(db, 'contacts', contactId);
          const contactSnap = await getDoc(contactRef);
          if (contactSnap.exists()) {
            const data = contactSnap.data();
            setContactInfo({
              prefix: data.prefix || '',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              organization: data.organization || '',
              title: data.title || '',
              email: data.email || '',
              phone: data.phone || '',
              mobile: data.mobile || '',
              street: data.street || '',
              city: data.city || '',
              region: data.region || '',
              postcode: data.postcode || '',
              country: data.country || '',
              website: data.website || ''
            });
          }
        } catch (error) {
          console.error('Error fetching contact data:', error);
        }
      };
      fetchContactData();
      // Return default empty state initially
      return {
        prefix: '',
        firstName: '',
        lastName: '',
        organization: '',
        title: '',
        email: '',
        phone: '',
        mobile: '',
        street: '',
        city: '',
        region: '',
        postcode: '',
        country: '',
        website: ''
      };
    }
    return null;
  });

  // Modified handleSubmit to handle contact and multi-URL updates
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user) {
      setShowAuthModal(true);
      setError('You must be logged in to edit a QR code.');
      return;
    }
    try {
      if (qrCode.type === ContentTypes.MULTI_URL) {
        // Update multi-URL with new data
        onUpdate({
          ...qrCode,
          title: multiUrlData.title,
          content: JSON.stringify(multiUrlData)
        });
      } else if (qrCode.type === ContentTypes.CONTACT) {
        // Extract contact ID from URL
        const contactId = qrCode.content.split('/').pop();
        // Update contact data in Firestore
        const contactRef = doc(db, 'contacts', contactId);
        await updateDoc(contactRef, {
          ...contactInfo,
          updatedAt: new Date().toISOString()
        });
        // The QR code URL remains the same, just update the title if changed
        onUpdate({
          ...qrCode,
          title
        });
      } else {
        // Handle other content types as before
        // Prepare campaign data for URL type
        const campaignData = (qrCode.type === ContentTypes.URL && campaignEnabled) ? {
          enabled: true,
          utmSource: campaignSource,
          utmMedium: campaignMedium,
          utmCampaign: campaignName
        } : undefined;

        onUpdate({
          ...qrCode,
          title,
          content,
          ...(campaignData && { campaign: campaignData }),
          ...(qrCode.type === ContentTypes.URL && !campaignEnabled && { campaign: undefined })
        });
      }
      onClose();
    } catch (error) {
      console.error('Error updating:', error);
      setError('Failed to update. Please try again.');
    }
  };

  const AddUrlModalInEdit = () => {
    const [newUrl, setNewUrl] = useState("");
    const [newUrlTitle, setNewUrlTitle] = useState("");
    
    const handleAddUrl = () => {
      if (newUrl.trim() && multiUrlData) {
        setMultiUrlData({
          ...multiUrlData,
          urls: [...multiUrlData.urls.filter(u => u.url.trim()), { url: newUrl, title: newUrlTitle || newUrl }]
        });
        setNewUrl("");
        setNewUrlTitle("");
        setShowAddUrlModal(false);
      }
    };
    
    if (!showAddUrlModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Add New Link</h3>
            <button onClick={() => setShowAddUrlModal(false)} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link Title</label>
              <input
                type="text"
                value={newUrlTitle}
                onChange={(e) => setNewUrlTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g., My Website"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://example.com"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddUrlModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUrl}
                disabled={!newUrl.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContentInput = () => {
    // Block all input if not logged in
    const inputProps = {
      disabled: !user || loading,
      onFocus: () => { if (!user) setShowAuthModal(true); }
    };
    switch (qrCode.type) {
      case ContentTypes.MULTI_URL:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500">Page Title</label>
              <input
                type="text"
                value={multiUrlData?.title || ''}
                onChange={(e) => setMultiUrlData({ ...multiUrlData, title: e.target.value, urls: multiUrlData?.urls || [] })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Your title here"
                disabled={!user || loading}
                onFocus={() => { if (!user) setShowAuthModal(true); }}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Links ({multiUrlData?.urls.filter(u => u.url.trim()).length || 0})</label>
              {multiUrlData?.urls.map((item, index) => {
                if (!item.url.trim()) return null;
                return (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title || 'Untitled'}</p>
                      <p className="text-xs text-gray-500 truncate">{item.url}</p>
                    </div>
                    <button
                      onClick={() => {
                        const filtered = multiUrlData.urls.filter((_, i) => i !== index);
                        setMultiUrlData({
                          ...multiUrlData,
                          urls: filtered.length ? filtered : [{url: '', title: ''}]
                        });
                      }}
                      className="text-red-500 hover:text-red-700 text-xl leading-none"
                      disabled={!user || loading}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={() => setShowAddUrlModal(true)}
              className="w-full py-2 px-4 text-sm text-green-600 hover:text-green-700 font-medium flex items-center justify-center gap-2 border border-dashed border-green-600 rounded-lg hover:bg-green-50"
              disabled={!user || loading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Link
            </button>
          </div>
        );
      case ContentTypes.PLAIN_TEXT:
        return (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={5}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            {...inputProps}
          />
        );
      case ContentTypes.URL:
        return (
          <div className="space-y-4">
            <input
              type="url"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              {...inputProps}
            />
            
            {/* Campaign URL Tracking */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    📊 Campaign URL Tracking
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Add UTM parameters to track this QR code
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campaignEnabled}
                    onChange={(e) => setCampaignEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {campaignEnabled && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Campaign Source (utm_source)
                    </label>
                    <input
                      type="text"
                      value={campaignSource}
                      onChange={(e) => setCampaignSource(e.target.value)}
                      placeholder="e.g., newsletter, facebook, poster"
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Campaign Medium (utm_medium)
                    </label>
                    <input
                      type="text"
                      value={campaignMedium}
                      onChange={(e) => setCampaignMedium(e.target.value)}
                      placeholder="e.g., qr_code, email, social"
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Campaign Name (utm_campaign)
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g., summer_sale, product_launch"
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  {campaignSource && campaignMedium && campaignName && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs font-medium text-blue-900 mb-1">Preview URL:</p>
                      <p className="text-xs font-mono text-blue-700 break-all">
                        {content || 'https://example.com'}?utm_source={campaignSource}&utm_medium={campaignMedium}&utm_campaign={campaignName}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case ContentTypes.LOCATION:
        return (
          <PlaceAutocomplete
            value={content}
            onChange={setContent}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            // @ts-ignore
            disabled={!user || loading}
            // @ts-ignore
            onFocus={() => { if (!user) setShowAuthModal(true); }}
          />
        );
      case ContentTypes.PHONE:
        return (
          <input
            type="tel"
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            {...inputProps}
          />
        );
      case ContentTypes.SMS:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={content}
                onChange={e => setContent(e.target.value)}
                className="mt-1 w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                {...inputProps}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Message</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={3}
                className="mt-1 w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                {...inputProps}
              />
            </div>
          </div>
        );
      case ContentTypes.CONTACT:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Prefix</label>
              <select
                value={contactInfo.prefix}
                onChange={e => setContactInfo({ ...contactInfo, prefix: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                disabled={!user || loading}
                onFocus={() => { if (!user) setShowAuthModal(true); }}
              >
                <option value="">Select Prefix</option>
                {PREFIX_OPTIONS.map(prefix => (
                  <option key={prefix} value={prefix}>{prefix}</option>
                ))}
              </select>
            </div>
            {Object.entries({
              firstName: 'First Name',
              lastName: 'Last Name',
              organization: 'Organization',
              title: 'Title',
              email: 'Email',
              phone: 'Phone',
              mobile: 'Mobile',
              street: 'Street',
              city: 'City',
              region: 'Region',
              postcode: 'Postcode',
              country: 'Country',
              website: 'Website'
            }).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={contactInfo[key]}
                  onChange={e => setContactInfo({ ...contactInfo, [key]: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  disabled={!user || loading}
                  onFocus={() => { if (!user) setShowAuthModal(true); }}
                />
              </div>
            ))}
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
            {...inputProps}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Edit QR Code</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Overlay for unauthenticated users */}
        {!user && !loading && (
          <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center">
            <p className="mb-4 text-lg font-semibold text-gray-700">Please log in to edit a QR code.</p>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              onClick={() => setShowAuthModal(true)}
            >
              Log In
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={!user || loading}
              onFocus={() => { if (!user) setShowAuthModal(true); }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            {renderContentInput()}
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              disabled={!user || loading}
            >
              Save Changes
            </button>
          </div>
        </form>

        {/* Auth Modal */}
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        
        {/* Add URL Modal for Multi-URL editing */}
        <AddUrlModalInEdit />
      </div>
    </div>
  );
}
