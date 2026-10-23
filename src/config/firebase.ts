/**
 * HanuJai High School ERP — Central Firebase Initialization Module
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Strict boundary:
 * - Checks VITE_DATA_MODE: 'demo' (default) vs 'firebase'.
 * - Client-side ONLY. Never holds service accounts or private keys.
 * - In 'firebase' mode, validates all required configuration parameters.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export type DataMode = 'demo' | 'firebase';

export function getDataMode(): DataMode {
  if (import.meta.env.MODE === 'test') {
    return 'demo';
  }
  const mode = import.meta.env.VITE_DATA_MODE;
  return mode === 'firebase' ? 'firebase' : 'demo';
}

export function isDemoMode(): boolean {
  return getDataMode() === 'demo';
}

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (getDataMode() === 'firebase') {
  if (!isFirebaseConfigured()) {
    console.error(
      '[HanuJai ERP] VITE_DATA_MODE is set to "firebase", but required Firebase configuration is missing in environment variables. Check .env.local.'
    );
  } else {
    try {
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      auth = getAuth(app);
      try {
        db = initializeFirestore(app, { ignoreUndefinedProperties: true });
      } catch {
        db = getFirestore(app);
      }
      storage = getStorage(app);
      console.info('[HanuJai ERP] Successfully connected to Cloud Firestore in Firebase mode.');
    } catch (error) {
      console.error('[HanuJai ERP] Failed to initialize Firebase:', error);
    }
  }
}

export { app, auth, db, storage };
