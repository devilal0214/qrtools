import nodemailer from 'nodemailer';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface EmailConfig {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(emailConfig: EmailConfig) {
  try {
    const settingsSnapshot = await getDoc(doc(db, 'settings', 'global'));
    const settings = settingsSnapshot.data();

    if (!settings?.smtp) {
      throw new Error('SMTP settings not found');
    }

    const { smtp } = settings;

    // Validate SMTP settings
    if (!smtp.host || !smtp.auth.user || !smtp.auth.pass) {
      throw new Error('Incomplete SMTP configuration');
    }

    // Create transporter with extra logging
    console.log('Creating SMTP transport for:', smtp.host);
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port),
      secure: smtp.port === 465,
      auth: smtp.auth,
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection
    await transporter.verify();
    console.log('SMTP connection verified');

    // Send email
    const result = await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      ...emailConfig
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
