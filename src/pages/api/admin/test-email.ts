import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { host, port, secure, auth, fromEmail, fromName } = req.body;

  try {
    console.log('Creating SMTP transport with config:', {
      host,
      port,
      secure: port === 465, // Force secure for port 465, otherwise false
      auth,
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      }
    });

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === 465, // Force secure for port 465, otherwise false
      auth,
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      }
    });

    // Verify SMTP connection configuration
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: fromEmail ? `"${fromName || 'Admin'}" <${fromEmail}>` : auth.user,
      to: auth.user,
      subject: "SMTP Test Email",
      html: "<h1>Test Email</h1><p>This is a test email to verify SMTP settings.</p>"
    });

    return res.status(200).json({ message: 'Test email sent successfully' });
  } catch (error: any) {
    console.error('SMTP test detailed error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Failed to send test email',
      details: error.message,
      code: error.code
    });
  }
}
