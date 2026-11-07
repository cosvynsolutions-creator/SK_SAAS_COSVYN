
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  RefreshCw, Plus, Store, Search, Calendar, X, 
  Loader2, Edit, Trash2, Pause, Phone, ChevronDown, ChevronRight, MessageSquare, Receipt, Clock, CheckCircle, Info, CalendarDays, Share2, Calculator, Check, Star, AlertTriangle, Filter, Users2, MapPin, RotateCcw, Download, Package, UserCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  useStreamCollection, 
  addItem, 
  updateItem, 
  deleteItem, 
  getTargetBusinessId,
  addCustomerWithPaymentAtomic,
  deleteCustomerAtomic,
  pauseBranchAtomic
} from '../services/dbService';
import { 
  calculateEndDate, calculateRemainingDeliveries, shiftDateStr, isPlanActiveOnDate,
  GlobalCustomer, PauseEvent, SubscribedPlan, getTodayStr,
  REUSABLE_BOX_TYPES, getCustomerBoxHealth, getPlanDeliveryDayNumber, formatDateDDMMYYYY,
  getCustomerActiveDaysLeft, getPlanDietOnDate, getPlanDietSummaryLabel
} from '../services/store';
import { VegNonVegIcon, VegNonVegBadge } from '../components/VegNonVegIndicator';
import { doc, collection, query, where, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  getSubscriptionSummaryMessage, 
  getCustomerPlanStatusMessage, 
  buildWhatsAppUrl 
} from '../services/messageTemplates';

const StatCard = ({ title, value, textColor = "text-slate-900", icon: Icon }: any) => (
  <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between min-h-[110px] hover:shadow-glass-hover transition-all">
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      {Icon && <Icon size={16} className="text-slate-400" />}
    </div>
    <h3 className={`text-2xl sm:text-3xl font-bold font-display tracking-tight ${textColor} truncate mt-1`}>
      {value}
    </h3>
  </div>
);

const BigActionBtn = ({ icon: Icon, label, colorClass, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`${colorClass} text-white rounded-2xl flex flex-col items-center justify-center gap-2 p-3.5 transition-all duration-200 active:scale-95 shadow-glass hover:shadow-glass-hover min-h-[110px] w-full border border-white/20 backdrop-blur-md`}
  >
    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
      <Icon size={18} />
    </div>
    <span className="font-semibold text-xs tracking-tight">{label}</span>
  </button>
);

const Customers = () => {
  const { currentUser } = useAuth();
  const { data: customers = [], loading: l1 } = useStreamCollection<GlobalCustomer>('customers');
  const { data: branches = [], loading: l2 } = useStreamCollection<any>('branches');
  const { data: plans = [], loading: l3 } = useStreamCollection<any>('plans');
  const { data: staff = [], loading: l4 } = useStreamCollection<any>('staff');
  const { data: dbBoxTypes = [] } = useStreamCollection<any>('box_types');
  const { data: deliveryLogs = [] } = useStreamCollection<any>('delivery_logs');

  const isLoading = l1 || l2 || l3 || l4;
  const [businessName, setBusinessName] = useState<string>('Your Kitchen');
  const effectiveBizId = getTargetBusinessId(currentUser?.uid);

  useEffect(() => {
    if (!effectiveBizId) return;
    const unsub = onSnapshot(doc(db, 'businesses', effectiveBizId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.businessName) setBusinessName(d.businessName);
      }
    });
    return () => unsub();
  }, [effectiveBizId]);

  // Make the customer roster view responsive and occupy the full screen width without white borders
  useEffect(() => {
    const parentContainer = document.querySelector('main > div.max-w-7xl');
    if (parentContainer) {
      parentContainer.classList.remove('max-w-7xl');
      parentContainer.classList.add('w-full', 'max-w-none');
      return () => {
        parentContainer.classList.add('max-w-7xl');
        parentContainer.classList.remove('w-full', 'max-w-none');
      };
    }
  }, []);

  // Combine standard and custom box types from settings
  const availableBoxTypes = useMemo(() => {
    const map = new Map<string, any>();
    REUSABLE_BOX_TYPES.forEach(b => map.set(b.id, b));
    dbBoxTypes.forEach((b: any) => {
      map.set(b.id || b.name, {
        id: b.id || b.name,
        name: b.name,
        shortLabel: b.shortLabel || b.name,
        defaultDeposit: b.defaultDeposit || 0
      });
    });
    return Array.from(map.values());
  }, [dbBoxTypes]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isPauseBranchModalOpen, setIsPauseBranchModalOpen] = useState(false);
  
  const [activeCustomer, setActiveCustomer] = useState<GlobalCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Advanced Filters State
  const [filters, setFilters] = useState({ 
    name: '', 
    mobile: '', 
    area: '', 
    branchId: 'All', 
    paymentStatus: 'All', 
    timings: [] as string[],
    deliveryBoyId: 'All',
    starred: 'All' 
  });
  const [deliveryBoySort, setDeliveryBoySort] = useState<'none' | 'asc' | 'desc'>('none');

  const toggleDeliveryBoySort = () => {
    setDeliveryBoySort(prev => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'));
  };

  // Auto-lock branch filter to single branch (e.g. for branch manager)
  useEffect(() => {
    if (branches.length === 1 && filters.branchId !== branches[0].id) {
      setFilters(prev => ({ ...prev, branchId: branches[0].id }));
    }
  }, [branches, filters.branchId]);

  // REAL-TIME DATA ENRICHMENT: Calculate daysLeft dynamically based on canonical getCustomerActiveDaysLeft
  const enrichedCustomers = useMemo(() => {
    return customers.map(c => {
      const status = getCustomerActiveDaysLeft(c, plans);
      return { 
        ...c, 
        realDaysLeft: status.daysLeft,
        isExpired: status.isExpired,
        latestEndDate: status.endDate,
        canonicalPlanName: status.activePlanName
      };
    });
  }, [customers, plans]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const handleSaveCustomer = async (data: any) => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz) {
      alert("No active business profile found. Please log in again.");
      throw new Error("No active business profile found.");
    }
    try {
      if (activeCustomer) {
        await updateItem(effectiveBiz, 'customers', activeCustomer.id, data);
      } else {
        await addCustomerWithPaymentAtomic(effectiveBiz, data, Number(data.amountPaid) || 0);
      }
      setIsAddModalOpen(false);
      setActiveCustomer(null);
      setIsRenewal(false);
    } catch (err: any) {
      console.error("Failed to save customer:", err);
      alert("Failed to save customer in database: " + (err.message || "Please check network and try again."));
      throw err;
    }
  };

  const handleDeleteCustomer = (id: string) => {
    if (!id) return;
    setCustomerToDelete(id);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz) {
      alert("No active business profile found. Please log in again.");
      return;
    }
    setIsDeletingCustomer(true);
    try {
      await deleteCustomerAtomic(effectiveBiz, customerToDelete);
      setCustomerToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete customer:", err);
      alert("Failed to delete customer from database: " + (err.message || "Unknown error"));
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const handlePausePlans = async (customerId: string, selectedPlanIndices: number[], pauseEvent: PauseEvent) => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz) return;
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;

    try {
      const currentPlans = cust.activePlans || [];
      const updatedPlans = currentPlans.map((p, idx) => {
        if (selectedPlanIndices.includes(idx)) {
          const planConfig = plans.find(pc => pc.id === p.planId);
          const weekdays = planConfig?.weekdays || p.weekdays || [1,2,3,4,5,6];
          const newPauses = [...(p.pauses || []), pauseEvent];
          const newEndDate = calculateEndDate(p.startDate, planConfig?.numberOfDeliveryDays || p.totalDeliveries || 26, weekdays, newPauses);
          return { ...p, pauses: newPauses, endDate: newEndDate };
        }
        return p;
      });

      const maxEndDate = updatedPlans.reduce((max, p) => p.endDate > max ? p.endDate : max, updatedPlans[0].endDate);
      const maxDaysLeft = updatedPlans.reduce((max, p) => {
        const planConfig = plans.find(pc => pc.id === p.planId);
        const left = calculateRemainingDeliveries(p.endDate, planConfig?.weekdays || p.weekdays || [1,2,3,4,5,6], p.pauses || []);
        return left > max ? left : max;
      }, 0);

      await updateItem(effectiveBiz, 'customers', customerId, { 
        activePlans: updatedPlans, 
        endDate: maxEndDate,
        daysLeft: maxDaysLeft
      });
      setIsPauseModalOpen(false);
    } catch (err: any) {
      console.error("Failed to pause subscription in database:", err);
      alert("Failed to save pause changes: " + (err.message || "Unknown error"));
    }
  };

  const handlePauseBranch = async (branchId: string, timings: string[], pauseEvent: PauseEvent) => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz) return;
    
    const affectedCustomers = customers.filter(c => c.branchId === branchId);
    const updates: Array<{ id: string; activePlans: any[]; endDate: string; daysLeft: number }> = [];

    for (const cust of affectedCustomers) {
      const currentPlans = cust.activePlans || [];
      let hasChange = false;

      const updatedPlans = currentPlans.map(p => {
        if (timings.includes(p.mealTime)) {
          hasChange = true;
          const planConfig = plans.find(pc => pc.id === p.planId);
          const weekdays = planConfig?.weekdays || p.weekdays || [1,2,3,4,5,6];
          const newPauses = [...(p.pauses || []), pauseEvent];
          const newEndDate = calculateEndDate(p.startDate, planConfig?.numberOfDeliveryDays || p.totalDeliveries || 26, weekdays, newPauses);
          return { ...p, pauses: newPauses, endDate: newEndDate };
        }
        return p;
      });

      if (hasChange) {
        const maxEndDate = updatedPlans.reduce((max, p) => p.endDate > max ? p.endDate : max, updatedPlans[0].endDate);
        const maxDaysLeft = updatedPlans.reduce((max, p) => {
          const planConfig = plans.find(pc => pc.id === p.planId);
          const left = calculateRemainingDeliveries(p.endDate, planConfig?.weekdays || p.weekdays || [1,2,3,4,5,6], p.pauses || []);
          return left > max ? left : max;
        }, 0);

        updates.push({
          id: cust.id,
          activePlans: updatedPlans,
          endDate: maxEndDate,
          daysLeft: maxDaysLeft
        });
      }
    }

    if (updates.length > 0) {
      try {
        await pauseBranchAtomic(effectiveBiz, updates);
      } catch (err: any) {
        console.error("Failed to pause branch in database:", err);
        alert("Failed to pause branch: " + (err.message || "Unknown error"));
        return;
      }
    }
    
    setIsPauseBranchModalOpen(false);
  };

  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter(c => {
      const mealTimes = Array.isArray(c.mealTime) ? c.mealTime : [c.mealTime || 'Lunch'];
      const isStarredCustomer = Boolean(c.isStarred || (c.activePlans || []).some(p => p.isStarred));
      
      const matchesStarred = filters.starred === 'All' || (filters.starred === 'Yes' && isStarredCustomer) || (filters.starred === 'No' && !isStarredCustomer);
      const matchesBranch = filters.branchId === 'All' || c.branchId === filters.branchId;
      const matchesStatus = filters.paymentStatus === 'All' || 
                            (filters.paymentStatus === 'Paid' && (c.pendingAmount || 0) <= 0) || 
                            (filters.paymentStatus === 'Pending' && (c.pendingAmount || 0) > 0);
      
      const matchesTimings = filters.timings.length === 0 || mealTimes.some(m => filters.timings.includes(m));

      const assignedBoy = staff.find((s: any) => s.id === c.deliveryBoyId) || staff.find((s: any) => s.name === c.deliveryBoyName);
      const matchesDeliveryBoy = 
        filters.deliveryBoyId === 'All' || 
        (filters.deliveryBoyId === 'Unassigned' && !c.deliveryBoyId && !c.deliveryBoyName) ||
        (c.deliveryBoyId === filters.deliveryBoyId || (assignedBoy && assignedBoy.id === filters.deliveryBoyId) || c.deliveryBoyName === filters.deliveryBoyId);

      return (
        (c.name || '').toLowerCase().includes(filters.name.toLowerCase()) &&
        (c.mobile || '').includes(filters.mobile) &&
        (c.area || '').toLowerCase().includes(filters.area.toLowerCase()) &&
        matchesBranch &&
        matchesStatus &&
        matchesTimings &&
        matchesDeliveryBoy &&
        matchesStarred
      );
    }).sort((a, b) => {
      // 1. Delivery Boy Sort (if active)
      if (deliveryBoySort !== 'none') {
        const boyA = (staff.find((s: any) => s.id === a.deliveryBoyId)?.name || a.deliveryBoyName || '').toLowerCase().trim();
        const boyB = (staff.find((s: any) => s.id === b.deliveryBoyId)?.name || b.deliveryBoyName || '').toLowerCase().trim();
        if (!boyA && boyB) return 1;
        if (boyA && !boyB) return -1;
        const cmp = boyA.localeCompare(boyB);
        if (cmp !== 0) return deliveryBoySort === 'asc' ? cmp : -cmp;
      }

      // DEFAULT SORTING LOGIC:
      // 1. Active vs Expired
      const aIsActive = a.realDaysLeft > 0;
      const bIsActive = b.realDaysLeft > 0;
      
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // 2. Max Days Left (Descending)
      if (a.realDaysLeft !== b.realDaysLeft) {
        return b.realDaysLeft - a.realDaysLeft;
      }

      // 3. Recent Start Date (Recent on Top)
      const aStart = a.startDate || '';
      const bStart = b.startDate || '';
      return bStart.localeCompare(aStart);
    });
  }, [enrichedCustomers, filters, deliveryBoySort, staff]);

  const stats = useMemo(() => {
    const today = getTodayStr();
    const unique = customers.length;
    // Fix: Using date comparison for active count to be consistent with table status
    const active = enrichedCustomers.filter(c => c.isActive && today <= (c.endDate || '')).length;
    const totalRenewals = customers.reduce((acc, c) => acc + (c.renewalCount || 0), 0);
    const renewalRate = unique > 0 ? Math.round((totalRenewals / (unique + totalRenewals)) * 100) : 0;
    return { unique, active, renewalRate };
  }, [customers, enrichedCustomers]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary-600" size={36} />
        <p className="text-xs font-medium text-slate-400">Loading customer roster...</p>
      </div>
    );
  }

  const handleExportCSV = () => {
    if (!filteredCustomers.length) {
      alert("No customer records to export.");
      return;
    }
    const headers = [
      "Customer Name",
      "Mobile",
      "Address",
      "Area",
      "Branch",
      "Payment Status",
      "Days Remaining",
      "Uncollected Boxes",
      "Active Plans",
      "Special Notes"
    ];
    const rows = filteredCustomers.map(c => {
      const branch = branches.find((b: any) => b.id === c.branchId)?.name || 'Default';
      const plansList = (c.activePlans || []).map(p => `${p.planName} (${p.mealTime})`).join("; ");
      return [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${c.mobile || ''}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${(c.area || '').replace(/"/g, '""')}"`,
        `"${branch.replace(/"/g, '""')}"`,
        `"${c.paymentStatus || 'Pending'}"`,
        c.realDaysLeft ?? 0,
        c.uncollectedBoxesCount ?? 0,
        `"${plansList.replace(/"/g, '""')}"`,
        `"${(c.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const todayStr = getTodayStr();
    link.setAttribute("download", `customers_export_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-20 pt-1 animate-in fade-in duration-300">
      
      {/* Top Overview Cards & Primary Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard title="Total Customers" value={stats.unique} icon={Users2} />
        <StatCard title="Active Plans" value={stats.active} textColor="text-primary-600" icon={CheckCircle} />
        <StatCard title="Renewal Rate" value={`${stats.renewalRate}%`} textColor="text-emerald-600" icon={RotateCcw} />
        <BigActionBtn icon={Plus} label="New Customer" colorClass="bg-gradient-to-tr from-primary-600 to-indigo-600" onClick={() => { setActiveCustomer(null); setIsAddModalOpen(true); }} />
        <BigActionBtn icon={Pause} label="Pause Customer" colorClass="bg-gradient-to-tr from-amber-500 to-orange-600" onClick={() => setIsPauseModalOpen(true)} />
        <BigActionBtn icon={Store} label="Pause Kitchen" colorClass="bg-gradient-to-tr from-slate-800 to-slate-950" onClick={() => setIsPauseBranchModalOpen(true)} />
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/80 shadow-glass flex flex-wrap gap-3 items-center">
         <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              className="w-full pl-10 pr-4 py-2 bg-white/85 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 shadow-xs transition-all"
              placeholder="Search by customer name, locality, or phone number..."
              value={filters.name}
              onChange={(e) => setFilters({...filters, name: e.target.value})}
            />
         </div>
         <div className="relative">
            <select 
              className="bg-white/85 border border-slate-200/80 text-xs font-semibold text-slate-700 py-2 pl-8 pr-8 rounded-xl appearance-none outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 shadow-xs cursor-pointer transition-all"
              value={filters.starred}
              onChange={(e) => setFilters({...filters, starred: e.target.value})}
            >
              <option value="All">All Subscriptions</option>
              <option value="Yes">Special Request Only</option>
              <option value="No">Standard Only</option>
            </select>
            <Star className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-500" size={14} />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
         </div>
         <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white/90 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
            title="Download Customer Roster as CSV"
         >
            <Download size={14} className="text-primary-600" />
            <span>Export CSV</span>
         </button>
         {(filters.name || filters.starred !== 'All' || filters.branchId !== 'All' || filters.paymentStatus !== 'All' || filters.timings.length > 0 || filters.deliveryBoyId !== 'All' || deliveryBoySort !== 'none') && (
           <button 
            onClick={() => {
              setFilters({ name: '', mobile: '', area: '', branchId: 'All', paymentStatus: 'All', timings: [], deliveryBoyId: 'All', starred: 'All' });
              setDeliveryBoySort('none');
            }}
            className="text-xs font-semibold text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50/60 transition-colors flex items-center gap-1.5"
           >
            <X size={14} />
            Clear filters
           </button>
         )}
      </div>

      {/* Customer Directory Table */}
      <div className="glass-card rounded-2xl border border-white/80 overflow-hidden shadow-glass w-full">
         {/* Custom styled visible horizontal side-scroll container */}
         <style>{`
           .customer-table-scroll::-webkit-scrollbar {
             height: 10px;
           }
           .customer-table-scroll::-webkit-scrollbar-track {
             background: #f1f5f9;
             border-radius: 6px;
           }
           .customer-table-scroll::-webkit-scrollbar-thumb {
             background: #cbd5e1;
             border-radius: 6px;
           }
           .customer-table-scroll::-webkit-scrollbar-thumb:hover {
             background: #94a3b8;
           }
         `}</style>
         <div className="overflow-x-auto w-full customer-table-scroll pb-2">
            <table className="w-full text-left border-collapse min-w-[1320px] table-auto">
               <thead className="bg-slate-50/70 backdrop-blur-sm text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                  <tr>
                     <th className="p-3.5 w-10 text-center"></th>
                     <th className="p-3.5 w-12 text-center">#</th>
                     <th className="p-3.5 min-w-[180px]">Customer</th>
                     <th className="p-3.5 w-24 text-center">Special</th>
                     <th className="p-3.5 min-w-[300px]">
                        <TimingFilter 
                          selected={filters.timings} 
                          onChange={(vals) => setFilters({...filters, timings: vals})} 
                        />
                     </th>
                     <th className="p-3.5 min-w-[180px]">
                        <DeliveryBoyFilter 
                          staff={staff}
                          value={filters.deliveryBoyId}
                          onChange={(val) => setFilters({...filters, deliveryBoyId: val})}
                          sortOrder={deliveryBoySort}
                          onToggleSort={toggleDeliveryBoySort}
                        />
                     </th>
                     <th className="p-3.5 min-w-[130px]">Locality</th>
                     <th className="p-3.5 w-28 text-center">
                        <StatusFilter 
                          value={filters.paymentStatus} 
                          onChange={(val) => setFilters({...filters, paymentStatus: val})} 
                        />
                     </th>
                     <th className="p-3.5 w-32 text-center">Days Remaining</th>
                     <th className="p-3.5 min-w-[120px]">
                        <BranchFilter 
                          branches={branches}
                          value={filters.branchId}
                          onChange={(val) => setFilters({...filters, branchId: val})}
                        />
                     </th>
                     <th className="p-3.5 min-w-[120px] text-right sticky right-0 bg-slate-50/95 backdrop-blur-md z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.06)] border-l border-slate-200/70">Actions</th>
                  </tr>
               </thead>
               <tbody className="text-slate-800 text-xs font-normal divide-y divide-slate-100">
                  {filteredCustomers.map((c, idx) => {
                    const branch = branches.find((b:any) => b.id === c.branchId);
                    const mealTimes = Array.isArray(c.mealTime) ? c.mealTime : [c.mealTime || 'Lunch'];
                    const isExpanded = expandedRows.has(c.id);
                    const isStarredCustomer = Boolean(c.isStarred || (c.activePlans || []).some(p => p.isStarred));
                    const boxHealth = getCustomerBoxHealth(c);
                    const reusableBoxPlans = (c.activePlans || []).filter((p: any) => p.reusableBoxType && p.reusableBoxType !== 'None');

                    // Assigned Delivery Boy
                    const assignedBoy = staff.find((s: any) => s.id === c.deliveryBoyId) || staff.find((s: any) => s.name === c.deliveryBoyName);
                    const assignedBoyName = assignedBoy?.name || c.deliveryBoyName || '';

                    // Active (green border) vs Expired (red border) plans info for Timing column
                    const activePlansList = c.activePlans || [];
                    const pastPlansList = c.pastPlans || [];
                    const today = getTodayStr();

                    let displayPlans: Array<{
                      mealTime: string;
                      planName?: string;
                      startDate?: string;
                      endDate?: string;
                      isActive: boolean;
                      isStarred?: boolean;
                      daysRemaining?: number;
                    }> = [];

                    if (activePlansList.length > 0) {
                      displayPlans = activePlansList.map((p: any) => {
                        const isExpired = p.endDate ? (today > p.endDate) : (c.realDaysLeft <= 0);
                        const planConfig = plans.find((pc: any) => pc.id === p.planId);
                        const left = calculateRemainingDeliveries(p.endDate, planConfig?.weekdays || p.weekdays || [1,2,3,4,5,6], p.pauses || []);
                        return {
                          mealTime: p.mealTime || 'Lunch',
                          planName: p.planName,
                          startDate: p.startDate,
                          endDate: p.endDate,
                          isActive: !isExpired,
                          isStarred: Boolean(p.isStarred),
                          daysRemaining: left
                        };
                      });
                    } else {
                      const mealTimes = Array.isArray(c.mealTime) ? c.mealTime : [c.mealTime || 'Lunch'];
                      const isCustActive = today <= (c.endDate || '') && (c.realDaysLeft > 0 || c.isActive);
                      displayPlans = mealTimes.map((m: string) => ({
                        mealTime: m,
                        planName: c.planId ? plans.find((pl: any) => pl.id === c.planId)?.name : undefined,
                        startDate: c.startDate,
                        endDate: c.endDate,
                        isActive: isCustActive,
                        daysRemaining: c.realDaysLeft
                      }));
                    }

                    if (pastPlansList.length > 0) {
                      const existingKeys = new Set(displayPlans.map(dp => `${dp.mealTime}-${dp.planName || ''}`));
                      pastPlansList.forEach((pp: any) => {
                        const key = `${pp.mealTime}-${pp.planName || ''}`;
                        if (!existingKeys.has(key)) {
                          displayPlans.push({
                            mealTime: pp.mealTime || 'Lunch',
                            planName: pp.planName,
                            startDate: pp.startDate,
                            endDate: pp.endDate,
                            isActive: false,
                            isStarred: Boolean(pp.isStarred),
                            daysRemaining: 0
                          });
                          existingKeys.add(key);
                        }
                      });
                    }

                    return (
                      <React.Fragment key={c.id}>
                        <tr onClick={() => toggleRow(c.id)} className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${isExpanded ? 'bg-slate-50/90' : ''}`}>
                          <td className="p-3.5 text-center text-slate-400">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                          <td className="p-3.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 truncate max-w-[140px] text-sm">{c.name}</span>
                              {c.highlightMark && c.highlightMark !== 'None' && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                  c.highlightMark === 'Urgent' ? 'bg-red-50 text-red-700 border border-red-200/60' : 
                                  c.highlightMark === 'Dietary' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 
                                  'bg-primary-50 text-primary-700 border border-primary-200/60'
                                }`}>{c.highlightMark}</span>
                              )}
                              {boxHealth.damagedOrDirty > 0 && (
                                <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5" title={`${boxHealth.damagedOrDirty} damaged / unclean box recorded`}>
                                  ⚠️ Box Issue
                                </span>
                              )}
                              {boxHealth.unreturned > 1 && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md" title={`${boxHealth.unreturned} boxes pending recollection`}>
                                  🔄 {boxHealth.unreturned} Pending
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{c.mobile}</div>
                          </td>
                          <td className="p-3.5 text-center">
                            {isStarredCustomer ? (
                              <div className="flex flex-col items-center justify-center gap-0.5" title={c.starredQuery || c.notes || 'VIP Starred Customer'}>
                                <Star size={16} fill="#f59e0b" className="text-amber-500 animate-pulse" />
                                {(c.starredQuery || c.notes) && (
                                  <span className="text-[9px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md max-w-[100px] truncate">
                                    {c.starredQuery || c.notes}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {displayPlans.map((dp, pIdx) => {
                                  const isGreen = dp.isActive;
                                  return (
                                    <div
                                      key={`${dp.mealTime}-${pIdx}`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-xs ${
                                        isGreen 
                                          ? 'border-2 border-emerald-500 bg-emerald-50/80 text-emerald-900 shadow-emerald-100' 
                                          : 'border-2 border-rose-500 bg-rose-50/80 text-rose-900 shadow-rose-100'
                                      }`}
                                      title={`${dp.mealTime} Plan: ${dp.planName || 'Standard'} | ${isGreen ? 'Active' : 'Expired'} | ${dp.endDate ? `Expiry: ${formatDateDDMMYYYY(dp.endDate)}` : ''} ${dp.daysRemaining !== undefined ? `(${dp.daysRemaining} deliveries left)` : ''}`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isGreen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                      <span className="font-bold uppercase tracking-tight">{dp.mealTime}</span>
                                      {dp.planName && (
                                        <span className={`text-[10px] max-w-[85px] truncate ${isGreen ? 'text-emerald-700 font-medium' : 'text-rose-700 opacity-90'}`}>
                                          {dp.planName}
                                        </span>
                                      )}
                                      <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                                        isGreen 
                                          ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300/70' 
                                          : 'bg-rose-100/90 text-rose-800 border-rose-300/70'
                                      }`}>
                                        {isGreen 
                                          ? (dp.endDate ? formatDateDDMMYYYY(dp.endDate) : 'Active') 
                                          : 'Expired'}
                                      </span>
                                      {dp.isStarred && <Star size={9} className="text-amber-500 fill-amber-500 shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                              {reusableBoxPlans.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {reusableBoxPlans.map((p: any, pIdx: number) => (
                                    <span key={pIdx} className="text-[9px] font-bold text-teal-800 bg-teal-50 border border-teal-200/70 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1" title={`${p.mealTime}: ${p.reusableBoxType}${p.boxTagOrNumber ? ` (#${p.boxTagOrNumber})` : ''}`}>
                                      <RotateCcw size={9} className="text-teal-600" />
                                      <span className="truncate max-w-[85px]">{p.reusableBoxType.replace('Stainless Steel ', 'SS ').replace('Insulated ', 'Ins. ')}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5">
                            {assignedBoyName ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-[11px] shrink-0 shadow-xs">
                                  {assignedBoyName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-800 text-xs block truncate max-w-[130px]">{assignedBoyName}</span>
                                  {assignedBoy?.mobile && (
                                    <span className="text-[10px] text-slate-400 font-mono block truncate">{assignedBoy.mobile}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-medium bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-600 text-xs font-medium truncate max-w-[120px]">{c.area || '—'}</td>
                          <td className="p-3.5 text-center">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.pendingAmount <= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'}`}>
                                {c.pendingAmount <= 0 ? 'Clear' : `₹${c.pendingAmount}`}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {c.isExpired ? (
                               <div className="inline-flex flex-col items-center">
                                 <span className="text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md text-xs font-semibold">Expired</span>
                                 {(c.latestEndDate || c.endDate) && <span className="text-[9px] text-slate-400 font-mono mt-0.5">{formatDateDDMMYYYY(c.latestEndDate || c.endDate)}</span>}
                               </div>
                            ) : (
                               <div className="inline-flex flex-col items-center">
                                 <span className="text-primary-700 font-bold text-xs bg-primary-50 px-2 py-0.5 rounded-md border border-primary-200/50">{c.realDaysLeft} days</span>
                                 {(c.latestEndDate || c.endDate) && <span className="text-[9px] text-slate-400 font-mono mt-0.5">till {formatDateDDMMYYYY(c.latestEndDate || c.endDate)}</span>}
                               </div>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-600 text-xs font-medium truncate max-w-[120px]">{branch?.name || 'Main Kitchen'}</td>
                          <td className="p-3.5 text-right sticky right-0 bg-white/95 group-hover:bg-slate-50/95 backdrop-blur-md z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.06)] border-l border-slate-100 transition-colors min-w-[120px]">
                            <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setActiveCustomer(c); setIsRenewal(true); setIsAddModalOpen(true); }} 
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Renew Subscription"
                                >
                                  <RotateCcw size={15}/>
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setActiveCustomer(c); setIsRenewal(false); setIsAddModalOpen(true); }} 
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Edit Customer"
                                >
                                  <Edit size={15}/>
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(c.id); }} 
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete Customer"
                                >
                                  <Trash2 size={15}/>
                                </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={11} className="p-0 bg-slate-50/50 border-b border-slate-200">
                               <CustomerExpansion customer={c} plans={plans} deliveryLogs={deliveryLogs} onClose={() => toggleRow(c.id)} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
               </tbody>
            </table>
         </div>
      </div>

      {isAddModalOpen && (
        <CustomerModal 
          plans={plans} 
          staff={staff} 
          branches={branches} 
          initialData={activeCustomer} 
          isRenewal={isRenewal} 
          availableBoxTypes={availableBoxTypes}
          onClose={() => { setIsAddModalOpen(false); setActiveCustomer(null); setIsRenewal(false); }} 
          onSubmit={handleSaveCustomer} 
        />
      )}
      {isPauseModalOpen && <PauseCustomerModal customers={customers} branches={branches} plans={plans} onClose={() => setIsPauseModalOpen(false)} onSubmit={handlePausePlans} />}
      {isPauseBranchModalOpen && <PauseBranchModal branches={branches} customers={customers} onClose={() => setIsPauseBranchModalOpen(false)} onSubmit={handlePauseBranch} />}

      {/* In-App Customer Deletion Confirmation Modal (Guaranteed iFrame & Mobile Compatibility) */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-left border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Customer?</h3>
                <p className="text-xs text-slate-400">This action will remove the record and linked records.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to permanently delete this customer? This will remove their subscription profile and history from your database roster.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                disabled={isDeletingCustomer}
                onClick={() => setCustomerToDelete(null)}
                className="py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="button"
                disabled={isDeletingCustomer}
                onClick={confirmDeleteCustomer}
                className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingCustomer ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COLUMN FILTER COMPONENTS ---

const DeliveryBoyFilter = ({ 
  staff, 
  value, 
  onChange, 
  sortOrder, 
  onToggleSort 
}: { 
  staff: any[], 
  value: string, 
  onChange: (val: string) => void,
  sortOrder: 'none' | 'asc' | 'desc',
  onToggleSort: () => void
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedBoy = staff.find((s: any) => s.id === value);
  const activeLabel = value === 'All' ? 'Delivery Boy' : value === 'Unassigned' ? 'Unassigned' : (selectedBoy?.name || 'Delivery Boy');

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div className="flex items-center gap-1">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
          className="flex items-center gap-1.5 hover:text-slate-900 transition-colors uppercase font-semibold text-xs tracking-wider"
          title="Filter by Delivery Boy"
        >
          <span className="truncate max-w-[90px]">{activeLabel}</span>
          <Filter size={10} className={value !== 'All' ? 'text-primary-600' : 'text-slate-300'} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSort(); }}
          className={`p-1 rounded hover:bg-slate-200/60 transition-colors ${sortOrder !== 'none' ? 'text-primary-600 font-bold' : 'text-slate-400'}`}
          title={`Sort by Delivery Boy (${sortOrder === 'asc' ? 'A to Z' : sortOrder === 'desc' ? 'Z to A' : 'Click to sort'})`}
        >
          {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
          <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>Filter Rider</span>
            <button 
              onClick={() => onToggleSort()}
              className="text-[9px] text-primary-600 hover:underline uppercase font-bold flex items-center gap-0.5"
            >
              Sort {sortOrder === 'asc' ? 'Z-A' : 'A-Z'}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto no-scrollbar space-y-0.5">
            <button
              onClick={() => { onChange('All'); setIsOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${value === 'All' ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              <span>All Delivery Boys</span>
              {value === 'All' && <Check size={12} strokeWidth={3} className="text-primary-600" />}
            </button>
            <button
              onClick={() => { onChange('Unassigned'); setIsOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${value === 'Unassigned' ? 'bg-rose-50 text-rose-700' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Unassigned Only
              </span>
              {value === 'Unassigned' && <Check size={12} strokeWidth={3} className="text-rose-600" />}
            </button>
            {staff.map((s: any) => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id); setIsOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${value === s.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <div className="truncate pr-2">
                  <span className="block truncate">{s.name}</span>
                  {s.mobile && <span className="block text-[9px] text-slate-400 font-mono font-normal">{s.mobile}</span>}
                </div>
                {value === s.id && <Check size={12} strokeWidth={3} className="text-primary-600 shrink-0" />}
              </button>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between px-1">
            <button onClick={() => { onChange('All'); setIsOpen(false); }} className="text-[9px] font-bold uppercase text-slate-400 hover:text-red-500">Reset</button>
            <button onClick={() => setIsOpen(false)} className="text-[9px] font-bold uppercase text-primary-600 hover:text-primary-800">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

const TimingFilter = ({ selected, onChange }: { selected: string[], onChange: (vals: string[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleVal = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter(s => s !== val));
    else onChange([...selected, val]);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="flex items-center gap-1.5 hover:text-slate-900 transition-colors uppercase">
        Timing <Filter size={10} className={selected.length > 0 ? 'text-primary-600' : 'text-slate-300'} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
           {['Breakfast', 'Lunch', 'Dinner'].map(t => (
             <label key={t} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selected.includes(t) ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                   {selected.includes(t) && <Check size={10} strokeWidth={4}/>}
                </div>
                <input type="checkbox" className="hidden" checked={selected.includes(t)} onChange={() => toggleVal(t)} />
                <span className={`text-[10px] font-black uppercase ${selected.includes(t) ? 'text-primary-700' : 'text-slate-500'}`}>{t}</span>
             </label>
           ))}
           <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between px-1">
              <button onClick={() => onChange([])} className="text-[8px] font-black uppercase text-slate-400 hover:text-red-500">Clear</button>
              <button onClick={() => setIsOpen(false)} className="text-[8px] font-black uppercase text-primary-600 hover:text-primary-800">Done</button>
           </div>
        </div>
      )}
    </div>
  );
};

const BranchFilter = ({ branches, value, onChange }: { branches: any[], value: string, onChange: (val: string) => void }) => {
  return (
    <div className="relative inline-block">
      <select 
        onClick={e => e.stopPropagation()}
        className="bg-transparent border-none p-0 text-[10px] font-bold text-slate-400 uppercase tracking-widest outline-none focus:text-slate-900 transition-colors appearance-none cursor-pointer pr-4"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {branches.length > 1 && <option value="All">All Branches</option>}
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      {branches.length > 1 && <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300" />}
    </div>
  );
};

const StatusFilter = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  return (
    <div className="relative inline-block">
      <select 
        onClick={e => e.stopPropagation()}
        className="bg-transparent border-none p-0 text-[10px] font-bold text-slate-400 uppercase tracking-widest outline-none focus:text-slate-900 transition-colors appearance-none cursor-pointer pr-4 text-center"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="All">All Payments</option>
        <option value="Paid">Paid Only</option>
        <option value="Pending">Pending Only</option>
      </select>
      <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300" />
    </div>
  );
};

const CustomerExpansion = ({ customer, plans, deliveryLogs, onClose }: { customer: GlobalCustomer, plans: any[], deliveryLogs?: any[], onClose: () => void }) => {
  const { currentUser, businessData } = useAuth();
  const businessName = businessData?.businessName;
  const [isLoggingBox, setIsLoggingBox] = useState(false);
  const [boxLogForm, setBoxLogForm] = useState({
    mealTime: (customer.activePlans?.[0]?.mealTime || 'Lunch') as 'Breakfast' | 'Lunch' | 'Dinner',
    date: getTodayStr(),
    status: 'returned_clean' as 'returned_clean' | 'unclean' | 'damaged' | 'missing_part' | 'not_returned',
    notes: '',
    boxTagOrNumber: customer.activePlans?.[0]?.boxTagOrNumber || ''
  });
  const [savingBoxLog, setSavingBoxLog] = useState(false);

  const boxHealth = getCustomerBoxHealth(customer, deliveryLogs);
  const reusablePlans = (customer.activePlans || []).filter(p => p.reusableBoxType && p.reusableBoxType !== 'None');
  const hasReusableBoxes = reusablePlans.length > 0 || (customer.pastPlans || []).some(p => p.reusableBoxType && p.reusableBoxType !== 'None');

  const handleSaveBoxLog = async () => {
    if (!currentUser) return;
    setSavingBoxLog(true);
    try {
      const key = `${boxLogForm.date}_${boxLogForm.mealTime}`;
      const updatedCollections = {
        ...(customer.boxCollections || {}),
        [key]: {
          date: boxLogForm.date,
          mealTime: boxLogForm.mealTime,
          status: boxLogForm.status,
          notes: boxLogForm.notes,
          boxTagOrNumber: boxLogForm.boxTagOrNumber,
          recordedAt: new Date().toISOString()
        }
      };
      const isClean = boxLogForm.status === 'returned_clean';
      const isCollected = isClean || boxLogForm.status === 'unclean';
      const prevCount = typeof customer.uncollectedBoxesCount === 'number' ? customer.uncollectedBoxesCount : 1;
      const newCount = isCollected ? Math.max(0, prevCount - 1) : prevCount;

      const effectiveBiz = getTargetBusinessId(currentUser?.uid);
      if (effectiveBiz) {
        await updateItem(effectiveBiz, 'customers', customer.id, {
          uncollectedBoxesCount: newCount,
          boxCollections: updatedCollections
        });
      }
      setIsLoggingBox(false);
      setBoxLogForm(prev => ({
        ...prev,
        notes: '',
        status: 'returned_clean'
      }));
    } catch (err) {
      console.error('Error logging box status:', err);
      alert('Failed to save box log');
    } finally {
      setSavingBoxLog(false);
    }
  };

  const handleShareAll = () => {
    const activePlans = customer.activePlans || [];
    const msg = getSubscriptionSummaryMessage(
      customer,
      activePlans,
      plans,
      calculateRemainingDeliveries,
      businessName
    );
    window.open(buildWhatsAppUrl(customer.mobile, msg), '_blank');
  };

  const activePlans = customer.activePlans || [];

  return (
    <div className="p-6 animate-in slide-in-from-top-2 duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Info size={16} className="text-primary-600"/> Detailed Subscription Timelines
          </h4>
          <div className="flex flex-wrap gap-4 mt-2">
            {customer.notes && (
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-2 max-w-lg">
                 <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                 <div>
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Special Preparation Notes</p>
                    <p className="text-xs font-medium text-amber-700">{customer.notes}</p>
                 </div>
              </div>
            )}
            {customer.discount && Number(customer.discount) > 0 ? (
              <div className="bg-emerald-50 border border-emerald-200/70 p-3 rounded-xl flex items-center gap-2">
                 <span className="text-sm">🏷️</span>
                 <div>
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Discount</p>
                    <p className="text-xs font-bold text-emerald-700">₹{customer.discount} OFF</p>
                 </div>
              </div>
            ) : null}
            {customer.deliveryCharges && Number(customer.deliveryCharges) > 0 ? (
              <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl flex items-center gap-2">
                 <span className="text-sm">🚚</span>
                 <div>
                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Delivery</p>
                    <p className="text-xs font-bold text-slate-700">₹{customer.deliveryCharges}</p>
                 </div>
              </div>
            ) : null}
            {customer.locationLink && (
              <a 
                href={customer.locationLink.startsWith('http') ? customer.locationLink : `https://${customer.locationLink}`} 
                target="_blank" 
                rel="noreferrer" 
                className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-2 max-w-sm hover:bg-blue-100 transition-colors"
              >
                <MapPin size={16} className="text-blue-600 shrink-0" />
                <div className="truncate">
                   <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Customer Location Link</p>
                   <p className="text-xs font-medium text-blue-700 truncate">{customer.locationLink}</p>
                </div>
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {activePlans.length > 0 && (
            <button onClick={handleShareAll} className="flex items-center gap-2 bg-green-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-green-700 shadow-md">
              <Share2 size={14}/> Share All Status
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={16}/></button>
        </div>
      </div>
      
      <div className="space-y-8">
        {/* Reusable Box Management Section */}
        {hasReusableBoxes && (
          <div className="bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-cyan-500/10 backdrop-blur-md rounded-2xl border border-teal-200/70 p-5 shadow-glass space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-teal-200/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    Reusable Box Lifecycle & Health
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    Auto-recollection tracks from 2nd delivery day forward. Record returned clean, unclean, or damaged boxes.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsLoggingBox(!isLoggingBox)}
                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Plus size={14} /> {isLoggingBox ? 'Cancel Log' : 'Record Box Return'}
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white/80 p-3 rounded-xl border border-teal-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Tracked Collections</span>
                <p className="text-lg font-black text-slate-800">{boxHealth.totalExpected}</p>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-teal-100 text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Returned Clean</span>
                <p className="text-lg font-black text-emerald-700">{boxHealth.totalCollected}</p>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-teal-100 text-center">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Pending / Not Returned</span>
                <p className="text-lg font-black text-amber-700">{boxHealth.unreturned}</p>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-teal-100 text-center">
                <span className="text-[10px] font-bold text-rose-600 uppercase">Issues (Damage/Dirty)</span>
                <p className={`text-lg font-black ${boxHealth.damagedOrDirty > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>
                  {boxHealth.damagedOrDirty}
                </p>
              </div>
            </div>

            {/* Log Entry Form */}
            {isLoggingBox && (
              <div className="bg-white p-4 rounded-xl border border-teal-200/80 space-y-3 animate-in fade-in-50">
                <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <CheckCircle size={14} className="text-teal-600" /> Log Box Collection Entry
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Meal Time</label>
                    <select 
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      value={boxLogForm.mealTime}
                      onChange={e => setBoxLogForm({...boxLogForm, mealTime: e.target.value as any})}
                    >
                      <option value="Breakfast">Breakfast</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date</label>
                    <input 
                      type="date"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      value={boxLogForm.date}
                      onChange={e => setBoxLogForm({...boxLogForm, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Return Status</label>
                    <select 
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                      value={boxLogForm.status}
                      onChange={e => setBoxLogForm({...boxLogForm, status: e.target.value as any})}
                    >
                      <option value="returned_clean">✅ Returned Clean</option>
                      <option value="unclean">⚠️ Returned Unclean (Needs Wash)</option>
                      <option value="missing_part">⚠️ Missing Lid or Part</option>
                      <option value="damaged">❌ Broken / Damaged Box</option>
                      <option value="not_returned">⏳ Customer Did Not Return</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Box Tag / ID</label>
                    <input 
                      placeholder="e.g. BX-102"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white uppercase font-mono"
                      value={boxLogForm.boxTagOrNumber}
                      onChange={e => setBoxLogForm({...boxLogForm, boxTagOrNumber: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <input 
                    placeholder="Optional note: e.g. Customer promised to wash next time, dent on outer lid..."
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                    value={boxLogForm.notes}
                    onChange={e => setBoxLogForm({...boxLogForm, notes: e.target.value})}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => setIsLoggingBox(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    disabled={savingBoxLog}
                    onClick={handleSaveBoxLog}
                    className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    {savingBoxLog ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Save Record
                  </button>
                </div>
              </div>
            )}

            {/* Collection History Log */}
            {boxHealth.history && boxHealth.history.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Recent Box Recollection Events</span>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                  {boxHealth.history.slice(0, 10).map((h, i) => {
                    const isIssue = h.status === 'damaged' || h.status === 'unclean' || h.status === 'missing_part';
                    const isClean = h.status === 'returned_clean';
                    return (
                      <div 
                        key={i} 
                        className={`text-xs p-2 rounded-xl border flex items-center gap-2 ${
                          isClean ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' :
                          isIssue ? 'bg-rose-50/80 border-rose-200 text-rose-900 font-semibold' :
                          'bg-amber-50/80 border-amber-200 text-amber-900'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-slate-500">{formatDateDDMMYYYY(h.date)} ({h.mealTime})</span>
                        <span className="font-bold text-[11px]">
                          {h.status === 'returned_clean' ? '✅ Clean' :
                           h.status === 'unclean' ? '⚠️ Unclean' :
                           h.status === 'missing_part' ? '⚠️ Missing Part' :
                           h.status === 'damaged' ? '❌ Damaged' : '⏳ Not Returned'}
                        </span>
                        {h.boxTagOrNumber && <span className="font-mono text-[10px] text-slate-600">#{h.boxTagOrNumber}</span>}
                        {h.notes && <span className="text-[10px] italic text-slate-600">"{h.notes}"</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Plans Section */}
        {activePlans.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Active Plans</span>
              <div className="h-px flex-1 bg-slate-200"></div>
            </div>
            {activePlans.map((p, idx) => {
              const planConfig = plans.find(pc => pc.id === p.planId);
              return (
                <div key={`active-${idx}`} className={`bg-white rounded-2xl border p-5 shadow-sm ${p.isStarred ? 'border-amber-200 ring-2 ring-amber-50' : 'border-slate-200'}`}>
                   <div className="flex justify-end mb-2">
                     {p.isStarred && <span className="bg-amber-50 text-amber-600 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1"><Star size={8} fill="currentColor" /> Special Requirement</span>}
                   </div>
                   <PlanTimeline plan={p} planConfig={planConfig} customer={customer} planIndex={idx} allPlansConfig={plans} />
                </div>
              );
            })}
          </div>
        )}

        {/* Past Plans Section */}
        {customer.pastPlans && customer.pastPlans.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-red-100"></div>
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Past Subscriptions (History)</span>
              <div className="h-px flex-1 bg-red-100"></div>
            </div>
            {customer.pastPlans.map((p, idx) => {
              const planConfig = plans.find(pc => pc.id === p.planId);
              return (
                <div key={`past-${idx}`} className="bg-slate-50/50 rounded-2xl border border-slate-200 p-5 opacity-80 grayscale-[0.5]">
                   <PlanTimeline plan={p} planConfig={planConfig} customer={customer} planIndex={-1} allPlansConfig={plans} isPast={true} />
                </div>
              );
            })}
          </div>
        )}

        {activePlans.length === 0 && (!customer.pastPlans || customer.pastPlans.length === 0) && (
          <div className="text-center py-10 text-slate-400 italic">No detailed plan information available for this record.</div>
        )}
      </div>
    </div>
  );
};

const PlanTimeline = ({ plan, planConfig, customer, planIndex, allPlansConfig, isPast }: { plan: SubscribedPlan, planConfig: any, customer: GlobalCustomer, planIndex: number, allPlansConfig: any[], isPast?: boolean }) => {
  const { currentUser, businessData } = useAuth();
  const businessName = businessData?.businessName;
  const [selectedDateToCount, setSelectedDateToCount] = useState<string | null>(null);
  const weekdays = planConfig?.weekdays || plan.weekdays || [1,2,3,4,5,6];

  const handleCountDate = async (dateStr: string) => {
    if (!currentUser || isPast) return;
    
    const updatedPauses = [...(plan.pauses || [])];
    const pauseIdx = updatedPauses.findIndex(p => dateStr >= p.start && dateStr <= p.end);
    
    if (pauseIdx === -1) return;
    
    const pause = updatedPauses[pauseIdx];
    
    // Remove the date from the pause
    if (pause.start === dateStr && pause.end === dateStr) {
      // Single day pause, remove it
      updatedPauses.splice(pauseIdx, 1);
    } else if (pause.start === dateStr) {
      // Start of pause, move start to next day
      updatedPauses[pauseIdx] = { ...pause, start: shiftDateStr(dateStr, 1) };
    } else if (pause.end === dateStr) {
      // End of pause, move end to previous day
      updatedPauses[pauseIdx] = { ...pause, end: shiftDateStr(dateStr, -1) };
    } else {
      // Middle of pause, split it
      const p1 = { ...pause, end: shiftDateStr(dateStr, -1) };
      const p2 = { ...pause, start: shiftDateStr(dateStr, 1) };
      updatedPauses.splice(pauseIdx, 1, p1, p2);
    }
    
    // Recalculate end date for this plan
    const tDays = planConfig?.numberOfDeliveryDays || plan.totalDeliveries || 26;
    const newEndDate = calculateEndDate(plan.startDate, tDays, weekdays, updatedPauses);
    
    // Update the specific plan in the customer's activePlans
    const updatedActivePlans = [...(customer.activePlans || [])];
    updatedActivePlans[planIndex] = { ...plan, pauses: updatedPauses, endDate: newEndDate };
    
    // Recalculate customer level stats
    const maxEndDate = updatedActivePlans.reduce((max, p) => p.endDate > max ? p.endDate : max, updatedActivePlans[0].endDate);
    const maxDaysLeft = updatedActivePlans.reduce((max, p) => {
      const pc = allPlansConfig.find(pl => pl.id === p.planId);
      const wds = pc?.weekdays || p.weekdays || [1,2,3,4,5,6];
      const left = calculateRemainingDeliveries(p.endDate, wds, p.pauses || []);
      return left > max ? left : max;
    }, 0);
    
    try {
      const effectiveBiz = getTargetBusinessId(currentUser?.uid);
      if (effectiveBiz) {
        await updateItem(effectiveBiz, 'customers', customer.id, {
          activePlans: updatedActivePlans,
          endDate: maxEndDate,
          daysLeft: maxDaysLeft
        });
      }
      setSelectedDateToCount(null);
    } catch (err) {
      console.error("Error counting date:", err);
    }
  };
  
  const generateDates = () => {
    const dates = [];
    if (!plan.startDate || !plan.endDate) return [];
    const [sy, sm, sd] = plan.startDate.split('-').map(Number);
    let curr = new Date(sy, sm - 1, sd);
    const [ey, em, ed] = plan.endDate.split('-').map(Number);
    const end = new Date(ey, em - 1, ed);
    
    let safety = 0;
    while (curr <= end && safety < 1000) {
      dates.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
      curr.setDate(curr.getDate() + 1);
      safety++;
    }
    return dates;
  };

  const dates = generateDates();
  const today = getTodayStr();
  
  let delivered = 0;
  let userPaused = 0;
  let branchPaused = 0;
  let holidays = 0;
  
  dates.forEach(dStr => {
    const isHoliday = !weekdays.includes(new Date(dStr).getDay());
    const pause = (plan.pauses || []).find(p => dStr >= p.start && dStr <= p.end);
    
    if (isHoliday) holidays++;
    else if (pause) {
      if (pause.type === 'User') userPaused++;
      else branchPaused++;
    } else if (dStr <= today) {
      delivered++;
    }
  });

  const totalDays = planConfig?.numberOfDeliveryDays || plan.totalDeliveries || 26;
  const pending = Math.max(0, totalDays - delivered);

  const handleSharePlan = () => {
    const msg = getCustomerPlanStatusMessage(
      customer.name,
      plan.mealTime,
      plan.planName,
      delivered,
      totalDays,
      pending,
      userPaused + branchPaused,
      plan.endDate,
      businessName
    );
    window.open(buildWhatsAppUrl(customer.mobile, msg), '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            plan.mealTime === 'Breakfast' ? 'bg-orange-100 text-orange-600' :
            plan.mealTime === 'Lunch' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
          }`}>
            <Clock size={18}/>
          </div>
          <div>
            <div className="font-black text-slate-900 uppercase text-[11px] tracking-widest">{plan.mealTime} PLAN</div>
            <div className="text-sm font-bold text-slate-500">{plan.planName} (₹{plan.price})</div>
            {plan.reusableBoxType && plan.reusableBoxType !== 'None' ? (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <RotateCcw size={10} className="text-teal-600" />
                  {plan.reusableBoxType}
                  {plan.boxTagOrNumber && <span className="font-mono text-slate-500 ml-0.5">#{plan.boxTagOrNumber}</span>}
                  {plan.boxDeposit ? <span className="text-slate-600 ml-0.5">(₹{plan.boxDeposit} dep)</span> : null}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  {getPlanDeliveryDayNumber(plan, today) >= 2 
                    ? `Day #${getPlanDeliveryDayNumber(plan, today)} · Recollection Active`
                    : '1st Day Delivery · Recollection starts tomorrow'}
                </span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">📦 Disposable / No Reusable Box</div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
          <div className="text-center p-2 rounded-xl bg-green-50 border border-green-100">
            <div className="text-[10px] font-black text-green-600 uppercase tracking-tighter">Delivered</div>
            <div className="text-lg font-black text-green-700">{delivered}/{totalDays}</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-orange-50 border border-orange-100">
            <div className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">Paused</div>
            <div className="text-lg font-black text-orange-700">{userPaused + branchPaused}</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Left</div>
            <div className="text-lg font-black text-blue-700">{pending}</div>
          </div>
          <button onClick={handleSharePlan} className="bg-slate-900 text-white rounded-xl p-2 flex flex-col items-center justify-center hover:bg-black transition-all">
             <MessageSquare size={14}/>
             <span className="text-[8px] font-black uppercase mt-1">Share</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
         <div className="flex flex-wrap gap-1.5">
            {dates.map((dStr, i) => {
              const d = new Date(dStr);
              const isHoliday = !weekdays.includes(d.getDay());
              const pause = (plan.pauses || []).find(p => dStr >= p.start && dStr <= p.end);
              const isToday = dStr === today;
              
              let color = "bg-white border-slate-200";
              let label = "Pending";
              
              if (isHoliday) { color = "bg-slate-200 border-slate-300"; label = "Holiday"; }
              else if (pause) { 
                color = pause.type === 'User' ? "bg-orange-400 border-orange-500" : "bg-slate-800 border-black";
                label = `${pause.type} Paused`;
              } else if (dStr < today) { color = "bg-green-500 border-green-600"; label = "Delivered"; }
              else if (isToday) { color = "bg-blue-600 border-blue-700 ring-2 ring-blue-100 animate-pulse"; label = "Today"; }

              return (
                <div key={i} className="group relative">
                  <div 
                    onClick={() => { if (pause && !isPast) setSelectedDateToCount(dStr); }}
                    className={`w-5 h-7 rounded-[4px] border ${color} shadow-sm transition-transform ${!isPast ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`} 
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                     <div className="bg-slate-900 text-white text-[8px] font-black py-1 px-2 rounded whitespace-nowrap shadow-xl">
                        {formatDateDDMMYYYY(dStr)} • {label} {pause ? '(Click to Count)' : ''}
                     </div>
                  </div>
                </div>
              );
            })}
         </div>
      </div>

      {selectedDateToCount && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 mb-2">Count this date?</h3>
            <p className="text-sm text-slate-500 mb-6">
              You are marking <span className="font-bold text-slate-900">{formatDateDDMMYYYY(selectedDateToCount)}</span> as a delivery day. This will reduce the paused days and update the plan's end date.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedDateToCount(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleCountDate(selectedDateToCount)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200"
              >
                Count Date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const CustomerModal = ({ plans, staff, branches, initialData, isRenewal, onClose, onSubmit, availableBoxTypes = REUSABLE_BOX_TYPES }: any) => {
   const [formData, setFormData] = useState<any>({
      branchId: branches[0]?.id || '', name: '', mobile: '', address: '', area: '', 
      deliveryBoyId: '', amountPaid: 0, deliveryCharges: 0, discount: 0, activePlans: [], 
      highlightMark: 'None', notes: '', locationLink: '',
      isStarred: false,
      starredQuery: '',
      ...initialData,
      ...(isRenewal ? { amountPaid: 0, deliveryCharges: 0, discount: 0 } : {})
   });

   const [activePlans, setActivePlans] = useState<any[]>(isRenewal ? [] : (initialData?.activePlans || []));
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [submitError, setSubmitError] = useState<string | null>(null);
   const [newPlanForm, setNewPlanForm] = useState({ 
     mealTime: 'Lunch', 
     planId: '', 
     startDate: getTodayStr(),
     isStarred: false,
     reusableBoxType: availableBoxTypes[0]?.name || 'None',
     boxTagOrNumber: '',
     boxDeposit: 0
   });

   const [isCustomPlanOpen, setIsCustomPlanOpen] = useState(false);
   const [customPlanForm, setCustomPlanForm] = useState({
     name: '', price: '', totalDeliveries: 26, weekdays: [1,2,3,4,5,6], mealTime: 'Lunch', quantity: 1, startDate: getTodayStr(), isStarred: false,
     reusableBoxType: availableBoxTypes[0]?.name || 'None',
     boxTagOrNumber: '',
     boxDeposit: 0
   });

   const currentBranchPlans = (plans || []).filter((p: any) => 
     !p.branchId || p.branchId === 'All' || !formData.branchId || p.branchId === formData.branchId
   );
   const currentBranchStaff = (staff || []).filter((s: any) => 
     !s.branchId || s.branchId === 'All' || !formData.branchId || s.branchId === formData.branchId
   );

   // Natural 0-9, A-Z Sorting for all plans
   const sortedBranchPlans = useMemo(() => {
     return [...currentBranchPlans].sort((a: any, b: any) => {
       const nameA = String(a.name || '').trim();
       const nameB = String(b.name || '').trim();
       return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
     });
   }, [currentBranchPlans]);

   // Searchable Plan Dropdown State
   const [planSearchQuery, setPlanSearchQuery] = useState('');
   const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
   const planDropdownRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
     const handleClickOutside = (e: MouseEvent) => {
       if (planDropdownRef.current && !planDropdownRef.current.contains(e.target as Node)) {
         setIsPlanDropdownOpen(false);
       }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const filteredBranchPlans = useMemo(() => {
     const q = planSearchQuery.toLowerCase().trim();
     if (!q) return sortedBranchPlans;
     return sortedBranchPlans.filter((p: any) => 
       String(p.name || '').toLowerCase().includes(q) ||
       String(p.price || '').includes(q)
     );
   }, [sortedBranchPlans, planSearchQuery]);

   const selectedPlanObject = useMemo(() => {
     return sortedBranchPlans.find((p: any) => p.id === newPlanForm.planId) || (plans || []).find((p: any) => p.id === newPlanForm.planId);
   }, [sortedBranchPlans, plans, newPlanForm.planId]);

   // Searchable Reusable Box Dropdown State
   const [boxSearchQuery, setBoxSearchQuery] = useState('');
   const [isBoxDropdownOpen, setIsBoxDropdownOpen] = useState(false);
   const boxDropdownRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
     const handleClickOutsideBox = (e: MouseEvent) => {
       if (boxDropdownRef.current && !boxDropdownRef.current.contains(e.target as Node)) {
         setIsBoxDropdownOpen(false);
       }
     };
     document.addEventListener('mousedown', handleClickOutsideBox);
     return () => document.removeEventListener('mousedown', handleClickOutsideBox);
   }, []);

   const filteredBoxTypes = useMemo(() => {
     const q = boxSearchQuery.toLowerCase().trim();
     if (!q) return availableBoxTypes;
     return availableBoxTypes.filter((b: any) => 
       String(b.name || '').toLowerCase().includes(q) ||
       String(b.id || '').toLowerCase().includes(q)
     );
   }, [availableBoxTypes, boxSearchQuery]);

   useEffect(() => {
     if (!newPlanForm.planId && sortedBranchPlans.length > 0) {
       setNewPlanForm(p => ({ ...p, planId: sortedBranchPlans[0].id }));
     }
   }, [formData.branchId, sortedBranchPlans]);

   const addPlan = () => {
      const selectedPlan = plans.find((p:any) => p.id === newPlanForm.planId);
      if (!selectedPlan) return;
      
      const weekdays = selectedPlan.weekdays || [1,2,3,4,5,6];
      const endDate = calculateEndDate(newPlanForm.startDate, selectedPlan.numberOfDeliveryDays, weekdays, []);
      setActivePlans([...activePlans, { 
        ...newPlanForm, 
        planName: selectedPlan.name, 
        price: selectedPlan.price, 
        dietPreference: selectedPlan.dietPreference || 'Veg',
        dayDietSchedule: selectedPlan.dayDietSchedule,
        endDate, 
        pauses: [],
        reusableBoxType: newPlanForm.reusableBoxType || 'None',
        boxTagOrNumber: newPlanForm.boxTagOrNumber || '',
        boxDeposit: Number(newPlanForm.boxDeposit) || 0
      }]);
      // Reset isStarred and box tag for next plan
      setNewPlanForm(prev => ({ ...prev, isStarred: false, boxTagOrNumber: '' }));
   };

   const addCustomPlan = () => {
      if (!customPlanForm.name || !customPlanForm.price || !customPlanForm.totalDeliveries) {
        setSubmitError("Please fill all required custom plan fields (name, price, total deliveries).");
        return;
      }
      setSubmitError(null);
      const endDate = calculateEndDate(customPlanForm.startDate, Number(customPlanForm.totalDeliveries), customPlanForm.weekdays, []);
      const newPlans = [];
      for(let i=0; i<customPlanForm.quantity; i++) {
         newPlans.push({
            planId: `custom-${Date.now()}-${i}`,
            planName: customPlanForm.name,
            mealTime: customPlanForm.mealTime as any,
            startDate: customPlanForm.startDate,
            endDate,
            price: Number(customPlanForm.price),
            pauses: [],
            isStarred: customPlanForm.isStarred,
            isCustom: true,
            totalDeliveries: Number(customPlanForm.totalDeliveries),
            weekdays: customPlanForm.weekdays,
            reusableBoxType: customPlanForm.reusableBoxType || 'None',
            boxTagOrNumber: customPlanForm.boxTagOrNumber || '',
            boxDeposit: Number(customPlanForm.boxDeposit) || 0
         });
      }
      setActivePlans([...activePlans, ...newPlans]);
      setIsCustomPlanOpen(false);
      setCustomPlanForm({ 
        name: '', price: '', totalDeliveries: 26, weekdays: [1,2,3,4,5,6], mealTime: 'Lunch', quantity: 1, startDate: getTodayStr(), isStarred: false,
        reusableBoxType: availableBoxTypes[0]?.name || 'None', boxTagOrNumber: '', boxDeposit: 0 
      });
   };

   const plansTotal = activePlans.reduce((sum, p) => sum + Number(p.price), 0);
   const deliveryCharges = Math.max(0, Number(formData.deliveryCharges) || 0);
   const discount = Math.max(0, Number(formData.discount) || 0);
   const finalPayable = Math.max(0, plansTotal + deliveryCharges - discount);
   const pendingAmount = Math.max(0, finalPayable - (Number(formData.amountPaid) || 0));

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (activePlans.length === 0) {
        setSubmitError("Please add at least one subscribed plan for this customer.");
        return;
      }
      const primary = activePlans[0];
      const maxEnd = activePlans.reduce((max, p) => p.endDate > max ? p.endDate : max, activePlans[0].endDate);
      const maxDaysLeft = activePlans.reduce((max, p) => {
        const pc = plans.find(pl => pl.id === p.planId);
        const wds = pc?.weekdays || p.weekdays || [1,2,3,4,5,6];
        const left = calculateRemainingDeliveries(p.endDate, wds, p.pauses || []);
        return left > max ? left : max;
      }, 0);

      const pastPlans = isRenewal 
        ? [...(initialData?.pastPlans || []), ...(initialData?.activePlans || [])]
        : (initialData?.pastPlans || []);

      const isStarred = Boolean(formData.isStarred || activePlans.some(p => p.isStarred));
      const starredQuery = (formData.starredQuery || formData.notes || '').trim();

      const assignedStaff = currentBranchStaff.find((s: any) => s.id === formData.deliveryBoyId);
      const deliveryBoyName = assignedStaff ? assignedStaff.name : (formData.deliveryBoyName || '');

      setIsSubmitting(true);
      setSubmitError(null);
      try {
        await onSubmit({ 
           ...formData, 
           deliveryBoyId: formData.deliveryBoyId,
           deliveryBoyName,
           discount,
           deliveryCharges,
           amountPaid: Number(formData.amountPaid) || 0,
           finalPayable,
           isStarred,
           starredQuery,
           activePlans, 
           pastPlans,
           planId: primary.planId, 
           mealTime: activePlans.map(p => p.mealTime), 
           startDate: primary.startDate, endDate: maxEnd, daysLeft: maxDaysLeft, isActive: true, planPrice: plansTotal, 
           pendingAmount, paymentStatus: pendingAmount > 0 ? 'Pending' : 'Paid',
           renewalCount: initialData ? (isRenewal ? (initialData.renewalCount || 0) + 1 : (initialData.renewalCount || 0)) : 0, 
           routeOrder: initialData ? (initialData.routeOrder ?? 999) : 999 
        });
      } catch (err: any) {
        console.error("Save customer error:", err);
        setSubmitError(err?.message || "Failed to save customer in database. Please check your network and retry.");
      } finally {
        setIsSubmitting(false);
      }
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
         <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[95vh] relative text-left no-scrollbar">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 border-b pb-4">
               <h3 className="text-xl font-black text-slate-900">
                 {isRenewal ? 'Renew Subscription' : (initialData ? 'Edit Customer' : 'Add New Customer')}
               </h3>
               <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
            </div>
            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div><ModalLabel>Branch *</ModalLabel><select required className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm" value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}>{branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                  <div>
                    <ModalLabel>Staff (Delivery Boy) *</ModalLabel>
                    <select 
                      required 
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm" 
                      value={formData.deliveryBoyId} 
                      onChange={e => {
                        const selectedStaffMember = currentBranchStaff.find((s:any) => s.id === e.target.value);
                        setFormData({
                          ...formData, 
                          deliveryBoyId: e.target.value,
                          deliveryBoyName: selectedStaffMember ? selectedStaffMember.name : ''
                        });
                      }}
                    >
                      <option value="">Select Staff</option>
                      {currentBranchStaff.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div><ModalLabel>Name *</ModalLabel><input required className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                  <div><ModalLabel>Mobile *</ModalLabel><input required className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} /></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div><ModalLabel>Address *</ModalLabel><input required className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                  <div><ModalLabel>Area *</ModalLabel><input required className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} /></div>
               </div>

               {/* New Field: Location Link */}
               <div>
                  <ModalLabel>Location Link (Google Maps - Optional)</ModalLabel>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                    <input 
                      placeholder="Paste google maps link here..." 
                      className="w-full pl-10 p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-medium text-slate-700 text-sm" 
                      value={formData.locationLink} 
                      onChange={e => setFormData({...formData, locationLink: e.target.value})} 
                    />
                  </div>
               </div>

               {/* Starred Customer & Special Instructions / Query Notes */}
               <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                     <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
                          checked={formData.isStarred}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormData({ 
                              ...formData, 
                              isStarred: checked,
                              highlightMark: checked && formData.highlightMark === 'None' ? 'VIP' : formData.highlightMark 
                            });
                          }}
                        />
                        <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                          <Star size={16} fill={formData.isStarred ? "#f59e0b" : "none"} className={formData.isStarred ? "text-amber-500" : "text-slate-400"} />
                          Star Customer (VIP / High Priority Tracking)
                        </span>
                     </label>
                     <span className="text-[10px] text-amber-700 font-semibold px-2 py-0.5 rounded-full bg-amber-100/80">
                       Rider & Kitchen Alert
                     </span>
                  </div>

                  <div>
                     <ModalLabel>Customer Special Query & Custom Notes (Dietary / Delivery instructions)</ModalLabel>
                     <textarea 
                       className="w-full p-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none font-medium text-slate-800 text-xs resize-none h-[54px] placeholder:text-slate-400"
                       placeholder="e.g. Ring bell twice, deliver at 2nd floor, less spicy, no onion garlic, call before arriving..."
                       value={formData.starredQuery || formData.notes || ''}
                       onChange={e => setFormData({
                         ...formData, 
                         starredQuery: e.target.value,
                         notes: e.target.value
                       })}
                     />
                  </div>
               </div>

               {/* Highlight Mark */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <ModalLabel>Category / Mark *</ModalLabel>
                   <select 
                    required
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm"
                    value={formData.highlightMark}
                    onChange={e => setFormData({...formData, highlightMark: e.target.value})}
                   >
                     <option value="None">None</option>
                     <option value="VIP">VIP Customer</option>
                     <option value="Dietary">Dietary Control</option>
                     <option value="Allergy">Allergy Alert</option>
                     <option value="Urgent">Urgent Preparation</option>
                   </select>
                 </div>
                 <div>
                   <ModalLabel>Internal Preparation Mark</ModalLabel>
                   <p className="text-xs text-slate-500 mt-2">
                     {formData.isStarred ? '⭐ Customer is Starred - highlighted for cooks & riders.' : 'Standard priority customer.'}
                   </p>
                 </div>
               </div>

               <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-200">
                  <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-widest flex items-center gap-2"><Clock size={14}/> Add Subscribed Plans *</h4>
                  <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                        <div><ModalLabel>Time</ModalLabel><select className="w-full p-2 border rounded-xl font-bold text-xs bg-white" value={newPlanForm.mealTime} onChange={e => setNewPlanForm({...newPlanForm, mealTime: e.target.value as any})}><option value="Breakfast">Breakfast</option><option value="Lunch">Lunch</option><option value="Dinner">Dinner</option></select></div>
                        <div className="md:col-span-2 relative" ref={planDropdownRef}>
                           <div className="flex items-center justify-between">
                              <ModalLabel>Plan (0-9, A-Z) *</ModalLabel>
                              <span className="text-[9px] text-primary-600 font-bold">
                                 {sortedBranchPlans.length} plans
                              </span>
                           </div>

                           {/* Interactive Combobox Trigger Button */}
                           <button
                              type="button"
                              onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                              className="w-full p-2 border border-slate-200 hover:border-primary-400 bg-white rounded-xl font-bold text-xs flex items-center justify-between text-left transition-all shadow-2xs group focus:ring-2 focus:ring-primary-500 focus:outline-none"
                           >
                              <div className="flex items-center gap-2 truncate">
                                 {selectedPlanObject && (
                                    <VegNonVegIcon diet={selectedPlanObject.dietPreference === 'Non-Veg' ? 'Non-Veg' : selectedPlanObject.dietPreference === 'Mixed' ? 'Mixed' : 'Veg'} size={12} />
                                 )}
                                 <span className="truncate text-slate-800">
                                    {selectedPlanObject?.name || 'Select Plan...'}
                                 </span>
                                 {selectedPlanObject?.price && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                                       ₹{selectedPlanObject.price}
                                    </span>
                                 )}
                              </div>
                              <div className="flex items-center gap-1 text-slate-400 group-hover:text-primary-600 shrink-0 ml-1">
                                 <Search size={12} className="opacity-70" />
                                 <ChevronDown size={14} className={`transition-transform duration-200 ${isPlanDropdownOpen ? 'rotate-180 text-primary-600' : ''}`} />
                              </div>
                           </button>

                           {/* Searchable Dropdown Popover */}
                           {isPlanDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 space-y-2 animate-in fade-in zoom-in-95">
                                 {/* Search Input Box */}
                                 <div className="relative">
                                    <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                                    <input
                                       type="text"
                                       placeholder="Search plan (0-9, A-Z)..."
                                       value={planSearchQuery}
                                       onChange={e => setPlanSearchQuery(e.target.value)}
                                       autoFocus
                                       className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-800 placeholder:text-slate-400"
                                    />
                                    {planSearchQuery && (
                                       <button
                                          type="button"
                                          onClick={() => setPlanSearchQuery('')}
                                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                                       >
                                          <X size={13} />
                                       </button>
                                    )}
                                 </div>

                                 {/* Helper indicator */}
                                 <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
                                    <span>{filteredBranchPlans.length} matching</span>
                                    <span>Sorted 0-9, A-Z</span>
                                 </div>

                                 {/* Scrollable list of plans */}
                                 <div className="max-h-56 overflow-y-auto space-y-1 no-scrollbar pr-0.5">
                                    {filteredBranchPlans.length > 0 ? (
                                       filteredBranchPlans.map((p: any) => {
                                          const isSelected = p.id === newPlanForm.planId;
                                          const dietType = p.dietPreference === 'Non-Veg' ? 'Non-Veg' : p.dietPreference === 'Mixed' ? 'Mixed' : 'Veg';
                                          const dietSummary = getPlanDietSummaryLabel(p.dayDietSchedule, p.weekdays || [1,2,3,4,5,6]);
                                          const dietLabel = typeof dietSummary === 'object' && dietSummary !== null ? dietSummary.label : String(dietSummary || 'Pure Veg');
                                          return (
                                             <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                   setNewPlanForm({ ...newPlanForm, planId: p.id });
                                                   setIsPlanDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all ${
                                                   isSelected 
                                                      ? 'bg-primary-50 text-primary-900 border border-primary-200' 
                                                      : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                             >
                                                <div className="truncate flex-1 pr-2">
                                                   <div className="flex items-center gap-1.5">
                                                      <VegNonVegIcon diet={dietType} size={12} />
                                                      <span className="truncate">{p.name}</span>
                                                      {isSelected && <Check size={12} className="text-primary-600 shrink-0" />}
                                                   </div>
                                                   <div className="flex items-center gap-1.5 text-[10px] text-slate-400 block font-normal">
                                                      <span>{p.numberOfDeliveryDays || 26} deliveries • {p.mealTime || 'Daily'}</span>
                                                      <span>•</span>
                                                      <span className="font-medium text-slate-600">{dietLabel}</span>
                                                   </div>
                                                </div>
                                                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">
                                                   ₹{p.price}
                                                </span>
                                             </button>
                                          );
                                       })
                                    ) : (
                                       <div className="py-4 text-center text-xs text-slate-400">
                                          <p>No plans matching "{planSearchQuery}"</p>
                                          <button
                                             type="button"
                                             onClick={() => setPlanSearchQuery('')}
                                             className="text-primary-600 font-bold hover:underline text-[11px] mt-1"
                                          >
                                             Clear search filter
                                          </button>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           )}
                        </div>
                        <div><ModalLabel>Start Date</ModalLabel><input type="date" className="w-full p-2 border rounded-xl font-bold text-xs bg-white" value={newPlanForm.startDate} onChange={e => setNewPlanForm({...newPlanForm, startDate: e.target.value})} /></div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end pt-1 border-t border-slate-100">
                        <div className="md:col-span-6 relative" ref={boxDropdownRef}>
                           <div className="flex items-center justify-between">
                              <ModalLabel>Reusable Box Type (Eco / Tiffin Box)</ModalLabel>
                              <span className="text-[9px] text-primary-600 font-bold">
                                 {availableBoxTypes.length} options
                              </span>
                           </div>

                           {/* Interactive Combobox Trigger Button */}
                           <button
                              type="button"
                              onClick={() => setIsBoxDropdownOpen(!isBoxDropdownOpen)}
                              className="w-full p-2 border border-slate-200 hover:border-primary-400 bg-white rounded-xl font-bold text-xs flex items-center justify-between text-left transition-all shadow-2xs group focus:ring-2 focus:ring-primary-500 focus:outline-none"
                           >
                              <div className="flex items-center gap-1.5 truncate">
                                 <Package size={13} className="text-amber-500 shrink-0" />
                                 <span className="truncate text-slate-800">
                                    {newPlanForm.reusableBoxType || 'Select Box Type...'}
                                 </span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-400 group-hover:text-primary-600 shrink-0 ml-1">
                                 <Search size={12} className="opacity-70" />
                                 <ChevronDown size={14} className={`transition-transform duration-200 ${isBoxDropdownOpen ? 'rotate-180 text-primary-600' : ''}`} />
                              </div>
                           </button>

                           {/* Searchable Dropdown Popover */}
                           {isBoxDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 space-y-2 animate-in fade-in zoom-in-95">
                                 {/* Search Input Box */}
                                 <div className="relative">
                                    <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                                    <input
                                       type="text"
                                       placeholder="Search box type (e.g. Dabba, Bento, Glass)..."
                                       value={boxSearchQuery}
                                       onChange={e => setBoxSearchQuery(e.target.value)}
                                       autoFocus
                                       className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-800 placeholder:text-slate-400"
                                    />
                                    {boxSearchQuery && (
                                       <button
                                          type="button"
                                          onClick={() => setBoxSearchQuery('')}
                                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                                       >
                                          <X size={13} />
                                       </button>
                                    )}
                                 </div>

                                 {/* Helper indicator */}
                                 <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
                                    <span>{filteredBoxTypes.length} types matching</span>
                                    <span>Eco / Tiffin Inventory</span>
                                 </div>

                                 {/* Scrollable list of boxes */}
                                 <div className="max-h-56 overflow-y-auto space-y-1 no-scrollbar pr-0.5">
                                    {filteredBoxTypes.length > 0 ? (
                                       filteredBoxTypes.map((box: any) => {
                                          const isSelected = newPlanForm.reusableBoxType === (box.name || box.id);
                                          return (
                                             <button
                                                key={box.id || box.name}
                                                type="button"
                                                onClick={() => {
                                                   setNewPlanForm({ ...newPlanForm, reusableBoxType: box.name || box.id });
                                                   setIsBoxDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all ${
                                                   isSelected 
                                                      ? 'bg-amber-50 text-amber-900 border border-amber-200' 
                                                      : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                             >
                                                <div className="flex items-center gap-2 truncate">
                                                   <Package size={13} className={isSelected ? "text-amber-600 shrink-0" : "text-slate-400 shrink-0"} />
                                                   <span className="truncate">{box.name}</span>
                                                </div>
                                                {isSelected && <Check size={12} className="text-amber-600 shrink-0" />}
                                             </button>
                                          );
                                       })
                                    ) : (
                                       <div className="py-4 text-center text-xs text-slate-400">
                                          <p>No box types matching "{boxSearchQuery}"</p>
                                          <button
                                             type="button"
                                             onClick={() => setBoxSearchQuery('')}
                                             className="text-primary-600 font-bold hover:underline text-[11px] mt-1"
                                          >
                                             Clear search filter
                                          </button>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           )}
                        </div>
                        <div className="md:col-span-3">
                           <ModalLabel>Box Tag / ID (Optional)</ModalLabel>
                           <input 
                             placeholder="e.g. BX-102"
                             className="w-full p-2 border rounded-xl font-medium text-xs bg-white uppercase"
                             value={newPlanForm.boxTagOrNumber}
                             onChange={e => setNewPlanForm({...newPlanForm, boxTagOrNumber: e.target.value})}
                           />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-1.5">
                           <div className="w-full">
                              <ModalLabel>Deposit (₹)</ModalLabel>
                              <input 
                                type="number"
                                placeholder="0"
                                className="w-full p-2 border rounded-xl font-medium text-xs bg-white"
                                value={newPlanForm.boxDeposit || ''}
                                onChange={e => setNewPlanForm({...newPlanForm, boxDeposit: Number(e.target.value)})}
                              />
                           </div>
                           <div className="flex flex-col items-center">
                              <ModalLabel>Star</ModalLabel>
                              <button 
                                type="button" 
                                onClick={() => setNewPlanForm({...newPlanForm, isStarred: !newPlanForm.isStarred})}
                                className={`p-2 rounded-xl border transition-all ${newPlanForm.isStarred ? 'bg-amber-100 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-300'}`}
                                title="Special preparation required"
                              >
                                <Star size={15} fill={newPlanForm.isStarred ? "currentColor" : "none"} />
                              </button>
                           </div>
                        </div>
                        <div className="md:col-span-1">
                           <button type="button" onClick={addPlan} className="w-full bg-slate-900 text-white py-2 rounded-xl font-bold text-[10px] uppercase hover:bg-black h-9 flex items-center justify-center">Add</button>
                        </div>
                     </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    {!isCustomPlanOpen ? (
                      <button 
                        type="button" 
                        onClick={() => setIsCustomPlanOpen(true)}
                        className="text-[10px] font-black text-primary-600 uppercase flex items-center gap-2 hover:underline"
                      >
                        <Plus size={14} /> Add Custom Plan
                      </button>
                    ) : (
                      <div className="bg-white p-4 rounded-xl border border-primary-100 space-y-4 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center">
                          <h5 className="text-[10px] font-black text-slate-900 uppercase">Custom Plan Details</h5>
                          <button type="button" onClick={() => setIsCustomPlanOpen(false)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><ModalLabel>Plan Name</ModalLabel><input className="w-full p-2 border rounded-lg text-xs" value={customPlanForm.name} onChange={e => setCustomPlanForm({...customPlanForm, name: e.target.value})} /></div>
                          <div><ModalLabel>Price (₹)</ModalLabel><input type="number" className="w-full p-2 border rounded-lg text-xs" value={customPlanForm.price} onChange={e => setCustomPlanForm({...customPlanForm, price: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><ModalLabel>Total Deliveries</ModalLabel><input type="number" className="w-full p-2 border rounded-lg text-xs" value={customPlanForm.totalDeliveries} onChange={e => setCustomPlanForm({...customPlanForm, totalDeliveries: Number(e.target.value)})} /></div>
                          <div><ModalLabel>Meal Time</ModalLabel><select className="w-full p-2 border rounded-lg text-xs" value={customPlanForm.mealTime} onChange={e => setCustomPlanForm({...customPlanForm, mealTime: e.target.value})}><option value="Breakfast">Breakfast</option><option value="Lunch">Lunch</option><option value="Dinner">Dinner</option></select></div>
                        </div>
                        <div>
                          <ModalLabel>Delivery Days</ModalLabel>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {DAYS.map(d => (
                              <button 
                                key={d.value}
                                type="button"
                                onClick={() => setCustomPlanForm(prev => ({
                                  ...prev,
                                  weekdays: prev.weekdays.includes(d.value) ? prev.weekdays.filter(v => v !== d.value) : [...prev.weekdays, d.value]
                                }))}
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${customPlanForm.weekdays.includes(d.value) ? 'bg-primary-600 border-primary-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Plan Reusable Box Config */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="md:col-span-1">
                            <ModalLabel>Reusable Box Type</ModalLabel>
                            <select 
                              className="w-full p-2 border rounded-lg text-xs bg-white font-medium"
                              value={customPlanForm.reusableBoxType}
                              onChange={e => setCustomPlanForm({...customPlanForm, reusableBoxType: e.target.value})}
                            >
                              {availableBoxTypes.map((box: any) => (
                                <option key={box.id || box.name} value={box.name || box.id}>{box.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <ModalLabel>Box Tag / ID</ModalLabel>
                            <input 
                              placeholder="e.g. BX-205"
                              className="w-full p-2 border rounded-lg text-xs bg-white uppercase"
                              value={customPlanForm.boxTagOrNumber}
                              onChange={e => setCustomPlanForm({...customPlanForm, boxTagOrNumber: e.target.value})}
                            />
                          </div>
                          <div>
                            <ModalLabel>Deposit (₹)</ModalLabel>
                            <input 
                              type="number"
                              placeholder="0"
                              className="w-full p-2 border rounded-lg text-xs bg-white"
                              value={customPlanForm.boxDeposit || ''}
                              onChange={e => setCustomPlanForm({...customPlanForm, boxDeposit: Number(e.target.value)})}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 items-end">
                          <div><ModalLabel>Quantity</ModalLabel><input type="number" min="1" className="w-full p-2 border rounded-lg text-xs" value={customPlanForm.quantity} onChange={e => setCustomPlanForm({...customPlanForm, quantity: Number(e.target.value)})} /></div>
                          <div><ModalLabel>Start Date</ModalLabel><input type="date" className="w-full p-2 border rounded-lg text-xs" value={customPlanForm.startDate} onChange={e => setCustomPlanForm({...customPlanForm, startDate: e.target.value})} /></div>
                          <div className="flex flex-col items-center">
                            <ModalLabel>Star</ModalLabel>
                            <button 
                              type="button" 
                              onClick={() => setCustomPlanForm({...customPlanForm, isStarred: !customPlanForm.isStarred})}
                              className={`p-2 rounded-lg border transition-all ${customPlanForm.isStarred ? 'bg-amber-100 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-300'}`}
                            >
                              <Star size={14} fill={customPlanForm.isStarred ? "currentColor" : "none"} />
                            </button>
                          </div>
                        </div>
                        <button type="button" onClick={addCustomPlan} className="w-full bg-primary-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase hover:bg-primary-700">Add Custom Plan</button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mt-2">
                     {activePlans.map((p: any, i: number) => {
                        const isReusable = p.reusableBoxType && p.reusableBoxType !== 'None';
                        return (
                        <div key={i} className={`flex justify-between items-center bg-white p-3 rounded-xl border text-sm shadow-2xs ${p.isStarred ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'}`}>
                           <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${p.mealTime === 'Breakfast' ? 'bg-orange-100 text-orange-600' : p.mealTime === 'Lunch' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{p.mealTime}</span>
                                <div className="font-bold flex items-center gap-1.5 text-slate-900">
                                  <VegNonVegIcon diet={getPlanDietOnDate(p, p.startDate || getTodayStr(), p)} size={11} />
                                  <span>{p.planName} (₹{p.price})</span>
                                  {p.isStarred && <Star size={13} fill="#f59e0b" className="text-amber-500" />}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                 <span className="text-slate-400 font-mono">Starts: {formatDateDDMMYYYY(p.startDate)}</span>
                                 {isReusable ? (
                                   <span className="inline-flex items-center gap-1 font-bold text-teal-800 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md">
                                     🔄 {p.reusableBoxType}
                                     {p.boxTagOrNumber && <span className="font-mono text-slate-500 ml-1">#{p.boxTagOrNumber}</span>}
                                     {p.boxDeposit > 0 && <span className="text-slate-600 ml-1">₹{p.boxDeposit} dep</span>}
                                   </span>
                                 ) : (
                                   <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-medium">📦 Disposable / None</span>
                                 )}
                              </div>
                           </div>
                           <button type="button" onClick={() => setActivePlans(activePlans.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                        </div>
                        );
                     })}
                  </div>
               </div>

               <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 shadow-xl">
                  <div className="flex justify-between text-xs uppercase font-bold text-slate-400"><span>Total Plans: ₹{plansTotal}</span><span>Delivery Charges (Optional ₹)</span></div>
                  <input type="number" className="w-full p-2.5 bg-slate-800 border-none rounded-xl text-white font-bold text-sm outline-none" placeholder="Delivery Charges" value={formData.deliveryCharges ?? ''} onChange={e => setFormData({...formData, deliveryCharges: e.target.value})} />
                  
                  {/* DISCOUNT (OPTIONAL ₹) - IN BETWEEN DELIVERY CHARGE AND TOTAL PAID */}
                  <div className="flex justify-between items-center text-xs uppercase font-bold text-slate-400 pt-1">
                     <span>Discount (Optional ₹)</span>
                     {discount > 0 && (
                        <span className="text-emerald-400 font-bold tracking-wide text-[11px]">-₹{discount} OFF</span>
                     )}
                  </div>
                  <input 
                     type="number" 
                     min="0"
                     className="w-full p-2.5 bg-slate-800 border-none rounded-xl text-white font-bold text-sm outline-none focus:ring-1 focus:ring-emerald-500/50" 
                     placeholder="Discount Amount" 
                     value={formData.discount === 0 ? '' : (formData.discount ?? '')} 
                     onChange={e => setFormData({...formData, discount: e.target.value})} 
                  />

                  {/* PRICE TO BE PAID (DYNAMICALLY UPDATED) */}
                  <div className="flex justify-between items-center bg-slate-800/80 border border-slate-700/60 px-3.5 py-2.5 rounded-xl text-xs my-1">
                     <div className="flex items-center gap-2">
                        <span className="uppercase font-bold text-slate-400 tracking-wider text-[11px]">Price to be Paid:</span>
                        <span className="text-emerald-400 font-mono text-base font-black">₹{finalPayable}</span>
                        {discount > 0 && (
                           <span className="text-[10px] text-slate-400 font-medium">
                              (₹{plansTotal} {deliveryCharges > 0 ? `+ ₹${deliveryCharges}` : ''} - ₹{discount})
                           </span>
                        )}
                     </div>
                     <button
                        type="button"
                        onClick={() => setFormData((prev: any) => ({ ...prev, amountPaid: finalPayable }))}
                        className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="Click to copy Price to be Paid into Total Paid"
                     >
                        Pay Full
                     </button>
                  </div>

                  <ModalLabel><span className="text-slate-400">Total Paid (₹) *</span></ModalLabel>
                  <input required type="number" className="w-full p-2.5 bg-slate-800 border-none rounded-xl text-white font-bold text-lg outline-none" value={formData.amountPaid ?? ''} onChange={e => setFormData({...formData, amountPaid: e.target.value})} />
                  <div className="flex justify-between items-center font-black pt-2 border-t border-white/10">
                     <span className="text-xs uppercase text-slate-400">Due Amount:</span>
                     <span className={`text-xl ${pendingAmount > 0 ? 'text-red-400' : 'text-green-400'}`}>₹{pendingAmount}</span>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4 pb-2">
                  <button type="button" onClick={onClose} disabled={isSubmitting} className="py-3 border-2 border-slate-100 rounded-xl font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Saving Customer...</span>
                      </>
                    ) : (
                      <span>Save Customer</span>
                    )}
                  </button>
               </div>
            </form>
         </div>
      </div>
   );
};

const PauseCustomerModal = ({ customers, branches, plans, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({ branchId: branches[0]?.id || '', customerId: '', mealTime: 'All', start: '', end: '' });
   const [selectedPlanIndices, setSelectedPlanIndices] = useState<number[]>([]);
   const [customerSearch, setCustomerSearch] = useState('');
   const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
   const customerDropdownRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
     const handleClickOutside = (e: MouseEvent) => {
       if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
         setIsCustomerDropdownOpen(false);
       }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);
   
   const branchCustomers = (customers || []).filter((c:any) => c.branchId === formData.branchId);
   const selectedCustomer = branchCustomers.find((c:any) => c.id === formData.customerId);
   const activePlans = selectedCustomer?.activePlans || [];

   useEffect(() => {
     if (!formData.customerId && branchCustomers.length > 0) {
       setFormData(f => ({ ...f, customerId: branchCustomers[0].id }));
     }
   }, [formData.branchId, branchCustomers]);

   const filteredBranchCustomers = useMemo(() => {
     const q = customerSearch.toLowerCase().trim();
     if (!q) return branchCustomers;
     return branchCustomers.filter((c: any) => 
       String(c.name || '').toLowerCase().includes(q) ||
       String(c.mobile || '').includes(q) ||
       String(c.address || '').toLowerCase().includes(q) ||
       String(c.area || '').toLowerCase().includes(q)
     );
   }, [branchCustomers, customerSearch]);

   // Reset selection when mealTime changes
   useEffect(() => {
     setSelectedPlanIndices([]);
   }, [formData.mealTime]);

   const plansToDisplay = useMemo(() => {
     return activePlans.map((p, idx) => ({ ...p, originalIndex: idx }))
       .filter(p => formData.mealTime === 'All' || p.mealTime === formData.mealTime);
   }, [activePlans, formData.mealTime]);

   const togglePlanSelection = (idx: number) => {
     setSelectedPlanIndices(prev => 
       prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
     );
   };

   const selectAllCurrent = () => {
     const currentIndices = plansToDisplay.map(p => p.originalIndex);
     setSelectedPlanIndices(currentIndices);
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
         <div className="bg-white w-full max-w-4xl rounded-3xl p-8 shadow-2xl text-left overflow-y-auto max-h-[90vh] no-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Pause className="text-orange-500" /> Pause Plan Subscription</h3>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500"><X size={24}/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               <div>
                 <ModalLabel>Branch</ModalLabel>
                 <select 
                   className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none cursor-pointer focus:ring-2 focus:ring-primary-500" 
                   value={formData.branchId} 
                   onChange={e => {
                     setFormData({...formData, branchId: e.target.value, customerId: ''});
                     setCustomerSearch('');
                   }}
                 >
                   {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                 </select>
               </div>

               {/* Searchable Customer Dropdown */}
               <div ref={customerDropdownRef} className="relative">
                 <div className="flex items-center justify-between">
                   <ModalLabel>Select Customer *</ModalLabel>
                   <span className="text-[11px] font-bold text-slate-400 mb-1">{branchCustomers.length} customers</span>
                 </div>
                 <div 
                   onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                   className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none flex items-center justify-between cursor-pointer hover:border-primary-500 transition-all shadow-xs"
                 >
                   <div className="flex items-center gap-2 truncate">
                     <UserCircle size={18} className="text-primary-600 shrink-0" />
                     {selectedCustomer ? (
                       <span className="text-slate-800 truncate">
                         {selectedCustomer.name} <span className="text-slate-400 font-normal">({selectedCustomer.mobile || 'No phone'})</span>
                       </span>
                     ) : (
                       <span className="text-slate-400 font-normal">Select or Search Customer...</span>
                     )}
                   </div>
                   <ChevronDown size={16} className={`text-slate-400 transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                 </div>

                 {isCustomerDropdownOpen && (
                   <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                     <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                       <div className="relative flex items-center">
                         <Search size={15} className="absolute left-3 text-slate-400" />
                         <input
                           type="text"
                           autoFocus
                           placeholder="Type to search name, phone, area..."
                           value={customerSearch}
                           onChange={e => setCustomerSearch(e.target.value)}
                           className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary-500"
                         />
                         {customerSearch && (
                           <button 
                             type="button" 
                             onClick={() => setCustomerSearch('')}
                             className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600"
                           >
                             <X size={14} />
                           </button>
                         )}
                       </div>
                     </div>
                     <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 no-scrollbar">
                       {filteredBranchCustomers.length === 0 ? (
                         <div className="p-4 text-center text-xs font-medium text-slate-400">
                           No customers match "{customerSearch}"
                         </div>
                       ) : (
                         filteredBranchCustomers.map((c: any) => {
                           const isSelected = c.id === formData.customerId;
                           return (
                             <button
                               key={c.id}
                               type="button"
                               onClick={() => {
                                 setFormData(prev => ({ ...prev, customerId: c.id }));
                                 setIsCustomerDropdownOpen(false);
                               }}
                               className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-primary-50/60 transition-colors ${isSelected ? 'bg-primary-50 font-bold text-primary-900' : 'text-slate-700'}`}
                             >
                               <div className="truncate">
                                 <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                   {c.name}
                                   {c.area && <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md">{c.area}</span>}
                                 </div>
                                 <div className="text-[11px] text-slate-400 font-medium">{c.mobile || 'No phone'} • {c.address || ''}</div>
                               </div>
                               {isSelected && <Check size={16} className="text-primary-600 shrink-0" />}
                             </button>
                           );
                         })
                       )}
                     </div>
                   </div>
                 )}
               </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 mb-8">
               <div className="flex justify-between items-center">
                  <ModalLabel>Select Timing / Scope</ModalLabel>
                  {plansToDisplay.length > 0 && (
                    <button onClick={selectAllCurrent} className="text-[10px] font-black text-primary-600 uppercase hover:underline">Select All Below</button>
                  )}
               </div>
               <div className="flex flex-wrap gap-2 mt-3">
                  {['All', 'Breakfast', 'Lunch', 'Dinner'].map(t => (
                     <button 
                        key={t}
                        onClick={() => setFormData({...formData, mealTime: t})}
                        className={`px-6 py-2.5 rounded-2xl font-black text-xs transition-all border-2 ${formData.mealTime === t ? 'bg-primary-600 border-primary-700 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                     >
                        {t === 'All' ? 'Entire Subscription' : t}
                     </button>
                  ))}
               </div>

               <div className="mt-8 space-y-3">
                  <ModalLabel>Active Plans Found ({plansToDisplay.length})</ModalLabel>
                  <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-sm">
                     <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-tighter border-b">
                           <tr>
                              <th className="p-3 w-10"></th>
                              <th className="p-3">Timing</th>
                              <th className="p-3">Plan Name</th>
                              <th className="p-3">Price</th>
                              <th className="p-3">Present End</th>
                              <th className="p-3">Delivered</th>
                              <th className="p-3">Paused</th>
                              <th className="p-3">Left</th>
                           </tr>
                        </thead>
                        <tbody className="font-bold text-slate-700 divide-y">
                           {plansToDisplay.map((p) => {
                              const isSelected = selectedPlanIndices.includes(p.originalIndex);
                              const planConfig = plans.find((pc:any) => pc.id === p.planId);
                              const weekdays = planConfig?.weekdays || p.weekdays || [1,2,3,4,5,6];
                              const today = getTodayStr();
                              
                              let delCount = 0;
                              let pCount = 0;
                              let curr = new Date(p.startDate);
                              const end = new Date(p.endDate);
                              while (curr <= end) {
                                 const dStr = curr.toISOString().split('T')[0];
                                 const isP = (p.pauses || []).some((px:any) => dStr >= px.start && dStr <= px.end);
                                 const isH = !weekdays.includes(curr.getDay());
                                 if (!isH) {
                                    if (isP) pCount++;
                                    else if (dStr < today) delCount++;
                                 }
                                 curr.setDate(curr.getDate() + 1);
                              }
                              const left = calculateRemainingDeliveries(p.endDate, weekdays, p.pauses || []);

                              return (
                                 <tr key={p.originalIndex} onClick={() => togglePlanSelection(p.originalIndex)} className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}>
                                    <td className="p-3 text-center">
                                       <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-slate-200'}`}>
                                          {isSelected && <Check size={14} strokeWidth={4} />}
                                       </div>
                                    </td>
                                    <td className="p-3">
                                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${p.mealTime === 'Breakfast' ? 'bg-orange-100 text-orange-600' : p.mealTime === 'Lunch' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                        {p.mealTime}
                                      </span>
                                    </td>
                                    <td className="p-3 truncate max-w-[160px] text-slate-900">
                                      <div className="flex items-center gap-1.5">
                                        <VegNonVegIcon diet={getPlanDietOnDate(planConfig || p, getTodayStr(), p)} size={11} />
                                        <span className="truncate font-semibold">{p.planName}</span>
                                      </div>
                                    </td>
                                    <td className="p-3">₹{p.price}</td>
                                    <td className="p-3 font-mono text-[10px]">{formatDateDDMMYYYY(p.endDate)}</td>
                                    <td className="p-3 text-green-600">{delCount}/{planConfig?.numberOfDeliveryDays || p.totalDeliveries || 26}</td>
                                    <td className="p-3 text-orange-600">{pCount}</td>
                                    <td className="p-3 text-primary-600">{left}</td>
                                 </tr>
                              );
                           })}
                           {plansToDisplay.length === 0 && (
                              <tr><td colSpan={8} className="p-10 text-center text-slate-400 italic">No plans found for this customer matching the selection.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
               <div className="grid grid-cols-2 gap-4">
                  <div><ModalLabel>Pause From</ModalLabel><input type="date" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm focus:ring-2 focus:ring-primary-500" onChange={e => setFormData({...formData, start: e.target.value})} /></div>
                  <div><ModalLabel>Until (Last Pause Day)</ModalLabel><input type="date" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm focus:ring-2 focus:ring-primary-500" onChange={e => setFormData({...formData, end: e.target.value})} /></div>
               </div>

               <div className="space-y-2">
                  {selectedPlanIndices.length > 0 && formData.start && formData.end ? (
                     <div className="bg-primary-600 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between border-b-4 border-primary-800 animate-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-white/20 rounded-2xl"><CalendarDays size={24}/></div>
                           <div>
                              <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">Preview: Expiry Extension</p>
                              <p className="text-sm font-black text-white/80">
                                {selectedPlanIndices.length === 1 ? 'End Date will shift to:' : `${selectedPlanIndices.length} plans will be extended`}
                              </p>
                              {selectedPlanIndices.length === 1 && (
                                <p className="text-xl font-black">
                                  {formatDateDDMMYYYY(calculateEndDate(
                                      activePlans[selectedPlanIndices[0]].startDate, 
                                      plans.find((pc:any) => pc.id === activePlans[selectedPlanIndices[0]].planId)?.numberOfDeliveryDays || activePlans[selectedPlanIndices[0]].totalDeliveries || 26,
                                      plans.find((pc:any) => pc.id === activePlans[selectedPlanIndices[0]].planId)?.weekdays || activePlans[selectedPlanIndices[0]].weekdays || [1,2,3,4,5,6],
                                      [...(activePlans[selectedPlanIndices[0]].pauses || []), { start: formData.start, end: formData.end, type: 'User' }]
                                  ))}
                                </p>
                              )}
                           </div>
                        </div>
                        <span className="bg-white/20 text-[10px] font-black px-3 py-1.5 rounded-full border border-white/20">BULK ACTION</span>
                     </div>
                  ) : (
                     <div className="bg-slate-100 p-6 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-center text-xs">
                        Select plans and dates to confirm pause duration.
                     </div>
                  )}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
               <button onClick={onClose} className="py-4 border-2 border-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-colors uppercase text-xs tracking-widest">Cancel</button>
               <button 
                  disabled={selectedPlanIndices.length === 0 || !formData.start || !formData.end}
                  onClick={() => onSubmit(formData.customerId, selectedPlanIndices, { start: formData.start, end: formData.end, type: 'User' })} 
                  className="py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black shadow-xl shadow-orange-200 transition-all disabled:opacity-50 disabled:grayscale uppercase text-xs tracking-widest"
               >
                  Confirm & Pause {selectedPlanIndices.length} Plan(s)
               </button>
            </div>
         </div>
      </div>
   );
};

const PauseBranchModal = ({ branches, customers, onClose, onSubmit }: any) => {
  const [formData, setFormData] = useState({ branchId: branches[0]?.id || '', timings: [] as string[], start: '', end: '' });

  const toggleTiming = (t: string) => {
    setFormData(prev => ({
      ...prev,
      timings: prev.timings.includes(t) ? prev.timings.filter(x => x !== t) : [...prev.timings, t]
    }));
  };

  const impactSummary = useMemo(() => {
    if (!formData.branchId || formData.timings.length === 0) return { customers: 0, plans: 0 };
    const filtered = customers.filter((c: any) => c.branchId === formData.branchId);
    let planCount = 0;
    filtered.forEach((c: any) => {
      planCount += (c.activePlans || []).filter((p: any) => formData.timings.includes(p.mealTime)).length;
    });
    return { customers: filtered.length, plans: planCount };
  }, [formData.branchId, formData.timings, customers]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
       <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl text-left overflow-y-auto max-h-[90vh] no-scrollbar">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Store className="text-slate-800" /> Pause Branch Delivery</h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500"><X size={24}/></button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <ModalLabel>Select Branch</ModalLabel>
                <select 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  value={formData.branchId}
                  onChange={e => setFormData({...formData, branchId: e.target.value})}
                >
                  {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <ModalLabel>Affected Meal Timings</ModalLabel>
                <div className="flex flex-wrap gap-2">
                  {['Breakfast', 'Lunch', 'Dinner'].map(t => (
                    <button 
                      key={t}
                      type="button"
                      onClick={() => toggleTiming(t)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                        formData.timings.includes(t) 
                          ? 'bg-primary-600 border-primary-700 text-white shadow-lg' 
                          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><ModalLabel>Pause Start Date</ModalLabel><input type="date" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none shadow-sm focus:ring-2 focus:ring-primary-500" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} /></div>
              <div><ModalLabel>Pause End Date</ModalLabel><input type="date" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none shadow-sm focus:ring-2 focus:ring-primary-500" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} /></div>
            </div>

            {impactSummary.plans > 0 ? (
              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Users2 size={80}/></div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/10 rounded-2xl"><Info size={24} className="text-cyan-400" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Estimated Impact</p>
                    <p className="text-lg font-bold">
                      <span className="text-cyan-400">{impactSummary.customers}</span> Customers affected
                    </p>
                    <p className="text-xs text-slate-500">
                      Total <span className="text-white font-black">{impactSummary.plans} plans</span> across selected timings will be extended.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-3xl text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                Select timings to see impact summary.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button onClick={onClose} className="py-4 border-2 border-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-colors uppercase text-xs tracking-widest">Cancel</button>
              <button 
                disabled={formData.timings.length === 0 || !formData.start || !formData.end || impactSummary.plans === 0}
                onClick={() => onSubmit(formData.branchId, formData.timings, { start: formData.start, end: formData.end, type: 'Branch' })}
                className="py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black shadow-xl transition-all disabled:opacity-50 disabled:grayscale uppercase text-xs tracking-widest"
              >
                Apply Branch Pause
              </button>
            </div>
          </div>
       </div>
    </div>
  );
};

const ModalLabel = ({ children }: React.PropsWithChildren<{}>) => (
  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{children}</label>
);

export default Customers;
