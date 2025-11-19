const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateTours() {
  try {
    console.log('Starting tour migration...');
    const toursRef = db.collection('virtualTours');
    const batch = db.batch();
    let count = 0;

    // Get all tours without a status field
    const snapshot = await toursRef.get();
    
    for (const doc of snapshot.docs) {
      const tourData = doc.data();
      
      // Skip if already has status
      if (tourData.status) continue;

      // Convert to new format
      const updates = {
        status: tourData.isPublic ? 'published' : 'draft',
        updatedAt: admin.firestore.Timestamp.now()
      };

      // If dates are strings, convert them
      if (typeof tourData.createdAt === 'string') {
        updates.createdAt = admin.firestore.Timestamp.fromDate(new Date(tourData.createdAt));
      }
      if (typeof tourData.updatedAt === 'string') {
        updates.updatedAt = admin.firestore.Timestamp.fromDate(new Date(tourData.updatedAt));
      }

      batch.update(doc.ref, updates);
      count++;

      // Commit every 500 documents (Firestore batch limit)
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`Processed ${count} tours...`);
      }
    }

    // Commit any remaining updates
    if (count % 500 !== 0) {
      await batch.commit();
    }

    console.log(`Migration complete. Updated ${count} tours.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrateTours();
