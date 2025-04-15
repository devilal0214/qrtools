import { useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { nanoid } from 'nanoid';

// Add URL validation utility
const isValidUrl = (str: string) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

export default function ShortUrl() {
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Add new state for successful URL creation
  const [generatedUrls, setGeneratedUrls] = useState<Array<{
    shortUrl: string;
    originalUrl: string;
    title: string;
  }>>([]);

  const generateShortUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    // Validate URL
    if (!isValidUrl(url)) {
      toast.error('Please enter a valid URL');
      return;
    }

    // Add https:// if protocol is missing
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;

    setLoading(true);
    try {
      const shortCode = nanoid(8);
      const shortUrlData = {
        originalUrl: formattedUrl,
        shortCode,
        title: title || 'Untitled',
        createdAt: new Date().toISOString(),
        userId: user.uid,
        clicks: 0,
        isActive: true // Set default to active
      };

      // First check if shortCode already exists
      const existingQuery = query(
        collection(db, 'shorturls'),
        where('shortCode', '==', shortCode)
      );
      const existingDocs = await getDocs(existingQuery);
      
      if (!existingDocs.empty) {
        throw new Error('Generated code already exists. Please try again.');
      }

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'shorturls'), shortUrlData);
      console.log('Created short URL with ID:', docRef.id);

      // Create the full short URL
      const fullShortUrl = `${window.location.origin}/go/${shortCode}`;
      setShortUrl(fullShortUrl);

      // Add to generated URLs list
      setGeneratedUrls(prev => [{
        shortUrl: fullShortUrl,
        originalUrl: formattedUrl,
        title: title || 'Untitled'
      }, ...prev]);
      
      // Reset form
      setUrl('');
      setTitle('');
      
      toast.success('Short URL created successfully!');
    } catch (error) {
      console.error('Error creating short URL:', error);
      toast.error('Failed to create short URL');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (urlToCopy: string) => {
    try {
      await navigator.clipboard.writeText(urlToCopy);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const shareUrl = async (urlToShare: string, titleToShare: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: titleToShare || 'Shared URL',
          url: urlToShare
        });
        toast.success('Shared successfully!');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      copyToClipboard(urlToShare);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign in Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to use Short URL</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Head>
        <title>Short URL Generator</title>
      </Head>

      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">
          Short URL Generator
        </h1>

        <form onSubmit={generateShortUrl} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Original URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter URL to shorten"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter a title for reference"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Generating...
              </div>
            ) : (
              'Generate Short URL'
            )}
          </button>
        </form>

        {shortUrl && (
          <div className="mt-8 p-4 bg-gray-50 rounded-xl">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Short URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shortUrl}
                readOnly
                className="flex-1 px-4 py-2 rounded-xl border bg-white"
              />
              <button
                onClick={() => copyToClipboard(shortUrl)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Copy to clipboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
              <button
                onClick={() => shareUrl(shortUrl, title)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Share URL"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Add Generated URLs List */}
        {generatedUrls.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-medium text-gray-700">Generated URLs</h2>
            <div className="space-y-4">
              {generatedUrls.map((item, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">{item.title}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(item.shortUrl)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Copy short URL"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => shareUrl(item.shortUrl, item.title)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Share URL"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.shortUrl}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm bg-white rounded-lg border"
                    />
                  </div>
                  <div className="text-xs text-gray-500 truncate" title={item.originalUrl}>
                    Original: {item.originalUrl}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
