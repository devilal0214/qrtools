import { GetServerSideProps } from 'next';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import QRCode from 'react-qr-code';
import Head from 'next/head';

interface Props {
  qrCode?: {
    id: string;
    title?: string;
    content: string;
    type: string;
    scans: number;
    isActive: boolean;
    settings?: {
      size?: number;
      fgColor?: string;
      bgColor?: string;
      shape?: string;
    };
  };
  error?: string;
}

export default function QRCodeView({ qrCode, error }: Props) {
  if (error || !qrCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-red-50 p-6 rounded-xl">
          <h1 className="text-xl font-semibold text-red-600 mb-2">QR Code Not Found</h1>
          <p className="text-gray-600">The requested QR code does not exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  if (!qrCode.isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-yellow-50 p-6 rounded-xl">
          <h1 className="text-xl font-semibold text-yellow-600 mb-2">QR Code Paused</h1>
          <p className="text-gray-600">This QR code is currently inactive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Head>
        <title>{qrCode.title || 'QR Code'}</title>
        <meta name="description" content={`QR Code for ${qrCode.title || 'content'}`} />
      </Head>

      <div className="bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-lg max-w-lg w-full">
        <div className="space-y-6">
          {qrCode.title && (
            <h1 className="text-2xl font-bold text-center text-gray-800">
              {qrCode.title}
            </h1>
          )}

          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-xl shadow-sm">
              <QRCode
                value={qrCode.content}
                size={256}
                bgColor={qrCode.settings?.bgColor || '#FFFFFF'}
                fgColor={qrCode.settings?.fgColor || '#000000'}
                level="H"
                className={`
                  ${qrCode.settings?.shape === 'rounded' ? 'rounded-2xl' : ''}
                  ${qrCode.settings?.shape === 'dots' ? 'rounded-full' : ''}
                `}
              />
            </div>
          </div>

          {/* <div className="text-center text-gray-500">
            <p>Scanned {qrCode.scans} times</p>
          </div> */}

          {qrCode.type === 'URL' && (
            <div className="text-center">
              <a
                href={qrCode.content}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                Visit URL directly
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = params?.id as string;

  try {
    // Get QR code directly using document ID
    const qrRef = doc(db, 'qrcodes', id);
    const qrSnap = await getDoc(qrRef);

    if (!qrSnap.exists()) {
      return {
        props: {
          error: 'QR code not found'
        }
      };
    }

    const qrData = qrSnap.data();

    // Check if QR code is active
    if (!qrData.isActive) {
      return {
        props: {
          error: 'This QR code has been paused'
        }
      };
    }

    // Update scan count in a separate try-catch to prevent blocking the view
    try {
      await updateDoc(qrRef, {
        scans: increment(1),
        lastScannedAt: new Date().toISOString()
      });
    } catch (updateError) {
      console.error('Error updating scan count:', updateError);
      // Continue even if update fails
    }

    // Return QR code data without waiting for scan count update
    return {
      props: {
        qrCode: {
          id: qrSnap.id,
          ...qrData,
          scans: (qrData.scans || 0) + 1 // Optimistically increment scan count
        }
      }
    };
  } catch (error) {
    console.error('Error fetching QR code:', error);
    return {
      props: {
        error: 'Failed to load QR code'
      }
    };
  }
};
