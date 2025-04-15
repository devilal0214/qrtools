import { loadScript } from "@paypal/paypal-js";

export const loadPayPalScript = async () => {
  return loadScript({
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    currency: "USD"
  });
};

export const createPayPalOrder = async ({
  planId,
  amount,
  currency = 'USD'
}: {
  planId: string;
  amount: number;
  currency?: string;
}) => {
  try {
    const response = await fetch('/api/payments/create-paypal-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        amount,
        currency
      }),
    });
    
    const orderData = await response.json();
    return orderData;
  } catch (err) {
    console.error('Error creating PayPal order:', err);
    throw err;
  }
};
