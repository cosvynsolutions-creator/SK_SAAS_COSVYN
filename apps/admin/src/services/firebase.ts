import { initializeApp, getApps, getApp } from "firebase/app";
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
  getIdTokenResult,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  IdTokenResult
} from "firebase/auth";
import { initializeFirestore, memoryLocalCache, setLogLevel, getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Silence internal WebChannel reconnect logs in iFrame
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

// Isolated Admin Firebase App instance
const APP_NAME = "ScaleKitchenAdminApp";
export const app = getApps().find(a => a.name === APP_NAME) || initializeApp(firebaseConfig, APP_NAME);

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  } catch {
    return getFirestore(app);
  }
})();

export const functions = getFunctions(app, "us-central1");

// Cloud Function Callables
export const verifyAdminAuthCallable = httpsCallable<{ forceMint?: boolean }, { authorized: boolean; uid: string; email: string; admin: boolean; claimUpdated: boolean }>(functions, "verifyAdminAuth");
export const migrateCredentialsCallable = httpsCallable(functions, "migratePlaintextCredentials");
export const purgeLegacyDriverDocsCallable = httpsCallable(functions, "purgeLegacyDriverDocs");

export const googleProvider = new GoogleAuthProvider();

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
  signInWithPopup
};
export type { User, IdTokenResult };
