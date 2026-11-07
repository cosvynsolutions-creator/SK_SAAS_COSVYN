import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Download, Loader2, UserCheck, UserX, Clock, MapPin, Calendar,
  Building2, Bike, Users, IndianRupee, RefreshCw, Eye, Phone, MessageSquare, 
  Mail, Activity, CheckCircle, AlertCircle, X, ShieldAlert, Sparkles, TrendingUp, Shield,
  Key, Trash2
} from 'lucide-react';
import { 
  useAdminTenants, 
  syncBusinessLiveStats, 
  syncAllBusinessesLiveStats, 
  fetchBusinessDetailedDossier 
} from '../services/adminDbService';
import { getDaysDifference, formatDateDDMMYYYY } from '../services/adminStore';
import { migrateCredentialsCallable, purgeLegacyDriverDocsCallable } from '../services/firebase';

const AdminUsers = () => {
  const { tenants, loading } = useAdminTenants();
  const [activeTab, setActiveTab] = useState<'owners' | 'signups'>('owners');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');
  
  // Selected business for Dossier Modal
  const [selectedBizId, setSelectedBizId] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [bizDossier, setBizDossier] = useState<any>(null);

  // Selected business for Login History Modal
  const [loginHistoryBiz, setLoginHistoryBiz] = useState<any | null>(null);

  // Filters for each column
  const [filters, setFilters] = useState({
     business: '',
     owner: '',
     number: '',
     loginStatus: 'all', // all | today | week | inactive
     plan: '',
     status: '',
     city: '',
     state: ''
  });

  // Auto-sync initial stats and auto-audit out-of-sync trial expiry dates in background
  useEffect(() => {
    if (tenants.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const needsAudit = tenants.filter(t => {
        // Missing live aggregate counts
        if (t.branchCount === undefined || t.kitchenRevenue === undefined) return true;
        // Check if tenant is on Free Trial but dates need alignment
        if ((t.planName || '').toLowerCase().includes('trial')) {
          const historicalDates: string[] = [];
          if (t.createdAt) historicalDates.push(t.createdAt.split('T')[0]);
          if (t.trialOriginalStartDate) historicalDates.push(t.trialOriginalStartDate.split('T')[0]);
          if (t.trialStartDate) historicalDates.push(t.trialStartDate.split('T')[0]);
          if (Array.isArray(t.recentLoginDates)) {
            t.recentLoginDates.forEach((d: string) => {
              if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) historicalDates.push(d);
            });
          }
          historicalDates.sort();
          if (historicalDates.length > 0) {
            const earliestOrigin = historicalDates[0];
            const expObj = new Date(earliestOrigin);
            expObj.setDate(expObj.getDate() + 30);
            const correctExp = expObj.toISOString().split('T')[0];
            if (t.planExpiryDate > correctExp || t.trialStartDate !== earliestOrigin || !t.trialClaimed) {
              return true;
            }
          }
        }
        return false;
      });

      if (needsAudit.length > 0) {
        const idsToSync = needsAudit.slice(0, 10).map(t => t.id);
        syncAllBusinessesLiveStats(idsToSync).catch(console.warn);
      }
    }
  }, [tenants]);

  const handleManualSyncAll = async () => {
    if (isSyncing || tenants.length === 0) return;
    setIsSyncing(true);
    setSyncStatusText(`Auditing ${tenants.length} businesses...`);
    try {
      await syncAllBusinessesLiveStats(tenants.map(t => t.id));
      setSyncStatusText('All business metrics successfully updated!');
      setTimeout(() => setSyncStatusText(''), 4000);
    } catch (err) {
      console.error("Manual sync failed:", err);
      setSyncStatusText('Sync completed with partial updates.');
      setTimeout(() => setSyncStatusText(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMigrateCredentials = async () => {
    if (isMigrating) return;
    if (!window.confirm("Migrate all plaintext delivery staff PINs and manager passwords to hashed credentials and staff_credentials subcollections?")) return;
    setIsMigrating(true);
    setSyncStatusText("Migrating credentials to bcrypt hashes and staff_credentials...");
    try {
      const res = await migrateCredentialsCallable();
      const resData = (res.data || {}) as any;
      setSyncStatusText(`Migration complete! Migrated: ${resData.migratedStaffCount || 0} staff PINs, ${resData.migratedManagersCount || 0} managers, ${resData.migratedGlobalDriversCount || 0} auth lookups.`);
      setTimeout(() => setSyncStatusText(''), 6000);
    } catch (err: any) {
      console.error("Migration failed:", err);
      setSyncStatusText(`Migration error: ${err.message || 'Failed'}`);
      setTimeout(() => setSyncStatusText(''), 6000);
    } finally {
      setIsMigrating(false);
    }
  };

  const handlePurgeLegacyDocs = async () => {
    if (isPurging) return;
    if (!window.confirm("Permanently purge legacy global_features docs (driver_auth_* and driver_manifest_*) to prevent credential and customer leaks?")) return;
    setIsPurging(true);
    setSyncStatusText("Purging legacy driver docs from global_features...");
    try {
      const res = await purgeLegacyDriverDocsCallable();
      const resData = (res.data || {}) as any;
      setSyncStatusText(`Purge complete! Deleted ${resData.deletedCount || 0} legacy driver documents.`);
      setTimeout(() => setSyncStatusText(''), 6000);
    } catch (err: any) {
      console.error("Purge failed:", err);
      setSyncStatusText(`Purge error: ${err.message || 'Failed'}`);
      setTimeout(() => setSyncStatusText(''), 6000);
    } finally {
      setIsPurging(false);
    }
  };

  const handleOpenDossier = async (biz: any) => {
    setSelectedBizId(biz.id);
    setDossierLoading(true);
    try {
      const dossier = await fetchBusinessDetailedDossier(biz.id);
      setBizDossier(dossier);
    } catch (e) {
      console.error("Error loading dossier:", e);
    } finally {
      setDossierLoading(false);
    }
  };

  // 1. Separate Owners vs Signups
  const filteredByTab = useMemo(() => {
    return tenants.filter(t => {
      const isInactiveSignup = t.planStatus === 'Inactive' || t.planName === 'None' || !t.planStatus;
      if (activeTab === 'owners') {
        return !isInactiveSignup;
      } else {
        return isInactiveSignup;
      }
    });
  }, [tenants, activeTab]);

  // Today string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 2. Apply Column & Login Filters
  const displayedTenants = useMemo(() => {
    return filteredByTab.filter(t => {
      const matchesSearch = (
        (t.businessName || '').toLowerCase().includes(filters.business.toLowerCase()) &&
        ((t.ownerName || '').toLowerCase().includes(filters.owner.toLowerCase()) || (t.email || '').toLowerCase().includes(filters.owner.toLowerCase())) &&
        (t.mobile || '').includes(filters.number) &&
        (t.planName || '').toLowerCase().includes(filters.plan.toLowerCase()) &&
        (t.planStatus || '').toLowerCase().includes(filters.status.toLowerCase()) &&
        (t.city || '').toLowerCase().includes(filters.city.toLowerCase()) &&
        (t.state || '').toLowerCase().includes(filters.state.toLowerCase())
      );

      if (!matchesSearch) return false;

      if (filters.loginStatus === 'today') {
        return t.lastLoginDate === todayStr;
      } else if (filters.loginStatus === 'week') {
        if (!t.lastLoginDate) return false;
        const diff = getDaysDifference(t.lastLoginDate, todayStr);
        return diff >= 0 && diff <= 7;
      } else if (filters.loginStatus === 'inactive') {
        if (!t.lastLoginDate) return true;
        const diff = getDaysDifference(t.lastLoginDate, todayStr);
        return diff > 7;
      }

      return true;
    });
  }, [filteredByTab, filters, todayStr]);

  // Aggregate stats across all filtered businesses
  const summaryKPIs = useMemo(() => {
    const list = filteredByTab;
    const totalCount = list.length;
    const loggedInTodayCount = list.filter(t => t.lastLoginDate === todayStr).length;
    const totalBranches = list.reduce((sum, t) => sum + (Number(t.branchCount) || 0), 0);
    const totalRiders = list.reduce((sum, t) => sum + (Number(t.deliveryBoysCount) || 0), 0);
    const totalUniqueCust = list.reduce((sum, t) => sum + (Number(t.totalUniqueCustomers) || 0), 0);
    const totalActiveCust = list.reduce((sum, t) => sum + (Number(t.totalActiveCustomers) || 0), 0);
    const totalKitchenRevenue = list.reduce((sum, t) => sum + (Number(t.kitchenRevenue) || 0), 0);

    return {
      totalCount,
      loggedInTodayCount,
      totalBranches,
      totalRiders,
      totalUniqueCust,
      totalActiveCust,
      totalKitchenRevenue
    };
  }, [filteredByTab, todayStr]);

  const handleExportCSV = () => {
    const headers = [
      "Business ID", "Business Name", "Owner Name", "Email", "Mobile", 
      "City", "State", "Plan Name", "Plan Status", "Expiry Date", 
      "Days Left", "Last Login Date", "Last Login At", "Login Count", 
      "Branches", "Delivery Boys", "Total Unique Customers", "Total Active Customers", "Kitchen Revenue (INR)"
    ];

    const rows = displayedTenants.map(t => {
      const daysLeft = t.planExpiryDate ? getDaysDifference(todayStr, t.planExpiryDate) : 0;
      return [
        `"${t.id || ''}"`,
        `"${(t.businessName || '').replace(/"/g, '""')}"`,
        `"${(t.ownerName || '').replace(/"/g, '""')}"`,
        `"${t.email || ''}"`,
        `"${t.mobile || ''}"`,
        `"${t.city || ''}"`,
        `"${t.state || ''}"`,
        `"${t.planName || ''}"`,
        `"${t.planStatus || ''}"`,
        `"${t.planExpiryDate || ''}"`,
        daysLeft,
        `"${t.lastLoginDate || ''}"`,
        `"${t.lastLoginAt || ''}"`,
        t.loginCount || 0,
        t.branchCount || 0,
        t.deliveryBoysCount || 0,
        t.totalUniqueCustomers || 0,
        t.totalActiveCustomers || 0,
        t.kitchenRevenue || 0
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scalekitchen_businesses_${activeTab}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {activeTab === 'owners' ? 'Business Owners & Kitchen Intelligence' : 'Unconverted Signups (No Plan)'}
            </h1>
            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-black px-2.5 py-0.5 rounded-full">
              {displayedTenants.length} Businesses
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time tracking of owner daily logins, branch count, delivery boys, unique customer base, and kitchen turnover.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button 
            onClick={handleMigrateCredentials}
            disabled={isMigrating}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Migrate plaintext rider PINs and manager passwords into staff_credentials subcollection and bcrypt hashes"
          >
            <Key size={14} className={isMigrating ? "animate-spin" : ""} />
            {isMigrating ? "Migrating..." : "Migrate Credentials"}
          </button>

          <button 
            onClick={handlePurgeLegacyDocs}
            disabled={isPurging}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Purge legacy global_features documents (driver_auth_* and driver_manifest_*) to prevent data leakage"
          >
            <Trash2 size={14} className={isPurging ? "animate-spin" : ""} />
            {isPurging ? "Purging..." : "Purge Legacy Docs"}
          </button>

          <button 
            onClick={handleManualSyncAll}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Recalculate branches, delivery boys, customer counts, and kitchen revenues live from Firestore subcollections"
          >
            <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Auditing Databases..." : "Sync All Stats"}
          </button>

          <button 
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {syncStatusText && (
        <div className="bg-cyan-950/60 border border-cyan-800 text-cyan-200 text-xs px-4 py-2 rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle size={14} className="text-cyan-400 shrink-0" />
          <span>{syncStatusText}</span>
        </div>
      )}

      {/* AGGREGATED METRICS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Kitchens</span>
            <Building2 size={15} className="text-cyan-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">{summaryKPIs.totalCount}</div>
          <div className="text-[10px] text-slate-500">Registered SaaS</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Active Today</span>
            <Activity size={15} className="text-emerald-400 animate-pulse" />
          </div>
          <div className="text-xl font-black text-emerald-400 mt-1">{summaryKPIs.loggedInTodayCount}</div>
          <div className="text-[10px] text-slate-500">Logged In Today</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Branches</span>
            <Building2 size={15} className="text-indigo-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">{summaryKPIs.totalBranches}</div>
          <div className="text-[10px] text-slate-500">Operating Kitchens</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Delivery Staff</span>
            <Bike size={15} className="text-amber-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">{summaryKPIs.totalRiders}</div>
          <div className="text-[10px] text-slate-500">Active Riders</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Unq Customers</span>
            <Users size={15} className="text-blue-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">{summaryKPIs.totalUniqueCust}</div>
          <div className="text-[10px] text-slate-500">All Subscribed</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Subs</span>
            <CheckCircle size={15} className="text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">{summaryKPIs.totalActiveCust}</div>
          <div className="text-[10px] text-slate-500">Currently Eating</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Gross Rev</span>
            <IndianRupee size={15} className="text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400 mt-1">₹{Math.round(summaryKPIs.totalKitchenRevenue).toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-500">Kitchen Sales</div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex space-x-2 bg-slate-900/50 p-1 rounded-xl border border-slate-800 w-full sm:w-fit">
        <button 
          onClick={() => setActiveTab('owners')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none justify-center ${
            activeTab === 'owners' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <UserCheck size={16} /> Active & Paid Businesses
        </button>
        <button 
          onClick={() => setActiveTab('signups')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none justify-center ${
            activeTab === 'signups' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <UserX size={16} /> Free Signups (No Plan)
        </button>
      </div>

      {/* TABLE CONTAINER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1450px]">
            <thead className="bg-slate-950 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              {/* HEADER ROW */}
              <tr>
                <th className="p-3.5 border-b border-slate-800 min-w-[190px]">Kitchen Business</th>
                <th className="p-3.5 border-b border-slate-800 min-w-[210px]">Owner / Contact</th>
                <th className="p-3.5 border-b border-slate-800 min-w-[160px]">Daily Login Activity</th>
                <th className="p-3.5 border-b border-slate-800 text-center min-w-[100px]">Branches</th>
                <th className="p-3.5 border-b border-slate-800 text-center min-w-[110px]">Delivery Boys</th>
                <th className="p-3.5 border-b border-slate-800 text-center min-w-[130px]">Unq / Active Cust</th>
                <th className="p-3.5 border-b border-slate-800 min-w-[130px]">Kitchen Revenue</th>
                <th className="p-3.5 border-b border-slate-800 min-w-[130px]">SaaS Plan</th>
                <th className="p-3.5 border-b border-slate-800 text-center min-w-[100px]">Exp In</th>
                <th className="p-3.5 border-b border-slate-800 min-w-[110px]">City / State</th>
                <th className="p-3.5 border-b border-slate-800 text-center min-w-[100px]">Dossier</th>
              </tr>
              {/* FILTER ROW */}
              <tr className="bg-slate-900/90 text-xs">
                <th className="p-2 border-b border-slate-800">
                  <input 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" 
                    placeholder="Search Kitchen..." 
                    value={filters.business} 
                    onChange={e => setFilters({...filters, business: e.target.value})} 
                  />
                </th>
                <th className="p-2 border-b border-slate-800">
                  <input 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" 
                    placeholder="Owner, Email, Mobile..." 
                    value={filters.owner} 
                    onChange={e => setFilters({...filters, owner: e.target.value})} 
                  />
                </th>
                <th className="p-2 border-b border-slate-800">
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" 
                    value={filters.loginStatus} 
                    onChange={e => setFilters({...filters, loginStatus: e.target.value})}
                  >
                    <option value="all">All Activity</option>
                    <option value="today">Logged in Today</option>
                    <option value="week">Active in 7 Days</option>
                    <option value="inactive">Inactive &gt; 7 Days</option>
                  </select>
                </th>
                <th className="p-2 border-b border-slate-800"></th>
                <th className="p-2 border-b border-slate-800"></th>
                <th className="p-2 border-b border-slate-800"></th>
                <th className="p-2 border-b border-slate-800"></th>
                <th className="p-2 border-b border-slate-800">
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" 
                    value={filters.plan} 
                    onChange={e => setFilters({...filters, plan: e.target.value})}
                  >
                    <option value="">All Plans</option>
                    <option value="Free Trial">Free Trial</option>
                    <option value="Monthly">Monthly</option>
                    <option value="6 Months">6 Months</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </th>
                <th className="p-2 border-b border-slate-800"></th>
                <th className="p-2 border-b border-slate-800">
                  <input 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:border-cyan-500 outline-none" 
                    placeholder="Filter City..." 
                    value={filters.city} 
                    onChange={e => setFilters({...filters, city: e.target.value})} 
                  />
                </th>
                <th className="p-2 border-b border-slate-800"></th>
              </tr>
            </thead>

            <tbody className="text-sm text-slate-300 divide-y divide-slate-800/60">
              {displayedTenants.map((t, idx) => {
                const daysLeft = t.planExpiryDate ? getDaysDifference(todayStr, t.planExpiryDate) : 0;
                const isExpired = daysLeft < 0;
                const cleanPlanName = t.planName?.replace('COSVYN ONE', '').replace(/[()]/g, '').trim() || 'No Plan';

                // Login Info
                const isLoggedToday = t.lastLoginDate === todayStr;
                const daysSinceLogin = t.lastLoginDate ? getDaysDifference(t.lastLoginDate, todayStr) : null;
                const loginCount = t.loginCount || (t.lastLoginDate ? 1 : 0);

                // WhatsApp link
                const cleanPhone = (t.mobile || '').replace(/\D/g, '');
                const whatsappMsg = `Hello ${t.ownerName || 'Partner'}, this is ScaleKitchen SaaS Support checking in on your kitchen operations. How can we assist you today?`;
                const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMsg)}`;

                return (
                  <tr key={t.id || idx} className="hover:bg-slate-800/40 transition-colors group">
                    {/* 1. BUSINESS */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                          {t.logoUrl ? (
                            <img src={t.logoUrl} alt={t.businessName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-cyan-400 font-black text-sm uppercase">
                              {(t.businessName || 'K')[0]}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white text-sm truncate max-w-[160px] group-hover:text-cyan-400 transition-colors">
                            {t.businessName || 'Unnamed Kitchen'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                            {t.businessCategory || 'Cloud Kitchen'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. OWNER & CONTACT */}
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-200 text-xs">{t.ownerName || 'Unknown Owner'}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px] font-mono">{t.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-300 font-mono">{t.mobile || '-'}</span>
                        {cleanPhone && (
                          <div className="flex items-center gap-1">
                            <a 
                              href={whatsappUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              title="Chat with Owner on WhatsApp"
                              className="text-emerald-400 hover:text-emerald-300 p-0.5 rounded transition-colors"
                            >
                              <MessageSquare size={13} />
                            </a>
                            <a 
                              href={`tel:${t.mobile}`} 
                              title="Call Owner"
                              className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded transition-colors"
                            >
                              <Phone size={13} />
                            </a>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 3. DAILY LOGIN ACTIVITY */}
                    <td className="p-3.5">
                      <div>
                        {isLoggedToday ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Logged In Today
                          </span>
                        ) : daysSinceLogin === 1 ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Active Yesterday
                          </span>
                        ) : daysSinceLogin !== null && daysSinceLogin <= 7 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            <Clock size={11} /> {daysSinceLogin}d ago
                          </span>
                        ) : t.lastLoginDate ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            <Clock size={11} /> {daysSinceLogin}d ago
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            Never Logged In
                          </span>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <button 
                            onClick={() => setLoginHistoryBiz(t)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline font-bold flex items-center gap-1"
                          >
                            <span>{loginCount} logins</span>
                            <span className="text-slate-500">• Details</span>
                          </button>
                          {t.lastLoginAt && (
                            <span className="text-[10px] text-slate-500 truncate">
                              {new Date(t.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 4. BRANCHES */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-bold">
                        <Building2 size={13} className="text-indigo-400" />
                        {t.branchCount !== undefined ? t.branchCount : 1}
                      </span>
                    </td>

                    {/* 5. DELIVERY BOYS */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold">
                        <Bike size={13} className="text-amber-400" />
                        {t.deliveryBoysCount !== undefined ? t.deliveryBoysCount : 0}
                      </span>
                    </td>

                    {/* 6. UNIQUE & ACTIVE CUSTOMERS */}
                    <td className="p-3.5 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                          <Users size={12} className="text-blue-400" />
                          <span>{t.totalUniqueCustomers || 0} unq</span>
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-400 mt-0.5">
                          {t.totalActiveCustomers || 0} active
                        </div>
                      </div>
                    </td>

                    {/* 7. KITCHEN REVENUE */}
                    <td className="p-3.5">
                      <div className="font-black text-emerald-400 text-sm">
                        ₹{(Number(t.kitchenRevenue) || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-500">Customer Billings</div>
                    </td>

                    {/* 8. SAAS PLAN */}
                    <td className="p-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-medium border border-slate-700 truncate max-w-[130px]">
                          {cleanPlanName}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          t.planStatus === 'Active' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 
                          t.planStatus === 'Inactive' ? 'bg-slate-800 text-slate-400' :
                          'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}>
                          {t.planStatus || 'Unknown'}
                        </span>
                      </div>
                    </td>

                    {/* 9. EXP IN */}
                    <td className="p-3.5 text-center">
                      {activeTab === 'owners' ? (
                        <div className="flex flex-col items-center">
                          <span className={`font-bold text-xs ${
                            isExpired ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-slate-300'
                          }`}>
                            {isExpired ? 'Expired' : `${daysLeft} days`}
                          </span>
                          {t.planExpiryDate && (
                            <span className="text-[10px] text-slate-500 mt-0.5">{formatDateDDMMYYYY(t.planExpiryDate)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* 10. CITY & STATE */}
                    <td className="p-3.5">
                      <div className="text-xs text-slate-300 truncate max-w-[110px]">{t.city || '-'}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[110px]">{t.state || '-'}</div>
                    </td>

                    {/* 11. DOSSIER ACTION */}
                    <td className="p-3.5 text-center">
                      <button 
                        onClick={() => handleOpenDossier(t)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-400 transition-all border border-slate-700 shadow-sm"
                        title="View Full Business Dossier"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {displayedTenants.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-500">
                    <Search size={32} className="mb-2 opacity-50 mx-auto" />
                    <p className="font-bold text-slate-400">No businesses match the specified filters.</p>
                    <p className="text-xs text-slate-500 mt-1">Try clearing or adjusting your search queries.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: OWNER LOGIN HISTORY & DAILY ACTIVITY AUDIT */}
      {loginHistoryBiz && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Owner Login Activity</h3>
                  <p className="text-xs text-slate-400">{loginHistoryBiz.businessName || 'Business Audit'}</p>
                </div>
              </div>
              <button 
                onClick={() => setLoginHistoryBiz(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Owner Name:</span>
                  <span className="font-bold text-white">{loginHistoryBiz.ownerName || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Registered Email:</span>
                  <span className="font-mono text-cyan-400">{loginHistoryBiz.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total Lifetime Logins:</span>
                  <span className="font-black text-emerald-400 text-sm">{loginHistoryBiz.loginCount || 1} logins</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Latest Session Timestamp:</span>
                  <span className="font-mono text-slate-300">
                    {loginHistoryBiz.lastLoginAt 
                      ? `${formatDateDDMMYYYY(loginHistoryBiz.lastLoginAt)} ${new Date(loginHistoryBiz.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                      : (loginHistoryBiz.lastLoginDate ? formatDateDDMMYYYY(loginHistoryBiz.lastLoginDate) : 'No record')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Logged In Today:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    loginHistoryBiz.lastLoginDate === todayStr 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {loginHistoryBiz.lastLoginDate === todayStr ? 'YES (Active)' : 'NO'}
                  </span>
                </div>
              </div>

              {/* FREE TRIAL LIFECYCLE & TAMPER AUDIT */}
              {(loginHistoryBiz.planName || '').toLowerCase().includes('trial') && (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={13} className="text-emerald-400" />
                      Free Trial Lifecycle & Anti-Tamper
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Locked & Enforced
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Account / Trial Origin:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {formatDateDDMMYYYY(loginHistoryBiz.trialStartDate || loginHistoryBiz.createdAt) || (Array.isArray(loginHistoryBiz.recentLoginDates) ? formatDateDDMMYYYY([...loginHistoryBiz.recentLoginDates].sort()[0]) : 'N/A')}
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Trial Expiry Date:</span>
                      <span className="font-mono font-bold text-cyan-400">
                        {loginHistoryBiz.planExpiryDate ? formatDateDDMMYYYY(loginHistoryBiz.planExpiryDate) : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400">Days Remaining:</span>
                    <span className="font-bold text-emerald-400">
                      {loginHistoryBiz.planExpiryDate ? `${getDaysDifference(todayStr, loginHistoryBiz.planExpiryDate)} days` : '0 days'}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!loginHistoryBiz.id) return;
                      await syncBusinessLiveStats(loginHistoryBiz.id);
                      const freshBiz = tenants.find(t => t.id === loginHistoryBiz.id);
                      if (freshBiz) setLoginHistoryBiz(freshBiz);
                    }}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw size={12} />
                    Re-align & Enforce Trial Dates From Origin
                  </button>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={13} className="text-cyan-400" />
                  Recent Daily Login Audit
                </h4>
                <div className="space-y-1.5">
                  {Array.isArray(loginHistoryBiz.recentLoginDates) && loginHistoryBiz.recentLoginDates.length > 0 ? (
                    loginHistoryBiz.recentLoginDates.map((date: string, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-emerald-400" />
                          <span className="font-mono text-slate-200">{formatDateDDMMYYYY(date)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {date === todayStr ? 'Today' : `${getDaysDifference(date, todayStr)} days ago`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl">
                      {loginHistoryBiz.lastLoginDate 
                        ? `Recorded login on ${formatDateDDMMYYYY(loginHistoryBiz.lastLoginDate)}. Ongoing tracking enabled.` 
                        : 'No historical login records yet.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button 
                onClick={() => setLoginHistoryBiz(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: COMPREHENSIVE BUSINESS DOSSIER (Branches, Delivery Boys, Customers, Revenue) */}
      {selectedBizId && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            {/* MODAL HEADER */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                  {bizDossier?.business?.logoUrl ? (
                    <img src={bizDossier.business.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-cyan-400 font-black text-2xl uppercase">
                      {(bizDossier?.business?.businessName || 'K')[0]}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">
                    {bizDossier?.business?.businessName || 'Kitchen Profile'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Owner: <span className="text-slate-200 font-bold">{bizDossier?.business?.ownerName || 'Unknown'}</span> ({bizDossier?.business?.email})
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">
                      {bizDossier?.business?.businessCategory || 'Cloud Kitchen'}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <MapPin size={11} /> {bizDossier?.business?.city || 'City'}, {bizDossier?.business?.state || 'State'}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => { setSelectedBizId(null); setBizDossier(null); }}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {dossierLoading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-cyan-400 mb-3" size={32} />
                  <p className="text-xs text-slate-400 font-bold">Auditing business databases & subcollections...</p>
                </div>
              ) : (
                <>
                  {/* METRIC STRIP */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Operating Branches</span>
                      <div className="text-xl font-black text-indigo-400 mt-1 flex items-center gap-1.5">
                        <Building2 size={16} />
                        {bizDossier?.branches?.length || 0}
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Delivery Fleet</span>
                      <div className="text-xl font-black text-amber-400 mt-1 flex items-center gap-1.5">
                        <Bike size={16} />
                        {bizDossier?.staff?.length || 0}
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Subscribed Cust</span>
                      <div className="text-xl font-black text-blue-400 mt-1 flex items-center gap-1.5">
                        <Users size={16} />
                        {bizDossier?.customers?.length || 0}
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Total Turnover</span>
                      <div className="text-xl font-black text-emerald-400 mt-1 flex items-center gap-1">
                        <IndianRupee size={16} />
                        {Math.round(bizDossier?.business?.kitchenRevenue || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* BRANCHES LIST */}
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Building2 size={16} className="text-indigo-400" />
                      Kitchen Branches ({bizDossier?.branches?.length || 0})
                    </h3>
                    {bizDossier?.branches?.length === 0 ? (
                      <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-500 text-xs text-center">
                        No secondary branches configured. Operating from single primary kitchen.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {bizDossier?.branches?.map((branch: any) => (
                          <div key={branch.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                            <div className="font-bold text-white text-xs">{branch.name}</div>
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                              <MapPin size={11} className="shrink-0" />
                              <span className="truncate">{branch.address || 'Address unlisted'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-mono">{branch.phone || 'No phone'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DELIVERY BOYS FLEET */}
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Bike size={16} className="text-amber-400" />
                      Delivery Boys Fleet ({bizDossier?.staff?.length || 0})
                    </h3>
                    {bizDossier?.staff?.length === 0 ? (
                      <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-500 text-xs text-center">
                        No delivery personnel added yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {bizDossier?.staff?.map((rider: any) => (
                          <div key={rider.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-white text-xs">{rider.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">{rider.phone || rider.mobile || '-'}</div>
                              <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded mt-1 inline-block uppercase font-bold">
                                {rider.role || 'Rider'}
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              rider.status === 'Active' || rider.isOnline 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {rider.status || 'Offline'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CONTACT OWNER DIRECTLY */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                      <h4 className="font-bold text-white text-xs">Direct Support & Outreach</h4>
                      <p className="text-[11px] text-slate-400">Communicate directly with {bizDossier?.business?.ownerName || 'the owner'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {bizDossier?.business?.mobile && (
                        <>
                          <a 
                            href={`https://wa.me/${(bizDossier.business.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent('Hello! ScaleKitchen Support here. How are operations going today?')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                          >
                            <MessageSquare size={13} /> WhatsApp
                          </a>
                          <a 
                            href={`tel:${bizDossier.business.mobile}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm"
                          >
                            <Phone size={13} /> Call
                          </a>
                        </>
                      )}
                      {bizDossier?.business?.email && (
                        <a 
                          href={`mailto:${bizDossier.business.email}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold shadow-sm"
                        >
                          <Mail size={13} /> Email
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* FOOTER */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button 
                onClick={() => { setSelectedBizId(null); setBizDossier(null); }}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
