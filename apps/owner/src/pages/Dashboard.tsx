import React, { useMemo, useState } from 'react';
import { 
  Users, DollarSign, Package, Loader2, 
  AlertCircle, Calendar, ChevronDown, TrendingUp, ShoppingBag, Activity, BarChart3, PieChart as PieIcon, MapPin
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { useStreamCollection } from '../services/dbService';
import { calculateRemainingDeliveries, getTodayStr, isPlanActiveOnDate, formatDateDDMMYYYY, getCustomerActiveDaysLeft } from '../services/store';
import { GlassmorphicDonutChart } from '../components/GlassmorphicDonutChart';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#6366f1'];

const StatCard = ({ title, value, icon: Icon, colorClass, iconColor, subtext }: any) => (
  <div className="glass-card p-5 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between hover:shadow-glass-hover transition-all duration-300 min-h-[130px]">
    <div className="flex justify-between items-start gap-3">
      <div className="space-y-1 overflow-hidden">
        <p className="text-xs font-semibold text-slate-500 truncate">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 font-display tracking-tight truncate">
          {typeof value === 'number' && (title.toLowerCase().includes('revenue') || title.toLowerCase().includes('payment') || title.toLowerCase().includes('sales')) 
            ? `₹${Math.round(value).toLocaleString('en-IN')}` 
            : value}
        </h3>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass} bg-opacity-15 shadow-xs`}>
        <Icon size={18} className={iconColor} />
      </div>
    </div>
    {subtext && (
      <div className="pt-2 border-t border-slate-100/70">
        <p className="text-xs text-slate-400 font-medium truncate">{subtext}</p>
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: singleOrders = [], loading: l2 } = useStreamCollection<any>('single_orders');
  const { data: plans = [], loading: l3 } = useStreamCollection<any>('plans');
  const { data: branches = [], loading: l4 } = useStreamCollection<any>('branches');
  const { data: payments = [], loading: l5 } = useStreamCollection<any>('payments');

  const isLoading = l1 || l2 || l3 || l4 || l5;

  // Defaults: All Branches, All Years
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  // If manager or user is locked to a single branch, lock selection
  React.useEffect(() => {
    if (branches.length === 1 && selectedBranch !== branches[0].id) {
      setSelectedBranch(branches[0].id);
    }
  }, [branches, selectedBranch]);

  const today = new Date();
  const formattedToday = formatDateDDMMYYYY(today);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    customers.forEach(c => { if(c.createdAt) years.add(new Date(c.createdAt).getFullYear().toString()); });
    singleOrders.forEach(o => { if(o.date) years.add(new Date(o.date).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [customers, singleOrders]);

  const kpis = useMemo(() => {
    if (isLoading) return { subRevenue: 0, pending: 0, unqCust: 0, activeCust: 0, plansToday: 0, singleRev: 0, singleCount: 0 };

    const todayStr = getTodayStr();
    const dayOfWeek = new Date().getDay();

    const filteredCust = customers.filter((c: any) => {
      const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || !c.createdAt || new Date(c.createdAt).getFullYear().toString() === selectedYear;
      return matchesBranch && matchesYear;
    });

    const filteredSingles = singleOrders.filter((o: any) => {
      const matchesBranch = selectedBranch === 'All' || o.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || !o.date || new Date(o.date).getFullYear().toString() === selectedYear;
      return matchesBranch && matchesYear;
    });

    const subRevenue = filteredCust.reduce((acc, c) => acc + (Number(c.planPrice) || 0) + (Number(c.deliveryCharges) || 0), 0);
    const pending = filteredCust.reduce((acc, c) => acc + (Number(c.pendingAmount) || 0), 0);
    
    // FIX: LIVE DATA CALCULATION - Matches Customer Page Logic
    const unqCust = filteredCust.length;
    const activeCust = filteredCust.filter(c => {
      if (!c.isActive) return false;
      const status = getCustomerActiveDaysLeft(c, plans);
      return !status.isExpired;
    }).length;

    let plansToday = 0;
    customers.filter(c => c.isActive && (selectedBranch === 'All' || c.branchId === selectedBranch)).forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        const planConfig = plans.find(p => p.id === ap.planId);
        if (isPlanActiveOnDate(ap, todayStr, planConfig)) {
          plansToday += (Number(ap.quantity) || 1);
        }
      });
    });

    const singleRev = filteredSingles.reduce((acc, o) => acc + (Number(o.amount) || 0) + (Number(o.deliveryCharges) || 0), 0);
    const singleCount = filteredSingles.length;

    return { subRevenue, pending, unqCust, activeCust, plansToday, singleRev, singleCount };
  }, [customers, singleOrders, plans, selectedBranch, selectedYear, isLoading]);

  const cashFlowData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, idx) => {
      const subRev = payments
        .filter((p: any) => {
          const d = new Date(p.date);
          const matchesDate = d.getMonth() === idx && (selectedYear === 'All' || d.getFullYear().toString() === selectedYear);
          const cust = customers.find(c => c.id === p.customerId);
          const matchesBranch = selectedBranch === 'All' || (cust && cust.branchId === selectedBranch);
          return matchesDate && matchesBranch;
        })
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const sRev = singleOrders
        .filter((o: any) => {
          const d = new Date(o.date);
          const matchesDate = d.getMonth() === idx && (selectedYear === 'All' || d.getFullYear().toString() === selectedYear);
          const matchesBranch = selectedBranch === 'All' || o.branchId === selectedBranch;
          return matchesDate && matchesBranch;
        })
        .reduce((a, b) => a + (Number(b.amount) || 0) + (Number(b.deliveryCharges) || 0), 0);

      return { name: m, amount: subRev + sRev };
    });
  }, [payments, singleOrders, customers, selectedBranch, selectedYear]);

  const planRevenueData = useMemo(() => {
    const map: Record<string, number> = {};
    customers.filter(c => {
      const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || !c.createdAt || new Date(c.createdAt).getFullYear().toString() === selectedYear;
      return matchesBranch && matchesYear;
    }).forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        map[ap.planName] = (map[ap.planName] || 0) + Number(ap.price || 0);
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [customers, selectedBranch, selectedYear]);

  const customerGrowthData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, idx) => {
      const count = customers.filter(c => {
        const d = new Date(c.createdAt);
        const matchesDate = d.getMonth() === idx && (selectedYear === 'All' || d.getFullYear().toString() === selectedYear);
        const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
        return matchesDate && matchesBranch;
      }).length;
      return { name: m, count };
    });
  }, [customers, selectedBranch, selectedYear]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary-600" size={36} />
        <p className="text-xs font-medium text-slate-400">Loading dashboard insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 pt-1 animate-in fade-in duration-300">
      
      {/* Header & Filters Unified Row */}
      <div className="glass-panel p-4 rounded-2xl border border-white/80 shadow-glass flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display">Dashboard Overview</h1>
            <p className="text-xs text-slate-500 hidden sm:block">Real-time performance and kitchen metrics</p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-xl text-xs font-medium text-slate-600 border border-slate-200/60 shadow-xs">
            <Calendar size={13} className="text-primary-600" />
            <span>{formattedToday}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <select 
              className="pl-3 pr-8 py-2 bg-white/85 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 appearance-none cursor-pointer transition-all" 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {branches.length > 1 && <option value="All">All Branches</option>}
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          <div className="relative">
            <select 
              className="pl-3 pr-8 py-2 bg-white/85 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 appearance-none cursor-pointer transition-all" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="All">All Years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* KPI Section */}
      <div className="space-y-4">
        {/* Row 1: Revenue & Pending */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Subscription Revenue" value={kpis.subRevenue} icon={DollarSign} colorClass="bg-emerald-600" iconColor="text-emerald-600" subtext="Total collected payments" />
          <StatCard title="Pending Payments" value={kpis.pending} icon={AlertCircle} colorClass="bg-rose-500" iconColor="text-rose-500" subtext="Collection balance due" />
          <StatCard title="Active Subscriptions" value={kpis.activeCust} icon={Activity} colorClass="bg-indigo-600" iconColor="text-indigo-600" subtext="Currently receiving deliveries" />
          <StatCard title="Total Customers" value={kpis.unqCust} icon={Users} colorClass="bg-blue-600" iconColor="text-blue-600" subtext="Registered customer base" />
        </div>

        {/* Row 2: Single Orders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard title="Single Order Sales" value={kpis.singleRev} icon={TrendingUp} colorClass="bg-cyan-600" iconColor="text-cyan-600" subtext="One-off meal purchases" />
          <StatCard title="Single Order Deliveries" value={kpis.singleCount} icon={ShoppingBag} colorClass="bg-violet-600" iconColor="text-violet-600" subtext="Completed standalone orders" />
        </div>

        {/* Row 3: Kitchen Daily Preparation Featured Glass Card */}
        <div className="w-full">
           <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-glass-lg border border-slate-700/60 flex items-center justify-between group">
              <div className="absolute -right-8 -top-8 w-44 h-44 bg-primary-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                 <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                   <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kitchen Schedule Today</p>
                 </div>
                 <div className="flex items-baseline gap-2 mt-2">
                   <h3 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">{kpis.plansToday}</h3>
                   <span className="text-sm font-medium text-slate-300">meal boxes queued for dispatch</span>
                 </div>
              </div>
              <div className="relative z-10 w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center text-primary-300 shadow-inner group-hover:scale-105 transition-transform">
                 <Package size={22} />
              </div>
           </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Cash Flow Chart */}
        <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass flex flex-col h-[380px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl border border-primary-100/60 shadow-xs"><BarChart3 size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Monthly Cash Flow</h3>
                <p className="text-xs text-slate-400">{selectedYear === 'All' ? 'Complete transaction history' : `Year ${selectedYear}`}</p>
              </div>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={cashFlowData}>
                    <defs>
                      <linearGradient id="cashFlowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip 
                      cursor={{fill: 'rgba(241, 245, 249, 0.6)', radius: 8}} 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs">
                              <p className="font-bold text-slate-800 font-display mb-1">{label}</p>
                              <p className="text-primary-600 font-black font-mono text-sm">₹{Number(payload[0].value).toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Collected Collections</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="amount" fill="url(#cashFlowGrad)" radius={[8, 8, 2, 2]} barSize={26} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Plan Wise Revenue Pie */}
        <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass flex flex-col min-h-[410px]">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100/60 shadow-xs"><PieIcon size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Plan Revenue Distribution</h3>
                <p className="text-xs text-slate-400">{selectedYear === 'All' ? 'All-time volume breakdown' : `Year ${selectedYear}`}</p>
              </div>
           </div>
           <div className="flex-1">
              <GlassmorphicDonutChart 
                data={planRevenueData}
                centerLabel="Total Volume"
                height={260}
                isCurrency={true}
              />
           </div>
        </div>

        {/* Customer Growth Area Chart (Full Width on 2-col grid) */}
        <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass flex flex-col h-[380px] lg:col-span-2">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/60 shadow-xs"><TrendingUp size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Customer Signup Velocity</h3>
                <p className="text-xs text-slate-400">{selectedYear === 'All' ? 'Historical monthly registrations' : `Signups in ${selectedYear}`}</p>
              </div>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={customerGrowthData}>
                    <defs>
                      <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} allowDecimals={false} />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs">
                              <p className="font-bold text-slate-800 font-display mb-0.5">{label}</p>
                              <p className="text-emerald-600 font-bold font-mono text-sm">{payload[0].value} signups</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} fill="url(#growthGradient)" dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, fill: '#059669', stroke: '#fff', strokeWidth: 2 }} name="New Signups" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;