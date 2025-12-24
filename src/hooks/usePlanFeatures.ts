import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { ContentTypes } from '@/types/qr';

interface PlanFeatures {
  loading: boolean;
  planName: string;
  features: Record<string, boolean>;
  enabledContentTypes: string[];
  qrLimit: number;
  qrCreated: number;
  remainingQRs: number;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialEndsAt: Date | null;
  canCreateMoreQR: () => boolean;
  canUseFeature: (feature: string) => boolean;
  canUseContentType: (type: string) => boolean;
}

// Premium features that require subscription or active trial
const PREMIUM_FEATURES = [
  'tracking',
  'removeWatermark',
  'dynamicQR',
  'frames',
  'analytics',
  'customDomain',
  'pauseResume',
  'customization'
];

// Map app feature names to plan feature keys
const FEATURE_KEY_MAP: Record<string, string> = {
  'tracking': 'analytics',
  'removeWatermark': 'customization',
  'dynamicQR': 'dynamic',
  'frames': 'customization',
  'analytics': 'analytics',
  'customDomain': 'customDomain',
  'pauseResume': 'pauseResume',
  'customization': 'customization'
};


export function usePlanFeatures(): PlanFeatures {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState<any>(null);
  const [qrCount, setQrCount] = useState(0);
  const [trialDays, setTrialDays] = useState(14);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [freePlanConfig, setFreePlanConfig] = useState<any>(null);

  useEffect(() => {
    // Fetch free plan config first
    fetchFreePlanConfig();
    
    if (user) {
      fetchTrialSettings();
      fetchUserPlan();
      fetchQRCount();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchFreePlanConfig = async () => {
    try {
      // First, try to find a "Free" plan in plans collection
      const plansQuery = query(
        collection(db, 'plans'),
        where('name', '==', 'Free'),
        where('price', '==', 0),
        limit(1)
      );
      const plansSnapshot = await getDocs(plansQuery);
      
      if (!plansSnapshot.empty) {
        // Use the Free plan from database
        setFreePlanConfig(plansSnapshot.docs[0].data());
      } else {
        // Fallback: Check settings/config for default free tier
        const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          if (settings?.freeTier) {
            setFreePlanConfig(settings.freeTier);
          } else {
            // Ultimate fallback: Use hardcoded defaults
            setFreePlanConfig({
              name: 'Free',
              qrLimit: 5,
              enabledContentTypes: ['URL', 'PLAIN_TEXT'],
              features: [
                { key: 'qrLimit', label: 'QR Code Limit', value: 5, type: 'number' },
                { key: 'analytics', label: 'Analytics', value: false, type: 'boolean' },
                { key: 'customization', label: 'Customization', value: false, type: 'boolean' },
                { key: 'dynamic', label: 'Dynamic QR', value: false, type: 'boolean' }
              ]
            });
          }
        } else {
          // Ultimate fallback
          setFreePlanConfig({
            name: 'Free',
            qrLimit: 5,
            enabledContentTypes: ['URL', 'PLAIN_TEXT'],
            features: [
              { key: 'qrLimit', label: 'QR Code Limit', value: 5, type: 'number' },
              { key: 'analytics', label: 'Analytics', value: false, type: 'boolean' },
              { key: 'customization', label: 'Customization', value: false, type: 'boolean' },
              { key: 'dynamic', label: 'Dynamic QR', value: false, type: 'boolean' }
            ]
          });
        }
      }
    } catch (error) {
      console.error('Error fetching free plan config:', error);
      // Set fallback config
      setFreePlanConfig({
        name: 'Free',
        qrLimit: 5,
        enabledContentTypes: ['URL', 'PLAIN_TEXT'],
        features: [
          { key: 'qrLimit', label: 'QR Code Limit', value: 5, type: 'number' },
          { key: 'analytics', label: 'Analytics', value: false, type: 'boolean' },
          { key: 'customization', label: 'Customization', value: false, type: 'boolean' },
          { key: 'dynamic', label: 'Dynamic QR', value: false, type: 'boolean' }
        ]
      });
    }
  };

  const fetchTrialSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data();
        if (settings?.trial?.durationDays) {
          setTrialDays(settings.trial.durationDays);
        }
      }
    } catch (error) {
      console.error('Error fetching trial settings:', error);
    }
  };

  const fetchUserPlan = async () => {
    try {
      // Check for active subscription
      const subsQuery = query(
        collection(db, 'subscriptions'),
        where('userId', '==', user.uid),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const subsSnapshot = await getDocs(subsQuery);
      
      if (!subsSnapshot.empty) {
        const subscription = subsSnapshot.docs[0].data();
        const planRef = doc(db, 'plans', subscription.planId);
        const planDoc = await getDoc(planRef);
        
        if (planDoc.exists()) {
          setPlanData({
            ...planDoc.data(),
            id: planDoc.id,
            subscriptionId: subsSnapshot.docs[0].id,
            endDate: subscription.endDate
          });
        }
      } else {
        // No subscription - check trial period
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Use free plan config from admin settings
          const freeConfig = freePlanConfig || {
            name: 'Free',
            qrLimit: 5,
            enabledContentTypes: ['URL', 'PLAIN_TEXT'],
            features: []
          };
          
          setPlanData({
            ...freeConfig,
            createdAt: userData.createdAt || new Date().toISOString()
          });
        } else {
          // New user - use free plan config
          const freeConfig = freePlanConfig || {
            name: 'Free',
            qrLimit: 5,
            enabledContentTypes: ['URL', 'PLAIN_TEXT'],
            features: []
          };
          
          setPlanData({
            ...freeConfig,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQRCount = async () => {
    try {
      const qrQuery = query(
        collection(db, 'qrcodes'),
        where('userId', '==', user.uid)
      );
      const qrSnapshot = await getDocs(qrQuery);
      setQrCount(qrSnapshot.size);
    } catch (error) {
      console.error('Error fetching QR count:', error);
    }
  };

  const getTrialStatus = () => {
    if (!user || !planData?.createdAt) {
      return { isActive: false, daysRemaining: 0, endsAt: null };
    }

    // Don't check trial if user has active subscription
    if (planData?.subscriptionId) {
      return { isActive: false, daysRemaining: 0, endsAt: null };
    }

    const createdDate = new Date(planData.createdAt);
    
    // Calculate trial end date: registration date + trialDays
    // Example: Registered Dec 15 + 14 days = Trial ends Dec 29 at 23:59:59
    const trialEndDate = new Date(createdDate);
    trialEndDate.setDate(createdDate.getDate() + trialDays);
    trialEndDate.setHours(23, 59, 59, 999); // End of day
    
    // Current date and time
    const now = new Date();
    
    // Calculate days remaining from NOW to trial end
    const timeRemaining = trialEndDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
    
    // Debug logging
    console.log('Trial Calculation:', {
      registrationDate: createdDate.toISOString(),
      trialDays,
      trialEndDate: trialEndDate.toISOString(),
      now: now.toISOString(),
      timeRemaining,
      daysRemaining: Math.max(0, daysRemaining)
    });

    // Trial is active if we haven't passed the end date
    return {
      isActive: daysRemaining > 0,
      daysRemaining: Math.max(0, daysRemaining),
      endsAt: trialEndDate
    };
  };

  const trialStatus = getTrialStatus();
  const hasPremiumAccess = !loading && (planData?.subscriptionId || trialStatus.isActive);

  // Build features object from actual plan data
  const buildFeatures = () => {
    const featuresObj: Record<string, boolean> = {};
    
    // ✅ IMPORTANT: Check subscription FIRST, then trial, then free
    // Trial users have no subscriptionId, so check that first!
    if (planData?.subscriptionId && planData?.features && Array.isArray(planData.features)) {
      // For paid users with active subscription, use plan features
      // First, store all plan features by their actual keys
      const planFeatures: Record<string, boolean> = {};
      planData.features.forEach((feature: any) => {
        if (feature.type === 'boolean') {
          planFeatures[feature.key] = Boolean(feature.value);
        }
      });
      
      // Map app feature names to plan feature keys
      PREMIUM_FEATURES.forEach(appFeature => {
        const planKey = FEATURE_KEY_MAP[appFeature] || appFeature;
        featuresObj[appFeature] = planFeatures[planKey] || false;
      });
    } else if (trialStatus.isActive) {
      // For trial users (no subscription but within trial period), enable all premium features
      PREMIUM_FEATURES.forEach(feature => {
        featuresObj[feature] = true;
      });
    } else {
      // For free users (no subscription, trial expired), disable all premium features
      PREMIUM_FEATURES.forEach(feature => {
        featuresObj[feature] = false;
      });
    }
    
    return featuresObj;
  };

  // Get QR limit from plan features or default
  const getQRLimit = () => {
    if (planData?.features && Array.isArray(planData.features)) {
      const qrLimitFeature = planData.features.find((f: any) => f.key === 'qrLimit');
      if (qrLimitFeature) {
        return Number(qrLimitFeature.value) || 5;
      }
    }
    // Fallback to planData.qrLimit or free plan config or default 5
    return planData?.qrLimit || freePlanConfig?.qrLimit || 5;
  };

  const qrLimit = getQRLimit();

  return {
    loading,
    planName: planData?.name || 'Free',
    features: buildFeatures(),
    enabledContentTypes: planData?.enabledContentTypes || ['URL', 'PLAIN_TEXT'],
    qrLimit,
    qrCreated: qrCount,
    remainingQRs: Math.max(0, qrLimit - qrCount),
    isTrialActive: trialStatus.isActive,
    trialDaysRemaining: trialStatus.daysRemaining,
    trialEndsAt: trialStatus.endsAt,
    canCreateMoreQR: () => true, // Always allow on frontend, limits enforced in dashboard
    canUseFeature: (feature: string) => {
      const features = buildFeatures();
      // If feature is in plan features, use that value
      if (features.hasOwnProperty(feature)) {
        return features[feature];
      }
      // Otherwise, allow if not a premium feature
      return !PREMIUM_FEATURES.includes(feature);
    },
    canUseContentType: (type: string) => {
      const enabledTypes = planData?.enabledContentTypes || ['URL', 'PLAIN_TEXT'];
      return enabledTypes.includes(type);
    }
  };
}
