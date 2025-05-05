import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Head from 'next/head';
import TourCard from '@/components/virtualTour/TourCard';
import { VirtualTourProject } from '@/types/virtualTour';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

const ITEMS_PER_PAGE = 12;

export default function VirtualTourGallery() {
  const [tours, setTours] = useState<VirtualTourProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const fetchTours = async (isInitial = false) => {
    try {
      setLoading(true);
      let toursQuery = query(
        collection(db, 'virtualTours'),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(ITEMS_PER_PAGE)
      );

      if (!isInitial && lastVisible) {
        toursQuery = query(
          collection(db, 'virtualTours'),
          where('isPublic', '==', true),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(ITEMS_PER_PAGE)
        );
      }

      const snapshot = await getDocs(toursQuery);
      const newTours = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VirtualTourProject[];

      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      
      if (isInitial) {
        setTours(newTours);
      } else {
        setTours(prev => [...prev, ...newTours]);
      }
    } catch (err) {
      console.error('Error fetching tours:', err);
      setError('Failed to load virtual tours');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTours(true);
  }, []);

  const filteredTours = tours.filter(tour => 
    tour.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tour.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedTours = filteredTours.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredTours.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Virtual Tours Gallery</title>
      </Head>

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Virtual Tours</h1>
          {user && (
            <Link
              href="/dashboard/virtual-tours/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Tour
            </Link>
          )}
        </div>

        {/* Search Input */}
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tours..."
            className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => fetchTours(true)}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedTours.map(tour => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 rounded-lg ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
