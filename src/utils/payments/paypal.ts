import { loadScript, PayPalScriptOptions } from '@paypal/paypal-js';

export interface PayPalConfig {
  amount: number;
  currency?: string;
}

export const initializePayPal = async ({ currency = 'USD' }: Partial<PayPalConfig> = {}) => {
  try {
    const scriptOptions: PayPalScriptOptions = {
      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
      currency
    };

    return await loadScript(scriptOptions);
  } catch (error) {
    console.error('PayPal initialization error:', error);
    throw error;
  }
};
