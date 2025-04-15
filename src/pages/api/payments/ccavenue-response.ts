import type { NextApiRequest, NextApiResponse } from 'next';
import { decryptResponse } from '@/utils/payments/ccavenue';
import { db } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { encResp } = req.body;
    const workingKey = process.env.CCAVENUE_WORKING_KEY!;

    // Decrypt the response
    const decryptedResponse = decryptResponse(encResp, workingKey);
    const responseParams = new URLSearchParams(decryptedResponse);
    
    const orderId = responseParams.get('order_id');
    const orderStatus = responseParams.get('order_status');
    const userId = responseParams.get('merchant_param1');
    const planId = responseParams.get('merchant_param2');

    if (!orderId || !orderStatus || !userId || !planId) {
      throw new Error('Invalid response parameters');
    }

    // Update order status in Firestore
    await db.collection('orders').doc(orderId).update({
      status: orderStatus.toLowerCase(),
      updatedAt: new Date().toISOString(),
      paymentDetails: Object.fromEntries(responseParams)
    });

    // If payment successful, update user subscription
    if (orderStatus === 'Success') {
      await db.collection('subscriptions').add({
        userId,
        planId,
        status: 'active',
        orderId,
        createdAt: new Date().toISOString(),
        startDate: new Date().toISOString(),
        // Add 30 days to current date
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Redirect based on status
    const redirectUrl = orderStatus === 'Success'
      ? '/payment/success'
      : '/payment/failure';

    res.redirect(302, `${redirectUrl}?orderId=${orderId}`);
  } catch (error) {
    console.error('CCAvenue response error:', error);
    res.redirect(302, '/payment/failure');
  }
}
