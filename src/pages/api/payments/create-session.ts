import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { createCCAvenueSession } from '@/lib/ccavenue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gateway, planId, userId, amount, currency = 'USD' } = req.body;

    // Fetch gateway credentials from Firestore
    const gatewayDoc = await adminDb.collection('payment_gateways').doc(gateway).get();
    
    if (!gatewayDoc.exists || !gatewayDoc.data()?.isActive) {
      return res.status(400).json({ error: 'Payment gateway is not active or configured' });
    }

    const gatewayData = gatewayDoc.data();
    const credentials = gatewayData?.credentials || {};

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
        if (!credentials.secretKey) {
          return res.status(400).json({ error: 'Stripe credentials not configured' });
        }
        
        const stripe = new Stripe(credentials.secretKey, {
          apiVersion: '2023-10-16' as Stripe.LatestApiVersion
        });

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
          success_url: `${req.headers.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`,
          cancel_url: `${req.headers.origin}/pricing`,
          metadata: {
            orderId,
            userId,
            planId
          }
        });
        break;

      case 'razorpay':
        if (!credentials.keyId || !credentials.keySecret) {
          return res.status(400).json({ error: 'Razorpay credentials not configured' });
        }

        const razorpay = new Razorpay({
          key_id: credentials.keyId,
          key_secret: credentials.keySecret
        });

        session = await razorpay.orders.create({
          amount: amount * 100,
          currency: currency === 'USD' ? 'INR' : currency, // Razorpay primarily uses INR
          receipt: orderId,
          notes: {
            userId,
            planId
          }
        });
        break;

      case 'paypal':
        if (!credentials.clientId || !credentials.clientSecret) {
          return res.status(400).json({ error: 'PayPal credentials not configured' });
        }
        
        // PayPal integration
        const paypalAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
        const paypalResponse = await fetch(`https://api${gatewayData.sandboxMode ? '-m.sandbox' : ''}.paypal.com/v2/checkout/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${paypalAuth}`
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
              amount: {
                currency_code: currency,
                value: amount.toString()
              },
              reference_id: orderId
            }],
            application_context: {
              return_url: `${req.headers.origin}/payment/success?orderId=${orderId}`,
              cancel_url: `${req.headers.origin}/pricing`
            }
          })
        });

        session = await paypalResponse.json();
        break;

      case 'ccavenue':
        if (!credentials.merchantId || !credentials.accessCode || !credentials.workingKey) {
          return res.status(400).json({ error: 'CCAvenue credentials not configured' });
        }

        const ccavenueSession = await createCCAvenueSession({
          orderId,
          amount,
          currency,
          userId,
          planId,
          redirectUrl: `${req.headers.origin}/payment/success`,
          cancelUrl: `${req.headers.origin}/pricing`
        });
        session = ccavenueSession;
        break;

      default:
        return res.status(400).json({ error: 'Invalid payment gateway' });
    }

    res.status(200).json({ session });
  } catch (error: any) {
    console.error('Payment session creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment session' });
  }
}
