export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: number;
  isActive: boolean;
  description: string;
  features: PlanFeature[];
  enabledContentTypes: string[];
}

export interface PlanFeature {
  key: string;
  label: string;
  value: boolean | number;
  type: 'boolean' | 'number';
}

export const QR_CONTENT_TYPES = [
  { key: 'URL', label: 'Website URL' },
  { key: 'PLAIN_TEXT', label: 'Plain Text' },
  { key: 'CONTACT', label: 'Contact' },
  { key: 'SMS', label: 'SMS' },
  { key: 'MULTI_URL', label: 'Multi URL' },
  { key: 'LOCATION', label: 'Location' },
  { key: 'PDF', label: 'PDF' },
  { key: 'FILE', label: 'File' },
  { key: 'SOCIALS', label: 'Socials' },
  { key: 'PHONE', label: 'Phone Number' }
] as const;

export const PLAN_TYPES = {
  FREE: {
    name: 'Free',
    enabledContentTypes: ['URL', 'CONTACT'],
    features: {
      qrLimit: 5,
      analytics: false,
      customization: false,
      bulkGeneration: false,
      scheduling: false,
      password: false,
      dynamic: false
    }
  },
  // ...other plan types
};

export const DEFAULT_PLAN_FEATURES = {
  FREE: {
    name: 'Free',
    features: [
      { key: 'qrLimit', label: 'QR Code Limit', value: 5, type: 'number' },
      { key: 'analytics', label: 'Analytics', value: false, type: 'boolean' },
      { key: 'customization', label: 'Customization', value: false, type: 'boolean' },
      { key: 'dynamic', label: 'Dynamic QR', value: false, type: 'boolean' },
      { key: 'password', label: 'Password Protection', value: false, type: 'boolean' }
    ],
    enabledContentTypes: ['URL', 'TEXT']
  }
};

// Default free plan structure
export const FREE_PLAN = {
  id: 'free',
  name: 'Free',
  price: 0,
  currency: 'USD',
  duration: 0,
  isActive: true,
  description: 'Basic QR Code Creation',
  enabledContentTypes: ['URL', 'TEXT'], // Basic types for free plan
  features: [
    { key: 'qrLimit', label: 'QR Code Limit', value: 5, type: 'number' },
    { key: 'analytics', label: 'Analytics', value: false, type: 'boolean' },
    { key: 'customization', label: 'Customization', value: false, type: 'boolean' },
    { key: 'dynamic', label: 'Dynamic QR', value: false, type: 'boolean' },
    { key: 'pauseResume', label: 'Pause/Resume', value: false, type: 'boolean' },
    { key: 'scheduling', label: 'Scheduling', value: false, type: 'boolean' },
    { key: 'password', label: 'Password Protection', value: false, type: 'boolean' }
  ]
};

export interface PaymentGateway {
  id: string;
  name: 'stripe' | 'paypal' | 'razorpay' | 'ccavenue';
  displayName: string;
  isActive: boolean;
  credentials: {
    [key: string]: string;
  };
  sandboxMode: boolean;
  updatedAt: string;
}

export const PAYMENT_GATEWAYS = [
  {
    name: 'stripe',
    displayName: 'Stripe',
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'text' },
      { key: 'secretKey', label: 'Secret Key', type: 'password' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password' }
    ]
  },
  {
    name: 'paypal',
    displayName: 'PayPal',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' }
    ]
  },
  {
    name: 'razorpay',
    displayName: 'Razorpay',
    fields: [
      { key: 'keyId', label: 'Key ID', type: 'text' },
      { key: 'keySecret', label: 'Key Secret', type: 'password' }
    ]
  },
  {
    name: 'ccavenue',
    displayName: 'CCAvenue',
    fields: [
      { key: 'merchantId', label: 'Merchant ID', type: 'text' },
      { key: 'workingKey', label: 'Working Key', type: 'password' },
      { key: 'accessCode', label: 'Access Code', type: 'text' }
    ]
  }
] as const;

export interface Transaction {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  gateway: string;
  gatewayTransactionId: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'superadmin';
  createdAt: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
  createdAt: string;
}

export interface SecuritySettings {
  loginAttempts: {
    maxAttempts: number;
    blockDuration: number; // in minutes
    enabled: boolean;
  };
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  sessionTimeout: number; // in minutes
  ipWhitelist: string[];
  adminIpRestriction: boolean;
}
