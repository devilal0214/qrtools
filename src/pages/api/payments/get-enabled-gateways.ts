import { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all active payment gateways using Admin SDK
    const snapshot = await adminDb.collection('payment_gateways')
      .where('isActive', '==', true)
      .get();
    
    const gateways = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      displayName: doc.data().displayName
    }));

    return res.status(200).json({ gateways });
  } catch (error) {
    console.error('Error fetching enabled gateways:', error);
    return res.status(500).json({ error: 'Failed to fetch payment gateways' });
  }
}
