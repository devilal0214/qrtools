// src/pages/dashboard/paused.tsx
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Head from "next/head";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PlayIcon, TrashIcon } from "@heroicons/react/24/outline";

interface QRCode {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  scans: number;
  isActive: boolean;
  title?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

const truncateTitle = (title: string, maxLength: number = 30) => {
  if (!title || title.length <= maxLength) return title;
  return `${title.substring(0, maxLength)}...`;
};

const truncateContent = (content: string, maxLength: number = 40) => {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + "...";
};

export default function PausedCodes() {
  const [codes, setCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<
    "title" | "type" | "createdAt" | "scans"
  >("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const itemsPerPage = 10;

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
  }>({
    message: "",
    visible: false,
  });

  const [qrToTrash, setQrToTrash] = useState<QRCode | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  useEffect(() => {
    const fetchPausedCodes = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const q = query(
          collection(db, "qrcodes"),
          where("userId", "==", user.uid),
          where("isActive", "==", false)
        );

        const querySnapshot = await getDocs(q);
        const fetchedCodes = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as QRCode[];

        const nonDeleted = fetchedCodes.filter((c) => !c.isDeleted);
        setCodes(nonDeleted);
      } catch (error) {
        console.error("Error fetching paused QR codes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPausedCodes();
  }, [user]);

  const handleResume = async (qrCode: QRCode) => {
    try {
      const qrRef = doc(db, "qrcodes", qrCode.id);
      await updateDoc(qrRef, {
        title: qrCode.title,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });

      setCodes((prevCodes) =>
        prevCodes.filter((code) => code.id !== qrCode.id)
      );
      showToast("QR has been resumed and moved back to Active.");
    } catch (error) {
      console.error("Error resuming QR code:", error);
      showToast(
        "Something went wrong while resuming the QR. Please try again."
      );
    }
  };

  const handleDeleteClick = (qrCode: QRCode) => {
    setQrToTrash(qrCode);
  };

  const confirmMoveToTrash = async () => {
    if (!qrToTrash) return;

    try {
      setIsMoving(true);
      setDeletingId(qrToTrash.id);

      const qrRef = doc(db, "qrcodes", qrToTrash.id);
      await updateDoc(qrRef, {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        isActive: false,
        updatedAt: new Date().toISOString(),
      });

      // Trigger trash tab animation (DashboardLayout listens for this)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("qr-moved-to-trash"));
      }

      setTimeout(() => {
        setCodes((prevCodes) =>
          prevCodes.filter((code) => code.id !== qrToTrash.id)
        );
        setDeletingId(null);
        setQrToTrash(null);
        setIsMoving(false);
      }, 350);

      showToast(
        "QR moved to Trash. You can restore it from the Trash Bin for up to 30 days."
      );
    } catch (error) {
      console.error("Error moving QR to trash:", error);
      setDeletingId(null);
      setIsMoving(false);
      showToast("Something went wrong while moving the QR to Trash.");
    }
  };

  const cancelMoveToTrash = () => {
    setQrToTrash(null);
    setIsMoving(false);
  };

  const filteredCodes = codes.filter(
    (code) =>
      code.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCodes = [...filteredCodes].sort((a, b) => {
    if (sortField === "createdAt") {
      return sortDirection === "asc"
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortField === "scans") {
      return sortDirection === "asc" ? a.scans - b.scans : b.scans - a.scans;
    }
    return sortDirection === "asc"
      ? (a[sortField] || "").localeCompare(b[sortField] || "")
      : (b[sortField] || "").localeCompare(a[sortField] || "");
  });

  const paginatedCodes = sortedCodes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedCodes.length / itemsPerPage);

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Paused QR Codes - Dashboard</title>
        </Head>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              Paused QR Codes
            </h2>
            <Link
              href="/dashboard/trash"
              className="text-sm text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg"
            >
              View Trash Bin
            </Link>
          </div>

          <p className="text-xs text-gray-500">
            Any paused QR code moved to Trash will be stored for 30 days. After
            that it will be permanently deleted.
          </p>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : codes.length > 0 ? (
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search QR codes..."
                  className="w-full px-4 py-2 pl-10 border rounded-lg"
                />
                <svg
                  className="w-5 h-5 absolute left-3 top-2.5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Title", "Type", "Content", "Created", "Scans"].map(
                          (label, index) => (
                            <th
                              key={index}
                              onClick={() =>
                                handleSort(
                                  label.toLowerCase() as typeof sortField
                                )
                              }
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            >
                              <div className="flex items-center gap-1">
                                {label}
                                {sortField === label.toLowerCase() && (
                                  <svg
                                    className={`w-4 h-4 transform ${
                                      sortDirection === "desc"
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 15l7-7 7 7"
                                    />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedCodes.map((code) => (
                        <tr
                          key={code.id}
                          className={`transition-all duration-500 ease-out ${
                            deletingId === code.id
                              ? "opacity-0 -translate-y-2 scale-95 bg-red-50"
                              : "opacity-100 hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <div className="relative group">
                              <span
                                className="truncate block max-w-[200px]"
                                title={code.title}
                              >
                                {truncateTitle(code.title || "Untitled")}
                              </span>
                              {code.title && code.title.length > 30 && (
                                <div className="absolute left-0 -bottom-1 translate-y-full hidden group-hover:block z-50 w-auto p-2 bg-gray-900 text-white text-sm rounded-lg">
                                  {code.title}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {code.type}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                            <div className="truncate" title={code.content}>
                              {truncateContent(code.content)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(code.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {code.scans}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleResume(code)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                                title="Resume QR Code"
                              >
                                <PlayIcon className="w-4 h-4" />
                                <span>Resume</span>
                              </button>
                              <button
                                onClick={() => handleDeleteClick(code)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                title="Move to Trash"
                              >
                                <TrashIcon className="w-4 h-4" />
                                <span>Trash</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg bg-gray-100 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-lg ${
                          currentPage === page
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg bg-gray-100 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-500">No paused QR codes found</p>
            </div>
          )}
        </div>

        {/* Toast Notification */}
        {toast.visible && (
          <div className="fixed bottom-6 right-6 z-50">
            <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {qrToTrash && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Move QR to Trash?
              </h3>
              <p className="text-sm text-gray-600 mt-2">
                This QR code will be moved to the Trash Bin. It will be kept for
                30 days and then permanently deleted. You can restore it from
                the Trash Bin during this period.
              </p>

              <div className="mt-4 border rounded-lg p-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-800">
                  {qrToTrash.title || "Untitled QR"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {qrToTrash.content}
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={cancelMoveToTrash}
                  disabled={isMoving}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMoveToTrash}
                  disabled={isMoving}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {isMoving && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Move to Trash</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </AuthGuard>
  );
}
