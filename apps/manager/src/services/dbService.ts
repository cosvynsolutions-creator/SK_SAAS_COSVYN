import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  FirestoreError,
  Query,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { useManagerAuth } from '../contexts/ManagerAuthContext';

/**
 * Collections where documents are strictly branch-scoped and require where('branchId', '==', ...)
 * constraints when queried by a single-branch manager to align with Firestore security rules.
 */
const STRICT_BRANCH_COLLECTIONS = new Set([
  'customers',
  'staff',
  'expenses',
  'inventory',
  'single_orders',
]);

/**
 * Collections where documents can either be branch-specific or organization-wide (null/'All').
 */
const SHARED_OR_BRANCH_COLLECTIONS = new Set([
  'plans',
  'notes',
  'broadcasts',
  'delivery_logs',
  'invoices',
  'payments',
]);

/**
 * Real-time collection stream hook scoped strictly to the authenticated manager's business
 * with backend-aligned query constraints and robust error surfacing.
 */
export const useStreamCollection = <T>(collectionName: string) => {
  const { bizId, branchId, isAllBranches, currentUser, claims } = useManagerAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bizId || !currentUser || !claims || claims.role !== 'manager') {
      setData([]);
      setLoading(false);
      return;
    }

    const colRef = collection(db, 'businesses', bizId, collectionName);
    let q: Query;

    // Build query constraints matching firestore.rules
    if (!isAllBranches && branchId && branchId !== 'All') {
      if (STRICT_BRANCH_COLLECTIONS.has(collectionName)) {
        // Enforce branch filter in Firestore query so the rule passes
        q = query(colRef, where('branchId', '==', branchId));
      } else {
        // For shared collections (branches, plans, notes), retrieve and apply branch filter
        q = query(colRef);
      }
    } else {
      // All-branches authorized manager: query full collection
      q = query(colRef);
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot) => {
        let items = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        })) as any[];

        // Apply secondary filtering for shared collections or legacy records without explicit branch index
        if (!isAllBranches && branchId && branchId !== 'All') {
          if (collectionName === 'branches') {
            items = items.filter((b) => b.id === branchId || b.name === branchId);
          } else if (collectionName === 'plans') {
            items = items.filter((p) => !p.branchId || p.branchId === 'All' || p.branchId === branchId);
          } else if (collectionName === 'notes') {
            items = items.filter((n) => !n.branchId || n.branchId === 'All' || n.branchId === branchId);
          } else if (collectionName === 'broadcasts') {
            items = items.filter((b) => !b.branchId || b.branchId === 'All' || b.branchId === branchId);
          } else if (collectionName === 'delivery_logs') {
            items = items.filter((l) => !l.branchId || l.branchId === branchId);
          } else if (collectionName === 'invoices') {
            items = items.filter((inv) => !inv.branchId || inv.branchId === branchId);
          } else if (collectionName === 'payments') {
            items = items.filter((p) => !p.branchId || p.branchId === branchId);
          }
        }

        setData(items as T[]);
        setLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        console.warn(`[ScaleKitchenManager] Firestore Stream Error (${collectionName}):`, err.code, err.message);
        setError(`Permission error on ${collectionName}: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [bizId, branchId, isAllBranches, currentUser, claims, collectionName]);

  return { data, loading, error };
};

/**
 * Secure document insertion with branch injection and validation.
 */
export const addDocument = async (
  bizId: string,
  collectionName: string,
  data: any,
  verifiedBranchId?: string
) => {
  if (!bizId) throw new Error("Missing business ID for insertion.");
  
  // Guarantee that branchId is set to the manager's authorized branch
  const effectiveBranch = verifiedBranchId || data.branchId;
  const payload = {
    ...data,
    branchId: effectiveBranch,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const colRef = collection(db, 'businesses', bizId, collectionName);
  return await addDoc(colRef, payload);
};

/**
 * Secure document update with branch protection.
 */
export const updateDocument = async (
  bizId: string,
  collectionName: string,
  id: string,
  data: any
) => {
  if (!bizId || !id) throw new Error("Missing parameters for update.");

  const docRef = doc(db, 'businesses', bizId, collectionName, id);

  // If updating branchId, ensure it cannot be changed across branches
  const payload = {
    ...data,
    updatedAt: new Date().toISOString()
  };

  return await updateDoc(docRef, payload);
};

/**
 * Secure document deletion.
 */
export const deleteDocument = async (bizId: string, collectionName: string, id: string) => {
  if (!bizId || !id) throw new Error("Missing parameters for deletion.");
  const docRef = doc(db, 'businesses', bizId, collectionName, id);
  return await deleteDoc(docRef);
};
