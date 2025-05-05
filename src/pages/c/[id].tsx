import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ContactInfo {
  prefix?: string;
  firstName: string;
  lastName: string;
  organization?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  street?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
  website?: string;
}

export default function ContactView() {
  const router = useRouter();
  const { id } = router.query;
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchContact = async () => {
      if (!id) return;

      try {
        const docRef = doc(db, 'contacts', id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setContact(docSnap.data() as ContactInfo);
        } else {
          setError('Contact not found');
        }
      } catch (error) {
        console.error('Error fetching contact:', error);
        setError('Failed to load contact information');
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">{error}</div>
      </div>
    );
  }

  const handleDownloadVCard = () => {
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${contact.lastName};${contact.firstName};${contact.prefix};;`,
      `FN:${[contact.prefix, contact.firstName, contact.lastName].filter(Boolean).join(' ')}`,
      contact.organization && `ORG:${contact.organization}`,
      contact.title && `TITLE:${contact.title}`,
      contact.email && `EMAIL:${contact.email}`,
      contact.phone && `TEL;TYPE=WORK,VOICE:${contact.phone}`,
      contact.mobile && `TEL;TYPE=CELL,VOICE:${contact.mobile}`,
      contact.street && `ADR;TYPE=WORK:;;${contact.street};${contact.city};${contact.region};${contact.postcode};${contact.country}`,
      contact.website && `URL:${contact.website}`,
      'END:VCARD'
    ].filter(Boolean).join('\n');

    const blob = new Blob([vCard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${contact.firstName}_${contact.lastName}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Head>
        <title>{`${contact.firstName} ${contact.lastName} - Contact Card`}</title>
      </Head>

      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-blue-600 px-6 py-8 text-white">
          <h1 className="text-2xl font-bold">
            {[contact.prefix, contact.firstName, contact.lastName].filter(Boolean).join(' ')}
          </h1>
          {contact.title && <p className="mt-1 opacity-90">{contact.title}</p>}
          {contact.organization && <p className="mt-1 opacity-90">{contact.organization}</p>}
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            {/* Email */}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-3 text-gray-600 hover:text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {contact.email}
              </a>
            )}

            {/* Phone */}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-3 text-gray-600 hover:text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {contact.phone}
              </a>
            )}

            {/* Mobile */}
            {contact.mobile && (
              <a href={`tel:${contact.mobile}`} className="flex items-center gap-3 text-gray-600 hover:text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {contact.mobile}
              </a>
            )}

            {/* Website */}
            {contact.website && (
              <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-600 hover:text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {contact.website}
              </a>
            )}

            {/* Address Section */}
            {(contact.street || contact.city || contact.region || contact.country) && (
              <div className="flex items-start gap-3 text-gray-600">
                <svg className="w-5 h-5 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="space-y-1">
                  {contact.street && <p>{contact.street}</p>}
                  <p>
                    { [
                      contact.city,
                      contact.region,
                      contact.postcode
                    ].filter(Boolean).join(', ')}
                  </p>
                  {contact.country && <p>{contact.country}</p>}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleDownloadVCard}
            className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Add to Contacts
          </button>
        </div>
      </div>
    </div>
  );
}
