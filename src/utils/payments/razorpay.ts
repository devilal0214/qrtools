import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

export const createRazorpaySession = async ({
  amount,
  currency,
  orderId,
  userId,
  planId
}: {
  amount: number;
  currency: string;
  orderId: string;
  userId: string;
  planId: string;
}) => {
  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to smallest currency unit
      currency,
      receipt: orderId,
      notes: {
        userId,
        planId
      }
    });
    
    return {
      id: order.id,
      currency: order.currency,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID
    };
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    throw error;
  }
};
