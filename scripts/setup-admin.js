#!/usr/bin/env node

/**
 * Setup Admin User Script
 * 
 * This script sets the admin role for a user in Firestore.
 * 
 * Usage:
 *   node scripts/setup-admin.js <email_or_uid>
 * 
 * Example:
 *   node scripts/setup-admin.js admin@example.com
 *   node scripts/setup-admin.js ABC123uid456
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function setupAdmin(emailOrUid) {
  try {
    let userId;

    // Check if input is email or UID
    if (emailOrUid.includes('@')) {
      // It's an email - get the user by email
      console.log(`Looking up user by email: ${emailOrUid}`);
      const userRecord = await auth.getUserByEmail(emailOrUid);
      userId = userRecord.uid;
      console.log(`Found user with UID: ${userId}`);
    } else {
      // It's a UID
      userId = emailOrUid;
      console.log(`Using provided UID: ${userId}`);
      
      // Verify user exists
      await auth.getUser(userId);
      console.log(`User verified in Firebase Auth`);
    }

    // Update or create user document in Firestore with admin role
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      // Update existing document
      await userRef.update({
        role: 'admin',
        isAdmin: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Updated existing user document with admin role`);
    } else {
      // Create new document
      const user = await auth.getUser(userId);
      await userRef.set({
        email: user.email,
        role: 'admin',
        isAdmin: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Created new user document with admin role`);
    }

    console.log(`\n✅ SUCCESS! Admin setup completed for user: ${userId}`);
    console.log(`\nYou can now:`);
    console.log(`  1. Refresh your admin panel`);
    console.log(`  2. Login with this user to access admin features\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error setting up admin:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.error('\nUser not found. Make sure the user is registered in Firebase Auth first.');
    }
    
    process.exit(1);
  }
}

// Get email or UID from command line arguments
const emailOrUid = process.argv[2];

if (!emailOrUid) {
  console.error('\n❌ Error: No email or UID provided\n');
  console.log('Usage: node scripts/setup-admin.js <email_or_uid>\n');
  console.log('Examples:');
  console.log('  node scripts/setup-admin.js admin@example.com');
  console.log('  node scripts/setup-admin.js ABC123uid456\n');
  process.exit(1);
}

console.log('\n🔧 Setting up admin user...\n');
setupAdmin(emailOrUid);
