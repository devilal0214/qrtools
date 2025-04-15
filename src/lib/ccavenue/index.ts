import crypto from 'crypto';

class CCAvenueGateway {
  private merchantId: string;
  private accessCode: string;
  private workingKey: string;

  constructor() {
    // Check if credentials are configured
    if (!process.env.CCAVENUE_MERCHANT_ID || 
        !process.env.CCAVENUE_ACCESS_CODE || 
        !process.env.CCAVENUE_WORKING_KEY) {
      throw new Error('CCAvenue credentials not configured');
    }

    this.merchantId = process.env.CCAVENUE_MERCHANT_ID;
    this.accessCode = process.env.CCAVENUE_ACCESS_CODE;
    this.workingKey = process.env.CCAVENUE_WORKING_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.merchantId && this.accessCode && this.workingKey);
  }

  // Rest of implementation...
}

// Export singleton instance
export const ccavenue = new CCAvenueGateway();
