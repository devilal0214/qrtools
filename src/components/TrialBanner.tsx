import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import Link from 'next/link';

export default function TrialBanner() {
  const { isTrialActive, trialDaysRemaining, trialEndsAt, loading } = usePlanFeatures();

  if (loading || !isTrialActive) {
    return null;
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold">
              {trialDaysRemaining === 0 
                ? '🎉 Trial expires today!' 
                : `🎁 Premium Trial Active - ${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'day' : 'days'} remaining`}
            </p>
            <p className="text-sm text-white/90">
              Trial ends on {formatDate(trialEndsAt)}
            </p>
          </div>
        </div>
        
        <Link
          href="/pricing"
          className="px-6 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg"
        >
          Upgrade Now
        </Link>
      </div>
    </div>
  );
}
