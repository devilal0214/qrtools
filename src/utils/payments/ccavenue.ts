import crypto from 'crypto';

interface CCAvenueCreds {
  merchantId: string;
  workingKey: string;
  accessCode: string;
}

export class CCAvenuePayment {
  private workingKey: string;
  private merchantId: string;
  private accessCode: string;

  constructor({ merchantId, workingKey, accessCode }: CCAvenueCreds) {
    this.workingKey = workingKey;
    this.merchantId = merchantId;
    this.accessCode = accessCode;
  }

  encryptRequest(params: Record<string, string>): string {
    const cipher = crypto.createCipheriv('aes-128-cbc', this.workingKey, Buffer.alloc(16));
    let encrypted = cipher.update(JSON.stringify(params), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decryptResponse(encResponse: string): Record<string, string> {
    const decipher = crypto.createDecipheriv('aes-128-cbc', this.workingKey, Buffer.alloc(16));
    let decrypted = decipher.update(encResponse, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  generateChecksum(params: Record<string, string>): string {
    const values = Object.values(params).join('|');
    return crypto.createHash('sha256')
      .update(values + this.workingKey)
      .digest('hex');
  }
}

export const decryptData = (encryptedData: string, workingKey: string): Record<string, string> => {
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', workingKey, Buffer.alloc(16));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt CCAvenue response');
  }
};

interface CCAvenueParams {
  orderId: string;
  amount: number;
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export const createCCAvenueSession = async ({
  orderId,
  amount,
  userId,
  planId,
  successUrl,
  cancelUrl
}: CCAvenueParams) => {
  const merchantId = process.env.CCAVENUE_MERCHANT_ID!;
  const accessCode = process.env.CCAVENUE_ACCESS_CODE!;
  const workingKey = process.env.CCAVENUE_WORKING_KEY!;

  if (!merchantId || !accessCode || !workingKey) {
    throw new Error('CCAvenue credentials not configured');
  }

  const ccAvenuePayment = new CCAvenuePayment({ merchantId, workingKey, accessCode });

  // Create parameter string for encryption
  const params = {
    merchant_id: merchantId,
    order_id: orderId,
    amount: amount.toFixed(2),
    currency: 'INR',
    redirect_url: successUrl,
    cancel_url: cancelUrl,
    language: 'EN',
    merchant_param1: userId,
    merchant_param2: planId,
  };

  // Encrypt the parameters
  const encRequest = ccAvenuePayment.encryptRequest(params);

  return {
    encRequest,
    accessCode,
    merchantId,
    redirectUrl: 'https://secure.ccavenue.com/transaction/transaction.do'
  };
};
