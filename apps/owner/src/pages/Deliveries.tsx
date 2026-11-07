import React, { useState, useMemo, useEffect } from 'react';
import { 
  Truck, Package, MapPin, ChevronDown, ChevronUp, 
  Loader2, ArrowUp, ArrowDown, Phone,
  Sunrise, Sun, Moon, Star, CheckCircle2, UserX, 
  ArrowRight, MessageSquare, ClipboardList, ExternalLink, Users, LayoutGrid, ListChecks,
  Compass, Navigation, Sparkles, Zap, RotateCcw, Share2, Smartphone, Activity,
  Calendar, X
} from 'lucide-react';
import { useStreamCollection, updateItem, getTargetBusinessId } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { 
  calculateRemainingDeliveries, getTodayStr, getPlanDeliveryDayNumber, 
  getCustomerUncollectedBoxesCount, getCustomerScheduledPlansForSession, isPlanActiveOnDate,
  formatDateDDMMYYYY, getDefaultMealSessionForTime, MealSession, getPlanDietOnDate, DietType
} from '../services/store';
import { VegNonVegBadge, VegNonVegIcon } from '../components/VegNonVegIndicator';
import { writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { RouteOptimizerModal } from '../components/RouteOptimizerModal';
import { ReusableBoxTracker } from '../components/ReusableBoxTracker';
import { LiveFleetTracker } from '../components/LiveFleetTracker';
import { optimizeRouteOrder, formatWhatsAppOptimizedRoute } from '../services/routeOptimizer';

const StatCard = ({ title, value, icon: Icon, colorClass, subtext }: any) => (
  <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between hover:shadow-glass-hover transition-all min-h-[110px]">
    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-slate-900 mt-0.5">{value}</h3>
      </div>
      <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10 backdrop-blur-xs`}>
        <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
    <div className="mt-2">
      <p className="text-xs text-slate-400 font-medium truncate">{subtext}</p>
    </div>
  </div>
);

const Deliveries = () => {
  const { currentUser } = useAuth();
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: staff = [], loading: l2 } = useStreamCollection<any>('staff');
  const { data: plans = [], loading: l3 } = useStreamCollection<any>('plans');
  const { data: branches = [], loading: l4 } = useStreamCollection<any>('branches');
  const { data: deliveryLogs = [] } = useStreamCollection<any>('delivery_logs');

  const [mainTab, setMainTab] = useState<'routes' | 'boxes' | 'fleet'>('routes');
  const [activeMealTab, setActiveMealTab] = useState<MealSession>(() => getDefaultMealSessionForTime());
  const [isMealManuallySelected, setIsMealManuallySelected] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState('All');

  // Automatically select the correct meal session when time crosses 11:00 AM or 5:00 PM if user hasn't manually selected
  useEffect(() => {
    const checkMealTime = () => {
      if (!isMealManuallySelected) {
        const expectedSession = getDefaultMealSessionForTime();
        setActiveMealTab(prev => (prev !== expectedSession ? expectedSession : prev));
      }
    };
    checkMealTime();
    const interval = setInterval(checkMealTime, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [isMealManuallySelected]);


  const handleSelectMealTab = (tabId: MealSession) => {
    setIsMealManuallySelected(true);
    setActiveMealTab(tabId);
    setExpandedBoyId(null);
  };

  // Helper function to consistently match customer to delivery boy across all sections
  const doesCustomerBelongToBoy = (c: any, boy: any): boolean => {
    if (!c || !boy) return false;
    const bId = String(boy.id || '').trim();
    const bName = String(boy.name || '').trim().toLowerCase();
    const cBoyId = String(c.deliveryBoyId || '').trim();
    const cBoyName = String(c.deliveryBoyName || '').trim().toLowerCase();

    if (bId && (cBoyId === bId || cBoyId.toLowerCase() === bId.toLowerCase())) return true;
    if (bName && (cBoyName === bName || cBoyId.toLowerCase() === bName)) return true;
    return false;
  };

  // Auto-lock to single branch if manager or user has only 1 branch assigned
  useEffect(() => {
    if (branches.length === 1 && selectedBranch !== branches[0].id) {
      setSelectedBranch(branches[0].id);
    }
  }, [branches, selectedBranch]);
  const [expandedBoyId, setExpandedBoyId] = useState<string | null>(null);
  const [expandedMatrixBoyId, setExpandedMatrixBoyId] = useState<string | null>(null);
  const [optimizerModalData, setOptimizerModalData] = useState<{ boy: any; customers: any[]; branch: any } | null>(null);

  // DATE SELECTOR STATE (Default: Today's date)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [isOptimizingAll, setIsOptimizingAll] = useState(false);
  const [optimizeAllSuccess, setOptimizeAllSuccess] = useState<string | null>(null);

  const isLoading = l1 || l2 || l3 || l4;

  const todayStr = getTodayStr();
  const isSelectedToday = selectedDate === todayStr;

  // Derive Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat) from selectedDate
  const targetDayOfWeek = useMemo(() => {
    const parts = selectedDate.split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    }
    return new Date().getDay();
  }, [selectedDate]);

  const handleShiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${yStr}-${mStr}-${dStr}`);
  };

  // Map of selected date's delivery status by customer and mealTime
  const dateLogsMap = useMemo(() => {
    const map: Record<string, any> = {};
    deliveryLogs.forEach((l: any) => {
      if (l.date === selectedDate) {
        map[`${l.customerId}_${l.mealTime}`] = l;
      }
    });
    return map;
  }, [deliveryLogs, selectedDate]);

  // Overall uncollected boxes count across customers
  const totalUncollectedBoxes = useMemo(() => {
    return customers.reduce((sum, c) => sum + getCustomerUncollectedBoxesCount(c), 0);
  }, [customers]);

  // Online delivery boys count
  const onlineStaffCount = useMemo(() => {
    return staff.filter(s => s.status === 'Online' && s.lastAttendanceDate === selectedDate).length;
  }, [staff, selectedDate]);

  // --- GLOBAL KITCHEN LOAD (FOR SELECTED DATE) ---
  const globalDailySummary = useMemo(() => {
    const stats = { Breakfast: 0, Lunch: 0, Dinner: 0, GrandTotal: 0, vegTotal: 0, nonVegTotal: 0 };
    
    customers.filter(c => {
      if (selectedBranch !== 'All' && c.branchId !== selectedBranch) return false;
      return true;
    }).forEach(c => {
      ['Breakfast', 'Lunch', 'Dinner'].forEach((session: any) => {
        const scheduled = getCustomerScheduledPlansForSession(c, session, selectedDate, plans);
        scheduled.forEach((ap: any) => {
          const qty = Number(ap.quantity) || 1;
          const planConfig = plans.find((p: any) => p.id === ap.planId);
          const diet = getPlanDietOnDate(planConfig, selectedDate, ap);

          if (session === 'Breakfast') stats.Breakfast += qty;
          if (session === 'Lunch') stats.Lunch += qty;
          if (session === 'Dinner') stats.Dinner += qty;
          stats.GrandTotal += qty;

          if (diet === 'Non-Veg') {
            stats.nonVegTotal += qty;
          } else {
            stats.vegTotal += qty;
          }
        });
      });
    });

    return stats;
  }, [customers, plans, selectedBranch, selectedDate]);

  // --- DELIVERY BOY WISE WORKLOAD MATRIX FOR SELECTED DATE ---
  const deliveryBoyMatrix = useMemo(() => {
    const filteredStaff = staff.filter(s => selectedBranch === 'All' || s.branchId === selectedBranch);
    
    return filteredStaff.map(boy => {
      const boyWork: any = { 
        id: boy.id, 
        name: boy.name, 
        Breakfast: 0, 
        Lunch: 0, 
        Dinner: 0, 
        Total: 0,
        vegTotal: 0,
        nonVegTotal: 0,
        breakdown: {
          Breakfast: {} as Record<string, { count: number, isStarred: boolean, name: string, diet: DietType }>,
          Lunch: {} as Record<string, { count: number, isStarred: boolean, name: string, diet: DietType }>,
          Dinner: {} as Record<string, { count: number, isStarred: boolean, name: string, diet: DietType }>
        }
      };
      
      customers.filter(c => doesCustomerBelongToBoy(c, boy)).forEach(c => {
        ['Breakfast', 'Lunch', 'Dinner'].forEach((session: any) => {
          const scheduled = getCustomerScheduledPlansForSession(c, session, selectedDate, plans);
          scheduled.forEach((ap: any) => {
            const qty = Number(ap.quantity) || 1;
            const planConfig = plans.find((p: any) => p.id === ap.planId);
            const diet = getPlanDietOnDate(planConfig, selectedDate, ap);

            boyWork[session] += qty;
            boyWork.Total += qty;
            if (diet === 'Non-Veg') {
              boyWork.nonVegTotal += qty;
            } else {
              boyWork.vegTotal += qty;
            }

            const isStarred = Boolean(ap.isStarred || (c.highlightMark && c.highlightMark !== 'None'));
            const planKey = `${ap.planName}-${diet}-${isStarred}`;
            if (!boyWork.breakdown[session][planKey]) {
              boyWork.breakdown[session][planKey] = { count: 0, isStarred, name: ap.planName, diet };
            }
            boyWork.breakdown[session][planKey].count += qty;
          });
        });
      });
      
      return boyWork;
    }).sort((a, b) => b.Total - a.Total);
  }, [customers, plans, staff, selectedBranch, selectedDate]);

  // 1. Filter customers scheduled for SELECTED DATE and current Meal Session
  const deliveriesToday = useMemo(() => {
    return customers.filter(c => {
      if (selectedBranch !== 'All' && c.branchId !== selectedBranch) return false;
      const scheduled = getCustomerScheduledPlansForSession(c, activeMealTab, selectedDate, plans);
      return scheduled.length > 0;
    });
  }, [customers, plans, activeMealTab, selectedBranch, selectedDate]);

  // Session metrics for selected date
  const sessionMetrics = useMemo(() => {
    let totalBoxes = 0;
    let totalStarBoxes = 0;
    let vegBoxes = 0;
    let nonVegBoxes = 0;

    deliveriesToday.forEach(c => {
      const sessionPlans = getCustomerScheduledPlansForSession(c, activeMealTab, selectedDate, plans);
      sessionPlans.forEach((ap: any) => {
        const qty = Number(ap.quantity) || 1;
        totalBoxes += qty;
        const planConfig = plans.find((p: any) => p.id === ap.planId);
        const diet = getPlanDietOnDate(planConfig, selectedDate, ap);

        if (diet === 'Non-Veg') {
          nonVegBoxes += qty;
        } else {
          vegBoxes += qty;
        }

        if (ap.isStarred || (c.highlightMark && c.highlightMark !== 'None')) {
          totalStarBoxes += qty;
        }
      });
    });
    return { 
      customers: deliveriesToday.length, 
      plans: totalBoxes, 
      starPlans: totalStarBoxes,
      vegBoxes,
      nonVegBoxes
    };
  }, [deliveriesToday, activeMealTab, plans, selectedDate]);

  // Stable swap-based reordering for stops in active route
  const handleMoveOrder = async (boyId: string, customerId: string, direction: 'up' | 'down') => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz) return;

    const boyCustomers = deliveriesToday
      .filter(c => c.deliveryBoyId === boyId)
      .sort((a, b) => (a.routeOrder || 999) - (b.routeOrder || 999));

    const currentIndex = boyCustomers.findIndex(c => c.id === customerId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= boyCustomers.length) return;

    const reordered = [...boyCustomers];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const batch = writeBatch(db);
    reordered.forEach((c, idx) => {
      const custRef = doc(db, 'businesses', effectiveBiz, 'customers', c.id);
      batch.update(custRef, { routeOrder: idx + 1 });
    });
    await batch.commit();
  };

  const handleOpenOptimizer = (boy: any, boyCustomers: any[]) => {
    // Find boy's branch or fallback to selected branch or first branch
    const branch = branches.find((b: any) => b.id === boy.branchId) || 
                   branches.find((b: any) => b.id === selectedBranch) || 
                   branches[0] || { name: 'Main Kitchen Hub' };
    
    setOptimizerModalData({
      boy,
      customers: boyCustomers,
      branch
    });
  };

  const handleApplyOptimizedOrder = async (orderedCustomerIds: string[]) => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz || orderedCustomerIds.length === 0) return;
    const batch = writeBatch(db);
    orderedCustomerIds.forEach((id, index) => {
      const custRef = doc(db, 'businesses', effectiveBiz, 'customers', id);
      batch.update(custRef, { routeOrder: index + 1 });
    });
    await batch.commit();
  };

  // 1-Click Auto-Sort All Partner Routes to Shortest Order
  const handleOptimizeAllRoutes = async () => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz || deliveriesToday.length === 0) {
      setOptimizeAllSuccess("⚠️ No active deliveries scheduled for this date & session.");
      setTimeout(() => setOptimizeAllSuccess(null), 4000);
      return;
    }
    setIsOptimizingAll(true);
    setOptimizeAllSuccess(null);

    try {
      const batch = writeBatch(db);
      let updatedTotalStops = 0;
      const eligibleStaff = staff.filter(s => selectedBranch === 'All' || s.branchId === selectedBranch);

      eligibleStaff.forEach(boy => {
        const boyStops = deliveriesToday.filter(c => c.deliveryBoyId === boy.id);
        if (boyStops.length > 0) {
          const branch = branches.find((b: any) => b.id === boy.branchId) || 
                         branches.find((b: any) => b.id === selectedBranch) || 
                         branches[0] || { name: 'Main Kitchen Hub' };
          
          const hub = {
            name: branch.name || 'Kitchen Hub',
            address: branch.hubAddress || `${branch.name || 'Kitchen Hub'}, ${branch.city || ''}`,
            locationLink: branch.hubLocationLink || ''
          };

          const routeResult = optimizeRouteOrder(hub, boyStops);
          routeResult.orderedStops.forEach((stop, index) => {
            const custRef = doc(db, 'businesses', effectiveBiz, 'customers', stop.id);
            batch.update(custRef, { routeOrder: index + 1 });
            updatedTotalStops++;
          });
        }
      });

      if (updatedTotalStops > 0) {
        await batch.commit();
        setOptimizeAllSuccess(`✅ Sorted & saved ${updatedTotalStops} stops into shortest route sequence! Delivery apps updated.`);
        setTimeout(() => setOptimizeAllSuccess(null), 5000);
      } else {
        setOptimizeAllSuccess("ℹ️ No assigned deliveries found to optimize. Please assign delivery partners first.");
        setTimeout(() => setOptimizeAllSuccess(null), 4000);
      }
    } catch (err) {
      console.error("Error optimizing all routes:", err);
      setOptimizeAllSuccess("❌ Failed to auto-sort routes. Check database permissions.");
      setTimeout(() => setOptimizeAllSuccess(null), 4000);
    } finally {
      setIsOptimizingAll(false);
    }
  };

  const handleUpdateHubLocation = async (branchId: string, hubAddress: string, hubLocationLink: string) => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz || !branchId) return;
    await updateItem(effectiveBiz, 'branches', branchId, {
      hubAddress,
      hubLocationLink
    });
  };

  const handleShareRoute = (boy: any, boyCustomers: any[]) => {
    const branch = branches.find((b: any) => b.id === boy.branchId) || 
                   branches.find((b: any) => b.id === selectedBranch) || 
                   branches[0] || { name: 'Main Kitchen Hub' };
    
    const hub = {
      name: branch.name || 'Kitchen Hub',
      address: branch.hubAddress || `${branch.name || 'Kitchen Hub'}, ${branch.city || ''}`,
      locationLink: branch.hubLocationLink || ''
    };

    // Calculate shortest route metrics on the fly for WhatsApp using selectedDate
    const routeResult = optimizeRouteOrder(hub, boyCustomers);
    const whatsappMsg = formatWhatsAppOptimizedRoute(
      activeMealTab,
      selectedDate,
      boy,
      routeResult,
      plans
    );

    window.open(`https://wa.me/${(boy.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary-600" size={36} />
        <p className="text-xs font-medium text-slate-400">Loading delivery schedules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 pt-1 animate-in fade-in duration-300">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">Delivery Logistics & Routing</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">Real-time dispatches, shortest round-trip route solver, and workload management.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Branch selector */}
          <div className="w-full sm:w-56 relative">
            <select 
              className="w-full py-2.5 pl-4 pr-10 bg-white/85 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-glass outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 appearance-none cursor-pointer transition-all"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {branches.length > 1 && <option value="All">All Kitchen Branches</option>}
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
          </div>
        </div>
      </div>

      {/* 2. DATE SELECTOR & LOGISTICS CONTROL BAR */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-glass flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        
        {/* Left: Quick Date Stepper & Picker */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/70 shadow-inner">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronDown className="rotate-90" size={16} />
            </button>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <Calendar size={15} className="text-primary-600" />
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronDown className="-rotate-90" size={16} />
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setSelectedDate(getTodayStr())}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                isSelectedToday 
                  ? 'bg-primary-600 text-white shadow-xs' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Today
            </button>
            <span className="text-xs text-slate-600 font-semibold px-1 hidden sm:inline">
              {new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('en-US', { weekday: 'long' })}, {formatDateDDMMYYYY(selectedDate)}
            </span>
            {!isSelectedToday && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                selectedDate < todayStr ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {selectedDate < todayStr ? 'Past Date Record' : 'Future Scheduled Date'}
              </span>
            )}
          </div>
        </div>

        {/* Right: 1-Click Auto-Sort All Partner Routes Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOptimizeAllRoutes}
            disabled={isOptimizingAll || deliveriesToday.length === 0}
            className="flex-1 md:flex-none px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Sorts and re-orders customer sequence (#1, #2, #3...) for all delivery partners based on shortest round-trip path"
          >
            <Zap size={14} className="text-amber-300" />
            <span>{isOptimizingAll ? 'Optimizing Routes...' : '⚡ Auto-Sort All Routes (Shortest Path)'}</span>
          </button>
        </div>
      </div>

      {optimizeAllSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{optimizeAllSuccess}</span>
          <button onClick={() => setOptimizeAllSuccess(null)} className="p-1 hover:bg-emerald-100 rounded-lg cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setMainTab('routes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            mainTab === 'routes'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Truck size={15} />
          <span>Route Dispatch & Workload</span>
        </button>

        <button
          onClick={() => setMainTab('boxes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            mainTab === 'boxes'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Package size={15} />
          <span>Customer Box Inventory</span>
          {totalUncollectedBoxes > 0 && (
            <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
              mainTab === 'boxes' ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-800'
            }`}>
              {totalUncollectedBoxes} uncollected
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('fleet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            mainTab === 'fleet'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Activity size={15} />
          <span>Live Rider Fleet & GPS Tracker</span>
          {onlineStaffCount > 0 && (
            <span className={`flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
              mainTab === 'fleet' ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              {onlineStaffCount} Online
            </span>
          )}
        </button>
      </div>

      {/* TAB 2: REUSABLE BOX INVENTORY & CUSTOMER TRACKER */}
      {mainTab === 'boxes' && (
        <ReusableBoxTracker 
          customers={customers} 
          currentUser={currentUser} 
          todayStr={selectedDate} 
        />
      )}

      {/* TAB 3: LIVE FLEET & GPS TRACKER */}
      {mainTab === 'fleet' && (
        <LiveFleetTracker 
          staff={staff} 
          customers={customers} 
          deliveryLogs={deliveryLogs} 
          plans={plans}
          branches={branches}
          selectedBranch={selectedBranch}
          activeMealTab={activeMealTab}
          todayStr={selectedDate} 
        />
      )}

      {/* TAB 1: EXISTING ROUTE DISPATCH & WORKLOAD */}
      {mainTab === 'routes' && (
        <div className="space-y-8 animate-in fade-in duration-200">

      {/* 2. GLOBAL KITCHEN LOAD (TODAY) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <LayoutGrid size={16} className="text-primary-600" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Kitchen Production Load</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard 
            title="Total Meal Boxes" 
            value={globalDailySummary.GrandTotal} 
            icon={Package} 
            colorClass="bg-slate-900" 
            subtext={globalDailySummary.GrandTotal > 0 ? `Veg ${globalDailySummary.vegTotal} • N-veg ${globalDailySummary.nonVegTotal}` : 'Combined daily total'} 
          />
          <StatCard title="Breakfast Boxes" value={globalDailySummary.Breakfast} icon={Sunrise} colorClass="bg-orange-500" subtext="Morning slot" />
          <StatCard title="Lunch Boxes" value={globalDailySummary.Lunch} icon={Sun} colorClass="bg-blue-600" subtext="Afternoon slot" />
          <StatCard title="Dinner Boxes" value={globalDailySummary.Dinner} icon={Moon} colorClass="bg-purple-600" subtext="Evening slot" />
        </div>
      </div>

      {/* 3. DELIVERY BOY WORKLOAD MATRIX */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ListChecks size={16} className="text-primary-600" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Partner Workload Distribution</h2>
        </div>
        <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-slate-50/70 backdrop-blur-sm text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                <tr>
                  <th className="py-3.5 px-6">Delivery Partner</th>
                  <th className="py-3.5 px-4 text-center text-orange-700 bg-orange-50/30">Breakfast</th>
                  <th className="py-3.5 px-4 text-center text-blue-700 bg-blue-50/30">Lunch</th>
                  <th className="py-3.5 px-4 text-center text-purple-700 bg-purple-50/30">Dinner</th>
                  <th className="py-3.5 px-6 text-right">Daily Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {deliveryBoyMatrix.map(boy => (
                  <React.Fragment key={boy.id}>
                    <tr 
                      className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${expandedMatrixBoyId === boy.id ? 'bg-slate-50/90' : ''}`}
                      onClick={() => setExpandedMatrixBoyId(expandedMatrixBoyId === boy.id ? null : boy.id)}
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${expandedMatrixBoyId === boy.id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-primary-600 group-hover:text-white'}`}>
                            <Truck size={15} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 text-sm">{boy.name}</span>
                            <span className="text-[10px] text-slate-400">Click to view meal plan breakdown</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 bg-orange-50/10">{boy.Breakfast}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 bg-blue-50/10">{boy.Lunch}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 bg-purple-50/10">{boy.Dinner}</td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="text-right">
                            <span className="inline-block bg-slate-900 text-white px-2.5 py-0.5 rounded-full text-xs font-bold min-w-[32px] text-center shadow-xs">
                              {boy.Total}
                            </span>
                            <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-emerald-700">V:{boy.vegTotal}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-rose-700">NV:{boy.nonVegTotal}</span>
                            </div>
                          </div>
                          {expandedMatrixBoyId === boy.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </div>
                      </td>
                    </tr>
                    {expandedMatrixBoyId === boy.id && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={5} className="p-5 pl-12">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-in slide-in-from-top-1 duration-200">
                            {/* Breakfast Details */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-orange-100 pb-1.5">
                                <Sunrise size={13} /> Breakfast ({boy.Breakfast})
                              </h4>
                              <div className="space-y-1.5">
                                {Object.values(boy.breakdown.Breakfast).length > 0 ? Object.values(boy.breakdown.Breakfast).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white/90 p-2 rounded-xl border border-slate-100 shadow-xs">
                                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                                      <VegNonVegIcon diet={p.diet} size={11} />
                                      <span>{p.name}</span> 
                                      {p.isStarred && <Star size={11} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{p.count}</span>
                                  </div>
                                )) : <p className="text-xs italic text-slate-400">No breakfast drops assigned</p>}
                              </div>
                            </div>
                            {/* Lunch Details */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-blue-100 pb-1.5">
                                <Sun size={13} /> Lunch ({boy.Lunch})
                              </h4>
                              <div className="space-y-1.5">
                                {Object.values(boy.breakdown.Lunch).length > 0 ? Object.values(boy.breakdown.Lunch).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white/90 p-2 rounded-xl border border-slate-100 shadow-xs">
                                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                                      <VegNonVegIcon diet={p.diet} size={11} />
                                      <span>{p.name}</span> 
                                      {p.isStarred && <Star size={11} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{p.count}</span>
                                  </div>
                                )) : <p className="text-xs italic text-slate-400">No lunch drops assigned</p>}
                              </div>
                            </div>
                            {/* Dinner Details */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-100 pb-1.5">
                                <Moon size={13} /> Dinner ({boy.Dinner})
                              </h4>
                              <div className="space-y-1.5">
                                {Object.values(boy.breakdown.Dinner).length > 0 ? Object.values(boy.breakdown.Dinner).map((p: any, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-white/90 p-2 rounded-xl border border-slate-100 shadow-xs">
                                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                                      <VegNonVegIcon diet={p.diet} size={11} />
                                      <span>{p.name}</span> 
                                      {p.isStarred && <Star size={11} className="text-amber-500" fill="currentColor" />}
                                    </span>
                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{p.count}</span>
                                  </div>
                                )) : <p className="text-xs italic text-slate-400">No dinner drops assigned</p>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {deliveryBoyMatrix.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium text-xs">No delivery personnel found for selected branch.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Active Route Details */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">Active Route Management</h2>
            <p className="text-slate-500 text-xs mt-0.5">Dispatches and route sequences for <strong className="text-slate-800 font-semibold">{activeMealTab}</strong></p>
          </div>
          <div className="glass-panel p-1.5 rounded-2xl flex gap-2 w-full md:w-fit shadow-xs bg-slate-100/80 border border-slate-200/80">
            {[
              { 
                id: 'Breakfast', 
                icon: Sunrise, 
                selectedClasses: 'bg-orange-600 text-white shadow-md ring-2 ring-orange-500/50 border-orange-700',
                unselectedClasses: 'bg-orange-50/70 hover:bg-orange-100/80 text-orange-950 border-orange-200/70',
                selectedIcon: 'text-white',
                unselectedIcon: 'text-orange-600'
              },
              { 
                id: 'Lunch', 
                icon: Sun, 
                selectedClasses: 'bg-blue-600 text-white shadow-md ring-2 ring-blue-500/50 border-blue-700',
                unselectedClasses: 'bg-blue-50/70 hover:bg-blue-100/80 text-blue-950 border-blue-200/70',
                selectedIcon: 'text-white',
                unselectedIcon: 'text-blue-600'
              },
              { 
                id: 'Dinner', 
                icon: Moon, 
                selectedClasses: 'bg-purple-700 text-white shadow-md ring-2 ring-purple-600/50 border-purple-800',
                unselectedClasses: 'bg-purple-50/70 hover:bg-purple-100/80 text-purple-950 border-purple-200/70',
                selectedIcon: 'text-white',
                unselectedIcon: 'text-purple-600'
              }
            ].map(tab => {
              const isSelected = activeMealTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectMealTab(tab.id as any)}
                  aria-pressed={isSelected}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer active:scale-95 ${
                    isSelected ? tab.selectedClasses : tab.unselectedClasses
                  }`}
                >
                  <tab.icon size={16} className={isSelected ? tab.selectedIcon : tab.unselectedIcon} />
                  <span>{tab.id}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Existing Session Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <StatCard title={`${activeMealTab} Customers`} value={sessionMetrics.customers} icon={Users} colorClass="bg-blue-600" subtext="Unique session stops" />
          <StatCard 
            title={`${activeMealTab} Tiffin Boxes`} 
            value={sessionMetrics.plans} 
            icon={Package} 
            colorClass="bg-primary-600" 
            subtext={sessionMetrics.plans > 0 ? `Veg ${sessionMetrics.vegBoxes} • N-veg ${sessionMetrics.nonVegBoxes}` : 'Dispatched boxes'} 
          />
          <StatCard title={`${activeMealTab} Special Requirements`} value={sessionMetrics.starPlans} icon={Star} colorClass="bg-amber-600" subtext="Custom instructions" />
        </div>

        {/* Staff Route List */}
        <div className="space-y-4">
          {deliveriesToday.filter(c => !c.deliveryBoyId).length > 0 && (
            <div className="bg-rose-50/70 backdrop-blur-sm border border-rose-200/80 rounded-2xl p-5 mb-4 shadow-glass">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                  <UserX size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Unassigned Customers ({deliveriesToday.filter(c => !c.deliveryBoyId).length})</h3>
                  <p className="text-[11px] text-rose-600">Assign a delivery partner to include these customers in optimized routes.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                 {deliveriesToday.filter(c => !c.deliveryBoyId).map(c => (
                   <div key={c.id} className="bg-white/90 p-3 rounded-xl border border-rose-100 shadow-xs flex justify-between items-center group">
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{c.area || 'No area set'}</p>
                      </div>
                      <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 transition-colors">
                        <ArrowRight size={13} />
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {staff.filter(s => selectedBranch === 'All' || s.branchId === selectedBranch).map(boy => {
            const boyCustomers = deliveriesToday.filter(c => doesCustomerBelongToBoy(c, boy));
            const hasDeliveries = boyCustomers.length > 0;
            const isExpanded = expandedBoyId === boy.id;
            let boyTotalBoxes = 0;
            let boyStarBoxes = 0;
            let boyVegBoxes = 0;
            let boyNonVegBoxes = 0;
            boyCustomers.forEach(c => {
              const cPlans = getCustomerScheduledPlansForSession(c, activeMealTab, selectedDate, plans);
              cPlans.forEach((p: any) => {
                const qty = Number(p.quantity) || 1;
                boyTotalBoxes += qty;
                const pConfig = plans.find((pc: any) => pc.id === p.planId);
                const diet = getPlanDietOnDate(pConfig, selectedDate, p);
                if (diet === 'Non-Veg') boyNonVegBoxes += qty; else boyVegBoxes += qty;
                if (p.isStarred || (c.highlightMark && c.highlightMark !== 'None')) {
                  boyStarBoxes += qty;
                }
              });
            });

            return (
              <div key={boy.id} className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden transition-all">
                <div onClick={() => setExpandedBoyId(isExpanded ? null : boy.id)} className={`p-4 sm:p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center cursor-pointer gap-4 ${isExpanded ? 'bg-slate-50/80 border-b border-slate-200/60' : 'hover:bg-slate-50/50'}`}>
                  <div className="flex items-center gap-3.5 w-full xl:w-auto">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                      hasDeliveries 
                        ? 'bg-primary-50 text-primary-600 border-primary-100' 
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <Truck size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold font-display text-slate-900 tracking-tight">{boy.name}</h3>
                        {!hasDeliveries && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Available / Standby
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5"><Phone size={13}/> {boy.mobile || 'No contact'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full xl:w-auto flex-1 md:flex-none">
                    <div className="bg-white/80 border border-slate-100/90 py-1.5 px-3 rounded-xl text-center shadow-xs">
                      <p className="text-[10px] font-medium text-slate-400">Stops</p>
                      <p className={`font-bold text-sm ${hasDeliveries ? 'text-slate-800' : 'text-slate-400'}`}>{boyCustomers.length}</p>
                    </div>
                    <div className="bg-white/80 border border-slate-100/90 py-1.5 px-3 rounded-xl text-center shadow-xs">
                      <p className="text-[10px] font-medium text-slate-400">Boxes</p>
                      <p className={`font-bold text-sm ${hasDeliveries ? 'text-primary-600' : 'text-slate-400'}`}>{boyTotalBoxes}</p>
                      {hasDeliveries && (
                        <p className="text-[9px] font-bold text-slate-500 mt-0.5 flex items-center justify-center gap-1">
                          <span className="text-emerald-700">V:{boyVegBoxes}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-rose-700">NV:{boyNonVegBoxes}</span>
                        </p>
                      )}
                    </div>
                    <div className="bg-white/80 border border-slate-100/90 py-1.5 px-3 rounded-xl text-center shadow-xs">
                      <p className="text-[10px] font-medium text-slate-400">Regular</p>
                      <p className={`font-bold text-sm ${hasDeliveries ? 'text-slate-600' : 'text-slate-400'}`}>{boyTotalBoxes - boyStarBoxes}</p>
                    </div>
                    <div className="bg-white/80 border border-slate-100/90 py-1.5 px-3 rounded-xl text-center shadow-xs">
                      <p className="text-[10px] font-medium text-amber-600">Starred</p>
                      <p className={`font-bold text-sm ${boyStarBoxes > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{boyStarBoxes}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap xl:flex-nowrap items-center gap-2 w-full xl:w-auto justify-end">
                    {hasDeliveries && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenOptimizer(boy, boyCustomers); }} 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                      >
                        <Compass size={14} /> <span>Shortest Route</span>
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleShareRoute(boy, boyCustomers); }} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <MessageSquare size={14} fill="currentColor" /> <span>WhatsApp</span>
                    </button>
                    <div className={`p-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${isExpanded ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-400 bg-white'}`}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="animate-in slide-in-from-top-1 duration-200">
                    {!hasDeliveries ? (
                      <div className="p-6 text-center text-slate-400 bg-slate-50/50">
                        <Truck size={28} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">No {activeMealTab} stops currently assigned to {boy.name}.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Assign customers to this delivery partner in Customers page or dispatch standby routes.</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-50/70 border-b border-slate-200/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                              <Compass size={12} />
                            </div>
                            <span className="font-semibold text-slate-700">Hub ➔ Delivery Sequence ➔ Hub:</span>
                            <span className="text-slate-500 hidden md:inline">Calculates shortest round-trip sequence to save travel time.</span>
                          </div>
                          <button 
                            onClick={() => handleOpenOptimizer(boy, boyCustomers)}
                            className="w-full sm:w-auto px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs shrink-0 active:scale-95 transition-all"
                          >
                            <Zap size={12} className="text-amber-400" /> Optimize Sequence
                          </button>
                        </div>

                    {/* MOBILE CARD VIEW: Visible on small screens (< 768px) */}
                    <div className="block md:hidden p-3 space-y-3 bg-slate-50/50 divide-y divide-slate-200/70">
                      {boyCustomers.sort((a, b) => (a.routeOrder || 999) - (b.routeOrder || 999)).map((c, idx) => {
                        const sessionPlans = getCustomerScheduledPlansForSession(c, activeMealTab, selectedDate, plans);
                        const overallStarred = sessionPlans.some((p: any) => p.isStarred) || (c.highlightMark && c.highlightMark !== 'None');
                        const logKey = `${c.id}_${activeMealTab}`;
                        const logRecord = dateLogsMap[logKey];
                        const isDelivered = logRecord?.status === 'Delivered';
                        const boxCondition = logRecord?.boxStatus;
                        const mapsUrl = c.locationLink && (c.locationLink.startsWith('http://') || c.locationLink.startsWith('https://'))
                          ? c.locationLink
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((c.address || '') + (c.area ? `, ${c.area}` : ''))}`;

                        return (
                          <div key={c.id} className={`pt-3 first:pt-0 ${overallStarred ? 'bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/60' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1">
                                    {c.name}
                                    {overallStarred && <Star size={11} className="text-amber-500" fill="currentColor" />}
                                  </h4>
                                  <p className="text-[11px] text-slate-500 font-mono">{c.mobile}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button onClick={() => handleMoveOrder(boy.id, c.id, 'up')} className="p-1 hover:bg-slate-200 rounded text-slate-600" title="Move Up"><ArrowUp size={13}/></button>
                                <button onClick={() => handleMoveOrder(boy.id, c.id, 'down')} className="p-1 hover:bg-slate-200 rounded text-slate-600" title="Move Down"><ArrowDown size={13}/></button>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-700 mt-1.5 leading-tight">
                              <span className="font-semibold text-slate-800">{c.area}</span>: {c.address}
                            </p>

                            {/* Meal Plans with Veg/Non-Veg tags */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {sessionPlans.map((sp: any, spIdx: number) => {
                                const pConfig = plans.find((pc: any) => pc.id === sp.planId);
                                const diet = getPlanDietOnDate(pConfig, selectedDate, sp);
                                return (
                                  <div key={spIdx} className="inline-flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs text-[11px] font-bold text-slate-800">
                                    <VegNonVegIcon diet={diet} size={11} />
                                    <span>{Number(sp.quantity) || 1}x {sp.planName}</span>
                                    <span className={`text-[9px] font-black px-1 rounded ${diet === 'Non-Veg' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{diet}</span>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-1.5">
                                {isDelivered ? (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                                    <CheckCircle2 size={11} className="text-emerald-600" /> Delivered
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                    Pending
                                  </span>
                                )}
                                {boxCondition && boxCondition !== 'None' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    🍱 {boxCondition}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <a 
                                  href={`tel:${c.mobile}`} 
                                  className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs" 
                                  title="Call"
                                >
                                  <Phone size={13} />
                                </a>
                                <a 
                                  href={`https://wa.me/${(c.mobile || '').replace(/\D/g, '')}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs" 
                                  title="WhatsApp"
                                >
                                  <MessageSquare size={13} />
                                </a>
                                <a 
                                  href={mapsUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="px-2 py-1 bg-primary-50 text-primary-700 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                                >
                                  <Navigation size={11} /> Maps
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* DESKTOP TABLE VIEW: Visible on screens >= 768px */}
                    <div className="hidden md:block overflow-x-auto no-scrollbar">
                      <table className="w-full text-left border-collapse min-w-[1050px] text-xs">
                        <thead className="bg-slate-50/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200/60">
                          <tr>
                            <th className="py-3 px-4 w-12 text-center">Stop</th>
                            <th className="py-3 px-3 w-16 text-center">Reorder</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Contact</th>
                            <th className="py-3 px-4 min-w-[200px]">Meal Plans</th>
                            <th className="py-3 px-3 text-center">Priority</th>
                            <th className="py-3 px-3 text-center">Live Status</th>
                            <th className="py-3 px-4">Delivery Area / Address</th>
                            <th className="py-3 px-3 text-center">Remaining</th>
                            <th className="py-3 px-3 text-center">Maps</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {boyCustomers.sort((a, b) => (a.routeOrder || 999) - (b.routeOrder || 999)).map((c, idx) => {
                              const sessionPlans = getCustomerScheduledPlansForSession(c, activeMealTab, selectedDate, plans);
                              const groupedPlans = sessionPlans.reduce((acc: any, p: any) => {
                                 const pConfig = plans.find((pc: any) => pc.id === p.planId);
                                 const diet = getPlanDietOnDate(pConfig, selectedDate, p);
                                 const key = `${p.planName}-${diet}`;
                                 acc[key] = acc[key] || { 
                                   name: p.planName, 
                                   diet, 
                                   count: 0, 
                                   isStarred: p.isStarred, 
                                   pConfig, 
                                   endDate: p.endDate, 
                                   pauses: p.pauses 
                                 };
                                 acc[key].count += (Number(p.quantity) || 1);
                                 if (p.isStarred) acc[key].isStarred = true;
                                 return acc;
                              }, {});
                              const overallStarred = sessionPlans.some((p: any) => p.isStarred) || (c.highlightMark && c.highlightMark !== 'None');

                              const logKey = `${c.id}_${activeMealTab}`;
                              const logRecord = dateLogsMap[logKey];
                              const isDelivered = logRecord?.status === 'Delivered';
                              const boxCondition = logRecord?.boxStatus;

                              return (
                                <tr key={c.id} className={`hover:bg-slate-50/70 transition-colors ${overallStarred ? 'bg-amber-50/30' : ''}`}>
                                  <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <button onClick={() => handleMoveOrder(boy.id, c.id, 'up')} className="p-1 hover:bg-slate-200/70 rounded text-slate-500" title="Move Up"><ArrowUp size={13}/></button>
                                      <button onClick={() => handleMoveOrder(boy.id, c.id, 'down')} className="p-1 hover:bg-slate-200/70 rounded text-slate-500" title="Move Down"><ArrowDown size={13}/></button>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{c.name}</span>
                                      {overallStarred && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{c.mobile}</td>
                                  <td className="py-3 px-4">
                                    <div className="space-y-1">
                                      {Object.values(groupedPlans).map((gp: any, i) => (
                                        <div key={i} className="flex items-center justify-between gap-3 bg-white/90 border border-slate-100 py-1 px-2 rounded-lg shadow-xs">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <VegNonVegIcon diet={gp.diet} size={11} />
                                            <span className="text-[11px] font-medium text-slate-700 truncate max-w-[120px]">{gp.name}</span>
                                            <span className={`text-[9px] font-black px-1 rounded ${gp.diet === 'Non-Veg' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{gp.diet}</span>
                                            {gp.isStarred && <Star size={10} className="text-amber-500" fill="currentColor" />}
                                          </div>
                                          <span className="bg-slate-900 text-white text-[10px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0">{gp.count}</span>
                                        </div>
                                      ))}
                                      {sessionPlans.filter((p: any) => p.reusableBoxType && p.reusableBoxType !== 'None').map((rp: any, rIdx: number) => {
                                        const dayNum = getPlanDeliveryDayNumber(rp, todayStr);
                                        const isSecondDayOrMore = dayNum >= 2;
                                        return (
                                          <div 
                                            key={`box-${rIdx}`} 
                                            className={`text-[10px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 border shadow-xs ${
                                              isSecondDayOrMore 
                                                ? 'bg-teal-50 border-teal-200 text-teal-800' 
                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                            }`}
                                          >
                                            <RotateCcw size={10} className={isSecondDayOrMore ? 'text-teal-600 animate-spin-slow' : 'text-slate-400'} />
                                            <span>
                                              {isSecondDayOrMore 
                                                ? `🔄 Recollect: Yesterday's ${rp.reusableBoxType}${rp.boxTagOrNumber ? ` (#${rp.boxTagOrNumber})` : ''}`
                                                : `📦 Day 1: New ${rp.reusableBoxType} (recollect starts tomorrow)`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    {overallStarred ? <Star size={15} className="text-amber-500 mx-auto" fill="currentColor" /> : <span className="text-slate-300">—</span>}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      {isDelivered ? (
                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1 shadow-xs">
                                          <CheckCircle2 size={11} className="text-emerald-600" />
                                          Delivered
                                        </span>
                                      ) : (
                                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-medium text-[10px]">
                                          Pending
                                        </span>
                                      )}
                                      {boxCondition && boxCondition !== 'None' && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shadow-xs ${
                                          boxCondition === 'Collected' || boxCondition === 'Collected Clean'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-amber-50 text-amber-800 border-amber-200'
                                        }`}>
                                          🍱 {boxCondition}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div>
                                      <p className="text-[11px] font-semibold text-slate-700 truncate">{c.area || 'Area not specified'}</p>
                                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{c.address}</p>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="space-y-1">
                                      {Object.values(groupedPlans).map((gp: any, i) => (
                                        <div key={i} className="text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded py-0.5 px-1.5">
                                          {calculateRemainingDeliveries(gp.endDate, gp.pConfig?.weekdays || [], gp.pauses || [])} left
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    {c.locationLink ? (
                                      <a href={c.locationLink.startsWith('http') ? c.locationLink : `https://${c.locationLink}`} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors inline-flex" title="Open Map Location">
                                        <ExternalLink size={14} />
                                      </a>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {deliveriesToday.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center text-center glass-card rounded-2xl border border-white/80 shadow-glass">
            <div className="w-16 h-16 bg-slate-100/70 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
              <Truck size={30} />
            </div>
            <h3 className="text-lg font-bold font-display text-slate-800">No Deliveries Scheduled</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-xs">There are no active subscription plans scheduled for the {activeMealTab} session today.</p>
          </div>
        )}
      </div>
    </div>
  )}

      {/* Route Optimizer Modal */}
      {optimizerModalData && (
        <RouteOptimizerModal 
          isOpen={Boolean(optimizerModalData)}
          onClose={() => setOptimizerModalData(null)}
          deliveryBoy={optimizerModalData.boy}
          customersToday={optimizerModalData.customers}
          mealTime={activeMealTab}
          branch={optimizerModalData.branch}
          dateStr={selectedDate}
          onApplyNewOrder={handleApplyOptimizedOrder}
          onUpdateHubLocation={handleUpdateHubLocation}
        />
      )}

    </div>
  );
};

export default Deliveries;