import { useEffect } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, increment, updateDoc } from 'firebase/firestore';

interface RedirectProps {
  destinationUrl?: string;
  error?: string;
  isPaused?: boolean;
}

export default function Redirect({ destinationUrl, error, isPaused }: RedirectProps) {
  useEffect(() => {
    if (destinationUrl) {
      const timer = setTimeout(() => {
        window.location.href = destinationUrl;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [destinationUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Head>
        <title>{isPaused ? 'URL Paused' : 'Redirecting...'}</title>
      </Head>

      <div className="text-center">
        {error ? (
          <div className="bg-red-50 p-6 rounded-xl">
            <h1 className="text-xl font-semibold text-red-600 mb-2">Link Not Found</h1>
            <p className="text-gray-600">The requested short URL does not exist.</p>
          </div>
        ) : isPaused ? (
          <div className="bg-yellow-50 p-6 rounded-xl">
            <h1 className="text-xl font-semibold text-yellow-600 mb-2">Link Paused</h1>
            <p className="text-gray-600">This short URL is currently paused by the owner.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600">Redirecting you to your destination...</p>
            <p className="text-sm text-gray-400">Please wait a moment</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = params?.id as string;

  try {
    // Add console.log for debugging
    console.log('Searching for shortCode:', id);

    const shortUrlsRef = collection(db, 'shorturls');
    const q = query(
      shortUrlsRef, 
      where('shortCode', '==', id)
    );

    const snapshot = await getDocs(q);
    console.log('Found documents:', snapshot.size);

    if (snapshot.empty) {
      return {
        props: {
          error: 'Short URL not found'
        }
      };
    }

    const doc = snapshot.docs[0];
    const urlData = doc.data();
    console.log('URL data:', urlData);

    // Check if URL is active
    if (!urlData.isActive) {
      return {
        props: {
          isPaused: true,
        }
      };
    }

    // Ensure URL has proper protocol
    let destinationUrl = urlData.originalUrl;
    if (!destinationUrl.startsWith('http://') && !destinationUrl.startsWith('https://')) {
      destinationUrl = `https://${destinationUrl}`;
    }

    // Update click count and last clicked timestamp
    await updateDoc(doc.ref, {
      clicks: increment(1),
      lastClickedAt: new Date().toISOString()
    });

    return {
      props: {
        destinationUrl
      }
    };
  } catch (error) {
    console.error('Error processing short URL:', error);
    return {
      props: {
        error: 'Failed to process short URL'
      }
    };
  }
};
