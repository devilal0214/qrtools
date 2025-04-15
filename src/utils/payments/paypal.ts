import { loadScript } from '@paypal/paypal-js';

export const createPayPalSession = async ({
  amount,
  currency,
  orderId,
  successUrl,
  cancelUrl
}: {
  amount: number;
  currency: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
}) => {
  try {
    const paypal = await loadScript({
      'client-id': process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
      currency
    });

    return {
      amount,
      currency,
      orderId,
      successUrl,
      cancelUrl,
      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
    };
  } catch (error) {
    console.error('PayPal initialization failed:', error);
    throw error;
  }
};
