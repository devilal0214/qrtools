// import Stripe from 'stripe';
// import Razorpay from 'razorpay';
// import { loadScript } from '@paypal/paypal-js';
// import { CCAvenuePayment } from './payments/ccavenue';

// Payments are currently disabled for maintenance.
// To re-enable, uncomment the code below and restore gateway logic.

// Payment Gateway Factory
export const getPaymentGateway = (_gateway: string) => {
  throw new Error('Payments are currently disabled.');
};

export const createCheckoutSession = async () => {
  throw new Error('Payments are currently disabled.');
};

export const createPaymentSession = async () => {
  throw new Error('Payments are currently disabled.');
};

export const getSubscription = async () => {
  throw new Error('Payments are currently disabled.');
};
