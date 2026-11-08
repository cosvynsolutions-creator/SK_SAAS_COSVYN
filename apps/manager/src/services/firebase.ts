/**
 * ScaleKitchen Manager Application — Dedicated Firebase Service
 *
 * Source Isolation: Uses a uniquely named Firebase App ('ScaleKitchenManager')
 * to ensure authentication states, token claims, and listeners never
 * collide with other ScaleKitchen portals in the same browser origin.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  indexedDBLocalPersistence,
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

// Silence verbose internal logs in iframes and preview environments
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

// Initialize or retrieve the dedicated 'ScaleKitchenManager' named Firebase App
const APP_NAME = 'ScaleKitchenManager';
export const app = getApps().find(a => a.name === APP_NAME) || initializeApp(firebaseConfig, APP_NAME);

// Initialize Auth with multi-layer persistence for desktop/tablet/mobile browsers
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
export const functions = getFunctions(app, 'asia-south1');

export const setDriverPasswordCallable = httpsCallable<
  {
    bizId: string;
    staffId?: string;
    email: string;
    password: string;
    name: string;
    branchId?: string;
    mobile?: string;
    vehicleNumber?: string;
    additionalData?: Record<string, any>;
  },
  { success: boolean; staffId: string }
>(functions, 'setDriverPassword');

// Read server-assigned Firebase ID token claims for tenant isolation.
export interface ManagerClaims {
  role?: string;
  bizId?: string;
  managerId?: string;
  branchId?: string;
  allBranches?: boolean;
  allowedPages?: string[];
}

export const getManagerClaims = async (user: User): Promise<ManagerClaims> => {
  const idTokenResult = await user.getIdTokenResult(true);
  return {
    role: idTokenResult.claims.role as string | undefined,
    bizId: idTokenResult.claims.bizId as string | undefined,
    managerId: idTokenResult.claims.managerId as string | undefined,
    branchId: idTokenResult.claims.branchId as string | undefined,
    allBranches: (idTokenResult.claims.allBranches as boolean | undefined) || (idTokenResult.claims.branchId === 'All'),
    allowedPages: Array.isArray(idTokenResult.claims.allowedPages)
      ? idTokenResult.claims.allowedPages as string[]
      : undefined
  };
};

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
