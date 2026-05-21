import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if configuration is valid
const isConfigured =
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
  firebaseConfig.apiKey !== 'undefined'; // Handle potential string "undefined" from env

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (isConfigured) {
  try {
    // Prevent re-initialization in Next.js hot-reload
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error('❌ Firebase initialization crashed despite having config:', error);
  }
} else {
  console.warn('⚠️ DecentraVote: Firebase API Key is missing. App is running in "Unconfigured Mode". Please setup .env.local to enable voting and authentication.');
}

// Export with fallback types to prevent total import failure
// Components should use optional chaining or check isConfigured if needed
const exportedAuth = auth || ({} as Auth);
const exportedDb = db || ({} as Firestore);

export { exportedAuth as auth, exportedDb as db };
export default app;
