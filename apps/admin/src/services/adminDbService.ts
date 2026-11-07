import { useState, useEffect } from 'react';
import {
  collection,
  collectionGroup,
  query,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  addDoc,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { SaasPlan, SpecialOffer, SHARED_SAAS_PLANS, SHARED_OFFER, TenantUser } from './adminStore';

/**
 * Real-time hook to stream all businesses for the Admin portal.
 */
export const useAdminTenants = () => {
  const [tenants, setTenants] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'businesses'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const users = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id
        })) as TenantUser[];
        setTenants(users);
        setLoading(false);
        setError(null);
      }, 
      (err) => {
        console.warn("[AdminDB] Admin tenants stream error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { tenants, loading, error };
};

/**
 * Real-time hook to stream global billing and subscription transactions.
 */
export const useAdminBillingHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collectionGroup(db, 'billing_history'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const items = snapshot.docs.map(d => {
          const pathSegments = d.ref.path.split('/');
          return {
            ...d.data(),
            id: d.id,
            tenantId: pathSegments[1]
          };
        });
        setHistory(items);
        setLoading(false);
        setError(null);
      }, 
      (err) => {
        console.warn("[AdminDB] Admin billing history stream error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { history, loading, error };
};

/**
 * Real-time hook to stream a global collection (e.g. admin_messages, global_features, global_tickets, global_reviews).
 */
export const useGlobalCollection = (collectionName: string) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const items = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id
        }));
        setData(items);
        setLoading(false);
        setError(null);
      }, 
      (err) => {
        console.warn(`[AdminDB] Global collection error (${collectionName}):`, err.message);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [collectionName]);

  return { data, loading, error };
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
 * Global SaaS pricing configuration stream from global_settings/saas_config.
 */
export const useGlobalPricing = () => {
  const [plans, setPlans] = useState<SaasPlan[]>(SHARED_SAAS_PLANS);
  const [offer, setOffer] = useState<SpecialOffer | null>(SHARED_OFFER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'global_settings', 'saas_config');
    const unsubscribe = onSnapshot(
      docRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.plans) setPlans(data.plans);
          if (data.offer) setOffer(data.offer);
        }
        setLoading(false);
      }, 
      (err) => {
        console.warn("[AdminDB] Global pricing fetch warning, falling back to shared defaults:", err.message);
        setPlans(SHARED_SAAS_PLANS);
        setOffer(SHARED_OFFER);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { plans, offer, loading };
};

export const saveGlobalPricing = async (plans: SaasPlan[], offer: SpecialOffer | null) => {
  await setDoc(doc(db, 'global_settings', 'saas_config'), {
    plans,
    offer,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Live queries subcollections (branches, staff, customers, single_orders, payments)
 * to compute live aggregate stats and persist them into businesses/{businessId}.
 * Also audits and repairs artificially manipulated Free Trial expiration dates.
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

        historicalDates.sort();
        const earliestFootprint = historicalDates.length > 0 ? historicalDates[0] : todayStr;

        const originObj = new Date(earliestFootprint);
        const correctTrialExpiryObj = new Date(originObj);
        correctTrialExpiryObj.setDate(correctTrialExpiryObj.getDate() + 30);
        const correctTrialExpiry = correctTrialExpiryObj.toISOString().split('T')[0];

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
 * Deep dossier fetch for a single tenant business.
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
 * Syncs stats for a batch of businesses.
 */
export const syncAllBusinessesLiveStats = async (businessIds: string[]) => {
  const results: Record<string, any> = {};
  await Promise.all(businessIds.map(async (id) => {
    const stats = await syncBusinessLiveStats(id);
    if (stats) results[id] = stats;
  }));
  return results;
};
