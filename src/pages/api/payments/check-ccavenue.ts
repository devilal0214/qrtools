import type { NextApiRequest, NextApiResponse } from 'next';
import { ccavenue } from '@/lib/ccavenue';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const isConfigured = ccavenue.isConfigured();
    res.status(200).json({ 
      configured: isConfigured,
      merchantId: process.env.CCAVENUE_MERCHANT_ID ? 'Present' : 'Missing',
      accessCode: process.env.CCAVENUE_ACCESS_CODE ? 'Present' : 'Missing',
      workingKey: process.env.CCAVENUE_WORKING_KEY ? 'Present' : 'Missing'
    });
  } catch (error) {
    res.status(500).json({ error: 'CCAvenue configuration error' });
  }
}
