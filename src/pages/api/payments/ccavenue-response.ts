import type { NextApiRequest, NextApiResponse } from 'next';
import { decryptData } from '@/utils/payments/ccavenue';
import { db } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { encResp } = req.body;
    const workingKey = process.env.CCAVENUE_WORKING_KEY;

    if (!workingKey || !encResp) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const decryptedData = decryptData(encResp, workingKey);
    const responseParams = new URLSearchParams(decryptedData);
    
    const orderId = responseParams.get('order_id');
    const orderStatus = responseParams.get('order_status');
    const userId = responseParams.get('merchant_param1');
    const planId = responseParams.get('merchant_param2');

    if (!orderId || !orderStatus || !userId || !planId) {
      throw new Error('Invalid response parameters');
    }

    await db.collection('orders').doc(orderId).update({
      status: orderStatus.toLowerCase(),
      updatedAt: new Date().toISOString(),
      paymentDetails: Object.fromEntries(responseParams)
    });

    if (orderStatus === 'Success') {
      await db.collection('subscriptions').add({
        userId,
        planId,
        status: 'active',
        orderId,
        createdAt: new Date().toISOString(),
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    const redirectUrl = orderStatus === 'Success'
      ? '/payment/success'
      : '/payment/failure';

    res.redirect(302, `${redirectUrl}?orderId=${orderId}`);
  } catch (error) {
    console.error('CCAvenue response error:', error);
    return res.status(500).json({ message: 'Failed to process payment response' });
  }
}
