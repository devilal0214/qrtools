import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/utils/email';
import { EMAIL_TEMPLATES } from '@/constants/emailTemplates';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { jobId } = req.body;
    console.log('Processing job:', jobId);

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Use admin SDK to access Firestore
    const jobRef = adminDb.collection('email_jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return res.status(404).json({ error: 'Email job not found' });
    }

    const job = jobSnap.data();
    console.log('Processing email job:', { jobId, template: job.template });

    try {
      // Update job status to processing
      await jobRef.update({
        status: 'processing',
        processingStartedAt: new Date().toISOString()
      });

      if (job.template) {
        const template = EMAIL_TEMPLATES[job.template];
        if (!template) {
          throw new Error(`Template ${job.template} not found`);
        }

        // Process each recipient
        for (const recipient of job.recipients) {
          try {
            let content = template.defaultContent;
            let subject = template.subject;

            // Replace variables
            Object.entries(recipient.variables).forEach(([key, value]) => {
              const regex = new RegExp(`{{${key}}}`, 'g');
              content = content.replace(regex, String(value));
              subject = subject.replace(regex, String(value));
            });

            await sendEmail({
              to: recipient.email,
              subject,
              html: content
            });

            console.log('Email sent to:', recipient.email);
          } catch (error) {
            console.error('Error sending to:', recipient.email, error);
          }
        }
      } else {
        // Handle custom email
        console.log('Sending custom email to:', job.recipients.length, 'recipients');
        
        // Send in batches of 50
        const batchSize = 50;
        for (let i = 0; i < job.recipients.length; i += batchSize) {
          const batch = job.recipients.slice(i, i + batchSize);
          try {
            await sendEmail({
              to: batch.map(r => r.email), // Extract email addresses from recipients
              subject: job.subject,
              html: job.content
            });
            console.log(`Custom email batch sent (${i + 1} to ${i + batch.length})`);
          } catch (error) {
            console.error(`Error sending batch (${i + 1} to ${i + batch.length}):`, error);
          }
        }
      }

      // Update job status to completed
      await jobRef.update({
        status: 'completed',
        completedAt: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: 'Email job processed successfully'
      });

    } catch (error) {
      console.error('Job processing error:', error);
      
      // Update job status to failed
      await jobRef.update({
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      });

      throw error;
    }

  } catch (error: any) {
    console.error('Process email job error:', error);
    return res.status(500).json({
      error: 'Failed to process email job',
      details: error.message || 'Unknown error'
    });
  }
}
