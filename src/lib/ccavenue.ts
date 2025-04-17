import crypto from 'crypto';

export interface CCAvenueParams {
  orderId: string;
  amount: number;
  currency?: string;
  userId: string;
  planId: string;
  redirectUrl: string;  // Used for success URL
  cancelUrl: string;
}

class CCAvenue {
  private merchantId: string;
  private accessCode: string;
  private workingKey: string;

  constructor() {
    this.merchantId = process.env.CCAVENUE_MERCHANT_ID!;
    this.accessCode = process.env.CCAVENUE_ACCESS_CODE!;
    this.workingKey = process.env.CCAVENUE_WORKING_KEY!;
  }

  isConfigured(): boolean {
    return !!(this.merchantId && this.accessCode && this.workingKey);
  }

  async createSession(params: CCAvenueParams) {
    // CCAvenue session creation logic
    return {
      url: 'https://secure.ccavenue.com/transaction/transaction.do',
      params: {
        merchant_id: this.merchantId,
        access_code: this.accessCode,
        // ... other required parameters
      }
    };
  }
}

export const ccavenue = new CCAvenue();

export const createCCAvenueSession = async ({
  orderId,
  amount,
  currency,
  userId,
  planId,
  redirectUrl,  // Changed from successUrl
  cancelUrl
}: CCAvenueParams) => {
  const merchantId = process.env.CCAVENUE_MERCHANT_ID!;
  const accessCode = process.env.CCAVENUE_ACCESS_CODE!;
  const workingKey = process.env.CCAVENUE_WORKING_KEY!;

  if (!merchantId || !accessCode || !workingKey) {
    throw new Error('CCAvenue credentials not configured');
  }

  // Create parameter string for encryption
  const params = new URLSearchParams({
    merchant_id: merchantId,
    order_id: orderId,
    currency,
    amount: amount.toFixed(2),
    redirect_url: redirectUrl,  // Changed from successUrl
    cancel_url: cancelUrl,
    merchant_param1: userId,
    merchant_param2: planId,
    language: 'EN'
  }).toString();

  // Encrypt the parameters
  const encRequest = encryptData(params, workingKey);

  return {
    encRequest,
    accessCode,
    merchantId,
    redirectUrl: 'https://secure.ccavenue.com/transaction/transaction.do'
  };
};

function encryptData(plainText: string, workingKey: string): string {
  const m = crypto.createHash('md5');
  m.update(workingKey);
  const key = m.digest();
  const iv = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f';
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decryptData(encryptedText: string, workingKey: string): string {
  const m = crypto.createHash('md5');
  m.update(workingKey);
  const key = m.digest();
  const iv = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f';
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
