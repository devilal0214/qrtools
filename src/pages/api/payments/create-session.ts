import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { createCCAvenueSession } from '@/lib/ccavenue';

// Initialize payment gateways
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gateway, planId, userId, amount, currency = 'USD' } = req.body;

    let session;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create order document
    await adminDb.collection('orders').doc(orderId).set({
      userId,
      planId,
      amount,
      currency,
      gateway,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    switch (gateway) {
      case 'stripe':
        session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency,
              product_data: {
                name: 'QR Code Plan',
              },
              unit_amount: amount * 100,
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${req.headers.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.headers.origin}/payment/cancel`,
          metadata: {
            orderId,
            userId,
            planId
          }
        });
        break;

      case 'razorpay':
        session = await razorpay.orders.create({
          amount: amount * 100,
          currency,
          receipt: orderId,
          notes: {
            userId,
            planId
          }
        });
        break;

      case 'ccavenue':
        const ccavenueSession = await createCCAvenueSession({
          orderId,
          amount,
          currency,
          userId,
          planId,
          redirectUrl: `${req.headers.origin}/payment/success`, // Changed from successUrl
          cancelUrl: `${req.headers.origin}/payment/cancel`
        });
        session = ccavenueSession;
        break;

      default:
        throw new Error('Invalid payment gateway');
    }

    res.status(200).json({ session });
  } catch (error: any) {
    console.error('Payment session creation error:', error);
    res.status(500).json({ error: error.message });
  }
}
