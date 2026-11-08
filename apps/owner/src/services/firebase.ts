
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  inMemoryPersistence, 
  indexedDBLocalPersistence,
  GoogleAuthProvider
} from "firebase/auth";
import { initializeFirestore, memoryLocalCache, setLogLevel } from "firebase/firestore";

// Silence internal WebChannel reconnect logs in iFrame
setLogLevel('silent');

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBdOar16LP6FsYfkMZbpejixqX9XIlaHu4",
  authDomain: "subbussinesssaas.firebaseapp.com",
  projectId: "subbussinesssaas",
  storageBucket: "subbussinesssaas.firebasestorage.app",
  messagingSenderId: "954257463672",
  appId: "1:954257463672:web:6bef130b67567997e9108d",
  measurementId: "G-QHYDRHE6RG"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with IndexedDB, browser and memory persistence (prevents session drop on page refresh)
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
    });
  } catch {
    return getAuth(app);
  }
})();

export const googleProvider = new GoogleAuthProvider();

import { getFunctions, httpsCallable } from "firebase/functions";

// Initialize Firebase Functions for secure server-side callables
export const functions = getFunctions(app);

// Callable function instances
export const driverLoginCallable = httpsCallable<
  { email: string; password: string; bizId: string },
  { token: string; driver: { name: string; bizId: string; staffId: string; branchId: string; mobile: string } }
>(functions, 'driverLogin');

export const managerLoginCallable = httpsCallable<
  { email: string; password: string; bizId?: string },
  { token: string; manager: { id: string; name: string; email: string; branchId: string; allowedPages: string[]; bizId: string } }
>(functions, 'managerLogin');

export const setDriverPinCallable = httpsCallable<
  { bizId: string; staffId?: string; phone: string; pin: string; name?: string; branchId?: string; additionalData?: any },
  { success: boolean; staffId: string }
>(functions, 'setDriverPin');

export interface CreateDeliveryBoyAccountPayload {
  bizId: string;
  email: string;
  password: string;
  name: string;
  branchId?: string;
  mobile?: string;
  dateOfJoining?: string;
  joiningDate?: string;
  salary?: number;
  aadharNumber?: string;
  homeLocation?: string;
  vehicleNumber?: string;
  status?: 'Active' | 'Inactive';
  additionalData?: any;
}

export interface UpdateDeliveryBoyAccountPayload {
  bizId: string;
  staffId: string;
  email?: string;
  password?: string;
  name?: string;
  branchId?: string;
  mobile?: string;
  dateOfJoining?: string;
  joiningDate?: string;
  salary?: number;
  aadharNumber?: string;
  homeLocation?: string;
  vehicleNumber?: string;
  status?: 'Active' | 'Inactive';
  additionalData?: any;
}

export const createDeliveryBoyAccountCallable = httpsCallable<
  CreateDeliveryBoyAccountPayload,
  { success: boolean; staffId: string; authUid: string }
>(functions, 'createDeliveryBoyAccount');

export const updateDeliveryBoyAccountCallable = httpsCallable<
  UpdateDeliveryBoyAccountPayload,
  { success: boolean; staffId: string; authUid?: string }
>(functions, 'updateDeliveryBoyAccount');

export const resetDeliveryBoyPasswordCallable = httpsCallable<
  { bizId: string; staffId: string; newPassword: string },
  { success: boolean }
>(functions, 'resetDeliveryBoyPassword');

export const deactivateDeliveryBoyAccountCallable = httpsCallable<
  { bizId: string; staffId: string },
  { success: boolean }
>(functions, 'deactivateDeliveryBoyAccount');

export const reactivateDeliveryBoyAccountCallable = httpsCallable<
  { bizId: string; staffId: string },
  { success: boolean }
>(functions, 'reactivateDeliveryBoyAccount');

export const setDriverPasswordCallable = httpsCallable<
  { bizId: string; staffId?: string; email: string; password: string; name?: string; branchId?: string; mobile?: string; vehicleNumber?: string; additionalData?: any },
  { success: boolean; staffId: string }
>(functions, 'setDriverPassword');

export const setManagerPasswordCallable = httpsCallable<
  { bizId: string; managerId?: string; password: string; managerData: any },
  { success: boolean; managerId: string }
>(functions, 'setManagerPassword');

export const migrateCredentialsCallable = httpsCallable<
  Record<string, never>,
  { success: boolean; migratedStaffCount: number; migratedManagersCount: number; migratedGlobalDriversCount: number }
>(functions, 'migratePlaintextCredentials');

export const migrateDriverManifestsCallable = httpsCallable<
  Record<string, never>,
  { success: boolean; copiedManifests: number; copiedStatuses: number; copiedLogs: number }
>(functions, 'migrateDriverManifests');

export const claimFreeTrialCallable = httpsCallable<
  { bizId?: string; mobile?: string; email?: string },
  { success: boolean; planName: string; planStatus: string; planExpiryDate: string }
>(functions, 'claimFreeTrial');

export const deleteDriverCallable = httpsCallable<
  { bizId: string; staffId: string; phone?: string },
  { success: boolean }
>(functions, 'deleteDriver');

export const purgeLegacyDriverDocsCallable = httpsCallable<
  Record<string, never>,
  { success: boolean; deletedCount: number }
>(functions, 'purgeLegacyDriverDocs');

// Phase 3: Server-side Payment Callables
export const createRazorpayOrderCallable = httpsCallable<
  { planId: string },
  { orderId: string; amount: number; currency: string; keyId: string; planName: string }
>(functions, 'createRazorpayOrder');

export const verifyRazorpayPaymentCallable = httpsCallable<
  { orderId?: string; paymentId: string; signature?: string },
  { success: boolean; planExpiryDate?: string; planStatus?: string; alreadyProcessed?: boolean }
>(functions, 'verifyRazorpayPayment');

// Phase 3: Server-side Gemini AI Callable
export const geminiGenerateCallable = httpsCallable<
  { action: 'business_insights' | 'support_reply'; data?: any; customerQuery?: string },
  { text: string }
>(functions, 'geminiGenerate');

/**
 * @deprecated Legacy shared session removed in Phase 1 security hardening.
 * Driver authentication is now handled via secure driverLogin callable returning custom tokens.
 */
export const ensureDriverAuth = async () => {
  return auth.currentUser;
};

// Use memoryLocalCache to ensure clean in-memory state in iframe environments
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache({}) 
});

export default app;
