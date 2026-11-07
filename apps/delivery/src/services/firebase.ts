/**
 * ScaleKitchen Delivery Application — Dedicated Firebase Service
 *
 * Source Isolation: Uses a uniquely named Firebase App ('ScaleKitchenDelivery')
 * to ensure that authentication states, token claims, and listeners never
 * collide with other ScaleKitchen portals in the same browser origin.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  Firestore
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Silence verbose internal logs in mobile webview / iframes
setLogLevel('silent');

export const firebaseConfig = {
  apiKey: "AIzaSyBdOar16LP6FsYfkMZbpejixqX9XIlaHu4",
  authDomain: "subbussinesssaas.firebaseapp.com",
  projectId: "subbussinesssaas",
  storageBucket: "subbussinesssaas.firebasestorage.app",
  messagingSenderId: "954257463672",
  appId: "1:954257463672:web:6bef130b67567997e9108d",
  measurementId: "G-QHYDRHE6RG"
};

// Initialize or retrieve the dedicated 'ScaleKitchenDelivery' named Firebase App
const APP_NAME = 'ScaleKitchenDelivery';
export const app = getApps().find(a => a.name === APP_NAME) || initializeApp(firebaseConfig, APP_NAME);

// Initialize Auth with multi-layer persistence for mobile devices
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence
      ]
    });
  } catch {
    return getAuth(app);
  }
})();

// Initialize Firestore on the isolated named app
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache()
    });
  } catch {
    return initializeFirestore(app, {});
  }
})();

// Initialize Functions on the isolated named app
export const functions = getFunctions(app);

// Server-verified driver login callable contract
export interface DriverLoginResponse {
  token: string;
  driver: {
    name: string;
    bizId: string;
    staffId: string;
    branchId: string;
    email?: string;
    mobile?: string;
  };
}

export const driverLoginCallable = httpsCallable<
  { email?: string; password?: string; phone?: string; pin?: string; bizId?: string },
  DriverLoginResponse
>(functions, 'driverLogin');

// Helper to inspect custom token claims for tenant isolation
export interface DriverClaims {
  role?: string;
  bizId?: string;
  staffId?: string;
  branchId?: string;
}

export const getDriverClaims = async (user: User): Promise<DriverClaims | null> => {
  try {
    const idTokenResult = await user.getIdTokenResult(true);
    return {
      role: idTokenResult.claims.role as string | undefined,
      bizId: idTokenResult.claims.bizId as string | undefined,
      staffId: idTokenResult.claims.staffId as string | undefined,
      branchId: idTokenResult.claims.branchId as string | undefined,
    };
  } catch (err) {
    console.warn("Could not retrieve driver claims:", err);
    return null;
  }
};

export {
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
