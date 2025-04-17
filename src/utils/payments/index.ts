import { loadStripe } from '@stripe/stripe-js';
import Razorpay from 'razorpay';
import { loadScript } from '@paypal/paypal-js';
import { createCCAvenueSession } from './ccavenue';
import { initializePayPal } from './paypal';

const stripe = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

export type PaymentGateway = 'stripe' | 'razorpay' | 'paypal' | 'ccavenue';

export const initializePayment = async ({
  gateway,
  amount,
  orderId,
  userId,
  planId,
  successUrl,
  cancelUrl
}: {
  gateway: PaymentGateway;
  amount: number;
  orderId: string;
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}) => {
  try {
    switch (gateway) {
      case 'stripe':
        return stripe;
      
      case 'razorpay':
        return await razorpay.orders.create({
          amount: amount * 100,
          currency: 'INR',
          receipt: orderId,
          notes: { userId, planId }
        });

      case 'paypal':
        return await initializePayPal({ currency: 'USD' });

      case 'ccavenue':
        return await createCCAvenueSession({
          orderId,
          amount,
          userId,
          planId,
          successUrl,
          cancelUrl
        });

      default:
        throw new Error('Invalid payment gateway');
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    throw error;
  }
};

// Add test method
export const testPaymentFlow = async () => {
  try {
    const testPayment = await initializePayment({
      gateway: 'stripe',
      amount: 100,
      orderId: 'test-order',
      userId: 'test-user',
      planId: 'test-plan',
      successUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel'
    });
    console.log('Payment test result:', testPayment);
    return true;
  } catch (error) {
    console.error('Payment test failed:', error);
    return false;
  }
};
