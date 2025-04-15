import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import QRCode from 'react-qr-code';

export default function QRView() {
  const router = useRouter();
  const { id } = router.query;
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

  useEffect(() => {
    const fetchAndUpdateQR = async () => {
      if (!id) return;

      try {
        const docRef = doc(db, 'qrcodes', id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setQrCode(docSnap.data());
          // Increment scan count
          await updateDoc(docRef, {
            scans: increment(1)
          });
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndUpdateQR();
  }, [id]);

  useEffect(() => {
    const trackView = async () => {
      if (!id) return;

      try {
        await fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrId: id })
        });
      } catch (error) {
        console.error('Error tracking view:', error);
      }
    };

    trackView();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
    </div>;
  }

  if (!qrCode) return null;

  const urls = qrCode.type === 'MULTI_URL' ? qrCode.content.split('\n').filter(Boolean) : [qrCode.content];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-4xl w-full">
        {qrCode.type === 'MULTI_URL' && urls.length > 1 ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Multiple QR Codes</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentUrlIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentUrlIndex === 0}
                  className="px-3 py-1 rounded-lg bg-gray-100 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  {currentUrlIndex + 1} / {urls.length}
                </span>
                <button
                  onClick={() => setCurrentUrlIndex(prev => Math.min(urls.length - 1, prev + 1))}
                  disabled={currentUrlIndex === urls.length - 1}
                  className="px-3 py-1 rounded-lg bg-gray-100 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <QRCode
                value={urls[currentUrlIndex]}
                size={qrCode.settings?.size || 256}
                fgColor={qrCode.settings?.fgColor || '#000000'}
                bgColor={qrCode.settings?.bgColor || '#FFFFFF'}
                level="H"
                className={`
                  ${qrCode.settings?.shape === 'rounded' ? 'rounded-2xl' : ''}
                  ${qrCode.settings?.shape === 'dots' ? 'rounded-full' : ''}
                `}
              />
            </div>
            <p className="text-center text-sm text-gray-500 break-all">
              {urls[currentUrlIndex]}
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <QRCode
              value={qrCode.content}
              size={qrCode.settings?.size || 256}
              fgColor={qrCode.settings?.fgColor || '#000000'}
              bgColor={qrCode.settings?.bgColor || '#FFFFFF'}
              level="H"
              className={`
                ${qrCode.settings?.shape === 'rounded' ? 'rounded-2xl' : ''}
                ${qrCode.settings?.shape === 'dots' ? 'rounded-full' : ''}
              `}
            />
          </div>
        )}
      </div>
    </div>
  );
}
