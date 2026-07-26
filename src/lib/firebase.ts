import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * PASTE YOUR FIREBASE CONFIG HERE.
 *
 * Get it from: Firebase Console → Project Settings → General → "Your apps" → Web app config.
 * These values are publishable (safe to keep in the codebase); Firebase security lives in
 * Auth providers + Firestore Security Rules.
 */
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID",
};

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("PASTE_");

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function getFirebase() {
  if (!isFirebaseConfigured) return null;
  if (!_app) {
    _app = getApps()[0] ?? initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
  }
  return { app: _app!, auth: _auth!, db: _db! };
}

export const googleProvider = new GoogleAuthProvider();
