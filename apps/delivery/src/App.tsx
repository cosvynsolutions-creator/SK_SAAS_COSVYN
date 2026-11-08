import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Truck, MapPin, Phone, MessageSquare, CheckCircle2, Clock, 
  AlertCircle, AlertTriangle, Navigation, ArrowRight, RefreshCw, 
  ChevronRight, Calendar, User, Shield, Info, Battery, Compass,
  Sparkles, Check, X, RotateCcw, Package, HelpCircle, ExternalLink, Play, Star,
  Lock, Key, Eye, EyeOff, LogOut, Mail
} from 'lucide-react';
import { 
  collection, doc, updateDoc, setDoc, getDoc, onSnapshot, query, where
} from 'firebase/firestore';
import { 
  auth, db, driverLoginCallable, getDriverClaims,
  signInWithCustomToken, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from './services/firebase';
import {
  getTodayStr, isCustomerDeliveryDay2Plus, REUSABLE_BOX_TYPES, 
  BoxRecollectionStatus, DeliveryBoyStaff, GlobalCustomer, SubscribedPlan,
  getDriverCustomersScheduledForSession, formatDateDDMMYYYY,
  isReusableBoxType,
  getDefaultMealSessionForTime, MealSession, getPlanDietOnDate, DietType
} from './services/driverStore';
import { buildWhatsAppUrl, getDeliveryArrivalMessage } from './services/whatsapp';

export const App: React.FC = () => {
  const [bizId, setBizId] = useState<string>('');
  const [selectedBoyId, setSelectedBoyId] = useState<string>('');
  const [driverBranchId, setDriverBranchId] = useState<string>('');
  const [driverDisplayName, setDriverDisplayName] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [authInitializing, setAuthInitializing] = useState<boolean>(true);
  const [selectedMeal, setSelectedMeal] = useState<MealSession>(() => getDefaultMealSessionForTime());
  const [isDriverMealManuallySelected, setIsDriverMealManuallySelected] = useState<boolean>(false);
  const [todayStr, setTodayStr] = useState<string>(getTodayStr);

  useEffect(() => {
    const checkTime = () => {
      const currentIndiaDate = getTodayStr();
      setTodayStr(previous => previous === currentIndiaDate ? previous : currentIndiaDate);
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
  const [routeErrors, setRouteErrors] = useState<Record<string, boolean>>({});
  const routeError = Object.values(routeErrors).some(Boolean)
    ? 'Cannot load route. Check your connection and try again.'
    : null;

  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [punchInTime, setPunchInTime] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const currentCoordsRef = useRef(currentCoords);
  const [activeBoxModal, setActiveBoxModal] = useState<{ customer: GlobalCustomer; logKey: string } | null>(null);
  const [selectedBoxStatus, setSelectedBoxStatus] = useState<BoxRecollectionStatus>('Collected');
  const [boxNotes, setBoxNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [highlightedStopId, setHighlightedStopId] = useState<string | null>(null);

  const showToast = (msg: string, stopId?: string, retry?: () => void) => {
    setToastMessage(msg);
    setRetryAction(retry || null);
    if (stopId) setHighlightedStopId(stopId);
    setTimeout(() => {
      setToastMessage(null);
      setRetryAction(null);
      if (stopId) setHighlightedStopId(null);
    }, 8000);
  };

  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setBizId('');
        setSelectedBoyId('');
        setDriverBranchId('');
        setDriverDisplayName('');
        setAllStaff([]);
        setCustomers([]);
        setPlans([]);
        setBranches([]);
        setDeliveryLogs({});
        setRouteErrors({});
        setIsShiftActive(false);
        setPunchInTime(null);
        setAuthInitializing(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const claims = await getDriverClaims(user);
        if (claims?.role !== 'driver' || !claims.bizId || !claims.staffId) {
          await signOut(auth);
          setLoginError('This account is not authorized as a delivery partner. Please use the email and password provided by your kitchen owner.');
          return;
        }
        if (!claims.branchId) {
          await signOut(auth);
          setLoginError('Your delivery account has no assigned branch. Please contact your kitchen owner.');
          return;
        }

        const profileSnap = await getDoc(doc(db, 'driver_profiles', user.uid));
        if (profileSnap.exists() && profileSnap.data().active === false) {
          await signOut(auth);
          setLoginError('This delivery partner account has been deactivated. Please contact your kitchen owner.');
          return;
        }

        setBizId(claims.bizId);
        setSelectedBoyId(claims.staffId);
        setDriverBranchId(claims.branchId);
        setDriverDisplayName(user.displayName || '');
        setLoginError(null);
        setLoginModalOpen(false);
      } catch (error) {
        console.error('Unable to verify delivery partner identity:', error);
        await signOut(auth);
        setLoginError('Unable to verify your delivery account. Check your connection and try again.');
      } finally {
        setAuthInitializing(false);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Subscribe only to the authenticated driver's staff record and route data.
  useEffect(() => {
    if (!bizId || !selectedBoyId) return;

    const onRouteError = (source: string, error: Error) => {
      console.error('Cannot load route:', error);
      setRouteErrors(prev => ({ ...prev, [source]: true }));
    };
    const onRouteSuccess = (source: string) => {
      setRouteErrors(prev => ({ ...prev, [source]: false }));
    };

    const unsubscribeStaff = onSnapshot(
      doc(db, 'businesses', bizId, 'staff', selectedBoyId),
      async (snap) => {
        if (!snap.exists()) {
          onRouteError('staff', new Error('Delivery partner staff record is missing.'));
          return;
        }
        const staff = { id: snap.id, ...snap.data() } as DeliveryBoyStaff;
        setAllStaff([staff]);
        onRouteSuccess('staff');
        if (staff.name) setDriverDisplayName(staff.name);
        if (staff.status === 'Inactive' || staff.active === false || staff.isDeleted) {
          await signOut(auth);
          setLoginError('This delivery partner account has been deactivated. Please contact your kitchen owner.');
          return;
        }
        const shiftActive = staff.status === 'Online' && staff.lastAttendanceDate === todayStr;
        setIsShiftActive(shiftActive);
        setPunchInTime(shiftActive ? staff.attendanceMarkedAt || null : null);
      },
      error => onRouteError('staff', error)
    );

    const customersRef = collection(db, 'businesses', bizId, 'customers');
    const customerRoute = query(
      customersRef,
      where('branchId', '==', driverBranchId),
      where('deliveryBoyId', '==', selectedBoyId)
    );
    const unsubscribeCust = onSnapshot(
      customerRoute,
      (snap) => {
        onRouteSuccess('customers');
        setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as GlobalCustomer[]);
      },
      error => onRouteError('customers', error)
    );
    const unsubscribePlans = onSnapshot(
      collection(db, 'businesses', bizId, 'plans'),
      (snap) => {
        onRouteSuccess('plans');
        setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      error => onRouteError('plans', error)
    );
    const unsubscribeBranches = onSnapshot(
      collection(db, 'businesses', bizId, 'branches'),
      (snap) => {
        onRouteSuccess('branches');
        setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      error => onRouteError('branches', error)
    );
    const unsubscribeLogs = onSnapshot(
      collection(db, 'businesses', bizId, 'delivery_logs'),
      (snap) => {
        onRouteSuccess('delivery logs');
        const map: Record<string, any> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (
            data.date === todayStr &&
            data.deliveryBoyId === selectedBoyId &&
            data.staffId === selectedBoyId &&
            data.branchId === driverBranchId
          ) {
            map[`${data.customerId}_${data.mealTime}`] = { id: d.id, ...data };
          }
        });
        setDeliveryLogs(map);
      },
      error => onRouteError('delivery logs', error)
    );
    const unsubscribeBiz = onSnapshot(
      doc(db, 'businesses', bizId),
      (snap) => {
        onRouteSuccess('business');
        if (snap.exists()) {
          const data = snap.data();
          setBusinessName(data.businessName || 'ScaleKitchen');
          setLogoUrl(data.logoUrl || '');
        }
      },
      error => onRouteError('business', error)
    );
    const unsubscribeStatus = onSnapshot(
      doc(db, 'businesses', bizId, 'driver_status', selectedBoyId),
      (snap) => {
        onRouteSuccess('status');
        if (!snap.exists()) return;
        const status = snap.data();
        const shiftActive = status.lastAttendanceDate === todayStr && status.status === 'Online';
        setIsShiftActive(shiftActive);
        setPunchInTime(shiftActive ? status.attendanceMarkedAt || null : null);
      },
      error => onRouteError('status', error)
    );

    return () => {
      unsubscribeStaff();
      unsubscribeCust();
      unsubscribePlans();
      unsubscribeBranches();
      unsubscribeLogs();
      unsubscribeBiz();
      unsubscribeStatus();
    };
  }, [bizId, selectedBoyId, driverBranchId, todayStr]);

  // GPS Watcher when shift is active
  useEffect(() => {
    if (!isShiftActive || !navigator.geolocation || !bizId || !selectedBoyId) return;
    let lastWrittenMs = 0;

    const updateLocation = async (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const previousCoords = currentCoordsRef.current;
      const coords = { lat: latitude, lng: longitude };
      currentCoordsRef.current = coords;
      setCurrentCoords(coords);
      setGpsError(null);

      const nowMs = Date.now();
      if (nowMs - lastWrittenMs < 10000) return;
      lastWrittenMs = nowMs;

      const now = new Date().toISOString();
      const statusPayload = {
        staffId: selectedBoyId,
        deliveryBoyId: selectedBoyId,
        currentLat: latitude,
        currentLng: longitude,
        accuracy: accuracy || null,
        lastLocationUpdate: now,
        status: 'Online',
        isShiftActive: true,
        updatedAt: now
      };

      try {
        await Promise.all([
          setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), statusPayload, { merge: true }),
          updateDoc(doc(db, 'businesses', bizId, 'staff', selectedBoyId), {
            currentLat: latitude,
            currentLng: longitude,
            lastLocationUpdate: now,
            status: 'Online',
            updatedAt: now
          })
        ]);
      } catch (error) {
        console.error('GPS location sync failed:', error);
        lastWrittenMs = 0;
        currentCoordsRef.current = previousCoords;
        setCurrentCoords(previousCoords);
        showToast('Could not save your GPS location. Try again.', undefined, () => {
          void updateLocation(pos);
        });
      }
    };

    const retryCurrentLocation = () => {
      navigator.geolocation.getCurrentPosition(
        position => { void updateLocation(position); },
        error => {
          setGpsError(error.message);
          showToast('Could not get your location. Check location permission and try again.', undefined, retryCurrentLocation);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      position => { void updateLocation(position); },
      error => {
        setGpsError(error.message);
        showToast('Could not get your location. Check location permission and try again.', undefined, retryCurrentLocation);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    watchIdRef.current = navigator.geolocation.watchPosition(
      position => { void updateLocation(position); },
      error => {
        setGpsError(error.message);
        showToast('Could not get your location. Check location permission and try again.', undefined, retryCurrentLocation);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isShiftActive, bizId, selectedBoyId]);

  // Sync display details from the authenticated driver's staff record.
  useEffect(() => {
    if (!selectedBoyId) return;
    const fromStaff = allStaff.find(s => s.id === selectedBoyId);
    if (fromStaff?.name && fromStaff.name !== driverDisplayName) {
      setDriverDisplayName(fromStaff.name);
    }
  }, [allStaff, selectedBoyId, driverDisplayName]);

  // Active delivery boy & their branch hub
  const currentBoy = useMemo(() => {
    const fromStaff = allStaff.find(s => s.id === selectedBoyId);
    if (fromStaff) return fromStaff;

    if (selectedBoyId) {
      return {
        id: selectedBoyId,
        name: driverDisplayName || 'Delivery Partner',
        mobile: '',
        role: 'Delivery Boy',
        status: isShiftActive ? 'Online' : 'Offline',
        branchId: driverBranchId,
        lastAttendanceDate: isShiftActive ? todayStr : '',
        attendanceMarkedAt: punchInTime || undefined
      } as DeliveryBoyStaff;
    }
    return null;
  }, [allStaff, selectedBoyId, driverDisplayName, driverBranchId, isShiftActive, todayStr, punchInTime]);

  const driverBranch = useMemo(() => {
    if (!currentBoy?.branchId) return branches[0] || null;
    return branches.find(b => b.id === currentBoy.branchId) || branches[0] || null;
  }, [currentBoy, branches]);

  // Quick helper to determine if a customer is assigned to this driver
  // Stop counts for each meal session
  const sessionStopCounts = useMemo(() => {
    const counts = { Breakfast: 0, Lunch: 0, Dinner: 0 };
    (['Breakfast', 'Lunch', 'Dinner'] as const).forEach(meal => {
      counts[meal] = getDriverCustomersScheduledForSession(
        customers,
        selectedBoyId,
        driverBranchId,
        meal,
        todayStr,
        plans
      ).length;
    });
    return counts;
  }, [customers, selectedBoyId, driverBranchId, todayStr, plans]);

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
    const activeCustomerStops: any[] = [];

    getDriverCustomersScheduledForSession(
      customers,
      selectedBoyId,
      driverBranchId,
      selectedMeal,
      todayStr,
      plans
    ).forEach(({ customer: c, plans: rawPlans }) => {
        let scheduledPlans = rawPlans.map(ap => ({
          ...ap,
          planConfig: plans.find(p => p.id === ap.planId),
          quantity: Number(ap.quantity) || 1
        }));

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
  }, [customers, selectedBoyId, driverBranchId, selectedMeal, plans, todayStr, deliveryLogs]);

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
    if (!bizId || !selectedBoyId) return;

    const customer = stop.customer as GlobalCustomer;
    const logKey = stop.logKey as string;
    const previousLog = deliveryLogs[logKey];
    const previousCustomer = customers.find(c => c.id === customer.id) || customer;
    const previousLogFields = previousLog || {};
    const now = new Date();
    const isClean = status === 'Collected' || status === 'Collected Clean';
    const isCollectedAny = isClean || status === 'Dirty / Unwashed';
    const boxType = customer.reusableBoxType || stop.primaryBoxType || 'Stainless Steel 3-Tier Dabba';
    const newCount = isCollectedAny
      ? Math.max(0, (typeof customer.uncollectedBoxesCount === 'number' ? customer.uncollectedBoxesCount : 1) - 1)
      : (typeof customer.uncollectedBoxesCount === 'number' ? customer.uncollectedBoxesCount : 1);
    const logPayload = {
      date: todayStr,
      customerId: customer.id,
      customerName: customer.name,
      branchId: customer.branchId || currentBoy?.branchId || '',
      deliveryBoyId: selectedBoyId,
      staffId: selectedBoyId,
      deliveryBoyName: currentBoy?.name || 'Rider',
      mealTime: selectedMeal,
      status: previousLogFields.status || 'Pending',
      deliveredAt: previousLogFields.deliveredAt || null,
      reusableBoxEnabled: true,
      boxType,
      isDay2Plus: true,
      boxStatus: status,
      boxNotes: note.trim(),
      boxCollectedAt: isClean ? now.toISOString() : null,
      currentLat: currentCoords?.lat || null,
      currentLng: currentCoords?.lng || null,
      updatedAt: now.toISOString()
    };
    const boxCollection = {
      status,
      boxType,
      issueNote: note.trim(),
      collectedAt: now.toISOString(),
      updatedBy: currentBoy?.name || 'Delivery Partner'
    };
    const customerPayload = {
      uncollectedBoxesCount: newCount,
      [`boxCollections.${todayStr}_${selectedMeal}`]: boxCollection,
      updatedAt: now.toISOString()
    };

    setDeliveryLogs(prev => ({ ...prev, [logKey]: { ...(prev[logKey] || {}), ...logPayload } }));
    setCustomers(prev => prev.map(c => c.id === customer.id
      ? { ...c, uncollectedBoxesCount: newCount, boxCollections: {
          ...(c.boxCollections || {}), [`${todayStr}_${selectedMeal}`]: boxCollection
        } }
      : c));

    try {
      await Promise.all([
        setDoc(doc(db, 'businesses', bizId, 'delivery_logs', `${todayStr}_${customer.id}_${selectedMeal}`), logPayload),
        updateDoc(doc(db, 'businesses', bizId, 'customers', customer.id), customerPayload)
      ]);
      showToast(`Box status recorded as "${status}". You can now mark the order as delivered.`);
    } catch (error) {
      console.error('Could not save box status:', error);
      setDeliveryLogs(prev => {
        const next = { ...prev };
        if (previousLog) next[logKey] = previousLog;
        else delete next[logKey];
        return next;
      });
      setCustomers(prev => prev.map(c => c.id === customer.id ? previousCustomer : c));
      showToast('Could not save box status. Please retry.', customer.id, () => {
        void handleQuickBoxStatus(stop, status, note);
      });
    }
  };

  // Handle Attendance Punch In / Shift Start
  const handlePunchIn = async () => {
    if (!bizId || !selectedBoyId) {
      showToast('Your delivery account is not ready. Sign in again to continue.');
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sessionId = `${todayStr}_${selectedBoyId}`;
    const previousShift = isShiftActive;
    const previousPunchInTime = punchInTime;
    setIsShiftActive(true);
    setPunchInTime(timeStr);

    const statusPayload = {
      staffId: selectedBoyId,
      deliveryBoyId: selectedBoyId,
      riderName: currentBoy?.name || driverDisplayName || 'Rider',
      status: 'Online',
      lastAttendanceDate: todayStr,
      attendanceMarkedAt: timeStr,
      punchInTime: timeStr,
      isShiftActive: true,
      currentLat: currentCoords?.lat || null,
      currentLng: currentCoords?.lng || null,
      lastLocationUpdate: nowIso,
      updatedAt: nowIso
    };
    const sessionPayload = {
      sessionId,
      staffId: selectedBoyId,
      deliveryBoyId: selectedBoyId,
      driverName: currentBoy?.name || driverDisplayName || 'Rider',
      branchId: currentBoy?.branchId || driverBranchId || '',
      date: todayStr,
      startTime: nowIso,
      punchInTime: timeStr,
      endTime: null,
      durationMinutes: 0,
      status: 'Active',
      initialLat: currentCoords?.lat || null,
      initialLng: currentCoords?.lng || null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    try {
      await Promise.all([
        setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), statusPayload, { merge: true }),
        setDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId), sessionPayload),
        updateDoc(doc(db, 'businesses', bizId, 'staff', selectedBoyId), {
          status: 'Online',
          lastAttendanceDate: todayStr,
          attendanceMarkedAt: timeStr,
          updatedAt: nowIso
        })
      ]);
      showToast(`Shift started successfully at ${timeStr}.`);
    } catch (error) {
      console.error('Could not punch in:', error);
      setIsShiftActive(previousShift);
      setPunchInTime(previousPunchInTime);
      showToast('Could not save punch in. Please retry.', undefined, () => { void handlePunchIn(); });
    }
  };

  // Handle Shift End
  const handlePunchOut = async () => {
    if (!confirm('Are you sure you want to end your shift?')) return;
    if (!bizId || !selectedBoyId) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const sessionId = `${todayStr}_${selectedBoyId}`;
    const previousShift = isShiftActive;
    const previousPunchInTime = punchInTime;
    setIsShiftActive(false);
    setPunchInTime(null);

    try {
      const sessionSnap = await getDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId));
      const sessionData = sessionSnap.exists() ? sessionSnap.data() : {};
      const startTime = sessionData.startTime || null;
      const durationMinutes = startTime
        ? Math.max(1, Math.round((now.getTime() - new Date(startTime).getTime()) / 60000))
        : 0;
      const punchOutTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sessionPayload = {
        sessionId,
        staffId: selectedBoyId,
        deliveryBoyId: selectedBoyId,
        driverName: currentBoy?.name || driverDisplayName || 'Rider',
        branchId: currentBoy?.branchId || driverBranchId || '',
        date: todayStr,
        startTime: startTime || nowIso,
        punchInTime: sessionData.punchInTime || previousPunchInTime || '',
        endTime: nowIso,
        punchOutTime,
        durationMinutes,
        status: 'Completed',
        initialLat: sessionData.initialLat ?? currentCoords?.lat ?? null,
        initialLng: sessionData.initialLng ?? currentCoords?.lng ?? null,
        finalLat: currentCoords?.lat || null,
        finalLng: currentCoords?.lng || null,
        createdAt: sessionData.createdAt || nowIso,
        updatedAt: nowIso
      };

      await Promise.all([
        setDoc(doc(db, 'businesses', bizId, 'driver_sessions', sessionId), sessionPayload),
        setDoc(doc(db, 'businesses', bizId, 'driver_status', selectedBoyId), {
          staffId: selectedBoyId,
          deliveryBoyId: selectedBoyId,
          status: 'Offline',
          isShiftActive: false,
          updatedAt: nowIso
        }, { merge: true }),
        updateDoc(doc(db, 'businesses', bizId, 'staff', selectedBoyId), {
          status: 'Offline',
          updatedAt: nowIso
        })
      ]);

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      showToast('Shift ended. Have a great rest!');
    } catch (error) {
      console.error('Could not punch out:', error);
      setIsShiftActive(previousShift);
      setPunchInTime(previousPunchInTime);
      showToast('Could not save punch out. Please retry.', undefined, () => { void handlePunchOut(); });
    }
  };

  // Mark Delivery Status
  const handleToggleDelivered = async (stop: any) => {
    if (!bizId || !selectedBoyId) return;

    if (!isShiftActive) {
      showToast("Shift not started. Tap 'Start Shift / Punch In' before marking orders as delivered.", stop.customer.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const logKey = stop.logKey;
    const currentStatus = stop.isDelivered ? 'Pending' : 'Delivered';
    const now = new Date();
    const hasReusableBox = isReusableBoxType(stop.primaryBoxType);

    if (currentStatus === 'Delivered' && hasReusableBox) {
      const activeBoxStatus = deliveryLogs[logKey]?.boxStatus || stop.logRecord?.boxStatus;
      if (!activeBoxStatus || activeBoxStatus === 'Pending' || activeBoxStatus === 'None') {
        showToast('Record the returned box condition before marking this order as delivered.', stop.customer.id);
        return;
      }
    }

    const previousLog = deliveryLogs[logKey];
    const currentLog = previousLog || stop.logRecord || {};
    const logPayload = {
      date: todayStr,
      customerId: stop.customer.id,
      customerName: stop.customer.name,
      branchId: stop.customer.branchId || currentBoy?.branchId || driverBranchId || '',
      deliveryBoyId: selectedBoyId,
      staffId: selectedBoyId,
      deliveryBoyName: currentBoy?.name || 'Rider',
      mealTime: selectedMeal,
      status: currentStatus,
      deliveredAt: currentStatus === 'Delivered' ? now.toISOString() : null,
      reusableBoxEnabled: hasReusableBox,
      boxType: stop.primaryBoxType || 'Disposable',
      isDay2Plus: stop.isDay2Plus,
      boxStatus: hasReusableBox ? (currentLog.boxStatus || 'Pending') : 'Disposable',
      boxNotes: currentLog.boxNotes || '',
      currentLat: currentCoords?.lat || null,
      currentLng: currentCoords?.lng || null,
      boxCollectedAt: currentLog.boxCollectedAt || null,
      updatedAt: now.toISOString()
    };

    setDeliveryLogs(prev => ({ ...prev, [logKey]: { ...(prev[logKey] || {}), ...logPayload } }));
    try {
      await setDoc(
        doc(db, 'businesses', bizId, 'delivery_logs', `${todayStr}_${stop.customer.id}_${selectedMeal}`),
        logPayload,
      );
      showToast(currentStatus === 'Delivered' ? 'Order marked as delivered.' : 'Delivery status reset.');
    } catch (error) {
      console.error('Could not update delivery status:', error);
      setDeliveryLogs(prev => {
        const next = { ...prev };
        if (previousLog) next[logKey] = previousLog;
        else delete next[logKey];
        return next;
      });
      showToast('Could not save delivery status. Please retry.', stop.customer.id, () => {
        void handleToggleDelivered(stop);
      });
    }
  };

  // Save Box Recollection Condition
  const handleSaveBoxRecollection = async () => {
    if (!activeBoxModal || !bizId || !selectedBoyId) return;

    const { customer, logKey } = activeBoxModal;
    const previousLog = deliveryLogs[logKey];
    const previousCustomer = customers.find(c => c.id === customer.id) || customer;
    const now = new Date();
    const isClean = selectedBoxStatus === 'Collected' || selectedBoxStatus === 'Collected Clean';
    const isCollectedAny = isClean || selectedBoxStatus === 'Dirty / Unwashed';
    const boxType = customer.reusableBoxType || 'Stainless Steel 3-Tier Dabba';
    const previousCount = typeof customer.uncollectedBoxesCount === 'number' ? customer.uncollectedBoxesCount : 1;
    const newCount = isCollectedAny ? Math.max(0, previousCount - 1) : previousCount;
    const collectionStatus = selectedBoxStatus === 'Collected' ? 'Collected Clean'
      : selectedBoxStatus === 'Dirty / Unwashed' ? 'Collected Unclean' : selectedBoxStatus;
    const boxCollection = {
      status: collectionStatus,
      boxType,
      issueNote: boxNotes.trim(),
      collectedAt: now.toISOString(),
      updatedBy: currentBoy?.name || 'Delivery Partner'
    };
    const logPayload = {
      date: todayStr,
      customerId: customer.id,
      customerName: customer.name,
      branchId: customer.branchId || currentBoy?.branchId || driverBranchId || '',
      deliveryBoyId: selectedBoyId,
      staffId: selectedBoyId,
      deliveryBoyName: currentBoy?.name || 'Rider',
      mealTime: selectedMeal,
      status: previousLog?.status || 'Pending',
      deliveredAt: previousLog?.deliveredAt || null,
      reusableBoxEnabled: true,
      boxType,
      isDay2Plus: true,
      boxStatus: selectedBoxStatus,
      boxNotes: boxNotes.trim(),
      boxCollectedAt: isClean ? now.toISOString() : null,
      currentLat: currentCoords?.lat || null,
      currentLng: currentCoords?.lng || null,
      updatedAt: now.toISOString()
    };

    setDeliveryLogs(prev => ({ ...prev, [logKey]: { ...(prev[logKey] || {}), ...logPayload } }));
    setCustomers(prev => prev.map(c => c.id === customer.id
      ? { ...c, uncollectedBoxesCount: newCount, boxCollections: { ...(c.boxCollections || {}), [`${todayStr}_${selectedMeal}`]: boxCollection } }
      : c));

    try {
      await Promise.all([
        setDoc(doc(db, 'businesses', bizId, 'delivery_logs', `${todayStr}_${customer.id}_${selectedMeal}`), logPayload),
        updateDoc(doc(db, 'businesses', bizId, 'customers', customer.id), {
          uncollectedBoxesCount: newCount,
          [`boxCollections.${todayStr}_${selectedMeal}`]: boxCollection,
          updatedAt: now.toISOString()
        })
      ]);
      setActiveBoxModal(null);
      setBoxNotes('');
      showToast('Box condition saved.');
    } catch (error) {
      console.error('Could not save box recollection:', error);
      setDeliveryLogs(prev => {
        const next = { ...prev };
        if (previousLog) next[logKey] = previousLog;
        else delete next[logKey];
        return next;
      });
      setCustomers(prev => prev.map(c => c.id === customer.id ? previousCustomer : c));
      showToast('Could not save box recollection. Please retry.', customer.id, () => {
        void handleSaveBoxRecollection();
      });
    }
  };

  // Firebase email/password sign-in with the server-verified callable fallback.
  const handleVerifyLogin = async () => {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPassword = passwordInput;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLoginError('Please enter a valid delivery partner email.');
      return;
    }
    if (!cleanPassword) {
      setLoginError('Please enter your password.');
      return;
    }

    setVerifying(true);
    setLoginError(null);
    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      } catch (authError: any) {
        console.error('Firebase email/password sign-in failed; trying the driverLogin fallback:', authError);
        try {
          const result = await driverLoginCallable({ email: cleanEmail, password: cleanPassword });
          if (!result.data?.token) throw new Error('The driverLogin function returned no authentication token.');
          userCredential = await signInWithCustomToken(auth, result.data.token);
        } catch (functionError: any) {
          console.error('driverLogin fallback failed:', {
            authCode: authError?.code || 'unknown',
            authMessage: authError?.message || '',
            functionCode: functionError?.code || 'unknown',
            functionMessage: functionError?.message || ''
          });
          if (['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded', 'functions/not-found'].includes(functionError?.code)) {
            throw new Error(
              `Delivery authentication service error (${functionError.code}; Firebase Auth ${authError?.code || 'unknown'}). Confirm driverLogin is deployed to asia-south1 and check Firebase Functions logs. ${functionError.message || ''}`
            );
          }
          throw functionError;
        }
      }

      const claims = await getDriverClaims(userCredential.user);
      if (claims?.role !== 'driver' || !claims.bizId || !claims.staffId) {
        await signOut(auth);
        throw new Error('This account is not authorized as a delivery partner. Please use the email and password provided by your kitchen owner.');
      }
      if (!claims.branchId) {
        await signOut(auth);
        throw new Error('Your delivery account has no assigned branch. Please contact your kitchen owner.');
      }
      const profileSnap = await getDoc(doc(db, 'driver_profiles', userCredential.user.uid));
      if (profileSnap.exists() && profileSnap.data().active === false) {
        await signOut(auth);
        throw new Error('This delivery partner account has been deactivated. Please contact your kitchen owner.');
      }

      setPasswordInput('');
      setLoginModalOpen(false);
      showToast(`Welcome back, ${userCredential.user.displayName || 'Delivery Partner'}!`);
    } catch (error: any) {
      console.error('Delivery partner sign-in failed:', error);
      const errorCode = error?.code || '';
      const errorMessage = error?.message || '';
      if (errorCode === 'functions/resource-exhausted' || errorMessage.includes('locked')) {
        setLoginError(errorMessage);
      } else if (errorMessage.includes('not authorized') || errorMessage.includes('deactivated')) {
        setLoginError(errorMessage);
      } else if (
        errorCode === 'functions/unauthenticated' ||
        errorCode === 'auth/wrong-password' ||
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/user-not-found' ||
        errorMessage.includes('Invalid')
      ) {
        setLoginError('Invalid email or password. Please verify your credentials or contact your kitchen owner.');
      } else {
        setLoginError(`Sign in error: ${errorMessage || 'Unable to connect. Check your internet connection and try again.'}`);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDriverLogout = async () => {
    if (!window.confirm('Are you sure you want to log out of the Delivery Partner app?')) return;
    try {
      await signOut(auth);
      setPasswordInput('');
      setLoginError(null);
      showToast('Logged out successfully.');
    } catch (error) {
      console.error('Could not sign out:', error);
      showToast('Could not log out. Please try again.');
    }
  };

  if (authInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={28} className="animate-spin text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-slate-300">Verifying delivery account...</p>
        </div>
      </div>
    );
  }

  // If no authenticated driver claims are available, display the email/password login.
  if (!bizId || !selectedBoyId) {
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
            <p className="text-[11px] text-slate-400 mt-2">Forgot password? Ask your kitchen owner.</p>
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

          {routeError && (
            <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200">
              {routeError}
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
          {Boolean(currentBoy?.name || driverDisplayName) && (() => {
            const rawName = currentBoy?.name || driverDisplayName || 'Partner';
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
            {retryAction && (
              <button
                onClick={() => {
                  const retry = retryAction;
                  setRetryAction(null);
                  setToastMessage(null);
                  retry();
                }}
                className="px-2.5 py-1 bg-slate-950 text-white rounded-lg"
              >
                Retry
              </button>
            )}
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
                <p className="text-[10px] text-slate-500 mt-1">Forgot password? Ask your kitchen owner.</p>
              </div>
              {selectedBoyId && (
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
