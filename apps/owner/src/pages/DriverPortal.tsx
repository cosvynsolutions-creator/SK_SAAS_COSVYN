import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Truck, MapPin, Phone, MessageSquare, CheckCircle2, Clock, 
  AlertCircle, AlertTriangle, Navigation, ArrowRight, RefreshCw, 
  ChevronRight, Calendar, User, Shield, Info, Battery, Compass,
  Sparkles, Check, X, RotateCcw, Package, HelpCircle, ExternalLink, Play, Star,
  Lock, Key, Eye, EyeOff, LogOut
} from 'lucide-react';
import { 
  collection, query, onSnapshot, doc, updateDoc, setDoc, getDocs, getDoc, collectionGroup 
} from 'firebase/firestore';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { db, auth, driverLoginCallable } from '../services/firebase';
import bcrypt from 'bcryptjs';

/**
 * TEMPORARY MIGRATION FLAG:
 * Kept strictly for backward compatibility during Phase 1 deployment transition.
 * REMOVAL CRITERIA: Once Cloud Functions (firebase deploy --only functions) are deployed
 * and migratePlaintextCredentials has run, set this to false and remove the fallback branch.
 */
const ENABLE_LEGACY_CLIENT_AUTH_FALLBACK = true;
import { 
  getTodayStr, isCustomerDeliveryDay2Plus, REUSABLE_BOX_TYPES, 
  BoxRecollectionStatus, DeliveryBoyStaff, GlobalCustomer, SubscribedPlan,
  getCustomerScheduledPlansForSession, isPlanActiveOnDate, formatDateDDMMYYYY,
  decodeDriverToken, normalizePhone, isReusableBoxType,
  getDefaultMealSessionForTime, MealSession, getPlanDietOnDate, DietType
} from '../services/store';
import { buildWhatsAppUrl, getDeliveryArrivalMessage } from '../services/messageTemplates';


// Sample demo data for instant preview or offline testing
const DEMO_STAFF: DeliveryBoyStaff[] = [
  {
    id: 'demo-rider-1',
    name: 'Raju Express',
    mobile: '9876543210',
    branchId: 'main-hub',
    role: 'Delivery Boy',
    status: 'Online',
    currentLat: 12.9716,
    currentLng: 77.5946,
    lastLocationUpdate: new Date().toISOString(),
    lastAttendanceDate: getTodayStr(),
    attendanceMarkedAt: '08:30 AM'
  },
  {
    id: 'demo-rider-2',
    name: 'Amit Kumar',
    mobile: '9812345678',
    branchId: 'main-hub',
    role: 'Delivery Boy',
    status: 'Offline',
    lastAttendanceDate: '',
    attendanceMarkedAt: ''
  }
];

const DEMO_CUSTOMERS: GlobalCustomer[] = [
  {
    id: 'demo-cust-1',
    name: 'Rahul Verma',
    mobile: '9845012345',
    address: 'Flat 402, Green Glen Towers, Outer Ring Road, Bellandur',
    area: 'Bellandur',
    branchId: 'main-hub',
    deliveryBoyId: 'demo-rider-1',
    deliveryBoyName: 'Raju Express',
    routeOrder: 1,
    isActive: true,
    createdAt: '2026-09-01T08:00:00.000Z',
    planId: 'p-lunch-deluxe',
    mealTime: ['Lunch'],
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    daysLeft: 37,
    paymentStatus: 'Paid',
    amountPaid: 3200,
    planPrice: 3200,
    deliveryCharges: 0,
    pendingAmount: 0,
    renewalCount: 1,
    reusableBoxEnabled: true,
    reusableBoxType: '3-Tier Stainless Steel Tiffin',
    uncollectedBoxesCount: 1,
    activePlans: [
      {
        planId: 'p-lunch-deluxe',
        planName: 'Deluxe Healthy Lunch',
        mealTime: 'Lunch',
        startDate: '2026-09-01',
        endDate: '2026-10-31',
        price: 3200,
        pauses: [],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        reusableBoxType: '3-Tier Stainless Steel Tiffin'
      }
    ]
  },
  {
    id: 'demo-cust-2',
    name: 'Pooja Hegde',
    mobile: '9741098765',
    address: 'Villa 18, Palm Meadows Phase 2, Whitefield',
    area: 'Whitefield',
    branchId: 'main-hub',
    deliveryBoyId: 'demo-rider-1',
    deliveryBoyName: 'Raju Express',
    routeOrder: 2,
    isActive: true,
    createdAt: '2026-09-05T08:00:00.000Z',
    planId: 'p-lunch-deluxe',
    mealTime: ['Lunch'],
    startDate: '2026-09-05',
    endDate: '2026-10-31',
    daysLeft: 37,
    paymentStatus: 'Paid',
    amountPaid: 3200,
    planPrice: 3200,
    deliveryCharges: 0,
    pendingAmount: 0,
    renewalCount: 0,
    reusableBoxEnabled: true,
    reusableBoxType: 'Insulated Hot-Box 4-Container',
    uncollectedBoxesCount: 2,
    activePlans: [
      {
        planId: 'p-lunch-deluxe',
        planName: 'Deluxe Healthy Lunch',
        mealTime: 'Lunch',
        startDate: '2026-09-05',
        endDate: '2026-10-31',
        price: 3200,
        pauses: [],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        reusableBoxType: 'Insulated Hot-Box 4-Container'
      }
    ]
  },
  {
    id: 'demo-cust-3',
    name: 'Vikram Malhotra',
    mobile: '9980123456',
    address: '#104, Sunrise Residency, Kadubeesanahalli',
    area: 'Kadubeesanahalli',
    branchId: 'main-hub',
    deliveryBoyId: 'demo-rider-1',
    deliveryBoyName: 'Raju Express',
    routeOrder: 3,
    isActive: true,
    createdAt: '2026-09-10T08:00:00.000Z',
    planId: 'p-lunch-eco',
    mealTime: ['Lunch'],
    startDate: '2026-09-10',
    endDate: '2026-10-31',
    daysLeft: 37,
    paymentStatus: 'Paid',
    amountPaid: 2400,
    planPrice: 2400,
    deliveryCharges: 0,
    pendingAmount: 0,
    renewalCount: 0,
    reusableBoxEnabled: false,
    reusableBoxType: 'None',
    uncollectedBoxesCount: 0,
    activePlans: [
      {
        planId: 'p-lunch-eco',
        planName: 'Standard Homestyle Lunch',
        mealTime: 'Lunch',
        startDate: '2026-09-10',
        endDate: '2026-10-31',
        price: 2400,
        pauses: [],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        reusableBoxType: 'None'
      }
    ]
  }
];

// Safe storage helpers for Safari Private Browsing and cross-browser reliability
const safeStorageGet = (key: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const safeStorageSet = (key: string, val: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, val);
  } catch {}
  try {
    sessionStorage.setItem(key, val);
  } catch {}
};

export const DriverPortal: React.FC = () => {
  // Read params from URL or localStorage across all mobile and desktop browsers
  const getParam = (key: string) => {
    if (typeof window === 'undefined') return '';
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let val = searchParams.get(key);
      if (val) return val;

      const hash = window.location.hash || '';
      if (hash.includes('?')) {
        const hashQuery = hash.substring(hash.indexOf('?') + 1);
        const hashParams = new URLSearchParams(hashQuery);
        val = hashParams.get(key);
        if (val) return val;
      }

      // Regex fallback across full href for unusual redirect/WhatsApp URL formats
      const href = window.location.href || '';
      const match = href.match(new RegExp(`[?&]${key}=([^&#]*)`));
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
      return '';
    } catch {
      return '';
    }
  };

  // Decode secure obfuscated token if present
  const token = getParam('auth') || getParam('k') || getParam('token');
  const decoded = token ? decodeDriverToken(token) : null;

  // Persist URL parameters immediately so the mobile session persists across reloads
  if (decoded) {
    if (decoded.bizId) safeStorageSet('driver_biz_id', decoded.bizId);
    if (decoded.boyId) safeStorageSet('driver_boy_id', decoded.boyId);
    if (decoded.mobile) safeStorageSet('driver_phone', decoded.mobile);
    if (decoded.name) safeStorageSet('driver_name', decoded.name);
  }
  const urlBiz = getParam('biz');
  if (urlBiz) safeStorageSet('driver_biz_id', urlBiz);
  const urlBoy = getParam('boy');
  if (urlBoy) safeStorageSet('driver_boy_id', urlBoy);
  const urlPhone = getParam('phone');
  if (urlPhone) safeStorageSet('driver_phone', urlPhone);

  const initialBiz = decoded?.bizId || 
                     urlBiz || 
                     safeStorageGet('driver_biz_id') || 
                     safeStorageGet('last_active_business_id') || 
                     safeStorageGet('manager_biz_id') || 
                     (!auth.currentUser?.isAnonymous ? auth.currentUser?.uid : '') || '';
  const initialBoy = decoded?.boyId || urlBoy || safeStorageGet('driver_boy_id') || '';
  const initialPhone = decoded?.mobile || urlPhone || safeStorageGet('driver_phone') || '';
  const initialName = decoded?.name || safeStorageGet('driver_name') || safeStorageGet('driver_token_name') || '';

  const [bizId, setBizId] = useState<string>(initialBiz);
  const [bizInput, setBizInput] = useState<string>('');
  const [selectedBoyId, setSelectedBoyId] = useState<string>(initialBoy);
  const [driverDisplayName, setDriverDisplayName] = useState<string>(initialName);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(initialBiz === 'demo');
  
  // Kitchen Owner Preview: ONLY active if owner is logged in to Firebase AND NOT logged in as a delivery partner
  const sessionExpires = Number(safeStorageGet('driver_session_expires') || 0);
  const isSessionValid = !sessionExpires || sessionExpires > Date.now();
  const isDriverLoggedIn = Boolean(safeStorageGet('driver_is_logged_in') === 'true' && isSessionValid);
  const isOwnerPreviewParam = typeof window !== 'undefined' && (getParam('view') === 'preview' || getParam('preview') === 'true');
  const isOwnerFirebaseAccount = Boolean(
    auth.currentUser && 
    !auth.currentUser.isAnonymous && 
    auth.currentUser.email !== 'driver_session_system@scalekitchen.internal' &&
    (!initialBiz || auth.currentUser.uid === initialBiz)
  );
  const [isKitchenOwnerUser, setIsKitchenOwnerUser] = useState<boolean>(
    !isDriverLoggedIn && isOwnerFirebaseAccount && isOwnerPreviewParam
  );

  const [loginError, setLoginError] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState<string>(initialPhone);
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);

  // If driver has an active authenticated session, close login modal; otherwise prompt for 4-digit PIN
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(() => {
    if (initialBiz === 'demo') return false;
    if (initialBoy && isDriverLoggedIn) return false;
    // Don't auto-open if in owner preview
    if (!isDriverLoggedIn && isOwnerFirebaseAccount && isOwnerPreviewParam) return false;
    return true;
  });

  const [selectedMeal, setSelectedMeal] = useState<MealSession>(() => getDefaultMealSessionForTime());
  const [isDriverMealManuallySelected, setIsDriverMealManuallySelected] = useState<boolean>(false);

  // Auto-update meal session on time boundary crossing if driver hasn't manually overridden it
  useEffect(() => {
    const checkTime = () => {
      if (!isDriverMealManuallySelected) {
        const expected = getDefaultMealSessionForTime();
        setSelectedMeal(prev => (prev !== expected ? expected : prev));
      }
    };
    const interval = setInterval(checkTime, 30000);
    return () => clearInterval(interval);
  }, [isDriverMealManuallySelected]);

  const [allStaff, setAllStaff] = useState<DeliveryBoyStaff[]>([]);
  const [customers, setCustomers] = useState<GlobalCustomer[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<Record<string, any>>({});
  const [businessName, setBusinessName] = useState<string>('ScaleKitchen');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Shift & Attendance state: persists reliably across browser tab refreshes for today
  const todayStr = getTodayStr();
  const hasLocalActiveShift = safeStorageGet('driver_shift_active') === 'true' && safeStorageGet('driver_shift_date') === todayStr;
  const [isShiftActive, setIsShiftActive] = useState<boolean>(hasLocalActiveShift);
  const [punchInTime, setPunchInTime] = useState<string | null>(() => {
    if (hasLocalActiveShift) return safeStorageGet('driver_punch_in_time') || null;
    return null;
  });
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [activeBoxModal, setActiveBoxModal] = useState<{ customer: GlobalCustomer; logKey: string } | null>(null);
  const [selectedBoxStatus, setSelectedBoxStatus] = useState<BoxRecollectionStatus>('Collected');
  const [boxNotes, setBoxNotes] = useState('');
  const [showAllUnassigned, setShowAllUnassigned] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightedStopId, setHighlightedStopId] = useState<string | null>(null);

  const showToast = (msg: string, stopId?: string) => {
    setToastMessage(msg);
    if (stopId) setHighlightedStopId(stopId);
    setTimeout(() => {
      setToastMessage(null);
      if (stopId) setHighlightedStopId(null);
    }, 4500);
  };

  const dayOfWeek = new Date().getDay();
  const watchIdRef = useRef<number | null>(null);

  // ZERO URL EXPOSURE: Clean query parameters from address bar immediately after reading
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const hasSearch = Boolean(window.location.search);
        const hasHashQuery = window.location.hash.includes('?');
        if (hasSearch || hasHashQuery) {
          const cleanHash = window.location.hash.split('?')[0] || '#/driver';
          window.history.replaceState(null, '', window.location.pathname + cleanHash);
        }
      } catch (e) {
        console.warn("Could not clean driver address bar URL:", e);
      }
    }
  }, []);

  // Universal Auth Synchronization for Delivery Boy App across all browsers
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const isDriverSession = Boolean(
        safeStorageGet('driver_is_logged_in') === 'true' || 
        user?.uid?.startsWith('driver_')
      );
      if (user && !user.isAnonymous && !user.uid.startsWith('driver_')) {
        // Only show preview banner if owner explicitly requested preview AND is not logged in as driver
        if (!isDriverSession && (getParam('view') === 'preview' || getParam('preview') === 'true')) {
          setIsKitchenOwnerUser(true);
        } else {
          setIsKitchenOwnerUser(false);
        }
        if (!bizId && !isDemoMode) {
          setBizId(user.uid);
        }
      } else {
        setIsKitchenOwnerUser(false);
      }
    });

    return () => unsub();
  }, [bizId, isDemoMode]);


  // Sync to localStorage
  useEffect(() => {
    if (bizId) safeStorageSet('driver_biz_id', bizId);
    if (selectedBoyId) safeStorageSet('driver_boy_id', selectedBoyId);
  }, [bizId, selectedBoyId]);

  // Load Demo Data if in demo mode
  const launchDemoMode = () => {
    setIsDemoMode(true);
    setBizId('demo');
    setAllStaff(DEMO_STAFF);
    setSelectedBoyId(DEMO_STAFF[0].id);
    setCustomers(DEMO_CUSTOMERS);
    setSelectedMeal('Lunch');
    setIsShiftActive(true);
    setPunchInTime('08:30 AM');
    setLoginModalOpen(false);
    setLoading(false);
  };

  // Subscribe to staff members of this business
  useEffect(() => {
    if (!bizId) {
      setLoading(false);
      return;
    }

    if (bizId === 'demo') {
      launchDemoMode();
      return;
    }

    // 1. Direct staff subcollection stream (works in owner preview or when permissions permit)
    const staffRef = collection(db, 'businesses', bizId, 'staff');
    const unsubscribeStaff = onSnapshot(staffRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DeliveryBoyStaff[];
      if (list.length > 0) {
        setAllStaff(list);
        
        // If a rider is selected, update shift status
        if (selectedBoyId) {
          const found = list.find(s => s.id === selectedBoyId || s.name === selectedBoyId);
          if (found) {
            const hasLocalShift = safeStorageGet('driver_shift_active') === 'true' && safeStorageGet('driver_shift_date') === todayStr;
            const isOnlineInDb = found.status === 'Online' && found.lastAttendanceDate === todayStr;
            setIsShiftActive(isOnlineInDb || hasLocalShift);
            if (found.attendanceMarkedAt) {
              setPunchInTime(found.attendanceMarkedAt);
            } else if (hasLocalShift && safeStorageGet('driver_punch_in_time')) {
              setPunchInTime(safeStorageGet('driver_punch_in_time'));
            }

            // ENFORCE ACCOUNT STATUS: If rider was deactivated or deleted by owner
            if ((found.status as string) === 'Inactive' || (found as any).isDeleted) {
              safeStorageSet('driver_is_logged_in', 'false');
              safeStorageSet('driver_session_expires', '0');
              setLoginError("This delivery partner account has been deactivated by the kitchen manager.");
              setLoginModalOpen(true);
            }
          }
        }
      }
      setLoading(false);
    }, (err) => {
      console.warn("Direct staff stream notice (using global manifest):", err?.message);
      setLoading(false);
    });

    // 2. Direct customers subcollection stream
    const custRef = collection(db, 'businesses', bizId, 'customers');
    const unsubscribeCust = onSnapshot(custRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as GlobalCustomer[];
      if (list.length > 0) setCustomers(list);
    }, (err) => console.warn("Direct customer stream notice (using global manifest):", err?.message));

    // 3. Direct plans stream
    const plansRef = collection(db, 'businesses', bizId, 'plans');
    const unsubscribePlans = onSnapshot(plansRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length > 0) setPlans(list);
    }, (err) => console.warn("Direct plans stream notice:", err?.message));

    // 4. Direct branches stream
    const branchesRef = collection(db, 'businesses', bizId, 'branches');
    const unsubscribeBranches = onSnapshot(branchesRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length > 0) setBranches(list);
    }, (err) => console.warn("Direct branches stream notice:", err?.message));

    // 5. Direct today's delivery logs stream
    const logsRef = collection(db, 'businesses', bizId, 'delivery_logs');
    const unsubscribeLogs = onSnapshot(logsRef, (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.date === todayStr) {
          map[`${data.customerId}_${data.mealTime}`] = { id: d.id, ...data };
        }
      });
      setDeliveryLogs(prev => ({ ...prev, ...map }));
    }, (err) => console.warn("Direct logs stream notice:", err?.message));

    // 6. Direct business profile stream for branding & logo
    const bizDocRef = doc(db, 'businesses', bizId);
    const unsubscribeBiz = onSnapshot(bizDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.businessName) setBusinessName(data.businessName);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      }
    }, (err) => console.warn("Driver biz profile err:", err?.message));

    // 7. REAL-TIME DRIVER MANIFEST in per-tenant subcollection (businesses/{bizId}/driver_manifest/{staffId})
    let unsubscribeManifest = () => {};
    if (selectedBoyId) {
      const manifestDocRef = doc(db, 'businesses', bizId, 'driver_manifest', selectedBoyId);
      unsubscribeManifest = onSnapshot(manifestDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.customers) && data.customers.length > 0) setCustomers(data.customers);
          if (Array.isArray(data.plans) && data.plans.length > 0) setPlans(data.plans);
          if (Array.isArray(data.branches) && data.branches.length > 0) setBranches(data.branches);
          if (data.businessName) setBusinessName(data.businessName);
          if (data.logoUrl) setLogoUrl(data.logoUrl);
          setLoading(false);
        }
      }, (err) => console.warn("Driver manifest stream notice:", err?.message));
    }

    // 8. REAL-TIME DRIVER STATUS in per-tenant subcollection (businesses/{bizId}/driver_status/{staffId})
    let unsubscribeStatus = () => {};
    if (selectedBoyId) {
      const statusDocRef = doc(db, 'businesses', bizId, 'driver_status', selectedBoyId);
      unsubscribeStatus = onSnapshot(statusDocRef, (snap) => {
        if (snap.exists()) {
          const sData = snap.data();
          if (sData.lastAttendanceDate === todayStr && sData.status === 'Online') {
            setIsShiftActive(true);
            if (sData.attendanceMarkedAt) setPunchInTime(sData.attendanceMarkedAt);
          } else if (sData.status === 'Offline') {
            const hasLocalShift = safeStorageGet('driver_shift_active') === 'true' && safeStorageGet('driver_shift_date') === todayStr;
            if (!hasLocalShift) {
              setIsShiftActive(false);
            }
          }
        }
      }, () => {});
    }

    const unsubscribeGlobalLogs = () => {};

    return () => {
      unsubscribeBiz();
      unsubscribeStaff();
      unsubscribeCust();
      unsubscribePlans();
      unsubscribeBranches();
      unsubscribeLogs();
      unsubscribeManifest();
      unsubscribeGlobalLogs();
      unsubscribeStatus();
    };
  }, [bizId, selectedBoyId, todayStr]);

  // GPS Watcher when shift is active (Module 4)
  useEffect(() => {
    if (isShiftActive && navigator.geolocation) {
      let lastWrittenMs = 0;

      const updateLocation = (pos: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        setGpsError(null);

        const nowMs = Date.now();
        // Throttle Firestore writes to at most once per 10 seconds to protect database & battery
        if (nowMs - lastWrittenMs < 10000) {
          return;
        }
        lastWrittenMs = nowMs;

        // Update driver live location in Firestore across driver_status and staff
        if (bizId && selectedBoyId) {
          const locPayload = {
            currentLat: latitude,
            currentLng: longitude,
            accuracy: accuracy || null,
            lastLocationUpdate: new Date().toISOString(),
            status: 'Online',
            isShiftActive: true,
            updatedAt: new Date().toISOString()
          };

          // 1. Update per-tenant driver_status (authoritative real-time fleet stream)
          setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), locPayload, { merge: true })
            .catch(err => console.warn("Driver status GPS sync err:", err));

          // 2. Update staff doc in staff subcollection
          const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
          updateDoc(boyDocRef, {
            currentLat: latitude,
            currentLng: longitude,
            lastLocationUpdate: new Date().toISOString(),
            status: 'Online',
            updatedAt: new Date().toISOString()
          }).catch(err => console.warn("Staff GPS update err:", err));
        }
      };

      const handleError = (err: GeolocationPositionError) => {
        setGpsError(err.message);
      };

      navigator.geolocation.getCurrentPosition(updateLocation, handleError, { enableHighAccuracy: true });
      watchIdRef.current = navigator.geolocation.watchPosition(updateLocation, handleError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000
      });

      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };
    }
  }, [isShiftActive, bizId, selectedBoyId]);

  // Safely sync driver display name when staff list loads without violating React render purity
  useEffect(() => {
    if (!selectedBoyId && !driverDisplayName) return;
    const fromStaff = allStaff.find(s => 
      s.id === selectedBoyId || 
      (selectedBoyId && s.id?.toLowerCase() === selectedBoyId.toLowerCase()) ||
      (driverDisplayName && s.name?.toLowerCase() === driverDisplayName.toLowerCase())
    );
    if (fromStaff?.name && fromStaff.name !== driverDisplayName) {
      setDriverDisplayName(fromStaff.name);
      safeStorageSet('driver_name', fromStaff.name);
    }
  }, [allStaff, selectedBoyId, driverDisplayName]);

  // Active delivery boy & their branch hub
  const currentBoy = useMemo(() => {
    const fromStaff = allStaff.find(s => 
      s.id === selectedBoyId || 
      (selectedBoyId && s.id?.toLowerCase() === selectedBoyId.toLowerCase()) ||
      (driverDisplayName && s.name?.toLowerCase() === driverDisplayName.toLowerCase())
    );
    if (fromStaff) return fromStaff;

    const name = driverDisplayName || safeStorageGet('driver_name') || safeStorageGet('driver_token_name');
    if (selectedBoyId || name) {
      return {
        id: selectedBoyId || safeStorageGet('driver_boy_id') || 'driver-1',
        name: name || 'Delivery Partner',
        mobile: phoneInput || safeStorageGet('driver_phone') || '',
        role: 'Delivery Boy',
        status: isShiftActive ? 'Online' : 'Offline',
        branchId: safeStorageGet('driver_branch_id') || '',
        lastAttendanceDate: isShiftActive ? todayStr : '',
        attendanceMarkedAt: punchInTime || undefined
      } as DeliveryBoyStaff;
    }
    return null;
  }, [allStaff, selectedBoyId, driverDisplayName, isShiftActive, phoneInput, todayStr, punchInTime]);

  const driverBranch = useMemo(() => {
    if (!currentBoy?.branchId) return branches[0] || null;
    return branches.find(b => b.id === currentBoy.branchId) || branches[0] || null;
  }, [currentBoy, branches]);

  // Quick helper to determine if a customer is assigned to this driver
  const isCustomerAssignedToRider = (c: any) => {
    if (showAllUnassigned) return true;
    const boyId = selectedBoyId || currentBoy?.id || safeStorageGet('driver_boy_id') || '';
    const boyName = (currentBoy?.name || driverDisplayName || safeStorageGet('driver_name') || '').toLowerCase().trim();
    const boyPhone = (phoneInput || currentBoy?.mobile || safeStorageGet('driver_phone') || '').replace(/\D/g, '').slice(-10);

    const cBoyId = String(c.deliveryBoyId || '').trim();
    const cBoyName = String(c.deliveryBoyName || '').toLowerCase().trim();
    const cBoyPhone = String(c.deliveryBoyPhone || c.deliveryBoyMobile || '').replace(/\D/g, '').slice(-10);

    // Exact ID match
    if (boyId && (cBoyId === boyId || cBoyId.toLowerCase() === boyId.toLowerCase())) return true;
    // Name match (case-insensitive)
    if (boyName && (cBoyName === boyName || cBoyId.toLowerCase() === boyName)) return true;
    // Phone match
    if (boyPhone && (cBoyPhone === boyPhone || cBoyId === boyPhone)) return true;
    // If customer has no delivery boy assigned, and either single driver or matching branch
    if (!cBoyId && !cBoyName) {
      if (allStaff.length <= 1) return true;
      if (currentBoy?.branchId && c.branchId && c.branchId === currentBoy.branchId) return true;
    }
    return false;
  };

  // Stop counts for each meal session (Breakfast, Lunch, Dinner)
  const sessionStopCounts = useMemo(() => {
    const counts = { Breakfast: 0, Lunch: 0, Dinner: 0 };
    (['Breakfast', 'Lunch', 'Dinner'] as const).forEach(meal => {
      const activeForMeal = customers.filter(c => {
        if (c.isActive === false) return false;
        if (!isCustomerAssignedToRider(c)) return false;
        const plansList = getCustomerScheduledPlansForSession(c, meal, todayStr, plans);
        if (plansList.length > 0) return true;
        const cMeal = Array.isArray(c.mealTime) ? c.mealTime : [c.mealTime || 'Lunch'];
        return cMeal.includes(meal) || cMeal.includes('All') || (meal === 'Lunch' && !c.mealTime);
      });
      counts[meal] = activeForMeal.length;
    });
    return counts;
  }, [customers, selectedBoyId, currentBoy, driverDisplayName, phoneInput, todayStr, plans, showAllUnassigned, allStaff.length]);

  // Smart Session Switcher: Auto-switch to the meal session with scheduled deliveries if current session has 0
  useEffect(() => {
    if (customers.length === 0) return;
    if (sessionStopCounts[selectedMeal] === 0) {
      if (sessionStopCounts['Lunch'] > 0 && selectedMeal !== 'Lunch') {
        setSelectedMeal('Lunch');
      } else if (sessionStopCounts['Breakfast'] > 0 && selectedMeal !== 'Breakfast') {
        setSelectedMeal('Breakfast');
      } else if (sessionStopCounts['Dinner'] > 0 && selectedMeal !== 'Dinner') {
        setSelectedMeal('Dinner');
      }
    }
  }, [sessionStopCounts, selectedMeal, customers.length]);

  // Stops assigned to this delivery boy for the selected meal session
  // Grouped BY CUSTOMER (Stop-based Route)
  const stops = useMemo(() => {
    if (!selectedBoyId && !driverDisplayName) return [];

    const activeCustomerStops: any[] = [];

    customers
      .filter(c => c.isActive !== false && isCustomerAssignedToRider(c))
      .forEach(c => {
        // Collect all scheduled plans for this customer for today in the selected meal session
        const rawPlans = getCustomerScheduledPlansForSession(c, selectedMeal, todayStr, plans);
        let scheduledPlans = rawPlans.map(ap => ({
          ...ap,
          planConfig: plans.find(p => p.id === ap.planId),
          quantity: Number(ap.quantity) || 1
        }));

        // Robust fallback: if customer has a subscription, check if meal matches
        if (scheduledPlans.length === 0) {
          const cMeal = Array.isArray(c.mealTime) ? c.mealTime : [c.mealTime || 'Lunch'];
          if (cMeal.includes(selectedMeal) || cMeal.includes('All') || (selectedMeal === 'Lunch' && !c.mealTime)) {
            scheduledPlans = [{
              planId: c.planId || 'std-1',
              planName: (c as any).planName || 'Standard Meal Plan',
              quantity: 1,
              mealTime: selectedMeal
            } as any];
          }
        }

        // Only include customer if they actually have a scheduled meal today in this session!
        if (scheduledPlans.length > 0) {
          const stopTotalBoxes = scheduledPlans.reduce((sum: number, p: any) => sum + (p.quantity || 1), 0);
          const logKey = `${c.id}_${selectedMeal}`;
          const logRecord = deliveryLogs[logKey];
          const isDelivered = logRecord?.status === 'Delivered';

          // Check if Customer is on Day 2+ for reusable box
          const isDay2Plus = isCustomerDeliveryDay2Plus(c, todayStr);

          // Box variants breakdown with Veg/Non-Veg awareness
          const boxVariantMap: Record<string, { count: number; boxType: string; isStarred: boolean; diet: DietType; planName: string }> = {};
          scheduledPlans.forEach(p => {
            const pConfig = plans.find((pc: any) => pc.id === p.planId);
            const diet = getPlanDietOnDate(pConfig, todayStr, p);
            const rawBox = p.reusableBoxType || c.reusableBoxType;
            const effectiveBox = isReusableBoxType(rawBox) ? rawBox : 'Disposable';
            const planTitle = p.planName || 'Standard Meal';
            const variantKey = `${planTitle}_${diet}_${effectiveBox}`;
            if (!boxVariantMap[variantKey]) {
              boxVariantMap[variantKey] = {
                count: 0,
                boxType: effectiveBox,
                diet,
                planName: planTitle,
                isStarred: Boolean(p.isStarred)
              };
            }
            boxVariantMap[variantKey].count += p.quantity || 1;
            if (p.isStarred) boxVariantMap[variantKey].isStarred = true;
          });

          // Conditional return-box status based on box type (Module 5)
          const configuredReusable = scheduledPlans.find(p => p.reusableBoxType && isReusableBoxType(p.reusableBoxType))?.reusableBoxType || 
                                     (isReusableBoxType(c.reusableBoxType) ? c.reusableBoxType : null);
          const primaryBoxType = configuredReusable || 'Disposable';
          const isReusableApplicable = isReusableBoxType(primaryBoxType);

          const isStarred = Boolean(
            c.isStarred || 
            (c.highlightMark && c.highlightMark !== 'None') || 
            scheduledPlans.some(p => p.isStarred)
          );

          const starredQuery = c.starredQuery || c.notes || (c.highlightMark && c.highlightMark !== 'None' ? c.highlightMark : '');

          activeCustomerStops.push({
            customer: c,
            scheduledPlans,
            totalBoxes: stopTotalBoxes,
            boxVariants: Object.values(boxVariantMap),
            isStarred,
            starredQuery,
            isReusableApplicable,
            primaryBoxType,
            logKey,
            logRecord,
            isDelivered,
            isDay2Plus,
            routeOrder: typeof c.routeOrder === 'number' ? c.routeOrder : 999
          });
        }
      });

    // Sort by optimal route order
    return activeCustomerStops.sort((a, b) => a.routeOrder - b.routeOrder);
  }, [customers, selectedBoyId, currentBoy, driverDisplayName, selectedMeal, plans, todayStr, deliveryLogs, showAllUnassigned, allStaff.length, phoneInput]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalStops = stops.length;
    const deliveredStops = stops.filter(s => s.isDelivered).length;
    const pendingStops = totalStops - deliveredStops;
    const totalBoxesToDeliver = stops.reduce((sum, s) => sum + (s.totalBoxes || 1), 0);
    const deliveredBoxes = stops.filter(s => s.isDelivered).reduce((sum, s) => sum + (s.totalBoxes || 1), 0);

    let totalVegBoxes = 0;
    let totalNonVegBoxes = 0;
    stops.forEach(s => {
      s.boxVariants?.forEach((v: any) => {
        if (v.diet === 'Non-Veg') {
          totalNonVegBoxes += (v.count || 1);
        } else {
          totalVegBoxes += (v.count || 1);
        }
      });
    });

    // Reusable boxes metrics
    const reusableStops = stops.filter(s => s.isReusableApplicable);
    const boxesToRecollect = reusableStops.length;
    const boxesCollected = reusableStops.filter(s => 
      s.logRecord?.boxStatus === 'Collected' || s.logRecord?.boxStatus === 'Collected Clean'
    ).length;
    const boxesIssues = reusableStops.filter(s => 
      s.logRecord?.boxStatus === 'Dirty / Unwashed' || 
      s.logRecord?.boxStatus === 'Damaged / Missing Parts' || 
      s.logRecord?.boxStatus === 'Not Returned'
    ).length;

    return { 
      total: totalStops, 
      delivered: deliveredStops, 
      pending: pendingStops, 
      totalBoxesToDeliver,
      deliveredBoxes,
      totalVegBoxes,
      totalNonVegBoxes,
      boxesToRecollect, 
      boxesCollected, 
      boxesIssues 
    };
  }, [stops]);

  // Quick 1-Tap Box Status Update
  const handleQuickBoxStatus = async (stop: any, status: BoxRecollectionStatus, note: string = '') => {
    if (!bizId) return;

    const customer = stop.customer;
    const logKey = stop.logKey;
    const now = new Date();
    const isClean = status === 'Collected' || status === 'Collected Clean';
    const isCollectedAny = isClean || status === 'Dirty / Unwashed';

    // Optimistic UI update
    setDeliveryLogs(prev => ({
      ...prev,
      [logKey]: {
        ...(prev[logKey] || {}),
        date: todayStr,
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || 'Rider',
        mealTime: selectedMeal,
        reusableBoxEnabled: true,
        boxType: customer.reusableBoxType || stop.primaryBoxType || 'Stainless Steel 3-Tier Dabba',
        isDay2Plus: true,
        boxStatus: status,
        boxNotes: note.trim(),
        boxCollectedAt: isClean ? now.toISOString() : null,
        updatedAt: now.toISOString()
      }
    }));

    setCustomers(prev => prev.map(c => {
      if (c.id === customer.id) {
        const prevCount = typeof c.uncollectedBoxesCount === 'number' ? c.uncollectedBoxesCount : 1;
        const newCount = isCollectedAny ? Math.max(0, prevCount - 1) : prevCount;
        return {
          ...c,
          uncollectedBoxesCount: newCount,
          boxCollections: {
            ...(c.boxCollections || {}),
            [`${todayStr}_${selectedMeal}`]: {
              status,
              boxType: customer.reusableBoxType || stop.primaryBoxType || 'Stainless Steel 3-Tier Dabba',
              issueNote: note.trim(),
              collectedAt: now.toISOString(),
              updatedBy: currentBoy?.name || 'Delivery Partner'
            }
          }
        };
      }
      return c;
    }));

    setHighlightedStopId(null);
    showToast(`✅ Box status recorded as "${status}". You can now mark order as delivered!`);

    if (bizId === 'demo') return;

    try {
      const logDocRef = doc(db, 'businesses', bizId, 'delivery_logs', `${todayStr}_${customer.id}_${selectedMeal}`);
      await setDoc(logDocRef, {
        date: todayStr,
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || driverDisplayName || 'Rider',
        mealTime: selectedMeal,
        reusableBoxEnabled: true,
        boxType: customer.reusableBoxType || stop.primaryBoxType || 'Stainless Steel 3-Tier Dabba',
        isDay2Plus: true,
        boxStatus: status,
        boxNotes: note.trim(),
        boxCollectedAt: isClean ? now.toISOString() : null,
        updatedAt: now.toISOString()
      }, { merge: true });

      const custDocRef = doc(db, 'businesses', bizId, 'customers', customer.id);
      const prevCount = typeof customer.uncollectedBoxesCount === 'number' ? customer.uncollectedBoxesCount : 1;
      const newCount = isCollectedAny ? Math.max(0, prevCount - 1) : prevCount;
      await updateDoc(custDocRef, {
        uncollectedBoxesCount: newCount,
        [`boxCollections.${todayStr}_${selectedMeal}`]: {
          status,
          boxType: customer.reusableBoxType || stop.primaryBoxType || 'Stainless Steel 3-Tier Dabba',
          issueNote: note.trim(),
          collectedAt: now.toISOString(),
          updatedBy: currentBoy?.name || 'Delivery Partner'
        }
      });
    } catch (err) {
      console.warn("Save quick box status err:", err);
    }
  };

  // Handle Attendance Punch In / Shift Start (Module 4)
  const handlePunchIn = async () => {
    if (!bizId || !selectedBoyId) {
      showToast("⚠️ Missing rider credentials. Please log in with your PIN.");
      setLoginModalOpen(true);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sessionId = `${todayStr}_${selectedBoyId}`;
    
    // 1. Immediate optimistic shift activation & persistent local storage
    setIsShiftActive(true);
    setPunchInTime(timeStr);
    safeStorageSet('driver_shift_active', 'true');
    safeStorageSet('driver_shift_date', todayStr);
    safeStorageSet('driver_punch_in_time', timeStr);
    showToast(`✅ Shift started successfully at ${timeStr}! Attendance marked.`);

    const cleanPhone = (phoneInput || safeStorageGet('driver_phone') || '').replace(/\D/g, '').slice(-10);

    // 2. Persist real-time driver status (authoritative for live fleet tracking)
    const statusPayload = {
      bizId,
      staffId: selectedBoyId,
      riderName: currentBoy?.name || driverDisplayName || 'Rider',
      mobile: cleanPhone,
      status: 'Online',
      lastAttendanceDate: todayStr,
      attendanceMarkedAt: timeStr,
      punchInTime: timeStr,
      isShiftActive: true,
      currentLat: currentCoords?.lat || null,
      currentLng: currentCoords?.lng || null,
      lastLocationUpdate: now.toISOString(),
      updatedAt: now.toISOString()
    };

    setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), statusPayload, { merge: true })
      .catch(err => console.warn("Driver status sync notice:", err));

    // 3. Persist persistent session record in businesses/{bizId}/driver_sessions/{sessionId}
    const sessionPayload = {
      sessionId,
      staffId: selectedBoyId,
      driverName: currentBoy?.name || driverDisplayName || 'Rider',
      mobile: cleanPhone,
      branchId: currentBoy?.branchId || '',
      date: todayStr,
      startTime: now.toISOString(),
      punchInTime: timeStr,
      endTime: null,
      durationMinutes: 0,
      status: 'Active',
      initialLat: currentCoords?.lat || null,
      initialLng: currentCoords?.lng || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    setDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId), sessionPayload, { merge: true })
      .catch(err => console.warn("Driver session write notice:", err));

    // Update per-driver manifest document
    setDoc(doc(db, 'businesses', bizId, 'driver_manifest', selectedBoyId), {
      status: 'Online',
      lastAttendanceDate: todayStr,
      attendanceMarkedAt: timeStr,
      punchInTime: timeStr,
      isShiftActive: true,
      updatedAt: now.toISOString()
    }, { merge: true }).catch(err => console.warn("Driver manifest attendance sync notice:", err));

    // 4. Update staff document
    try {
      const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
      await updateDoc(boyDocRef, {
        status: 'Online',
        lastAttendanceDate: todayStr,
        attendanceMarkedAt: timeStr,
        punchInTime: timeStr,
        isShiftActive: true,
        updatedAt: now.toISOString()
      });
    } catch (writeErr) {
      console.warn("Direct staff attendance write notice:", writeErr);
    }

    // 5. Request initial GPS location fix
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);

          setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), {
            currentLat: pos.coords.latitude,
            currentLng: pos.coords.longitude,
            lastLocationUpdate: new Date().toISOString()
          }, { merge: true }).catch(() => {});

          setDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId), {
            initialLat: pos.coords.latitude,
            initialLng: pos.coords.longitude,
            lastLocationUpdate: new Date().toISOString()
          }, { merge: true }).catch(() => {});

          try {
            const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
            updateDoc(boyDocRef, {
              currentLat: pos.coords.latitude,
              currentLng: pos.coords.longitude,
              lastLocationUpdate: new Date().toISOString()
            }).catch(() => {});
          } catch {}
        },
        (err) => console.warn("GPS init:", err.message)
      );
    }
  };

  // Handle Shift End (Module 4)
  const handlePunchOut = async () => {
    if (!confirm("Are you sure you want to end your shift?")) return;
    if (!bizId || !selectedBoyId) return;

    const now = new Date();
    const sessionId = `${todayStr}_${selectedBoyId}`;
    setIsShiftActive(false);
    setPunchInTime(null);
    safeStorageSet('driver_shift_active', 'false');
    safeStorageSet('driver_punch_in_time', '');
    showToast("🏁 Shift ended. Have a great rest!");

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Calculate session duration
    let durationMins = 0;
    try {
      const sessionSnap = await getDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId));
      if (sessionSnap.exists() && sessionSnap.data().startTime) {
        const startMs = new Date(sessionSnap.data().startTime).getTime();
        durationMins = Math.max(1, Math.round((now.getTime() - startMs) / 60000));
      }
    } catch (e) {}

    // 1. Finalize driver session in driver_sessions
    setDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId), {
      status: 'Completed',
      endTime: now.toISOString(),
      punchOutTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      durationMinutes: durationMins,
      finalLat: currentCoords?.lat || null,
      finalLng: currentCoords?.lng || null,
      updatedAt: now.toISOString()
    }, { merge: true }).catch(err => console.warn("Driver session end write notice:", err));

    // 2. Sync to per-tenant driver_status subcollection
    setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), {
      status: 'Offline',
      isShiftActive: false,
      updatedAt: now.toISOString()
    }, { merge: true }).catch(err => console.warn("Per-tenant status punch out notice:", err));

    // 3. Update driver_manifest
    setDoc(doc(db, 'businesses', bizId, 'driver_manifest', selectedBoyId), {
      status: 'Offline',
      isShiftActive: false,
      updatedAt: now.toISOString()
    }, { merge: true }).catch(err => console.warn("Per-tenant manifest punch out notice:", err));

    // 4. Update staff document
    try {
      const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
      await updateDoc(boyDocRef, {
        status: 'Offline',
        isShiftActive: false,
        updatedAt: now.toISOString()
      });
    } catch (err) {
      console.warn("Direct punch out write notice:", err);
    }
  };

  // Mark Delivery Status (Module 4 & 5)
  const handleToggleDelivered = async (stop: any) => {
    if (!bizId) return;

    // 1. Shift check: Rider MUST start shift / punch in first
    if (!isShiftActive) {
      showToast("⚠️ Shift not started! Please tap 'Start Shift / Punch In' at the top of the screen before marking orders as delivered.", stop.customer.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const logKey = stop.logKey;
    const currentStatus = stop.isDelivered ? 'Pending' : 'Delivered';
    const now = new Date();
    const hasReusableBox = isReusableBoxType(stop.primaryBoxType);

    // 2. Reusable box status check: ONLY applies if customer has configured a REUSABLE container!
    // If packaging is Disposable, bypass this check completely.
    if (currentStatus === 'Delivered' && hasReusableBox) {
      const activeBoxStatus = deliveryLogs[logKey]?.boxStatus || stop.logRecord?.boxStatus;
      
      const isBoxStatusRecorded = activeBoxStatus && 
        activeBoxStatus !== 'Pending' && 
        activeBoxStatus !== 'None';

      if (!isBoxStatusRecorded) {
        showToast("📦 Please update the returned box status (Clean, Unclean, Damaged, or Missing) below before marking this order as delivered!", stop.customer.id);
        return;
      }
    }

    // Optimistic UI update
    setDeliveryLogs(prev => ({
      ...prev,
      [logKey]: {
        ...(prev[logKey] || {}),
        date: todayStr,
        customerId: stop.customer.id,
        customerName: stop.customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || 'Rider',
        mealTime: selectedMeal,
        status: currentStatus,
        deliveredAt: currentStatus === 'Delivered' ? now.toISOString() : null,
      }
    }));

    if (bizId === 'demo') {
      return;
    }

    try {
      const logDocRef = doc(db, 'businesses', bizId, 'delivery_logs', `${todayStr}_${stop.customer.id}_${selectedMeal}`);
      await setDoc(logDocRef, {
        date: todayStr,
        customerId: stop.customer.id,
        customerName: stop.customer.name,
        branchId: stop.customer.branchId || currentBoy?.branchId || '',
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || driverDisplayName || 'Rider',
        mealTime: selectedMeal,
        status: currentStatus,
        deliveredAt: currentStatus === 'Delivered' ? now.toISOString() : null,
        reusableBoxEnabled: hasReusableBox,
        boxType: stop.primaryBoxType || 'Disposable',
        isDay2Plus: stop.isDay2Plus,
        boxStatus: hasReusableBox 
          ? (stop.logRecord?.boxStatus || 'Pending') 
          : 'Disposable',
        boxNotes: stop.logRecord?.boxNotes || '',
        currentLat: currentCoords?.lat || null,
        currentLng: currentCoords?.lng || null,
        updatedAt: now.toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Direct delivery log write notice:", err);
    }
  };

  // Save Box Recollection Condition
  const handleSaveBoxRecollection = async () => {
    if (!activeBoxModal || !bizId) return;

    const { customer, logKey } = activeBoxModal;
    const now = new Date();
    const isClean = selectedBoxStatus === 'Collected' || selectedBoxStatus === 'Collected Clean';
    const isCollectedAny = isClean || selectedBoxStatus === 'Dirty / Unwashed';

    // Optimistic UI update
    setDeliveryLogs(prev => ({
      ...prev,
      [logKey]: {
        ...(prev[logKey] || {}),
        date: todayStr,
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || 'Rider',
        mealTime: selectedMeal,
        reusableBoxEnabled: true,
        boxType: customer.reusableBoxType || '3-Tier Stainless Steel Tiffin',
        isDay2Plus: true,
        boxStatus: selectedBoxStatus,
        boxNotes: boxNotes.trim(),
        boxCollectedAt: isClean ? now.toISOString() : null,
        updatedAt: now.toISOString()
      }
    }));

    setCustomers(prev => prev.map(c => {
      if (c.id === customer.id) {
        const prevCount = typeof c.uncollectedBoxesCount === 'number' ? c.uncollectedBoxesCount : 1;
        const newCount = isCollectedAny ? Math.max(0, prevCount - 1) : prevCount;
        return {
          ...c,
          uncollectedBoxesCount: newCount,
          boxCollections: {
            ...(c.boxCollections || {}),
            [`${todayStr}_${selectedMeal}`]: {
              status: selectedBoxStatus,
              boxType: customer.reusableBoxType || 'Stainless Steel 3-Tier Dabba',
              issueNote: boxNotes.trim(),
              collectedAt: now.toISOString(),
              updatedBy: currentBoy?.name || 'Delivery Partner'
            }
          }
        };
      }
      return c;
    }));

    setActiveBoxModal(null);
    setBoxNotes('');

    if (bizId === 'demo') {
      return;
    }

    try {
      const logDocRef = doc(db, 'businesses', bizId, 'delivery_logs', `${todayStr}_${customer.id}_${selectedMeal}`);

      await setDoc(logDocRef, {
        date: todayStr,
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: selectedBoyId,
        deliveryBoyName: currentBoy?.name || driverDisplayName || 'Rider',
        mealTime: selectedMeal,
        reusableBoxEnabled: true,
        boxType: customer.reusableBoxType || '3-Tier Stainless Steel Tiffin',
        isDay2Plus: true,
        boxStatus: selectedBoxStatus,
        boxNotes: boxNotes.trim(),
        boxCollectedAt: isClean ? now.toISOString() : null,
        updatedAt: now.toISOString()
      }, { merge: true });

      // Update customer uncollected boxes count and history in businesses/{bizId}/customers/{customer.id}
      try {
        const custDocRef = doc(db, 'businesses', bizId, 'customers', customer.id);
        const prevCount = typeof customer.uncollectedBoxesCount === 'number' ? customer.uncollectedBoxesCount : 1;
        const newCount = isCollectedAny ? Math.max(0, prevCount - 1) : prevCount;
        
        await updateDoc(custDocRef, {
          uncollectedBoxesCount: newCount,
          [`boxCollections.${todayStr}_${selectedMeal}`]: {
            status: selectedBoxStatus === 'Collected' ? 'Collected Clean' : selectedBoxStatus === 'Dirty / Unwashed' ? 'Collected Unclean' : selectedBoxStatus,
            boxType: customer.reusableBoxType || 'Stainless Steel 3-Tier Dabba',
            issueNote: boxNotes.trim(),
            collectedAt: now.toISOString(),
            updatedBy: currentBoy?.name || driverDisplayName || 'Delivery Partner'
          },
          updatedAt: now.toISOString()
        });
      } catch (custErr) {
        console.warn("Could not sync customer box record directly:", custErr);
      }
    } catch (err) {
      console.warn("Direct box recollection write notice (synced to global logs):", err);
    }
  };

  const handleVerifyLogin = async (mobileOverride?: string, boyIdOverride?: string) => {
    const rawMobile = mobileOverride || phoneInput;
    const digits = (rawMobile || '').replace(/\D/g, '').slice(-10);
    const pin = (pinInput || '').trim();

    if (!digits || digits.length !== 10) {
      setLoginError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!pin || pin.length < 4 || pin.length > 6) {
      setLoginError('PIN must be 4-6 digits.');
      return;
    }

    setVerifying(true);
    setLoginError(null);

    try {
      // ONLY PATH: Call driverLogin Cloud Function
      const result = await driverLoginCallable({
        phone: digits,
        pin: pin
      });

      if (result?.data?.token) {
        // Sign in with the custom token returned by the function
        await signInWithCustomToken(auth, result.data.token);

        const driverInfo = result.data.driver;
        const name = driverInfo.name || 'Delivery Partner';
        const bizId = driverInfo.bizId;
        const staffId = driverInfo.staffId;
        const branchId = driverInfo.branchId || '';
        const pinVersion = (result.data as any)?.pinVersion; // If function returns this

        // Store in localStorage for session persistence
        safeStorageSet('driver_is_logged_in', 'true');
        safeStorageSet('driver_session_expires', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
        safeStorageSet('driver_session_token', btoa(`${digits}:${staffId}:${Date.now()}`));
        if (pinVersion) safeStorageSet('driver_pin_version', pinVersion);
        setDriverDisplayName(name);
        safeStorageSet('driver_name', name);
        safeStorageSet('driver_phone', digits);
        safeStorageSet('driver_failed_attempts', '0');
        safeStorageSet('driver_lockout_until', '0');

        setBizId(bizId);
        safeStorageSet('driver_biz_id', bizId);

        if (staffId) {
          setSelectedBoyId(staffId);
          safeStorageSet('driver_boy_id', staffId);
        }

        if (branchId) safeStorageSet('driver_branch_id', branchId);

        setLoginModalOpen(false);
        setPinInput('');
        setVerifying(false);
        showToast(`Welcome back, ${name}! Ready for today's deliveries.`);
      }
    } catch (error: any) {
      setVerifying(false);

      const errorMsg = error?.message || '';
      const errorCode = error?.code || '';

      // Show real error from Cloud Function (no hiding)
      if (errorCode === 'functions/resource-exhausted' || 
          errorMsg.includes('locked') || 
          errorMsg.includes('attempts remaining')) {
        setLoginError(errorMsg);
      } else if (errorCode === 'functions/unauthenticated' || 
                 errorMsg.includes('Incorrect') ||
                 errorMsg.includes('not found')) {
        // Real auth error from function
        setLoginError(errorMsg);
        // Record failed attempt locally for UI feedback
        const attempts = parseInt(safeStorageGet('driver_failed_attempts') || '0') + 1;
        safeStorageSet('driver_failed_attempts', String(attempts));
      } else {
        // Network or other error
        setLoginError(
          `Connection error: ${errorMsg || 'Unable to reach the server. Please check your internet and try again.'}`
        );
      }
    }
  };

  const handleVerifyPin = handleVerifyLogin;

  const handleDriverLogout = () => {
    if (window.confirm("Are you sure you want to log out of the Delivery Partner app?")) {
      safeStorageSet('driver_is_logged_in', 'false');
      safeStorageSet('driver_session_expires', '0');
      safeStorageSet('driver_session_token', '');
      safeStorageSet('driver_pin_version', '');
      safeStorageSet('driver_auth_pin', '');
      safeStorageSet('driver_token_pin', '');
      safeStorageSet('driver_boy_id', '');
      safeStorageSet('driver_name', '');
      safeStorageSet('driver_phone', '');
      safeStorageSet('driver_biz_id', '');
      setBizId('');
      setSelectedBoyId('');
      setDriverDisplayName('');
      setPinInput('');
      setLoginModalOpen(true);
      showToast("Logged out successfully.");
    }
  };

  if (!bizId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-card bg-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl max-w-md w-full border border-white/20 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
            <Truck size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight text-white">Delivery Partner Login</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Enter your registered mobile number and 4-digit security PIN to access today's delivery route.
            </p>
          </div>

          {/* In-Screen Alert / Error Banner */}
          {loginError && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-200 rounded-xl text-xs flex items-start gap-2 text-left animate-in fade-in">
              <AlertCircle size={15} className="shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <span>{loginError}</span>
              </div>
              <button onClick={() => setLoginError(null)} className="text-rose-300 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyLogin();
            }}
            className="space-y-3.5 text-left"
          >
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Registered Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  required
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-xs font-mono outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  4-Digit Access PIN
                </label>
                <span className="text-[10px] text-amber-400 font-medium">Set by Kitchen Manager</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  required
                  type={showPin ? "text" : "password"}
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPinInput(digits);
                    setLoginError(null);
                  }}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-sm font-mono tracking-widest text-center font-bold outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {verifying ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-slate-950" />
                  <span>Connecting to Kitchen...</span>
                </>
              ) : (
                <>
                  <span>Verify & Access Route</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Quick Connect for Owner or Demo Route */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            {auth.currentUser && (
              <button
                onClick={() => setBizId(auth.currentUser!.uid)}
                className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <span>Connect As Current Kitchen Owner</span>
                <ArrowRight size={14} className="text-amber-400" />
              </button>
            )}

            <button
              type="button"
              onClick={launchDemoMode}
              className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Launch Demo Rider Route (Preview)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-slate-100 flex flex-col font-sans pb-24">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shadow-glass">
        
        {/* Left: Driver info and live status */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <Truck size={17} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold font-display text-xs sm:text-sm tracking-tight text-white truncate max-w-[90px] sm:max-w-none">
                {currentBoy ? currentBoy.name : driverDisplayName || 'Select Driver'}
              </h1>
              {isShiftActive && (
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1">
              <span>{formatDateDDMMYYYY(todayStr)}</span>
              <span>•</span>
              <button 
                onClick={() => setLoginModalOpen(true)} 
                className="text-amber-400 hover:underline font-medium"
              >
                Change
              </button>
            </p>
          </div>
        </div>

        {/* Center: Business Name in Middle of Top */}
        <div className="flex-1 text-center px-1 sm:px-3">
          <h2 className="font-bold font-display text-xs sm:text-sm tracking-tight text-white truncate max-w-[110px] sm:max-w-xs mx-auto">
            {businessName || 'ScaleKitchen'}
          </h2>
          <span className="text-[9px] text-amber-400/90 font-medium hidden sm:inline-block">
            Delivery Fleet
          </span>
        </div>

        {/* Right Corner: Driver Name Badge, Shift Action Button & Company / Business Logo */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Driver Name in Top Right Corner - prominently displays rider identity */}
          {Boolean(currentBoy?.name || driverDisplayName || safeStorageGet('driver_name') || safeStorageGet('driver_token_name')) && (() => {
            const rawName = currentBoy?.name || driverDisplayName || safeStorageGet('driver_name') || safeStorageGet('driver_token_name') || 'Partner';
            const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            return (
              <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-200 shadow-xs">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-[10px] sm:text-xs border border-amber-400/50 shrink-0">
                  {displayName.charAt(0)}
                </div>
                <div className="text-left leading-none">
                  <span className="block text-xs font-bold text-amber-100 truncate max-w-[75px] sm:max-w-[130px]">
                    {displayName}
                  </span>
                  <span className="block text-[8px] sm:text-[9px] text-emerald-400 font-semibold mt-0.5">
                    {isShiftActive ? '● Online' : '○ Standby'}
                  </span>
                </div>
              </div>
            );
          })()}

          {isShiftActive ? (
            <button 
              onClick={handlePunchOut}
              className="text-[11px] sm:text-xs font-semibold px-2 sm:px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl transition-all active:scale-95 flex items-center gap-1 shadow-xs"
            >
              <RotateCcw size={12} /> <span className="hidden sm:inline">End Shift</span>
            </button>
          ) : (
            <button 
              onClick={handlePunchIn}
              className="text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl transition-all active:scale-95 shadow-md flex items-center gap-1"
            >
              <Check size={13} /> <span className="hidden sm:inline">Punch In</span>
            </button>
          )}

          {/* Business Logo on Top Right Corner */}
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={`${businessName} Logo`} 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain bg-white/10 p-0.5 border border-white/20 shadow-xs shrink-0" 
            />
          ) : (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {businessName?.charAt(0) || 'K'}
            </div>
          )}

          {/* Rider App Logout */}
          <button
            onClick={handleDriverLogout}
            className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/20 hover:border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
            title="Log Out of Delivery App"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Kitchen Owner Preview Header Banner */}
      {isKitchenOwnerUser && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-b border-amber-500/30 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <span className="text-sm">👑</span>
            <span>Kitchen Owner Preview: Viewing Partner <strong>{currentBoy?.name || 'Selected Rider'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLoginModalOpen(true)}
              className="text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg transition-all"
            >
              Switch Rider
            </button>
            <a
              href="#/app/deliveries"
              className="text-[11px] font-bold text-white bg-slate-800 hover:bg-slate-700 border border-white/20 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
            >
              Back to Hub
            </a>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">
        
        {/* Floating In-App Toast Message */}
        {toastMessage && (
          <div className="sticky top-16 z-50 p-3.5 bg-amber-400 text-slate-950 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border-2 border-amber-300 font-bold text-xs animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">🔔</span>
              <span>{toastMessage}</span>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-black/10 rounded-lg text-slate-950 shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Attendance Banner when not punched in */}
        {!isShiftActive && (
          <div className="glass-card bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-300">Shift Not Started</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">Punch in to activate GPS tracking & record deliveries.</p>
              </div>
            </div>
            <button 
              onClick={handlePunchIn}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 shadow-sm active:scale-95"
            >
              Start Shift
            </button>
          </div>
        )}

        {/* GPS Active Pill */}
        {isShiftActive && (
          <div className="glass-card bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <Navigation size={14} className="animate-spin text-emerald-400" />
              <span>GPS Tracking Active</span>
              {punchInTime && <span className="text-slate-400 text-[11px]">(Started at {punchInTime})</span>}
            </div>
            {currentCoords && (
              <a 
                href={`https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-[11px] text-emerald-400 underline font-mono flex items-center gap-1"
              >
                Maps Pin <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}

        {/* Meal Session Filter Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
          {(['Breakfast', 'Lunch', 'Dinner'] as const).map(meal => (
            <button
              key={meal}
              onClick={() => setSelectedMeal(meal)}
              className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                selectedMeal === meal 
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{meal === 'Breakfast' ? '🌅' : meal === 'Lunch' ? '☀️' : '🌙'}</span>
              <span>{meal}</span>
              {sessionStopCounts[meal] > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedMeal === meal ? 'bg-slate-950 text-amber-300' : 'bg-amber-500/25 text-amber-300 border border-amber-500/30'
                }`}>
                  {sessionStopCounts[meal]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Route Progress Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card bg-white/5 border border-white/10 p-3.5 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Deliveries Progress</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-display text-white">
                {metrics.delivered} <span className="text-xs font-normal text-slate-400">/ {metrics.total}</span>
              </span>
              <span className="text-xs font-semibold text-amber-400">
                {metrics.total > 0 ? `${Math.round((metrics.delivered / metrics.total) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${metrics.total > 0 ? (metrics.delivered / metrics.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="glass-card bg-white/5 border border-white/10 p-3.5 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] text-amber-300 font-medium flex items-center gap-1">
              <Package size={12} /> Reusable Boxes
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-display text-white">
                {metrics.boxesCollected} <span className="text-xs font-normal text-slate-400">/ {metrics.boxesToRecollect}</span>
              </span>
              {metrics.boxesIssues > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {metrics.boxesIssues} Issues
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">
              {metrics.boxesToRecollect === 0 
                ? 'No boxes to recollect' 
                : `${metrics.boxesToRecollect - metrics.boxesCollected} pending recollection`}
            </p>
          </div>
        </div>

        {/* Stops List */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
            <span>Optimized Sequence ({stops.length} Stops)</span>
            <span>{selectedMeal} Route</span>
          </div>

          {stops.map((stop, idx) => {
            const { 
              customer, 
              scheduledPlans, 
              totalBoxes, 
              boxVariants, 
              isStarred, 
              starredQuery, 
              logKey, 
              logRecord, 
              isDelivered, 
              isDay2Plus, 
              isReusableApplicable, 
              primaryBoxType 
            } = stop;
            const boxStatus = logRecord?.boxStatus;

            return (
              <div 
                key={`${customer.id}-${idx}`}
                className={`glass-card rounded-2xl border transition-all duration-300 p-4 relative overflow-hidden ${
                  isDelivered 
                    ? 'bg-white/[0.04] border-emerald-500/30 shadow-xs' 
                    : 'bg-white/[0.08] border-white/20 shadow-glass hover:border-amber-500/40'
                }`}
              >
                {/* Top Badge Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-amber-400 border border-amber-400/40 font-black text-xs flex items-center gap-1 shadow-xs">
                      Stop {idx + 1} of {stops.length}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-xs">
                      <Package size={13} className="text-slate-950" />
                      {totalBoxes} Box{totalBoxes > 1 ? 'es' : ''} at this Stop
                    </span>
                    {isStarred && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                        <Star size={11} fill="currentColor" /> Star Customer
                      </span>
                    )}
                  </div>

                  {/* Delivery Status Checkbox */}
                  {(() => {
                    const hasReusableBox = isReusableBoxType(primaryBoxType);
                    const isBoxStatusRecorded = boxStatus && boxStatus !== 'Pending' && boxStatus !== 'None';
                    const isBlockedByShift = !isShiftActive;
                    const isBlockedByBox = !isDelivered && hasReusableBox && !isBoxStatusRecorded;

                    return (
                      <button
                        onClick={() => handleToggleDelivered(stop)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${
                          isDelivered 
                            ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/50' 
                            : isBlockedByShift
                              ? 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10'
                              : isBlockedByBox
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20'
                        }`}
                        title={
                          isBlockedByShift
                            ? 'Punch in at top of screen before marking delivered'
                            : isBlockedByBox
                              ? 'Select returned box condition below before marking delivered'
                              : isDelivered
                                ? 'Click to toggle back to pending'
                                : 'Click to mark delivered'
                        }
                      >
                        {isBlockedByShift ? (
                          <>
                            <span className="text-xs">🔒</span>
                            <span>Punch In First</span>
                          </>
                        ) : isDelivered ? (
                          <>
                            <CheckCircle2 size={15} className="text-slate-950" />
                            <span>Delivered ✅</span>
                          </>
                        ) : isBlockedByBox ? (
                          <>
                            <span className="text-xs">📦</span>
                            <span>Update Box First</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={15} className="text-slate-400" />
                            <span>Mark Done</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>

                {/* Customer Name */}
                <div className="mb-2">
                  <h3 className="font-bold font-display text-base text-white tracking-tight flex items-center gap-2">
                    <span>{customer.name}</span>
                    {customer.mobile && (
                      <span className="text-xs font-mono text-slate-400 font-normal">
                        ({customer.mobile})
                      </span>
                    )}
                  </h3>
                </div>

                {/* Total Boxes & Box Variants Breakdown */}
                <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl mb-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Package size={14} className="text-amber-400" />
                      Delivery Contents ({totalBoxes} Total):
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {boxVariants.length} Variant{boxVariants.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Variant pills with counts, box types, and starred mark */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {boxVariants.map((v: any, vIdx: number) => {
                      const isVeg = v.diet === 'Veg';
                      return (
                        <span 
                          key={vIdx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 text-[11px] font-semibold border border-white/10"
                        >
                          <span className="w-4 h-4 rounded bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                            {v.count}x
                          </span>
                          <span 
                            className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                              isVeg ? 'border-emerald-400 bg-white' : 'border-rose-400 bg-white'
                            }`}
                            title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                          >
                            <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          </span>
                          <span>{v.planName}</span>
                          <span className={`text-[10px] font-black px-1 rounded ${
                            isVeg ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {v.diet || 'Veg'}
                          </span>
                          <span className="text-[10px] text-amber-300/80 font-mono font-normal">
                            [{v.boxType}]
                          </span>
                          {v.isStarred && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 font-bold ml-0.5">
                              <Star size={11} fill="#f59e0b" /> Special
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Starred Customer Query & Instructions Banner */}
                {isStarred && (
                  <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl mb-3 flex items-start gap-2 text-xs">
                    <Star size={16} fill="#f59e0b" className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                        <span>⭐ Starred Customer Query & Instructions</span>
                      </div>
                      <p className="text-amber-100 text-xs font-medium mt-0.5 leading-snug">
                        {starredQuery ? `"${starredQuery}"` : '"Special high-priority customer. Check dietary and packaging instructions."'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Address & Navigation */}
                <div className="p-3 bg-black/20 rounded-xl border border-white/5 mb-3 text-xs space-y-2">
                  <div className="flex items-start gap-2 text-slate-300">
                    <MapPin size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{customer.address} {customer.area && `(${customer.area})`}</span>
                  </div>

                  {/* Action Buttons: Directions, Call, WhatsApp */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                    <a
                      href={customer.locationLink || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address + ' ' + (customer.area || ''))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Navigation size={13} />
                      <span>Route</span>
                    </a>

                    <a
                      href={`tel:${customer.mobile}`}
                      className="py-2 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Phone size={13} />
                      <span>Call</span>
                    </a>

                    <a
                      href={buildWhatsAppUrl(customer.mobile, getDeliveryArrivalMessage(customer.name, selectedMeal, businessName))}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <MessageSquare size={13} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
                {/* REUSABLE BOX RECOLLECTION / RETURN SECTION (Module 5: Only for Reusable Containers) */}
                {isReusableApplicable ? (
                  <div className={`mt-2.5 pt-2.5 border-t border-white/10 space-y-2 p-2.5 rounded-xl transition-all duration-300 ${
                    highlightedStopId === customer.id 
                      ? 'bg-amber-500/20 border-2 border-amber-400 ring-4 ring-amber-400/40 shadow-xl' 
                      : ''
                  }`}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                        TIFFIN BOX RETURN
                      </span>
                      <span className="font-bold text-slate-200">
                        {primaryBoxType}
                      </span>
                    </div>

                    {/* Current Status Pill */}
                    {boxStatus ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                        boxStatus === 'Collected' || boxStatus === 'Collected Clean'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                        boxStatus === 'Dirty / Unwashed'
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                        boxStatus === 'Damaged / Missing Parts'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                        boxStatus === 'Pending'
                          ? 'bg-slate-500/20 text-slate-300 border-slate-500/40' :
                          'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}>
                        {boxStatus === 'Collected' || boxStatus === 'Collected Clean' ? '✅ Collected Clean' :
                         boxStatus === 'Dirty / Unwashed' ? '🧽 Uncleaned' :
                         boxStatus === 'Damaged / Missing Parts' ? '💥 Damaged' :
                         boxStatus === 'Pending' ? '⏭️ Skipped' : '❌ Not Returned / Missing'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-300/80 font-medium">
                        Update Return Status:
                      </span>
                    )}
                  </div>

                  {/* Quick 1-Tap Buttons for Rider */}
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleQuickBoxStatus(stop, 'Collected')}
                      className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 border ${
                        boxStatus === 'Collected' || boxStatus === 'Collected Clean'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-emerald-300 border-emerald-500/30'
                      }`}
                      title="Collected Clean & Intact"
                    >
                      <span className="text-xs">✅</span>
                      <span>Clean</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickBoxStatus(stop, 'Dirty / Unwashed')}
                      className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 border ${
                        boxStatus === 'Dirty / Unwashed'
                          ? 'bg-yellow-400 text-slate-950 border-yellow-300 shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-yellow-300 border-yellow-500/30'
                      }`}
                      title="Returned Dirty / Needs Washing"
                    >
                      <span className="text-xs">🧽</span>
                      <span>Unclean</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickBoxStatus(stop, 'Damaged / Missing Parts')}
                      className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 border ${
                        boxStatus === 'Damaged / Missing Parts'
                          ? 'bg-red-500 text-white border-red-400 shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-red-300 border-red-500/30'
                      }`}
                      title="Broken lid, dented, or missing clips"
                    >
                      <span className="text-xs">💥</span>
                      <span>Damaged</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickBoxStatus(stop, 'Not Returned')}
                      className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 border ${
                        boxStatus === 'Not Returned'
                          ? 'bg-rose-600 text-white border-rose-400 shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-rose-300 border-rose-500/30'
                      }`}
                      title="Customer forgot or wasn't available"
                    >
                      <span className="text-xs">❌</span>
                      <span>Missing</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveBoxModal({ customer, logKey });
                        setSelectedBoxStatus(boxStatus || 'Collected');
                        setBoxNotes(logRecord?.boxNotes || '');
                      }}
                      className="py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 border bg-white/5 hover:bg-white/10 text-slate-300 border-white/20"
                      title="Add custom remarks or edit note"
                    >
                      <span className="text-xs">✏️</span>
                      <span>Remarks</span>
                    </button>
                  </div>

                  {logRecord?.boxNotes && (
                    <p className="text-[10px] text-amber-200/90 italic pt-1">
                      Note: {logRecord.boxNotes}
                    </p>
                  )}
                </div>
                ) : (
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Package size={13} className="text-slate-500" />
                      <span>Disposable Packaging • No container recollection required</span>
                    </span>
                  </div>
                )}

                {/* LAST STOP: Direct Back to Branch Button inside stop card */}
                {idx === stops.length - 1 && (
                  <div className="mt-3 pt-3 border-t-2 border-amber-500/30 bg-amber-500/10 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏁</span>
                      <div>
                        <p className="text-xs font-bold text-amber-300">Final Stop Completed?</p>
                        <p className="text-[10px] text-slate-300">
                          Head back to {driverBranch?.name || 'Branch Hub'}
                        </p>
                      </div>
                    </div>
                    <a
                      href={driverBranch?.hubLocationLink || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(driverBranch?.hubAddress || driverBranch?.name || 'Kitchen Hub')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                    >
                      <Navigation size={13} />
                      <span>Back to Branch</span>
                    </a>
                  </div>
                )}
              </div>
            );
          })}

          {/* BACK TO BRANCH / KITCHEN HUB (Always accessible after all stops / at last stop) */}
          {stops.length > 0 && (
            <div className="glass-card bg-linear-to-r from-amber-500/15 via-slate-900 to-primary-900/20 border-2 border-amber-500/40 rounded-3xl p-5 space-y-3.5 shadow-xl animate-in slide-in-from-bottom-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
                    🏁
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
                      Final Route Stop
                    </span>
                    <h3 className="font-bold font-display text-base text-white">
                      Back to Kitchen Branch Hub
                    </h3>
                    <p className="text-xs text-slate-300">
                      {driverBranch?.name || currentBoy?.name + "'s Hub" || 'Kitchen Dispatch Hub'}
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  metrics.pending === 0 
                    ? 'bg-emerald-500 text-slate-950 font-black' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {metrics.pending === 0 ? 'All Delivered ✅' : `${metrics.pending} Pending`}
                </span>
              </div>

              {driverBranch?.hubAddress && (
                <div className="p-3 bg-black/30 rounded-xl border border-white/10 text-xs text-slate-300 flex items-start gap-2">
                  <MapPin size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{driverBranch.hubAddress}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {driverBranch?.hubLocationLink ? (
                  <a
                    href={driverBranch.hubLocationLink}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <Navigation size={15} />
                    <span>Navigate Back to Branch</span>
                  </a>
                ) : (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(driverBranch?.hubAddress || driverBranch?.name || 'Kitchen Hub')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <Navigation size={15} />
                    <span>Navigate Back to Branch</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handlePunchOut}
                  className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-white/20 transition-all active:scale-95"
                >
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Mark Returned & End Shift</span>
                </button>
              </div>
            </div>
          )}

          {stops.length === 0 && (
            <div className="glass-card bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Truck size={28} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  No {selectedMeal} Deliveries Scheduled
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                  {currentBoy?.name || driverDisplayName || 'Driver'} has no active meal stops scheduled for {selectedMeal} today.
                </p>
              </div>

              {/* Quick switch to session that actually has stops */}
              {sessionStopCounts['Lunch'] > 0 && selectedMeal !== 'Lunch' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-2 max-w-sm mx-auto">
                  <span>☀️ <strong>{sessionStopCounts['Lunch']}</strong> stops scheduled in Lunch session</span>
                  <button
                    onClick={() => setSelectedMeal('Lunch')}
                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg transition-all"
                  >
                    View Lunch
                  </button>
                </div>
              )}

              {sessionStopCounts['Dinner'] > 0 && selectedMeal !== 'Dinner' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-2 max-w-sm mx-auto">
                  <span>🌙 <strong>{sessionStopCounts['Dinner']}</strong> stops scheduled in Dinner session</span>
                  <button
                    onClick={() => setSelectedMeal('Dinner')}
                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg transition-all"
                  >
                    View Dinner
                  </button>
                </div>
              )}

              {sessionStopCounts['Breakfast'] > 0 && selectedMeal !== 'Breakfast' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-2 max-w-sm mx-auto">
                  <span>🌅 <strong>{sessionStopCounts['Breakfast']}</strong> stops scheduled in Breakfast session</span>
                  <button
                    onClick={() => setSelectedMeal('Breakfast')}
                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg transition-all"
                  >
                    View Breakfast
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {!showAllUnassigned && customers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllUnassigned(true)}
                    className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    <span>Show All Unassigned Kitchen Stops</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setTimeout(() => setLoading(false), 500);
                  }}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>Refresh Stops</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Rider Switcher / PIN Login Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="glass-card bg-slate-900 border border-white/20 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display text-base text-white">Delivery Partner Login</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Enter your registered phone & 4-digit PIN
                </p>
              </div>
              {selectedBoyId && isDriverLoggedIn && (
                <button 
                  onClick={() => setLoginModalOpen(false)} 
                  className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* In-Modal Alert / Error Banner */}
            {loginError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-200 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1">
                  <span>{loginError}</span>
                </div>
                <button onClick={() => setLoginError(null)} className="text-rose-300 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyLogin();
              }}
              className="space-y-3 pt-1"
            >
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    required
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      setLoginError(null);
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-xs font-mono outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    4-Digit Security PIN
                  </label>
                  <span className="text-[10px] text-amber-400 font-medium">Provided by Kitchen Owner</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    required
                    type={showPin ? "text" : "password"}
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPinInput(digits);
                      setLoginError(null);
                    }}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-sm font-mono tracking-widest text-center font-bold outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 mt-1"
              >
                {verifying ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-slate-950" />
                    <span>Verifying PIN...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Access Route</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </form>

            {allStaff.length > 0 && (
              <>
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-slate-400 uppercase font-semibold">Or Select Profile</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {allStaff.map(boy => (
                    <button
                      key={boy.id}
                      type="button"
                      onClick={() => {
                        setPhoneInput(boy.mobile || '');
                        setLoginError(null);
                        showToast(`Selected ${boy.name}. Please enter your 4-digit PIN.`);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        selectedBoyId === boy.id 
                          ? 'bg-amber-500/20 border-amber-500/50 text-white' 
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-white">{boy.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{boy.mobile || 'No contact number'}</div>
                      </div>
                      <Key size={14} className="text-amber-400" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {allStaff.length === 0 && (
              <div className="pt-2 border-t border-white/10 text-center space-y-0.5">
                <p className="text-[11px] font-medium text-slate-400">ScaleKitchen Delivery Partner Portal</p>
                <p className="text-[10px] text-slate-500">Contact your kitchen owner if you need your 4-digit PIN.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Box Recollection Detailed Modal */}
      {activeBoxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="glass-card bg-slate-900 border border-white/20 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-left text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display text-base text-white">Box Return Condition</h3>
                <p className="text-xs text-slate-400">{activeBoxModal.customer.name}</p>
              </div>
              <button onClick={() => setActiveBoxModal(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Assigned Box</span>
              <span className="font-bold text-amber-300 text-sm">
                🍱 {activeBoxModal.customer.reusableBoxType || '3-Tier Stainless Steel'}
              </span>
            </div>

            {/* Condition Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Select Return Status:</label>
              {[
                { status: 'Collected', icon: '✅', label: 'Collected (Clean & Intact)', desc: 'Returned in good hygiene condition' },
                { status: 'Dirty / Unwashed', icon: '🧽', label: 'Dirty / Needs Cleaning', desc: 'Returned with food residue / unwashed' },
                { status: 'Damaged / Missing Parts', icon: '💥', label: 'Damaged or Missing Part', desc: 'Broken clip, missing lid, or dented' },
                { status: 'Not Returned', icon: '⏳', label: 'Not Returned Today', desc: 'Customer retained box; recollect tomorrow' }
              ].map(opt => (
                <button
                  key={opt.status}
                  type="button"
                  onClick={() => setSelectedBoxStatus(opt.status as BoxRecollectionStatus)}
                  className={`w-full p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    selectedBoxStatus === opt.status 
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-xs' 
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <div>
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Optional Note */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Condition Remarks (Optional):</label>
              <textarea
                value={boxNotes}
                onChange={e => setBoxNotes(e.target.value)}
                placeholder="e.g. Lid clip missing, will pay ₹50 replacement fee..."
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-400 resize-none h-16"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveBoxModal(null)}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBoxRecollection}
                className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold shadow-md active:scale-95"
              >
                Confirm Box Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortal;
