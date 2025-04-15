import { checkLoginAttempts } from '@/middleware/loginAttempts';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const canAttemptLogin = await checkLoginAttempts(req, res);
  if (!canAttemptLogin) {
    return res.status(429).json({ 
      error: 'Too many login attempts. Please try again later.' 
    });
  }

  // ... rest of login logic ...
}
