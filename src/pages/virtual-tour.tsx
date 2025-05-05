import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, orderBy, getDocs, limit, startAfter, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VirtualTourProject } from '@/types/virtualTour';
import AuthModal from '@/components/AuthModal';

const TOURS_PER_PAGE = 9;

export default function VirtualTour() {
  const { user } = useAuth();
  const [tours, setTours] = useState<VirtualTourProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentData | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTour, setSelectedTour] = useState<string | null>(null);

  const fetchTours = async (isLoadMore = false) => {
    try {
      setLoading(true);
      let toursQuery = query(
        collection(db, 'virtualTours'),
        orderBy('createdAt', 'desc'),
        limit(TOURS_PER_PAGE)
      );

      if (isLoadMore && lastVisible) {
        toursQuery = query(
          collection(db, 'virtualTours'),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(TOURS_PER_PAGE)
        );
      }

      const snapshot = await getDocs(toursQuery);
      
      if (snapshot.empty) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      const tourData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      })) as VirtualTourProject[];

      setHasMore(snapshot.docs.length === TOURS_PER_PAGE);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);

      if (isLoadMore) {
        setTours(prev => [...prev, ...tourData]);
      } else {
        setTours(tourData);
      }
    } catch (error) {
      console.error('Error fetching tours:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTours();
  }, []);

  const handlePreviewClick = (tourId: string) => {
    if (!user) {
      setSelectedTour(tourId);
      setShowAuthModal(true);
    } else {
      window.open(`/virtual-tour/${tourId}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
      <Head>
        <title>Virtual Tours Gallery</title>
      </Head>

      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Virtual Tours</h1>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow animate-pulse">
                <div className="aspect-video bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : tours.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tours.map((tour) => (
                <div key={tour.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="aspect-video relative">
                    <img
                      src={tour.thumbnail || '/placeholder-tour.jpg'}
                      alt={tour.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 truncate">{tour.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 h-10">{tour.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {new Date(tour.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handlePreviewClick(tour.id)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        Preview Tour
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!loading && tours.length > 0 && (
              <div className="mt-8 flex flex-col items-center gap-4">
                {hasMore && (
                  <button
                    onClick={() => fetchTours(true)}
                    className="px-6 py-3 bg-white text-gray-700 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    Load More Tours
                  </button>
                )}
                <p className="text-sm text-gray-500">
                  Showing {tours.length} {tours.length === 1 ? 'tour' : 'tours'}
                  {hasMore ? ' (Scroll for more)' : ' (No more tours)'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">No virtual tours available at the moment</p>
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setSelectedTour(null);
        }}
        onSuccess={() => {
          if (selectedTour) {
            window.open(`/virtual-tour/view/${selectedTour}`, '_blank');
          }
          setShowAuthModal(false);
          setSelectedTour(null);
        }}
      />
    </div>
  );
}
