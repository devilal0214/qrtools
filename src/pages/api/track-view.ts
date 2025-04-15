import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { qrId } = req.body;

  try {
    // Add scan record
    await adminDb.collection('scans').add({
      qrId,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    // Increment scan count in QR code document
    const qrRef = adminDb.collection('qrcodes').doc(qrId);
    await adminDb.runTransaction(async (transaction) => {
      const qrDoc = await transaction.get(qrRef);
      if (!qrDoc.exists) {
        throw new Error('QR code not found');
      }

      const newScans = (qrDoc.data()?.scans || 0) + 1;
      transaction.update(qrRef, { scans: newScans });
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking view:', error);
    return res.status(500).json({ error: 'Failed to track view' });
  }
}
