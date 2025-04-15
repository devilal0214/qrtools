import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userRecord = await adminAuth.getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }

    // Set secure cookie for admin session
    res.setHeader('Set-Cookie', [
      `admin-token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`,
      'is-admin=true; Path=/; Secure; SameSite=Strict; Max-Age=3600'
    ]);

    res.status(200).json({ status: 'success', isAdmin: true });
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(401).json({ error: 'Invalid token or unauthorized' });
  }
}
