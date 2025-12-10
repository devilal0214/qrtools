import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Head from "next/head";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowUturnLeftIcon, TrashIcon } from "@heroicons/react/24/outline";

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

const TRASH_RETENTION_DAYS = 30;

const truncateTitle = (title: string, maxLength: number = 30) => {
  if (!title || title.length <= maxLength) return title;
  return `${title.substring(0, maxLength)}...`;
};

const truncateContent = (content: string, maxLength: number = 40) => {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + "...";
};

export default function TrashPage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrash = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const q = query(
          collection(db, "qrcodes"),
          where("userId", "==", user.uid),
          where("isDeleted", "==", true)
        );

        const snap = await getDocs(q);
        const now = Date.now();
        const maxAgeMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

        const activeTrash: QRCode[] = [];
        const autoDelete: string[] = [];

        snap.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() } as QRCode;
          const deletedTime = data.deletedAt ? Date.parse(data.deletedAt) : 0;

          if (deletedTime && now - deletedTime > maxAgeMs) {
            autoDelete.push(docSnap.id);
          } else {
            activeTrash.push(data);
          }
        });

        await Promise.all(
          autoDelete.map((id) => deleteDoc(doc(db, "qrcodes", id)))
        );

        setCodes(activeTrash);
      } catch (err) {
        console.error("Error loading trash:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrash();
  }, [user]);

  const handleRestore = async (qrCode: QRCode) => {
    try {
      const qrRef = doc(db, "qrcodes", qrCode.id);

      await updateDoc(qrRef, {
        isDeleted: false,
        deletedAt: null,
        isActive: false, // restored as paused
        updatedAt: new Date().toISOString(),
      });

      setCodes((prev) => prev.filter((c) => c.id !== qrCode.id));
    } catch (err) {
      console.error("Error restoring QR:", err);
    }
  };

  const handlePermanentDelete = async (qrCode: QRCode) => {
    try {
      await deleteDoc(doc(db, "qrcodes", qrCode.id));
      setCodes((prev) => prev.filter((c) => c.id !== qrCode.id));
    } catch (err) {
      console.error("Error permanently deleting QR:", err);
    }
  };

  const daysLeft = (deletedAt?: string) => {
    if (!deletedAt) return "-";
    const deletedTime = Date.parse(deletedAt);
    const now = Date.now();
    const maxAgeMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const remainingMs = maxAgeMs - (now - deletedTime);
    if (remainingMs <= 0) return "0";

    return Math.ceil(remainingMs / (24 * 60 * 60 * 1000)).toString();
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Trash Bin - Dashboard</title>
        </Head>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Trash Bin</h2>
            <Link
              href="/dashboard/paused"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Back to Paused
            </Link>
          </div>

          <p className="text-xs text-gray-500">
            This section contains only deleted QR codes. Each QR code will
            remain stored for {TRASH_RETENTION_DAYS} days and will be
            automatically removed afterward.
          </p>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-500">Trash bin is empty.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Content
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Deleted At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Days Left
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {codes.map((code) => (
                      <tr key={code.id}>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {truncateTitle(code.title || "Untitled")}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {code.type}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          <div className="truncate" title={code.content}>
                            {truncateContent(code.content)}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {code.deletedAt
                            ? new Date(code.deletedAt).toLocaleString()
                            : "-"}
                        </td>

                        <td className="px-6 py-4 text-sm text-red-600">
                          {daysLeft(code.deletedAt)}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRestore(code)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg"
                            >
                              <ArrowUturnLeftIcon className="w-4 h-4" />
                              <span>Restore</span>
                            </button>

                            <button
                              onClick={() => handlePermanentDelete(code)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                            >
                              <TrashIcon className="w-4 h-4" />
                              <span>Delete Forever</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
