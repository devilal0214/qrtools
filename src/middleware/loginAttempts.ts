import { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function checkLoginAttempts(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.body;
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Get security settings
  const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
  const settings = settingsDoc.data()?.security;

  if (!settings?.loginAttempts.enabled) {
    return true;
  }

  const attemptKey = `${email}_${ipAddress}`;
  const attemptsRef = doc(db, 'loginAttempts', attemptKey);
  const attemptsDoc = await getDoc(attemptsRef);

  if (attemptsDoc.exists()) {
    const data = attemptsDoc.data();
    const now = Date.now();
    const blockExpires = data.lastAttempt + (settings.loginAttempts.blockDuration * 60 * 1000);

    if (data.attempts >= settings.loginAttempts.maxAttempts && now < blockExpires) {
      return false;
    }

    if (now > blockExpires) {
      // Reset attempts if block duration has passed
      await updateDoc(attemptsRef, {
        attempts: 1,
        lastAttempt: now
      });
    } else {
      // Increment attempts
      await updateDoc(attemptsRef, {
        attempts: data.attempts + 1,
        lastAttempt: now
      });
    }
  } else {
    // First attempt
    await setDoc(attemptsRef, {
      attempts: 1,
      lastAttempt: Date.now()
    });
  }

  return true;
}
