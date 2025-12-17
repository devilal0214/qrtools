import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import DashboardLayout from '@/components/DashboardLayout';
import Head from 'next/head';
import AuthGuard from '@/components/AuthGuard';

export default function Dashboard() {
  const { 
    planName, 
    features, 
    remainingQRs,
    qrLimit,
    isTrialActive, 
    trialDaysRemaining,
    canUseFeature 
  } = usePlanFeatures();
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    setRemaining(remainingQRs);
  }, [remainingQRs]);

  return (
    <DashboardLayout>
      <Head>
        <title>Dashboard - QR Tools</title>
      </Head>

      <div className="space-y-6">
        {/* Trial Banner */}
        {isTrialActive && (
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">🎉 Premium Trial Active</h3>
                <p className="text-purple-100">
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
                </p>
              </div>
              <Link
                href="/pricing"
                className="bg-white text-purple-600 px-6 py-2 rounded-full font-semibold hover:bg-purple-50 transition-colors"
              >
                Upgrade Now
              </Link>
            </div>
          </div>
        )}

        {/* Plan Info */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Current Plan</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isTrialActive 
                  ? 'bg-purple-100 text-purple-700' 
                  : planName === 'Free' 
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-blue-100 text-blue-700'
              }`}>
                {isTrialActive ? 'Trial' : planName}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{planName}</p>
            {!isTrialActive && planName === 'Free' && (
              <Link href="/pricing" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">
                Upgrade to Premium →
              </Link>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-2">QR Codes Remaining</h3>
            <p className="text-2xl font-bold text-gray-900">{remaining}</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${qrLimit > 0 ? (remaining / qrLimit) * 100 : 0}%` }}
              />
            </div>
            {remaining <= 5 && (
              <p className="text-xs text-orange-600 mt-2">Running low! Upgrade for more.</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Premium Features</h3>
            <div className="space-y-2">
              {['tracking', 'removeWatermark', 'frames'].map(feature => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  {canUseFeature(feature) ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={canUseFeature(feature) ? 'text-gray-700' : 'text-gray-400'}>
                    {feature.charAt(0).toUpperCase() + feature.slice(1).replace(/([A-Z])/g, ' $1')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Create QR</h4>
                <p className="text-xs text-gray-500">Generate new code</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/active" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Active QRs</h4>
                <p className="text-xs text-gray-500">View all codes</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/analytics" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Analytics</h4>
                <p className="text-xs text-gray-500">{canUseFeature('analytics') ? 'View stats' : '🔒 Premium'}</p>
              </div>
            </div>
          </Link>

          <Link href="/pricing" className="bg-gradient-to-br from-purple-600 to-pink-600 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-white">Upgrade</h4>
                <p className="text-xs text-purple-100">Unlock all features</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
