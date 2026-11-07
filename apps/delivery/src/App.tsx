import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Truck, MapPin, Phone, MessageSquare, CheckCircle2, Clock, 
  AlertCircle, AlertTriangle, Navigation, ArrowRight, RefreshCw, 
  ChevronRight, Calendar, User, Shield, Info, Battery, Compass,
  Sparkles, Check, X, RotateCcw, Package, HelpCircle, ExternalLink, Play, Star,
  Lock, Key, Eye, EyeOff, LogOut, Mail
} from 'lucide-react';
import { 
  collection, doc, updateDoc, setDoc, getDoc, onSnapshot 
} from 'firebase/firestore';
import { 
  auth, db, driverLoginCallable, getDriverClaims,
  signInWithCustomToken, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from './services/firebase';
import { 
  getTodayStr, isCustomerDeliveryDay2Plus, REUSABLE_BOX_TYPES, 
  BoxRecollectionStatus, DeliveryBoyStaff, GlobalCustomer, SubscribedPlan,
  getCustomerScheduledPlansForSession, isPlanActiveOnDate, formatDateDDMMYYYY,
  decodeDriverToken, normalizePhone, isReusableBoxType,
  getDefaultMealSessionForTime, MealSession, getPlanDietOnDate, DietType
} from './services/driverStore';
import { buildWhatsAppUrl, getDeliveryArrivalMessage } from './services/whatsapp';

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

export const App: React.FC = () => {
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
                     safeStorageGet('driver_biz_id') || '';
  const initialBoy = decoded?.boyId || urlBoy || safeStorageGet('driver_boy_id') || '';
  const initialPhone = decoded?.mobile || urlPhone || safeStorageGet('driver_phone') || '';
  const initialName = decoded?.name || safeStorageGet('driver_name') || safeStorageGet('driver_token_name') || '';

  const [bizId, setBizId] = useState<string>(initialBiz);
  const [selectedBoyId, setSelectedBoyId] = useState<string>(initialBoy);
  const [driverDisplayName, setDriverDisplayName] = useState<string>(initialName);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(initialBiz === 'demo');

  const sessionExpires = Number(safeStorageGet('driver_session_expires') || 0);
  const isSessionValid = !sessionExpires || sessionExpires > Date.now();
  const isDriverLoggedIn = Boolean(safeStorageGet('driver_is_logged_in') === 'true' && isSessionValid);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState<string>(() => safeStorageGet('driver_email') || '');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>(initialPhone);
  const [verifying, setVerifying] = useState<boolean>(false);

  // If driver has an active authenticated session, close login modal; otherwise prompt for Email + Password
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(() => {
    if (initialBiz === 'demo') return false;
    if (initialBoy && isDriverLoggedIn) return false;
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

  // Shift & Attendance state
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

  const watchIdRef = useRef<number | null>(null);

  // ZERO URL EXPOSURE: Clean query parameters from address bar immediately after reading
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const hasSearch = Boolean(window.location.search);
        const hasHashQuery = window.location.hash.includes('?');
        if (hasSearch || hasHashQuery) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (e) {
        console.warn("Could not clean driver address bar URL:", e);
      }
    }
  }, []);

  // Listen to Auth State on the isolated Delivery App
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const claims = await getDriverClaims(user);
          let targetBizId = claims?.bizId || '';
          let targetStaffId = claims?.staffId || '';
          let targetBranchId = claims?.branchId || '';

          // Fetch driver profile from driver_profiles/{user.uid}
          try {
            const profileSnap = await getDoc(doc(db, 'driver_profiles', user.uid));
            if (profileSnap.exists()) {
              const p = profileSnap.data();
              if (p.active === false || p.status === 'Inactive') {
                await signOut(auth);
                safeStorageSet('driver_is_logged_in', 'false');
                setLoginError('This delivery partner account has been deactivated. Please contact your kitchen manager.');
                setLoginModalOpen(true);
                return;
              }
              if (!targetBizId && p.bizId) targetBizId = p.bizId;
              if (!targetStaffId && p.staffId) targetStaffId = p.staffId;
              if (!targetBranchId && p.branchId) targetBranchId = p.branchId;
              if (p.name) {
                setDriverDisplayName(p.name);
                safeStorageSet('driver_name', p.name);
              }
              if (p.email) safeStorageSet('driver_email', p.email);
              if (p.mobile) safeStorageSet('driver_phone', p.mobile);
            }
          } catch (profileErr) {
            console.warn("Could not load driver_profiles:", profileErr);
          }

          if (targetBizId) {
            setBizId(targetBizId);
            safeStorageSet('driver_biz_id', targetBizId);
          }
          if (targetStaffId) {
            setSelectedBoyId(targetStaffId);
            safeStorageSet('driver_boy_id', targetStaffId);
          }
          if (targetBranchId) {
            safeStorageSet('driver_branch_id', targetBranchId);
          }

          if (targetBizId && targetStaffId) {
            safeStorageSet('driver_is_logged_in', 'true');
            setLoginModalOpen(false);
            setLoginError(null);
          }
        } catch (err: any) {
          console.warn("Auth state restoration error:", err);
        }
      } else {
        if (!isDemoMode) {
          safeStorageSet('driver_is_logged_in', 'false');
        }
      }
    });

    return () => unsub();
  }, [bizId, selectedBoyId, isDemoMode]);

  // Sync to storage
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

  // Subscribe to Firestore streams of the authenticated business
  useEffect(() => {
    if (!bizId) {
      setLoading(false);
      return;
    }

    if (bizId === 'demo') {
      launchDemoMode();
      return;
    }

    // 1. Staff subcollection stream
    const staffRef = collection(db, 'businesses', bizId, 'staff');
    const unsubscribeStaff = onSnapshot(staffRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DeliveryBoyStaff[];
      if (list.length > 0) {
        setAllStaff(list);
        
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

            // Enforce account deactivation
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
      console.warn("Direct staff stream notice:", err?.message);
      setLoading(false);
    });

    // 2. Customers subcollection stream
    const custRef = collection(db, 'businesses', bizId, 'customers');
    const unsubscribeCust = onSnapshot(custRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as GlobalCustomer[];
      if (list.length > 0) setCustomers(list);
    }, (err) => console.warn("Direct customer stream notice:", err?.message));

    // 3. Plans stream
    const plansRef = collection(db, 'businesses', bizId, 'plans');
    const unsubscribePlans = onSnapshot(plansRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length > 0) setPlans(list);
    }, (err) => console.warn("Direct plans stream notice:", err?.message));

    // 4. Branches stream
    const branchesRef = collection(db, 'businesses', bizId, 'branches');
    const unsubscribeBranches = onSnapshot(branchesRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length > 0) setBranches(list);
    }, (err) => console.warn("Direct branches stream notice:", err?.message));

    // 5. Today's delivery logs stream
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

    // 6. Business profile stream for branding & logo
    const bizDocRef = doc(db, 'businesses', bizId);
    const unsubscribeBiz = onSnapshot(bizDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.businessName) setBusinessName(data.businessName);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      }
    }, (err) => console.warn("Driver biz profile err:", err?.message));

    // 7. Driver Manifest stream
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

    // 8. Driver Status stream
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

    return () => {
      unsubscribeBiz();
      unsubscribeStaff();
      unsubscribeCust();
      unsubscribePlans();
      unsubscribeBranches();
      unsubscribeLogs();
      unsubscribeManifest();
      unsubscribeStatus();
    };
  }, [bizId, selectedBoyId, todayStr]);

  // GPS Watcher when shift is active
  useEffect(() => {
    if (isShiftActive && navigator.geolocation) {
      let lastWrittenMs = 0;

      const updateLocation = (pos: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        setGpsError(null);

        const nowMs = Date.now();
        // Throttle Firestore writes to at most once per 10 seconds
        if (nowMs - lastWrittenMs < 10000) {
          return;
        }
        lastWrittenMs = nowMs;

        // SAFE DEMO CHECK: Do not write GPS to production Firestore in demo mode
        if (bizId && bizId !== 'demo' && selectedBoyId) {
          const locPayload = {
            currentLat: latitude,
            currentLng: longitude,
            accuracy: accuracy || null,
            lastLocationUpdate: new Date().toISOString(),
            status: 'Online',
            isShiftActive: true,
            updatedAt: new Date().toISOString()
          };

          setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), locPayload, { merge: true })
            .catch(err => console.warn("Driver status GPS sync err:", err));

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

  // Safely sync driver display name when staff list loads
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

    if (boyId && (cBoyId === boyId || cBoyId.toLowerCase() === boyId.toLowerCase())) return true;
    if (boyName && (cBoyName === boyName || cBoyId.toLowerCase() === boyName)) return true;
    if (boyPhone && (cBoyPhone === boyPhone || cBoyId === boyPhone)) return true;
    if (!cBoyId && !cBoyName) {
      if (allStaff.length <= 1) return true;
      if (currentBoy?.branchId && c.branchId && c.branchId === currentBoy.branchId) return true;
    }
    return false;
  };

  // Stop counts for each meal session
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

  // Auto-switch to meal session with scheduled deliveries if current session has 0
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
  const stops = useMemo(() => {
    if (!selectedBoyId && !driverDisplayName) return [];

    const activeCustomerStops: any[] = [];

    customers
      .filter(c => c.isActive !== false && isCustomerAssignedToRider(c))
      .forEach(c => {
        const rawPlans = getCustomerScheduledPlansForSession(c, selectedMeal, todayStr, plans);
        let scheduledPlans = rawPlans.map(ap => ({
          ...ap,
          planConfig: plans.find(p => p.id === ap.planId),
          quantity: Number(ap.quantity) || 1
        }));

        if (scheduledPlans.length === 0) {
          const cMeal = Array.isArray(c.mealTime) ? c.mealTime : [c.mealTime || 'Lunch'];
          if (cMeal.includes(selectedMeal) || cMeal.includes('All') || (selectedMeal === 'Lunch' && !c.mealTime)) {
            scheduledPlans = [{
              planId: c.planId || 'std-1',
              planName: c.planName || 'Standard Meal Plan',
              quantity: 1,
              mealTime: selectedMeal
            } as any];
          }
        }

        if (scheduledPlans.length > 0) {
          const stopTotalBoxes = scheduledPlans.reduce((sum: number, p: any) => sum + (p.quantity || 1), 0);
          const logKey = `${c.id}_${selectedMeal}`;
          const logRecord = deliveryLogs[logKey];
          const isDelivered = logRecord?.status === 'Delivered';
          const isDay2Plus = isCustomerDeliveryDay2Plus(c, todayStr);

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

  // Handle Attendance Punch In / Shift Start
  const handlePunchIn = async () => {
    if (!bizId || !selectedBoyId) {
      showToast("⚠️ Missing rider credentials. Please log in with your PIN.");
      setLoginModalOpen(true);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sessionId = `${todayStr}_${selectedBoyId}`;
    
    setIsShiftActive(true);
    setPunchInTime(timeStr);
    safeStorageSet('driver_shift_active', 'true');
    safeStorageSet('driver_shift_date', todayStr);
    safeStorageSet('driver_punch_in_time', timeStr);
    showToast(`✅ Shift started successfully at ${timeStr}! Attendance marked.`);

    if (bizId === 'demo') return;

    const cleanPhone = (phoneInput || safeStorageGet('driver_phone') || '').replace(/\D/g, '').slice(-10);

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

    setDoc(doc(db, 'businesses', bizId, 'driver_manifest', selectedBoyId), {
      status: 'Online',
      lastAttendanceDate: todayStr,
      attendanceMarkedAt: timeStr,
      punchInTime: timeStr,
      isShiftActive: true,
      updatedAt: now.toISOString()
    }, { merge: true }).catch(err => console.warn("Driver manifest attendance sync notice:", err));

    try {
      const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
      await updateDoc(boyDocRef, {
        status: 'Online',
        lastAttendanceDate: todayStr,
        attendanceMarkedAt: timeStr,
        updatedAt: now.toISOString()
      });
    } catch (writeErr) {
      console.warn("Direct staff attendance write notice:", writeErr);
    }

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
        },
        (err) => console.warn("GPS init:", err.message)
      );
    }
  };

  // Handle Shift End
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

    if (bizId === 'demo') return;

    let durationMins = 0;
    try {
      const sessionSnap = await getDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId));
      if (sessionSnap.exists() && sessionSnap.data().startTime) {
        const startMs = new Date(sessionSnap.data().startTime).getTime();
        durationMins = Math.max(1, Math.round((now.getTime() - startMs) / 60000));
      }
    } catch (e) {}

    setDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId), {
      status: 'Completed',
      endTime: now.toISOString(),
      punchOutTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      durationMinutes: durationMins,
      finalLat: currentCoords?.lat || null,
      finalLng: currentCoords?.lng || null,
      updatedAt: now.toISOString()
    }, { merge: true }).catch(err => console.warn("Driver session end write notice:", err));

    setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), {
      status: 'Offline',
      isShiftActive: false,
      updatedAt: now.toISOString()
    }, { merge: true }).catch(err => console.warn("Per-tenant status punch out notice:", err));

    setDoc(doc(db, 'businesses', bizId, 'driver_manifest', selectedBoyId), {
      status: 'Offline',
      isShiftActive: false,
      updatedAt: now.toISOString()
    }, { merge: true }).catch(err => console.warn("Per-tenant manifest punch out notice:", err));

    try {
      const boyDocRef = doc(db, 'businesses', bizId, 'staff', selectedBoyId);
      await updateDoc(boyDocRef, {
        status: 'Offline',
        updatedAt: now.toISOString()
      });
    } catch (err) {
      console.warn("Direct punch out write notice:", err);
    }
  };

  // Mark Delivery Status
  const handleToggleDelivered = async (stop: any) => {
    if (!bizId) return;

    if (!isShiftActive) {
      showToast("⚠️ Shift not started! Please tap 'Start Shift / Punch In' at the top of the screen before marking orders as delivered.", stop.customer.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const logKey = stop.logKey;
    const currentStatus = stop.isDelivered ? 'Pending' : 'Delivered';
    const now = new Date();
    const hasReusableBox = isReusableBoxType(stop.primaryBoxType);

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
      console.warn("Direct box recollection write notice:", err);
    }
  };

  // Server-Verified Login Handler (Native Firebase Email/Password Auth + Custom Token Fallback)
  const handleVerifyLogin = async () => {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    const cleanPassword = (passwordInput || '');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLoginError('Please enter a valid delivery partner email.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      setLoginError('Password must be at least 6 characters.');
      return;
    }

    setVerifying(true);
    setLoginError(null);

    try {
      let loggedInUser: any = null;

      // 1. First attempt native Firebase Auth signInWithEmailAndPassword
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        loggedInUser = userCred.user;
      } catch (authErr: any) {
        console.warn("Direct signInWithEmailAndPassword notice:", authErr?.code);
      }

      // 2. If direct auth succeeded, inspect claims and profile
      if (loggedInUser) {
        const claims = await getDriverClaims(loggedInUser);
        let resolvedBiz = claims?.bizId || bizId || '';
        let resolvedStaff = claims?.staffId || '';
        let resolvedBranch = claims?.branchId || '';
        let resolvedName = loggedInUser.displayName || '';
        let resolvedMobile = '';

        try {
          const profileSnap = await getDoc(doc(db, 'driver_profiles', loggedInUser.uid));
          if (profileSnap.exists()) {
            const p = profileSnap.data();
            if (p.active === false || p.status === 'Inactive') {
              await signOut(auth);
              setVerifying(false);
              setLoginError('This delivery partner account has been deactivated. Please contact your kitchen manager.');
              return;
            }
            if (!resolvedBiz && p.bizId) resolvedBiz = p.bizId;
            if (!resolvedStaff && p.staffId) resolvedStaff = p.staffId;
            if (!resolvedBranch && p.branchId) resolvedBranch = p.branchId;
            if (p.name) resolvedName = p.name;
            if (p.mobile) resolvedMobile = p.mobile;
          }
        } catch (e) {}

        if (resolvedBiz && resolvedStaff) {
          safeStorageSet('driver_is_logged_in', 'true');
          safeStorageSet('driver_session_expires', String(Date.now() + 14 * 24 * 60 * 60 * 1000));
          safeStorageSet('driver_name', resolvedName || 'Delivery Partner');
          safeStorageSet('driver_email', cleanEmail);
          if (resolvedMobile) safeStorageSet('driver_phone', resolvedMobile);
          safeStorageSet('driver_biz_id', resolvedBiz);
          safeStorageSet('driver_boy_id', resolvedStaff);
          if (resolvedBranch) safeStorageSet('driver_branch_id', resolvedBranch);

          setDriverDisplayName(resolvedName || 'Delivery Partner');
          setBizId(resolvedBiz);
          setSelectedBoyId(resolvedStaff);
          setLoginModalOpen(false);
          setPasswordInput('');
          setVerifying(false);
          showToast(`Welcome back, ${resolvedName || 'Delivery Partner'}! Ready for deliveries.`);
          return;
        }
      }

      // 3. Fallback to server-side driverLogin Cloud Function callable
      const result = await driverLoginCallable({
        email: cleanEmail,
        password: cleanPassword,
        bizId: bizId || undefined
      });

      if (result?.data?.token) {
        await signInWithCustomToken(auth, result.data.token);

        const driverInfo = result.data.driver;
        const name = driverInfo.name || 'Delivery Partner';
        const businessId = driverInfo.bizId;
        const staffId = driverInfo.staffId;
        const branchId = driverInfo.branchId || '';
        const driverMobile = driverInfo.mobile || '';

        safeStorageSet('driver_is_logged_in', 'true');
        safeStorageSet('driver_session_expires', String(Date.now() + 14 * 24 * 60 * 60 * 1000));
        setDriverDisplayName(name);
        safeStorageSet('driver_name', name);
        safeStorageSet('driver_email', cleanEmail);
        if (driverMobile) safeStorageSet('driver_phone', driverMobile);
        safeStorageSet('driver_biz_id', businessId);
        if (staffId) safeStorageSet('driver_boy_id', staffId);
        if (branchId) safeStorageSet('driver_branch_id', branchId);

        setBizId(businessId);
        if (staffId) setSelectedBoyId(staffId);
        setLoginModalOpen(false);
        setPasswordInput('');
        setVerifying(false);
        showToast(`Welcome back, ${name}! Ready for today's deliveries.`);
      }
    } catch (error: any) {
      setVerifying(false);
      const errorMsg = error?.message || '';
      const errorCode = error?.code || '';

      if (errorCode === 'functions/resource-exhausted' || errorMsg.includes('locked')) {
        setLoginError(errorMsg);
      } else if (
        errorCode === 'functions/unauthenticated' || 
        errorCode === 'auth/wrong-password' || 
        errorCode === 'auth/invalid-credential' || 
        errorCode === 'auth/user-not-found' ||
        errorMsg.includes('Invalid') || 
        errorMsg.includes('not found')
      ) {
        setLoginError('Invalid email or password. Please verify your credentials or contact your kitchen owner.');
      } else if (errorCode === 'functions/permission-denied' || errorMsg.includes('deactivated') || errorMsg.includes('expired')) {
        setLoginError(errorMsg);
      } else {
        setLoginError(`Sign in error: ${errorMsg || 'Unable to connect to kitchen. Please check internet connection.'}`);
      }
    }
  };

  // Logout Handler (Cleans Delivery app auth and driver-specific storage only)
  const handleDriverLogout = async () => {
    if (window.confirm("Are you sure you want to log out of the Delivery Partner app?")) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn("Sign out err:", e);
      }
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
      safeStorageSet('driver_branch_id', '');
      setBizId('');
      setSelectedBoyId('');
      setDriverDisplayName('');
      setPasswordInput('');
      setLoginModalOpen(true);
      showToast("Logged out successfully.");
    }
  };

  // If no business or rider is connected, display Login screen
  if (!bizId || (!isDriverLoggedIn && !isDemoMode)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-card bg-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl max-w-md w-full border border-white/20 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
            <Truck size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight text-white">Delivery Partner Login</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Enter your registered Email and Password to access today's meal delivery route.
            </p>
          </div>

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
                Driver Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  required
                  type="email"
                  placeholder="e.g. rider@kitchen.com"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-[10px] text-amber-400 font-medium">Min 6 characters</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
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
                  <span>Sign In & Access Route</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Demo Route Preview Button */}
          <div className="pt-2 border-t border-white/10 space-y-2">
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

        {/* Center: Business Name */}
        <div className="flex-1 text-center px-1 sm:px-3">
          <h2 className="font-bold font-display text-xs sm:text-sm tracking-tight text-white truncate max-w-[110px] sm:max-w-xs mx-auto">
            {businessName || 'ScaleKitchen'}
          </h2>
          <span className="text-[9px] text-amber-400/90 font-medium hidden sm:inline-block">
            Delivery Fleet
          </span>
        </div>

        {/* Right Corner: Driver Name Badge, Shift Action Button & Company Logo */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">
        
        {/* Floating Toast Notification */}
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

        {/* Shift Banner when not punched in */}
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
              onClick={() => {
                setSelectedMeal(meal);
                setIsDriverMealManuallySelected(true);
              }}
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
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
              <span>{metrics.totalBoxesToDeliver} Boxes Total</span>
              <span className="font-semibold text-slate-300">
                <span className="text-emerald-400">V:{metrics.totalVegBoxes}</span> • <span className="text-rose-400">NV:{metrics.totalNonVegBoxes}</span>
              </span>
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
              totalBoxes, 
              boxVariants, 
              isStarred, 
              starredQuery, 
              logKey, 
              logRecord, 
              isDelivered, 
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

                  {/* Delivery Status Button */}
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

                {/* Reusable Box Return Section */}
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

                {/* Final Stop Return to Branch */}
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

          {/* BACK TO BRANCH / KITCHEN HUB CARD */}
          {stops.length > 0 && (
            <div className="glass-card bg-gradient-to-r from-amber-500/15 via-slate-900 to-indigo-900/20 border-2 border-amber-500/40 rounded-3xl p-5 space-y-3.5 shadow-xl animate-in slide-in-from-bottom-2">
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
                      {driverBranch?.name || (currentBoy?.name ? `${currentBoy.name}'s Hub` : 'Kitchen Dispatch Hub')}
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

              {sessionStopCounts['Lunch'] > 0 && selectedMeal !== 'Lunch' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-2 max-w-sm mx-auto">
                  <span>☀️ <strong>{sessionStopCounts['Lunch']}</strong> stops scheduled in Lunch session</span>
                  <button
                    onClick={() => {
                      setSelectedMeal('Lunch');
                      setIsDriverMealManuallySelected(true);
                    }}
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
                    onClick={() => {
                      setSelectedMeal('Dinner');
                      setIsDriverMealManuallySelected(true);
                    }}
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
                    onClick={() => {
                      setSelectedMeal('Breakfast');
                      setIsDriverMealManuallySelected(true);
                    }}
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

      {/* Delivery Partner Email + Password Login Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="glass-card bg-slate-900 border border-white/20 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display text-base text-white">Delivery Partner Login</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Sign in with your kitchen email & password
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
              className="space-y-3.5 pt-1"
            >
              {/* Optional Kitchen / Business ID */}
              {!bizId && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Kitchen / Business ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MyKitchen or leave blank"
                    value={bizId}
                    onChange={(e) => setBizId(e.target.value.trim())}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-xs font-mono outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Driver Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    required
                    type="email"
                    placeholder="e.g. rider@kitchen.com"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setLoginError(null);
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Password
                  </label>
                  <span className="text-[10px] text-amber-400 font-medium">Min 6 characters</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setLoginError(null);
                    }}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 mt-2"
              >
                {verifying ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-slate-950" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In & Access Route</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-white/10 text-center space-y-0.5">
              <p className="text-[11px] font-medium text-slate-400">ScaleKitchen Delivery Partner Portal</p>
              <p className="text-[10px] text-slate-500">Credentials are configured by your Kitchen Manager or Owner.</p>
            </div>
          </div>
        </div>
      )}

      {/* Box Recollection Detailed Remarks Modal */}
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

export default App;
