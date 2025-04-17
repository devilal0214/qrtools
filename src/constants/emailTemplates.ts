export const EMAIL_TEMPLATES = {
  WELCOME: {
    key: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to QR Generator!',
    variables: ['{{userName}}', '{{loginUrl}}'],
    defaultContent: `
      <h1>Welcome {{userName}}!</h1>
      <p>Thank you for joining QR Generator. We're excited to have you on board.</p>
      <p>You can login to your account here: <a href="{{loginUrl}}">Login</a></p>
    `
  },
  PLAN_PURCHASE: {
    key: 'planPurchase',
    name: 'Plan Purchase Confirmation',
    subject: 'Plan Purchase Confirmation',
    variables: ['{{userName}}', '{{planName}}', '{{amount}}', '{{expiryDate}}'],
    defaultContent: `
      <h1>Thank you for your purchase!</h1>
      <p>Dear {{userName}},</p>
      <p>Your subscription to {{planName}} has been activated.</p>
      <p>Amount paid: {{amount}}</p>
      <p>Valid until: {{expiryDate}}</p>
    `
  },
  PLAN_EXPIRY: {
    key: 'planExpiry',
    name: 'Plan Expiry Reminder',
    subject: 'Your Plan is Expiring Soon',
    variables: ['{{userName}}', '{{planName}}', '{{expiryDate}}', '{{renewalLink}}'],
    defaultContent: `
      <h1>Plan Expiry Reminder</h1>
      <p>Dear {{userName}},</p>
      <p>Your {{planName}} subscription will expire on {{expiryDate}}.</p>
      <p><a href="{{renewalLink}}">Renew Now</a></p>
    `
  }
} as const;

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailTemplates {
  welcome: EmailTemplate;
  passwordReset: EmailTemplate;
  verifyEmail: EmailTemplate;
  [key: string]: EmailTemplate;
}

export const DEFAULT_TEMPLATES: EmailTemplates = {
  welcome: {
    subject: 'Welcome to QR Generator',
    body: 'Thank you for joining QR Generator. We\'re excited to have you on board!'
  },
  passwordReset: {
    subject: 'Password Reset Request',
    body: 'You requested a password reset. Click the link below to reset your password:'
  },
  verifyEmail: {
    subject: 'Verify Your Email',
    body: 'Please verify your email address by clicking the link below:'
  }
};
