// src/components/DashboardLayout.tsx
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

import { collection, query, where, onSnapshot } from "firebase/firestore";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // ✅ REAL COUNTS FROM FIRESTORE
  const [counts, setCounts] = useState({ active: 0, paused: 0 });

  const router = useRouter();
  const { canUseFeature } = usePlanFeatures();

  // Helper to know if a link is current
  const isRouteActive = (href: string) => router.pathname === href;

  // ✅ Listen to Active + Paused counts in real time
  useEffect(() => {
    const uid = auth.currentUser?.uid;

    // if not logged in, just show 0
    if (!uid) {
      setCounts({ active: 0, paused: 0 });
      return;
    }

    const activeQ = query(
      collection(db, "qrcodes"),
      where("userId", "==", uid),
      where("isActive", "==", true)
    );

    const pausedQ = query(
      collection(db, "qrcodes"),
      where("userId", "==", uid),
      where("isActive", "==", false)
    );

    const unsubActive = onSnapshot(
      activeQ,
      (snap) => {
        setCounts((prev) => ({ ...prev, active: snap.size }));
      },
      (err) => console.error("Active count listener error:", err)
    );

    const unsubPaused = onSnapshot(
      pausedQ,
      (snap) => {
        setCounts((prev) => ({ ...prev, paused: snap.size }));
      },
      (err) => console.error("Paused count listener error:", err)
    );

    return () => {
      unsubActive();
      unsubPaused();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top red trial bar (like in screenshot) */}
      <div className="w-full bg-red-500 text-[15px] text-white text-center py-1">
        Your 14-day free trial has ended. Upgrade your account to enjoy the full
        benefits of JV QR Code Generator.
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Logo / Brand */}
            <div className="h-16 flex items-center px-4 border-b">
              <Link
                href="/dashboard/active"
                className="flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-md bg-black text-white flex items-center justify-center text-[10px] font-bold">
                  QR
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    JV QR CODE
                  </span>
                  <span className="text-[13px] font-semibold">GENERATOR</span>
                </div>
              </Link>
            </div>

            {/* Nav: My QR Codes */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
              <div>
                <p className="px-2 text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  My QR Codes
                </p>
                <ul className="space-y-1">
                  {/* Active */}
                  <li>
                    <Link
                      href="/dashboard/active"
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        isRouteActive("/dashboard/active")
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>Active</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        ({counts.active})
                      </span>
                    </Link>
                  </li>

                  {/* Paused */}
                  <li>
                    <Link
                      href="/dashboard/paused"
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        isRouteActive("/dashboard/paused")
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>Paused</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        ({counts.paused})
                      </span>
                    </Link>
                  </li>

                  {/* Analytics */}
                  <li>
                    <Link
                      href="/dashboard/analytics"
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        isRouteActive("/dashboard/analytics")
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                        <span>Analytics</span>
                      </span>
                    </Link>
                  </li>

                  {/* Trash Bin */}
                  <li>
                    <Link
                      href="/dashboard/trash"
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        isRouteActive("/dashboard/trash")
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 6h18M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h12z"
                          />
                        </svg>
                        <span>Trash Bin</span>
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Tools */}
              <div className="border-t pt-4 mt-4">
                <p className="px-2 text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Tools
                </p>
                <ul className="space-y-1 text-sm">
                  <li>
                    <Link
                      href="/dashboard/short-urls"
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        isRouteActive("/dashboard/short-urls")
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      <span>Short URLs</span>
                    </Link>
                  </li>

                  {canUseFeature("virtualTour") && (
                    <li>
                      <Link
                        href="/dashboard/virtual-tours"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                          isRouteActive("/dashboard/virtual-tours")
                            ? "bg-gray-100 text-gray-900"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Virtual Tours</span>
                      </Link>
                    </li>
                  )}

                  <li>
                    <Link
                      href="/dashboard/plans"
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        isRouteActive("/dashboard/plans")
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                        />
                      </svg>
                      <span>My Plans</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </nav>

            {/* Bottom "Dynamic Codes" + Upgrade */}
            <div className="border-t px-4 py-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-600">Dynamic Codes</span>
                <span className="text-gray-500">0/2</span>
              </div>
              <button className="w-full text-xs font-semibold text-emerald-700 border border-emerald-600/70 rounded-md py-1.5 hover:bg-emerald-50">
                Upgrade
              </button>
            </div>
          </div>
        </aside>

        {/* Main content + top header */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header */}
          <header className="h-16 bg-white border-b px-4 flex items-center justify-between sticky top-0 z-20">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div className="flex-1" />

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-lg"
              >
                <span className="text-sm">
                  {auth.currentUser?.email ?? "User"}
                </span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Profile Settings
                  </Link>
                  <button
                    onClick={() => {
                      signOut(auth);
                      router.push("/");
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
            {children}
          </main>
        </div>

        {/* Mobile backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 lg:hidden z-20"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
