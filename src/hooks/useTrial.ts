import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';

interface TrialInfo {
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  trialDays: number;
  isExpired: boolean;
}

export const useTrialPeriod = () => {
  const { user } = useAuth();
  const [trialInfo, setTrialInfo] = useState<TrialInfo>({
    isTrialActive: false,
    trialEndsAt: null,
    daysRemaining: 0,
    trialDays: 14,
    isExpired: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTrialStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch trial settings from admin config
        const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
        const trialSettings = settingsDoc.exists() 
          ? settingsDoc.data()?.trial 
          : { enabled: true, durationDays: 14 };

        // Fetch user data
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          // New user - create trial period
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + trialSettings.durationDays);
          
          setTrialInfo({
            isTrialActive: trialSettings.enabled,
            trialEndsAt,
            daysRemaining: trialSettings.durationDays,
            trialDays: trialSettings.durationDays,
            isExpired: false
          });
          
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        
        // Check if user has active subscription
        if (userData.subscriptionStatus === 'active') {
          setTrialInfo({
            isTrialActive: false,
            trialEndsAt: null,
            daysRemaining: 0,
            trialDays: trialSettings.durationDays,
            isExpired: false
          });
          setLoading(false);
          return;
        }

        // Calculate trial status
        const createdAt = userData.createdAt ? new Date(userData.createdAt) : new Date();
        const trialEndsAt = new Date(createdAt);
        trialEndsAt.setDate(trialEndsAt.getDate() + trialSettings.durationDays);
        
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const isExpired = now > trialEndsAt;

        setTrialInfo({
          isTrialActive: trialSettings.enabled && !isExpired,
          trialEndsAt,
          daysRemaining,
          trialDays: trialSettings.durationDays,
          isExpired
        });
      } catch (error) {
        console.error('Error checking trial status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkTrialStatus();
  }, [user]);

  return { ...trialInfo, loading };
};
