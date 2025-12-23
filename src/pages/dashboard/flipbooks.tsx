// src/pages/dashboard/flipbooks.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import DashboardLayout from "@/components/DashboardLayout";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc 
} from "firebase/firestore";
import type { Flipbook } from "@/types/flipbook";

export default function FlipbooksPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [flipbooks, setFlipbooks] = useState<Flipbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Upload form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);

  // Fetch flipbooks
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "flipbooks"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const books = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Flipbook[];
      setFlipbooks(books);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pdfFile || !user) {
      alert("Please select a PDF file");
      return;
    }

    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    setUploading(true);

    try {
      // Upload PDF to local storage
      const formData = new FormData();
      const fileName = `${Date.now()}-${pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      formData.append('file', pdfFile);
      formData.append('fileName', fileName);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload PDF');
      }

      const { url: pdfUrl } = await uploadResponse.json();

      // Create flipbook document
      await addDoc(collection(db, "flipbooks"), {
        userId: user.uid,
        title: title.trim(),
        description: description.trim() || "",
        pdfUrl,
        pageCount: 0,
        fileSize: pdfFile.size,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic,
        views: 0,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setPdfFile(null);
      setIsPublic(true);
      setShowUploadModal(false);
      
      alert("Flipbook uploaded successfully!");
    } catch (error) {
      console.error("Error uploading flipbook:", error);
      alert("Failed to upload flipbook. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this flipbook?")) return;

    try {
      await deleteDoc(doc(db, "flipbooks", id));
    } catch (error) {
      console.error("Error deleting flipbook:", error);
      alert("Failed to delete flipbook");
    }
  };

  const handleCopyLink = (id: string) => {
    const link = `${window.location.origin}/flipbook/${id}`;
    navigator.clipboard.writeText(link);
    alert("Link copied to clipboard!");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>My Flipbooks - Dashboard</title>
        </Head>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Flipbooks</h1>
              <p className="text-sm text-gray-600 mt-1">
                Upload and share PDF documents as interactive flipbooks
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload PDF
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          )}

          {/* Empty state */}
          {!loading && flipbooks.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No flipbooks yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by uploading your first PDF document.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload PDF
                </button>
              </div>
            </div>
          )}

          {/* Flipbooks grid */}
          {!loading && flipbooks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flipbooks.map((flipbook) => (
                <div
                  key={flipbook.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="h-48 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <svg className="w-16 h-16 text-white opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                      {flipbook.title}
                    </h3>
                    {flipbook.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {flipbook.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {flipbook.views} views
                      </span>
                      {flipbook.fileSize && (
                        <span>{formatFileSize(flipbook.fileSize)}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/flipbook/${flipbook.id}`)}
                        className="flex-1 px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleCopyLink(flipbook.id)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                        title="Copy link"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(flipbook.id)}
                        className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Upload PDF</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="My Flipbook"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    rows={3}
                    placeholder="Describe your flipbook..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PDF File *
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                  {pdfFile && (
                    <p className="text-sm text-gray-600 mt-1">
                      {pdfFile.name} ({formatFileSize(pdfFile.size)})
                    </p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="isPublic" className="ml-2 text-sm text-gray-700">
                    Make public (anyone with link can view)
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DashboardLayout>
    </AuthGuard>
  );
}
