import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { ContentTypes } from '@/types/qr';

export function usePlanFeatures() {
  const { user } = useAuth();
  const [qrLimitState, setQrLimitState] = useState({ limit: 100, created: 0 });

  // Return a simplified version that only checks for user authentication
  return {
    loading: false,
    features: {},
    enabledContentTypes: Object.keys(ContentTypes), // Use keys instead of values
    qrLimit: qrLimitState.limit,
    qrCreated: qrLimitState.created,
    remainingQRs: qrLimitState.limit - qrLimitState.created,
    canCreateMoreQR: () => true, // Always allow creating QR codes
    canUseFeature: () => true, // Always allow features
    canUseContentType: () => true // Always allow all content types
  };
}
