// src/pages/flipbook/[id].tsx
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import type { Flipbook } from "@/types/flipbook";
import { Howl } from "howler";

export default function FlipbookViewer() {
  const router = useRouter();
  const { id } = router.query;
  const [flipbook, setFlipbook] = useState<Flipbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const soundRef = useRef<Howl | null>(null);

  // Initialize sound effect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      soundRef.current = new Howl({
        src: ['data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='],
        volume: 0.5,
        rate: 1.5
      });
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.unload();
      }
    };
  }, []);

  const playSound = () => {
    if (soundEnabled && soundRef.current) {
      soundRef.current.play();
    }
  };

  useEffect(() => {
    if (!id || typeof id !== "string") return;

    const fetchFlipbook = async () => {
      try {
        const docRef = doc(db, "flipbooks", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError("Flipbook not found");
          setLoading(false);
          return;
        }

        const data = docSnap.data() as Flipbook;
        setFlipbook({ ...data, id: docSnap.id });

        // Increment view count
        await updateDoc(docRef, {
          views: increment(1),
        }).catch(console.error);

        setLoading(false);
      } catch (err) {
        console.error("Error fetching flipbook:", err);
        setError("Failed to load flipbook");
        setLoading(false);
      }
    };

    fetchFlipbook();
  }, [id]);

  const nextPage = () => {
    if (currentPage < 2 && !isTransitioning) {
      setIsTransitioning(true);
      playSound();
      setCurrentPage(currentPage + 1);
      setTimeout(() => setIsTransitioning(false), 800);
    }
  };

  const prevPage = () => {
    if (currentPage > 0 && !isTransitioning) {
      setIsTransitioning(true);
      playSound();
      setCurrentPage(currentPage - 1);
      setTimeout(() => setIsTransitioning(false), 800);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-amber-900 font-medium">Loading flipbook...</p>
        </div>
      </div>
    );
  }

  if (error || !flipbook) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-center">
          <svg className="w-16 h-16 text-amber-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Flipbook Not Found</h1>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{flipbook.title} - Flipbook</title>
        <meta name="description" content={flipbook.description || "View this PDF flipbook"} />
      </Head>

      <style jsx global>{`
        .flipbook-viewer {
          perspective: 1500px;
          overflow: hidden;
        }

        .page-container {
          position: relative;
          width: 100%;
          max-width: 1000px;
          height: 700px;
          margin: 0 auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          border-radius: 8px;
          overflow: hidden;
        }

        .page {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          backface-visibility: hidden;
          transition: all 0.8s cubic-bezier(0.645, 0.045, 0.355, 1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .page.active {
          transform: translateX(0) scale(1);
          opacity: 1;
          z-index: 2;
        }

        .page.prev {
          transform: translateX(-100%) rotateY(20deg) scale(0.9);
          opacity: 0;
          z-index: 1;
        }

        .page.next {
          transform: translateX(100%) rotateY(-20deg) scale(0.9);
          opacity: 0;
          z-index: 1;
        }

        .page iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        {/* Header */}
        <header className="bg-gradient-to-r from-amber-800 to-orange-900 text-white shadow-lg sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div>
                  <h1 className="text-xl font-bold">{flipbook.title}</h1>
                  {flipbook.description && (
                    <p className="text-sm text-amber-200">{flipbook.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 hover:bg-amber-700 rounded-lg transition-colors"
                  title={soundEnabled ? "Sound On" : "Sound Off"}
                >
                  {soundEnabled ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </button>
                <span className="text-sm text-amber-200">
                  {flipbook.views} views
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Flipbook Viewer */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="relative flipbook-viewer">
            <div className="page-container">
              {/* Page 0 - Cover */}
              <div className={`page bg-gradient-to-br from-amber-600 to-orange-700 text-white ${
                currentPage === 0 ? 'active' : currentPage > 0 ? 'prev' : 'next'
              }`}>
                <div className="p-8 text-center max-w-2xl">
                  <svg className="w-24 h-24 mb-6 text-amber-200 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h2 className="text-5xl font-bold mb-4">{flipbook.title}</h2>
                  {flipbook.description && (
                    <p className="text-xl text-amber-100">{flipbook.description}</p>
                  )}
                  <p className="mt-12 text-sm text-amber-200 animate-pulse">Click arrow to turn page →</p>
                </div>
              </div>

              {/* Page 1 - PDF Content */}
              <div className={`page bg-white ${
                currentPage === 1 ? 'active' : currentPage > 1 ? 'prev' : 'next'
              }`}>
                {currentPage === 1 && (
                  <object
                    data={flipbook.pdfUrl}
                    type="application/pdf"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                  >
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(flipbook.pdfUrl)}&embedded=true`}
                      width="100%"
                      height="100%"
                      style={{ border: 'none' }}
                      title={flipbook.title}
                    />
                  </object>
                )}
              </div>

              {/* Page 2 - Back Cover */}
              <div className={`page bg-gradient-to-br from-orange-700 to-red-800 text-white ${
                currentPage === 2 ? 'active' : currentPage > 2 ? 'prev' : 'next'
              }`}>
                <div className="p-8 text-center max-w-2xl">
                  <h3 className="text-3xl font-bold mb-4">Thank you for reading!</h3>
                  <p className="text-xl text-orange-100 mb-12">Powered by JV QR Code Generator</p>
                  <a
                    href={flipbook.pdfUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex px-10 py-5 bg-white text-orange-700 rounded-full hover:bg-orange-50 items-center gap-3 shadow-2xl transition-all transform hover:scale-110 font-bold text-lg"
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Full PDF
                  </a>
                </div>
              </div>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={prevPage}
              disabled={currentPage === 0 || isTransitioning}
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white p-5 rounded-full shadow-2xl transition-all transform hover:scale-110 disabled:hover:scale-100 z-10"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={nextPage}
              disabled={currentPage === 2 || isTransitioning}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white p-5 rounded-full shadow-2xl transition-all transform hover:scale-110 disabled:hover:scale-100 z-10"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Page Indicator & Controls */}
          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            <div className="bg-white px-8 py-4 rounded-full shadow-lg">
              <span className="text-gray-700 font-bold text-lg">
                Page {currentPage + 1} of 3
              </span>
            </div>

            <div className="flex gap-3">
              {[0, 1, 2].map((page) => (
                <button
                  key={page}
                  onClick={() => {
                    if (!isTransitioning && page !== currentPage) {
                      setIsTransitioning(true);
                      playSound();
                      setCurrentPage(page);
                      setTimeout(() => setIsTransitioning(false), 800);
                    }
                  }}
                  className={`w-3 h-3 rounded-full transition-all ${
                    currentPage === page 
                      ? 'bg-amber-600 w-8' 
                      : 'bg-amber-300 hover:bg-amber-400'
                  }`}
                />
              ))}
            </div>

            <a
              href={flipbook.pdfUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 flex items-center gap-2 shadow-lg transition-all transform hover:scale-105 font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pb-6 text-center">
          <p className="text-sm text-gray-600">
            Powered by JV QR Code Generator
          </p>
        </footer>
      </div>
    </>
  );
}
