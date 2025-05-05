import { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    const contactRef = doc(db, 'contacts', id as string);
    const contactDoc = await getDoc(contactRef);

    if (!contactDoc.exists()) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    return res.status(200).json(contactDoc.data());
  } catch (error) {
    console.error('Error fetching contact:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
