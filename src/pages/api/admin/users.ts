import { adminAuth } from '@/lib/firebase-admin';
import { adminDb } from '@/lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all users from Firebase Auth
    const listUsersResult = await adminAuth.listUsers();
    const authUsers = listUsersResult.users;

    // Get all user documents from Firestore
    const usersSnapshot = await adminDb.collection('users').get();
    const firestoreUsers = Object.fromEntries(
      usersSnapshot.docs.map(doc => [doc.id, doc.data()])
    );

    // Merge auth and Firestore data
    const users = await Promise.all(authUsers.map(async (authUser) => {
      const firestoreData = firestoreUsers[authUser.uid] || {};
      
      // Get custom claims to check if user is admin
      const customClaims = (await adminAuth.getUser(authUser.uid)).customClaims;
      
      return {
        id: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName || firestoreData.displayName,
        photoURL: authUser.photoURL,
        provider: authUser.providerData[0]?.providerId || 'email',
        createdAt: authUser.metadata.creationTime,
        lastLoginAt: authUser.metadata.lastSignInTime,
        isActive: firestoreData.isActive ?? true,
        subscription: firestoreData.subscription || { plan: 'Free' },
        role: customClaims?.admin ? 'admin' : 'user'  // Set role based on admin claim
      };
    }));

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    return res.status(500).json({ error: 'Failed to list users' });
  }
}
