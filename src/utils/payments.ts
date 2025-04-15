import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { loadScript } from '@paypal/paypal-js';
import CCAvenue from 'ccavenue-node';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use the latest API version
});

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

// Initialize CCAvenue
const ccav = new CCAvenue({
  merchant_id: process.env.CCAVENUE_MERCHANT_ID!,
  working_key: process.env.CCAVENUE_WORKING_KEY!,
  access_code: process.env.CCAVENUE_ACCESS_CODE!
});

// Payment Gateway Factory
export const getPaymentGateway = (gateway: 'stripe' | 'razorpay' | 'paypal' | 'ccavenue') => {
  switch (gateway) {
    case 'stripe':
      return stripe;
    case 'razorpay':
      return razorpay;
    case 'paypal':
      return {
        loadPayPalScript: async () => {
          return loadScript({
            clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!
          });
        }
      };
    case 'ccavenue':
      return ccav;
    default:
      return stripe;
  }
};

export const createCheckoutSession = async ({
  priceId,
  userId,
  planId,
  successUrl,
  cancelUrl,
}: {
  priceId: string;
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId,
        planId
      },
    });

    return session;
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    throw new Error(error.message);
  }
};

export const createPaymentSession = async ({
  gateway,
  amount,
  currency,
  orderId,
  userId,
  planId,
  successUrl,
  cancelUrl
}: {
  gateway: 'stripe' | 'razorpay' | 'paypal' | 'ccavenue';
  amount: number;
  currency: string;
  orderId: string;
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}) => {
  try {
    switch (gateway) {
      case 'razorpay':
        return await razorpay.orders.create({
          amount: amount * 100, // Razorpay expects amount in smallest currency unit
          currency,
          receipt: orderId,
          notes: {
            userId,
            planId
          }
        });

      case 'ccavenue':
        return ccav.getEncryptedOrder({
          order_id: orderId,
          amount: amount.toString(),
          currency,
          redirect_url: successUrl,
          cancel_url: cancelUrl,
          merchant_param1: userId,
          merchant_param2: planId
        });

      case 'paypal':
        // PayPal is handled client-side
        return null;

      default:
        return createCheckoutSession({
          priceId: planId,
          userId,
          orderId,
          successUrl,
          cancelUrl
        });
    }
  } catch (error: any) {
    console.error('Error creating payment session:', error);
    throw new Error(error.message);
  }
};

export const getSubscription = async (subscriptionId: string) => {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error: any) {
    console.error('Error retrieving subscription:', error);
    throw new Error(error.message);
  }
};
