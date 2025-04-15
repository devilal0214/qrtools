import { adminAuth } from '@/lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  try {
    // Get user by email
    const user = await adminAuth.getUserByEmail(email);
    
    // Set admin custom claim
    await adminAuth.setCustomUserClaims(user.uid, { admin: true });

    return res.status(200).json({ message: 'Admin claim set successfully' });
  } catch (error) {
    console.error('Error setting admin claim:', error);
    return res.status(500).json({ error: 'Failed to set admin claim' });
  }
}
