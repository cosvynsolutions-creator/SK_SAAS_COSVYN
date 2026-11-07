import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc,
  where,
  getDocs,
  getDoc,
  collectionGroup,
  orderBy,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from '../contexts/AuthContext';
import { SHARED_SAAS_PLANS, SHARED_OFFER, SaasPlan, SpecialOffer } from './saasStore';
import { normalizePhone, normalizeEmail } from './store';

// Hook to subscribe to a sub-collection of the current user or manager-connected business
import { auth } from './firebase';

/**
 * Resolves the branch assigned to the currently logged in manager (if any).
 * Returns null if the user is the SaaS business owner or if manager has 'All' branches.
 */
export const getManagerBranchId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const hash = window.location.hash || '';
    const pathname = window.location.pathname || '';
    const isManagerUrl = hash.includes('/manager') || pathname.includes('/manager');
    
    if (isManagerUrl) {
      const explicitBranch = localStorage.getItem('manager_branch_id');
      if (explicitBranch && explicitBranch !== 'All') {
        return explicitBranch;
      }
      const raw = localStorage.getItem('manager_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.branchId && parsed.branchId !== 'All') {
          return parsed.branchId;
        }
      }
    }
  } catch (e) {
    console.warn("Error reading manager branch:", e);
  }
  return null;
};

/**
 * Resolves the target business ID for CRUD operations.
 * If in manager portal, targets manager_biz_id.
 * If in driver portal, targets driver_biz_id.
 * Otherwise strictly uses the provided owner userId or auth.currentUser.uid.
 */
export const getTargetBusinessId = (fallbackUserId?: string): string => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash || '';
    const pathname = window.location.pathname || '';

    // Only apply manager business override when actively inside the manager portal
    if (hash.includes('/manager') || pathname.includes('/manager')) {
      const mgrBiz = localStorage.getItem('manager_biz_id');
      if (mgrBiz) return mgrBiz;
    }

    // Only apply driver business override when actively inside the driver portal
    if (hash.includes('/driver') || pathname.includes('/driver')) {
      const drvBiz = localStorage.getItem('driver_biz_id');
      if (drvBiz) return drvBiz;
    }

    // Fallback to active owner session if available
    try {
      const session = localStorage.getItem('scalekitchen_auth_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed?.uid) return fallbackUserId || auth.currentUser?.uid || parsed.uid;
      }
    } catch {}
  }
  return fallbackUserId || auth.currentUser?.uid || '';
};

export const useStreamCollection = <T>(collectionName: string, customBizId?: string) => {
  const { currentUser } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveUid = customBizId || getTargetBusinessId(currentUser?.uid);

  useEffect(() => {
    if (!effectiveUid) {
      setData([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'businesses', effectiveUid, collectionName));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as any[];

      // STRICT BRANCH ACCESS ENFORCEMENT FOR MANAGERS:
      // If the manager is granted access to a specific branch only, strictly filter every collection
      const managerBranchId = getManagerBranchId();
      if (managerBranchId) {
        if (collectionName === 'branches') {
          // Only return the manager's assigned branch
          items = items.filter(b => b.id === managerBranchId || b.name === managerBranchId);
        } else if (collectionName === 'customers') {
          // Only return customers belonging to this branch
          items = items.filter(c => c.branchId === managerBranchId);
        } else if (collectionName === 'staff') {
          // Only return delivery riders assigned to this branch
          items = items.filter(s => s.branchId === managerBranchId);
        } else if (collectionName === 'plans') {
          // Only return plans available to this branch
          items = items.filter(p => !p.branchId || p.branchId === 'All' || p.branchId === managerBranchId);
        } else if (collectionName === 'single_orders') {
          // Only return single meal orders for this branch
          items = items.filter(o => o.branchId === managerBranchId);
        } else if (collectionName === 'expenses') {
          // Only return expenses for this branch
          items = items.filter(e => e.branchId === managerBranchId);
        } else if (collectionName === 'inventory') {
          // Only return kitchen stock inventory for this branch
          items = items.filter(i => i.branchId === managerBranchId);
        } else if (collectionName === 'notes') {
          // Only return notes for this branch
          items = items.filter(n => !n.branchId || n.branchId === managerBranchId);
        } else if (collectionName === 'delivery_logs') {
          // Only return delivery logs for this branch
          items = items.filter(l => !l.branchId || l.branchId === managerBranchId);
        } else if (collectionName === 'payments') {
          // Only return payments matching this branch
          items = items.filter(p => !p.branchId || p.branchId === managerBranchId);
        }
      }

      setData(items as T[]);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn(`Firestore Stream Error (${collectionName}):`, error.message);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [effectiveUid, collectionName]);

  return { data, loading };
};

/**
 * Sanitizes object by recursively removing all `undefined` values.
 * Firestore throws a runtime exception if any field value is `undefined`.
 */
export const sanitizeFirestoreData = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreData(item));
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeFirestoreData(value);
    }
  }
  return clean;
};

export const addItem = async (userId: string, collectionName: string, data: any) => {
  try {
    const targetUid = getTargetBusinessId(userId);
    if (!targetUid) throw new Error("No target business ID found.");
    
    let enrichedData = { ...data };

    // Auto-enforce branch restriction for branch managers
    const managerBranchId = getManagerBranchId();
    if (managerBranchId && ['customers', 'single_orders', 'expenses', 'inventory', 'staff'].includes(collectionName)) {
      enrichedData.branchId = managerBranchId;
    }

    const { id: _ignoreId, ...cleanData } = enrichedData;
    const safePayload = sanitizeFirestoreData({
      ...cleanData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const colRef = collection(db, 'businesses', targetUid, collectionName);
    const docRef = await addDoc(colRef, safePayload);
    return docRef.id;
  } catch (error) {
    console.error(`Error adding to ${collectionName}:`, error);
    throw error;
  }
};

export const updateItem = async (userId: string, collectionName: string, docId: string, data: any) => {
  try {
    const targetUid = getTargetBusinessId(userId);
    if (!targetUid) throw new Error("No target business ID found.");
    if (!docId) throw new Error("No document ID provided for update.");

    let enrichedData = { ...data };

    const managerBranchId = getManagerBranchId();
    if (managerBranchId && ['customers', 'single_orders', 'expenses', 'inventory', 'staff'].includes(collectionName)) {
      enrichedData.branchId = managerBranchId;
    }

    // Strip top-level 'id' and computed virtual enrichment fields to prevent corrupting database documents
    const { 
      id: _ignoreId, 
      realDaysLeft: _ignoreDaysLeft, 
      isExpired: _ignoreExpired, 
      latestEndDate: _ignoreLatestEnd, 
      canonicalPlanName: _ignorePlanName,
      ...cleanData 
    } = enrichedData;

    const safePayload = sanitizeFirestoreData({
      ...cleanData,
      updatedAt: new Date().toISOString()
    });

    const docRef = doc(db, 'businesses', targetUid, collectionName, docId);
    // Use setDoc with merge: true to avoid crashes if document state differs
    await setDoc(docRef, safePayload, { merge: true });

    // Sync stats if modifying core collections
    if (['customers', 'staff', 'branches', 'single_orders', 'payments'].includes(collectionName)) {
      syncBusinessLiveStats(targetUid).catch(() => {});
    }
  } catch (error) {
    console.error(`Error updating ${collectionName}/${docId}:`, error);
    throw error;
  }
};

export const setItem = async (userId: string, collectionName: string, docId: string, data: any) => {
  try {
    const targetUid = getTargetBusinessId(userId);
    if (!targetUid) throw new Error("No target business ID found.");
    if (!docId) throw new Error("No document ID provided for setting data.");

    const { 
      id: _ignoreId, 
      realDaysLeft: _ignoreDaysLeft, 
      isExpired: _ignoreExpired, 
      latestEndDate: _ignoreLatestEnd, 
      canonicalPlanName: _ignorePlanName,
      ...cleanData 
    } = data;

    const safePayload = sanitizeFirestoreData({
      ...cleanData,
      updatedAt: new Date().toISOString()
    });

    const docRef = doc(db, 'businesses', targetUid, collectionName, docId);
    await setDoc(docRef, safePayload, { merge: true });
  } catch (error) {
    console.error(`Error setting ${collectionName}/${docId}:`, error);
    throw error;
  }
};

export const deleteItem = async (userId: string, collectionName: string, docId: string) => {
  try {
    const targetUid = getTargetBusinessId(userId);
    if (!targetUid) throw new Error("No target business ID found.");
    if (!docId) throw new Error("No document ID provided for deletion.");

    const docRef = doc(db, 'businesses', targetUid, collectionName, docId);
    await deleteDoc(docRef);

    if (['customers', 'staff', 'branches', 'single_orders', 'payments'].includes(collectionName)) {
      syncBusinessLiveStats(targetUid).catch(() => {});
    }
  } catch (error) {
    console.error(`Error deleting ${collectionName}/${docId}:`, error);
    throw error;
  }
};

/**
 * Atomic customer creation with optional initial payment.
 * Ensures customer and linked initial payment record are committed together in a single batch.
 */
export const addCustomerWithPaymentAtomic = async (
  userId: string,
  customerData: any,
  initialPaymentAmount: number = 0
): Promise<string> => {
  const targetUid = getTargetBusinessId(userId);
  if (!targetUid) throw new Error("No target business ID found.");

  const batch = writeBatch(db);
  const customersCol = collection(db, 'businesses', targetUid, 'customers');
  const newCustRef = doc(customersCol);
  const customerId = newCustRef.id;

  const { 
    id: _ignoreId, 
    realDaysLeft: _ignoreDaysLeft, 
    isExpired: _ignoreExpired, 
    latestEndDate: _ignoreLatestEnd, 
    canonicalPlanName: _ignorePlanName,
    ...cleanData 
  } = customerData;

  const managerBranchId = getManagerBranchId();
  if (managerBranchId) {
    cleanData.branchId = managerBranchId;
  }

  const safeCustomerPayload = sanitizeFirestoreData({
    ...cleanData,
    id: customerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  batch.set(newCustRef, safeCustomerPayload);

  if (initialPaymentAmount > 0) {
    const paymentsCol = collection(db, 'businesses', targetUid, 'payments');
    const newPayRef = doc(paymentsCol);
    const safePaymentPayload = sanitizeFirestoreData({
      amount: initialPaymentAmount,
      customerId,
      customerName: customerData.name || '',
      date: new Date().toISOString(),
      type: 'Income',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    batch.set(newPayRef, safePaymentPayload);
  }

  await batch.commit();

  // Immediately refresh live stats
  syncBusinessLiveStats(targetUid).catch(() => {});

  return customerId;
};

/**
 * Atomic customer deletion that removes customer, associated payments, and delivery logs in a single transaction.
 */
export const deleteCustomerAtomic = async (userId: string, customerId: string): Promise<void> => {
  const targetUid = getTargetBusinessId(userId);
  if (!targetUid) throw new Error("No target business ID found.");
  if (!customerId) throw new Error("No customer ID provided for deletion.");

  const batch = writeBatch(db);
  const custDocRef = doc(db, 'businesses', targetUid, 'customers', customerId);
  batch.delete(custDocRef);

  // Clean up linked payments atomically
  try {
    const paySnap = await getDocs(query(
      collection(db, 'businesses', targetUid, 'payments'),
      where('customerId', '==', customerId)
    ));
    paySnap.forEach(d => batch.delete(d.ref));
  } catch (payErr) {
    console.warn("Payment query during atomic delete note:", payErr);
  }

  // Clean up linked delivery logs atomically
  try {
    const logsSnap = await getDocs(query(
      collection(db, 'businesses', targetUid, 'delivery_logs'),
      where('customerId', '==', customerId)
    ));
    logsSnap.forEach(d => batch.delete(d.ref));
  } catch (logErr) {
    console.warn("Delivery logs query during atomic delete note:", logErr);
  }

  await batch.commit();

  // Immediately refresh live stats so dashboard customer count reflects true state
  syncBusinessLiveStats(targetUid).catch(() => {});
};

/**
 * Atomic branch pause operation committing updates across all affected customers in batches.
 */
export const pauseBranchAtomic = async (
  userId: string,
  customerUpdates: Array<{ id: string; activePlans: any[]; endDate: string; daysLeft: number }>
): Promise<number> => {
  const targetUid = getTargetBusinessId(userId);
  if (!targetUid) throw new Error("No target business ID found.");
  if (customerUpdates.length === 0) return 0;

  const BATCH_SIZE = 450;
  let committed = 0;

  for (let i = 0; i < customerUpdates.length; i += BATCH_SIZE) {
    const chunk = customerUpdates.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const update of chunk) {
      const docRef = doc(db, 'businesses', targetUid, 'customers', update.id);
      const safePayload = sanitizeFirestoreData({
        activePlans: update.activePlans,
        endDate: update.endDate,
        daysLeft: update.daysLeft,
        updatedAt: new Date().toISOString()
      });
      batch.set(docRef, safePayload, { merge: true });
    }

    await batch.commit();
    committed += chunk.length;
  }

  return committed;
};

// --- GLOBAL PRICING SERVICE ---
export const useGlobalPricing = () => {
  const [plans, setPlans] = useState<SaasPlan[]>(SHARED_SAAS_PLANS);
  const [offer, setOffer] = useState<SpecialOffer>(SHARED_OFFER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'global_settings', 'saas_config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.plans) setPlans(data.plans);
        if (data.offer) setOffer(data.offer);
      }
      setLoading(false);
    }, (error) => {
      // Fallback silently to shared constants if permissions are temporarily unavailable
      setPlans(SHARED_SAAS_PLANS);
      setOffer(SHARED_OFFER);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { plans, offer, loading };
};

export const saveGlobalPricing = async (plans: SaasPlan[], offer: SpecialOffer) => {
  await setDoc(doc(db, 'global_settings', 'saas_config'), {
    plans,
    offer,
    updatedAt: new Date().toISOString()
  });
};

// --- OWNER DAILY LOGIN & BUSINESS AGGREGATION SERVICES ---
/**
 * Records daily login info for business owner in Firestore.
 * Keeps lastLoginAt, lastLoginDate, loginCount, recentLoginDates, and an audit entry in login_logs.
 */
export const recordOwnerDailyLogin = async (businessId: string) => {
  if (!businessId) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const bizRef = doc(db, 'businesses', businessId);
    const snap = await getDoc(bizRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const updates: any = {
      lastLoginAt: nowIso,
      lastLoginDate: today,
      updatedAt: nowIso
    };

    if (data.lastLoginDate !== today) {
      updates.loginCount = (Number(data.loginCount) || 0) + 1;
      const recent = Array.isArray(data.recentLoginDates) ? [...data.recentLoginDates] : [];
      if (!recent.includes(today)) {
        recent.unshift(today);
        updates.recentLoginDates = recent.slice(0, 30); // Store up to last 30 daily logins
      }
    }

    await updateDoc(bizRef, updates);

    // Also persist an audit entry in the subcollection
    await setDoc(doc(db, 'businesses', businessId, 'login_logs', today), {
      date: today,
      lastSeenAt: nowIso,
      updatedAt: nowIso
    }, { merge: true }).catch(() => {});
  } catch (err) {
    console.warn("Error recording owner daily login:", err);
  }
};

/**
 * Live queries subcollections (branches, staff, customers, payments, single_orders)
 * and calculates live metrics: branchCount, deliveryBoysCount, totalUniqueCustomers, totalActiveCustomers, kitchenRevenue.
 * Persists the aggregate directly into businesses/{businessId} for instantaneous query in Admin Panel.
 */
export const syncBusinessLiveStats = async (businessId: string) => {
  if (!businessId) return null;
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const [bizSnap, branchesSnap, staffSnap, customersSnap, singlesSnap, paymentsSnap] = await Promise.all([
      getDoc(doc(db, 'businesses', businessId)).catch(() => null),
      getDocs(collection(db, 'businesses', businessId, 'branches')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'businesses', businessId, 'staff')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'businesses', businessId, 'customers')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'businesses', businessId, 'single_orders')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'businesses', businessId, 'payments')).catch(() => ({ docs: [] }))
    ]);

    const branchCount = branchesSnap.docs.length;

    // Delivery riders / staff
    const deliveryBoys = staffSnap.docs.filter((d: any) => {
      const data = d.data();
      const role = (data.role || '').toLowerCase();
      return role === 'rider' || role === 'driver' || role === 'delivery' || !role;
    });
    const deliveryBoysCount = deliveryBoys.length;

    // Unique & active customers
    const totalUniqueCustomers = customersSnap.docs.length;
    let totalActiveCustomers = 0;
    let customersRevenue = 0;

    customersSnap.docs.forEach((d: any) => {
      const c = d.data();
      const isActive = c.isActive !== false && (!c.endDate || c.endDate >= todayStr);
      if (isActive) totalActiveCustomers++;
      customersRevenue += (Number(c.planPrice) || 0) + (Number(c.deliveryCharges) || 0);
    });

    // Single meal orders revenue
    singlesSnap.docs.forEach((d: any) => {
      const o = d.data();
      customersRevenue += (Number(o.totalAmount) || Number(o.price) || Number(o.amount) || 0);
    });

    // Direct payments collection
    let recordedPayments = 0;
    paymentsSnap.docs.forEach((d: any) => {
      const p = d.data();
      recordedPayments += (Number(p.amount) || 0);
    });

    const kitchenRevenue = Math.max(customersRevenue, recordedPayments);

    const stats: any = {
      branchCount,
      deliveryBoysCount,
      totalUniqueCustomers,
      totalActiveCustomers,
      kitchenRevenue,
      lastStatsSyncAt: new Date().toISOString()
    };

    // SECURITY & AUDIT: Detect and permanently repair artificially extended or reset Free Trial dates
    if (bizSnap && bizSnap.exists()) {
      const bData = bizSnap.data();
      const isFreeTrial = (bData.planName || '').toLowerCase().includes('trial');
      
      if (isFreeTrial) {
        // Collect ALL candidate timestamps from historical footprints
        const historicalDates: string[] = [];

        if (bData.createdAt && typeof bData.createdAt === 'string') {
          const cDate = bData.createdAt.split('T')[0];
          if (cDate.match(/^\d{4}-\d{2}-\d{2}$/)) historicalDates.push(cDate);
        }
        if (bData.trialOriginalStartDate && typeof bData.trialOriginalStartDate === 'string') {
          const sDate = bData.trialOriginalStartDate.split('T')[0];
          if (sDate.match(/^\d{4}-\d{2}-\d{2}$/)) historicalDates.push(sDate);
        }
        if (bData.trialStartDate && typeof bData.trialStartDate === 'string') {
          const sDate = bData.trialStartDate.split('T')[0];
          if (sDate.match(/^\d{4}-\d{2}-\d{2}$/)) historicalDates.push(sDate);
        }
        if (Array.isArray(bData.recentLoginDates) && bData.recentLoginDates.length > 0) {
          bData.recentLoginDates.forEach((d: string) => {
            if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
              historicalDates.push(d);
            }
          });
        }
        if (bData.firstLoginDate && typeof bData.firstLoginDate === 'string') {
          historicalDates.push(bData.firstLoginDate);
        }

        // Sort chronologically ascending to strictly find the absolute earliest footprint
        historicalDates.sort();
        const earliestFootprint = historicalDates.length > 0 ? historicalDates[0] : todayStr;

        const originObj = new Date(earliestFootprint);
        const correctTrialExpiryObj = new Date(originObj);
        correctTrialExpiryObj.setDate(correctTrialExpiryObj.getDate() + 30);
        const correctTrialExpiry = correctTrialExpiryObj.toISOString().split('T')[0];

        // If planExpiryDate is set beyond correctTrialExpiry or trial dates are out of sync:
        if (
          bData.planExpiryDate > correctTrialExpiry || 
          !bData.trialClaimed || 
          bData.trialStartDate !== earliestFootprint ||
          bData.trialExpiryDate !== correctTrialExpiry
        ) {
          stats.trialClaimed = true;
          stats.trialStartDate = earliestFootprint;
          stats.trialOriginalStartDate = earliestFootprint;
          stats.trialExpiryDate = correctTrialExpiry;
          stats.trialOriginalExpiryDate = correctTrialExpiry;
          stats.planExpiryDate = correctTrialExpiry;
          stats.tamperResetDetected = bData.planExpiryDate > correctTrialExpiry;
          stats.originalFootprintDate = earliestFootprint;

          if (correctTrialExpiry < todayStr) {
            stats.planStatus = 'Expired';
          }
        }
      }

      // Restore owner details if they were cleared during a previous trial reset
      if (!bData.ownerName && bData.displayName) {
        stats.ownerName = bData.displayName;
      }
    }

    await updateDoc(doc(db, 'businesses', businessId), stats).catch((err) => {
      console.warn("Notice: Live stats sync update:", err?.message);
    });
    return stats;
  } catch (err) {
    console.error("Error syncing business live stats:", err);
    return null;
  }
};

/**
 * Fetches deep dossier for a single business (all branches, delivery boys, recent customers, login history).
 */
export const fetchBusinessDetailedDossier = async (businessId: string) => {
  if (!businessId) return null;
  try {
    const [bizSnap, branchesSnap, staffSnap, customersSnap, loginLogsSnap] = await Promise.all([
      getDoc(doc(db, 'businesses', businessId)).catch(() => null),
      getDocs(collection(db, 'businesses', businessId, 'branches')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'businesses', businessId, 'staff')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'businesses', businessId, 'customers')).catch(() => ({ docs: [] })),
      getDocs(query(collection(db, 'businesses', businessId, 'login_logs'), orderBy('date', 'desc'))).catch(() => ({ docs: [] }))
    ]);

    const business = bizSnap && bizSnap.exists() ? { ...bizSnap.data(), id: bizSnap.id } : null;
    const branches = branchesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const staff = staffSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const customers = customersSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const loginLogs = loginLogsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

    return {
      business,
      branches,
      staff,
      customers,
      loginLogs
    };
  } catch (err) {
    console.error("Error fetching business dossier:", err);
    return null;
  }
};

/**
 * Syncs stats for an entire batch of businesses in parallel.
 */
export const syncAllBusinessesLiveStats = async (businessIds: string[]) => {
  const results: Record<string, any> = {};
  await Promise.all(businessIds.map(async (id) => {
    const stats = await syncBusinessLiveStats(id);
    if (stats) results[id] = stats;
  }));
  return results;
};

// --- ADMIN SERVICES ---
export const useAdminTenants = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'businesses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setTenants(users);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn("Admin tenants stream error:", error.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { tenants, loading };
};

export const useAdminBillingHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collectionGroup(db, 'billing_history'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const pathSegments = doc.ref.path.split('/');
        return {
          ...doc.data(),
          id: doc.id,
          tenantId: pathSegments[1]
        };
      });
      setHistory(items);
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.warn("Admin billing history error:", err.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { history, loading };
};

export const useGlobalCollection = (collectionName: string) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setData(items);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn(`Global Collection Error (${collectionName}):`, error.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [collectionName]);

  return { data, loading };
};

export const updateGlobalItem = async (collectionName: string, docId: string, data: any) => {
  await updateDoc(doc(db, collectionName, docId), data);
};

export const addGlobalItem = async (collectionName: string, data: any) => {
  await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: new Date().toISOString()
  });
};

/**
 * Checks if a given email, mobile number, or user ID has already consumed a Free Trial.
 * Prevents users from abusing or resetting the 30-day trial.
 */
export const checkFreeTrialEligibility = async (
  email: string, 
  mobile: string,
  currentUserId?: string
): Promise<{ eligible: boolean; reason?: string }> => {
  const normEmail = normalizeEmail(email);
  const normPhone = normalizePhone(mobile);

  try {
    // 1. Check if the current user ID already has a recorded trial claim or business trial
    if (currentUserId) {
      const userClaimSnap = await getDoc(doc(db, 'trial_claims', `user_${currentUserId}`)).catch(() => null);
      if (userClaimSnap && userClaimSnap.exists()) {
        const claimData = userClaimSnap.data();
        const claimDate = claimData?.claimedAt ? claimData.claimedAt.split('T')[0] : 'an earlier date';
        return {
          eligible: false,
          reason: `Your 30-day Free Trial was already activated on ${claimDate}. Free trial is strictly 1 time per business.`
        };
      }

      // Also check existing business doc
      const bizSnap = await getDoc(doc(db, 'businesses', currentUserId)).catch(() => null);
      if (bizSnap && bizSnap.exists()) {
        const bData = bizSnap.data();
        if (bData.trialClaimed === true || bData.trialStartDate || (bData.planName === 'Free Trial' && bData.createdAt)) {
          const startDate = bData.trialStartDate ? bData.trialStartDate.split('T')[0] : (bData.createdAt ? bData.createdAt.split('T')[0] : '');
          return {
            eligible: false,
            reason: `Your 30-day Free Trial was already activated${startDate ? ` on ${startDate}` : ''}. Free trial is strictly 1 time per business.`
          };
        }
      }
    }

    // 2. Check Phone in trial_claims only if a valid 10-digit number is provided
    if (normPhone && normPhone.length >= 10) {
      const phoneSnap = await getDoc(doc(db, 'trial_claims', `phone_${normPhone}`)).catch(() => null);
      if (phoneSnap && phoneSnap.exists()) {
        return {
          eligible: false,
          reason: `Mobile number (+91 ${normPhone}) has already been used for a Free Trial. Please select a subscription plan to continue.`
        };
      }
    }

    // 3. Check Email in trial_claims
    if (normEmail) {
      const emailSnap = await getDoc(doc(db, 'trial_claims', `email_${normEmail}`)).catch(() => null);
      if (emailSnap && emailSnap.exists()) {
        return {
          eligible: false,
          reason: `Email (${normEmail}) has already claimed a Free Trial. Please choose a subscription plan to continue.`
        };
      }
    }

    return { eligible: true };
  } catch (err) {
    console.warn("Error checking free trial eligibility:", err);
    return { eligible: true };
  }
};

/**
 * Permanently records a Free Trial activation under the user's ID, phone, and email.
 */
export const recordFreeTrialClaim = async (userId: string, email: string, mobile: string, originStartDate?: string) => {
  if (!userId) return;
  const normEmail = normalizeEmail(email);
  const normPhone = normalizePhone(mobile);
  const now = new Date().toISOString();
  const trialStart = originStartDate || now;

  const startObj = new Date(trialStart);
  const expiryObj = new Date(startObj);
  expiryObj.setDate(expiryObj.getDate() + 30);
  const expiryDate = expiryObj.toISOString().split('T')[0];

  const claimData = {
    userId,
    mobile: normPhone,
    email: normEmail,
    claimedAt: now,
    trialStartDate: trialStart,
    trialExpiryDate: expiryDate
  };

  const promises: Promise<any>[] = [
    // 1. By User UID
    setDoc(doc(db, 'trial_claims', `user_${userId}`), claimData, { merge: true })
      .catch(err => console.warn("Failed recording user trial claim:", err))
  ];

  // 2. By Phone
  if (normPhone && normPhone.length >= 10) {
    promises.push(
      setDoc(doc(db, 'trial_claims', `phone_${normPhone}`), claimData, { merge: true })
        .catch(err => console.warn("Failed recording phone trial claim:", err))
    );
  }

  // 3. By Email
  if (normEmail) {
    promises.push(
      setDoc(doc(db, 'trial_claims', `email_${normEmail}`), claimData, { merge: true })
        .catch(err => console.warn("Failed recording email trial claim:", err))
    );
  }

  try {
    await Promise.allSettled(promises);
  } catch (e) {
    console.warn("Notice: trial claims record settled with warning:", e);
  }
};