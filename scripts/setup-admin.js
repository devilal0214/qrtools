const fetch = require('node-fetch');
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyAlUIs8iJe9awyj9SoCx16tnh0wo1ZVhHw",
  authDomain: "qr-code-generator-5f2a3.firebaseapp.com",
  projectId: "qr-code-generator-5f2a3",
  // ...rest of your config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function setupAdmin() {
  try {
    // Create admin user in Firebase Auth
    await createUserWithEmailAndPassword(auth, 'admin@qrcode.com', 'admin123');
    console.log('Admin user created in Firebase Auth');

    // Set admin claim
    const response = await fetch('http://localhost:3000/api/admin/set-claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'admin@qrcode.com' }),
    });

    const data = await response.json();
    console.log('Admin claim set:', data);
  } catch (error) {
    console.error('Error setting up admin:', error);
  }
}

setupAdmin();
