import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {

  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,

  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,

  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,

  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,

  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,

  appId: import.meta.env.VITE_FIREBASE_APP_ID

};

// If there's no API key, avoid initializing Firebase (prevents auth/invalid-api-key errors)
const hasApiKey = !!firebaseConfig.apiKey;
let app = null;
if (hasApiKey) {
  // Prevent double initialization during HMR or multiple imports
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} else {
   
  console.warn("VITE_FIREBASE_API_KEY is not set. Skipping Firebase initialization.");
}

let auth = null;
if (app) {
  try {
    auth = getAuth(app);
  } catch (err) {
     
    console.warn("Firebase auth initialization failed:", err?.message || err);
  }
}

const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };
export default app;