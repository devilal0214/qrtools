import nodemailer from 'nodemailer';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface EmailConfig {
  to: string | string[];
  subject?: string;
  html?: string;
  template?: 'welcome' | 'passwordReset' | 'verifyEmail' | 'trialExpiring';
  replacements?: Record<string, string>;
}

interface SMTPSettings {
  host: string;
  port: string;
  user: string;
  password: string;
  from: string;
}

interface EmailTemplate {
  subject: string;
  body: string;
}

interface AdminSettings {
  smtp: SMTPSettings;
  emailTemplates: {
    welcome: EmailTemplate;
    passwordReset: EmailTemplate;
    verifyEmail: EmailTemplate;
    trialExpiring: EmailTemplate;
  };
}

/**
 * Fetch admin SMTP settings and email templates
 */
async function getAdminSettings(): Promise<AdminSettings> {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
    
    if (!settingsDoc.exists()) {
      throw new Error('Admin settings not found');
    }

    const settings = settingsDoc.data();
    
    if (!settings?.smtp || !settings?.emailTemplates) {
      throw new Error('SMTP or email templates not configured in admin settings');
    }

    return settings as AdminSettings;
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    throw error;
  }
}

/**
 * Replace placeholders in email template
 */
function replacePlaceholders(text: string, replacements: Record<string, string>): string {
  let result = text;
  
  Object.entries(replacements).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  });
  
  return result;
}

/**
 * Send email using admin SMTP settings and templates
 */
export async function sendEmail(emailConfig: EmailConfig) {
  try {
    // Fetch admin settings
    const settings = await getAdminSettings();
    const { smtp, emailTemplates } = settings;

    // Validate SMTP settings
    if (!smtp.host || !smtp.user || !smtp.password) {
      throw new Error('Incomplete SMTP configuration');
    }

    let finalSubject = emailConfig.subject || '';
    let finalHtml = emailConfig.html || '';

    // Use template if specified
    if (emailConfig.template && emailTemplates[emailConfig.template]) {
      const template = emailTemplates[emailConfig.template];
      finalSubject = template.subject;
      finalHtml = template.body;

      // Replace placeholders if provided
      if (emailConfig.replacements) {
        finalSubject = replacePlaceholders(finalSubject, emailConfig.replacements);
        finalHtml = replacePlaceholders(finalHtml, emailConfig.replacements);
      }
    }

    // Create transporter with admin SMTP settings
    console.log('Creating SMTP transport for:', smtp.host);
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port),
      secure: Number(smtp.port) === 465,
      auth: {
        user: smtp.user,
        pass: smtp.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection
    await transporter.verify();
    console.log('SMTP connection verified');

    // Send email
    const result = await transporter.sendMail({
      from: smtp.from,
      to: emailConfig.to,
      subject: finalSubject,
      html: finalHtml
    });

    console.log('Email sent:', result.messageId);
    return result;

  } catch (error: any) {
    console.error('Email sending error:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
    throw new Error(`Email sending failed: ${error.message}`);
  }
}
