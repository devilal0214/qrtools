import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get user by email
    const userRecord = await adminAuth.getUserByEmail(email);
    const userId = userRecord.uid;

    // Update or create user document in Firestore
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      // Update existing document
      await userRef.update({
        role: 'admin',
        isAdmin: true,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Create new document
      await userRef.set({
        email: userRecord.email,
        role: 'admin',
        isAdmin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: `Admin role set for user: ${email}`,
      userId: userId
    });
  } catch (error: any) {
    console.error('Error setting up admin:', error);
    return res.status(500).json({
      error: 'Failed to setup admin',
      message: error.message
    });
  }
}
