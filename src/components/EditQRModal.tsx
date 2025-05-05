import { useState } from 'react';
import { PlaceAutocomplete } from './PlaceAutocomplete';
import { ContentTypes } from '@/types/qr';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Add contact prefix options
const PREFIX_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];

export default function EditQRModal({ qrCode, onClose, onUpdate }) {
  const [content, setContent] = useState(qrCode.content);
  const [title, setTitle] = useState(qrCode.title || '');
  const [error, setError] = useState('');

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

  // Modified handleSubmit to handle contact updates
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (qrCode.type === ContentTypes.CONTACT) {
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
        onUpdate({
          ...qrCode,
          title,
          content
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating:', error);
      setError('Failed to update. Please try again.');
    }
  };

  const renderContentInput = () => {
    switch (qrCode.type) {
      case ContentTypes.PLAIN_TEXT:
        return (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
          />
        );

      case ContentTypes.URL:
        return (
          <input
            type="url"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
          />
        );

      case ContentTypes.LOCATION:
        return (
          <PlaceAutocomplete
            value={content}
            onChange={setContent}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
          />
        );

      case ContentTypes.PHONE:
        return (
          <input
            type="tel"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
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
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Message</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                className="mt-1 w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
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
                onChange={(e) => setContactInfo({ ...contactInfo, prefix: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
                  onChange={(e) => setContactInfo({ ...contactInfo, [key]: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Edit QR Code</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
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
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
