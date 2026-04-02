// Firebase client SDK initialization
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase config is provided
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "your_api_key_here";

let app, auth, db, googleProvider;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.addScope("email");
  googleProvider.addScope("profile");
  console.log("✅ Firebase initialized.");
} else {
  console.warn("⚠️  Firebase not configured — running in mock auth mode.");
  // Mock auth/db objects for development without Firebase
  auth = null;
  db = null;
  googleProvider = null;
}

export { auth, db, googleProvider, isFirebaseConfigured };
