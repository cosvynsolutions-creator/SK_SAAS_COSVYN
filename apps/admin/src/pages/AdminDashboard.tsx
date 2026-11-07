import React, { useMemo } from 'react';
import { 
  AreaChart, Area, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  DollarSign, Activity, Users, TrendingUp, Loader2, Repeat, UserPlus, CreditCard, Receipt,
  Building2, Bike, IndianRupee, Sparkles, CheckCircle
} from 'lucide-react';
import { useAdminTenants, useAdminBillingHistory } from '../services/adminDbService';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];

const AdminDashboard = () => {
  const { tenants, loading: l1 } = useAdminTenants();
  const { history, loading: l2 } = useAdminBillingHistory();

  const loading = l1 || l2;

  const metrics = useMemo(() => {
    // 1. Core Counts
    const signups = tenants.length;
    const activeTenants = tenants.filter(t => t.planStatus === 'Active');
    const activeCount = activeTenants.length;
    
    // 2. Revenue Calculations from LIVE History
    const totalLifetimeCollected = history.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    
    // 3. Active Revenue & MRR Logic
    // We sum the actual amount paid for the current active period
    let activeRevenueSum = 0;
    let totalMonthlyEquivalent = 0;

    activeTenants.forEach(tenant => {
      // Find the most recent activation/renewal for this specific tenant
      const userPayments = history
        .filter(h => h.tenantId === tenant.id && (h.type === 'Activation' || h.type === 'Renewal'))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const lastPayment = userPayments[0];
      if (lastPayment) {
        const amount = Number(lastPayment.amount) || 0;
        activeRevenueSum += amount;

        // Infer duration for MRR calculation
        let months = 1;
        const name = (lastPayment.planName || '').toLowerCase();
        if (name.includes('6 months')) months = 6;
        if (name.includes('yearly')) months = 12;
        
        totalMonthlyEquivalent += (amount / months);
      }
    });

    const arpu = activeCount > 0 ? totalMonthlyEquivalent / activeCount : 0;
    const churn = signups > 0 ? ((signups - activeCount) / signups) * 100 : 0;

    // 4. Plan Distribution (Live)
    const planCounts = activeTenants.reduce((acc: any, t) => {
      let key = 'Monthly';
      if (t.planName?.toLowerCase().includes('6 months')) key = '6 Months';
      else if (t.planName?.toLowerCase().includes('yearly')) key = 'Yearly';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const planDistribution = Object.entries(planCounts).map(([name, value]) => ({ 
      name, 
      value: value as number 
    }));

    const todayStr = new Date().toISOString().split('T')[0];
    const loggedInTodayCount = tenants.filter(t => t.lastLoginDate === todayStr).length;
    const totalBranches = tenants.reduce((acc, t) => acc + (Number(t.branchCount) || (t.planStatus === 'Active' ? 1 : 0)), 0);
    const totalRiders = tenants.reduce((acc, t) => acc + (Number(t.deliveryBoysCount) || 0), 0);
    const totalUniqueCust = tenants.reduce((acc, t) => acc + (Number(t.totalUniqueCustomers) || 0), 0);
    const totalActiveCust = tenants.reduce((acc, t) => acc + (Number(t.totalActiveCustomers) || 0), 0);
    const totalKitchenGMV = tenants.reduce((acc, t) => acc + (Number(t.kitchenRevenue) || 0), 0);

    return { 
        activeRevenue: activeRevenueSum,
        lifetimeRevenue: totalLifetimeCollected,
        active: activeCount, 
        mrr: totalMonthlyEquivalent, 
        arpu, 
        churn: churn.toFixed(1), 
        signups,
        planDistribution,
        loggedInTodayCount,
        totalBranches,
        totalRiders,
        totalUniqueCust,
        totalActiveCust,
        totalKitchenGMV
    };
  }, [tenants, history]);

  const trendData = useMemo(() => {
     if (history.length === 0) return [];
     const grouped = history.reduce((acc: any, curr: any) => {
        if (!curr.date) return acc;
        const date = new Date(curr.date);
        if (isNaN(date.getTime())) return acc;
        const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        const sortKey = date.getFullYear() * 100 + date.getMonth(); 
        if (!acc[key]) acc[key] = { name: key, Revenue: 0, sort: sortKey };
        acc[key].Revenue += Number(curr.amount || 0);
        return acc;
     }, {});
     return Object.values(grouped).sort((a: any, b: any) => a.sort - b.sort);
  }, [history]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  const Widget = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
      <div className="bg-slate-900/70 p-6 rounded-[2rem] border border-slate-800 backdrop-blur-sm flex flex-col justify-between h-full hover:border-slate-700 transition-all hover:shadow-2xl hover:shadow-cyan-900/10">
         <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 text-opacity-100`}><Icon size={22} className={colorClass.replace('bg-', 'text-')} /></div>
         </div>
         <div>
            <div className="text-3xl font-black text-white mb-1">{value}</div>
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{title}</div>
            {subtext && <div className="text-slate-600 text-[10px] mt-2 font-bold uppercase">{subtext}</div>}
         </div>
      </div>
  );

  return (
    <div className="space-y-8 pb-12">
      
      {/* 1. SAAS PLATFORM BILLING KPI GRID */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-cyan-400" /> ScaleKitchen SaaS Financials
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Widget title="Lifetime Rev" value={`₹${Math.round(metrics.lifetimeRevenue).toLocaleString()}`} icon={Receipt} colorClass="bg-emerald-500 text-emerald-400" subtext="Total Invoiced" />
          <Widget title="Active MRR" value={`₹${Math.round(metrics.mrr).toLocaleString()}`} icon={Repeat} colorClass="bg-cyan-500 text-cyan-400" subtext={`ARPU: ₹${Math.round(metrics.arpu)}`} />
          <Widget title="Live Owners" value={metrics.active} icon={Activity} colorClass="bg-violet-500 text-violet-400" subtext="Active SaaS Users" />
          <Widget title="Active Rev" value={`₹${Math.round(metrics.activeRevenue).toLocaleString()}`} icon={DollarSign} colorClass="bg-blue-500 text-blue-400" subtext="Current Pool" />
          <Widget title="Churn Rate" value={`${metrics.churn}%`} icon={Users} colorClass="bg-red-500 text-red-400" subtext="Retention Metric" />
          <Widget title="Signups" value={metrics.signups} icon={UserPlus} colorClass="bg-amber-500 text-amber-400" subtext="Lifetime Leads" />
        </div>
      </div>

      {/* 2. BUSINESSES & KITCHEN NETWORK INTELLIGENCE */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Building2 size={14} className="text-indigo-400" /> Kitchens & Network Operations
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Logged In Today</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{metrics.loggedInTodayCount} Owners</div>
              <div className="text-[10px] text-slate-500">Daily SaaS usage</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Activity size={20} className="animate-pulse" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Operating Branches</div>
              <div className="text-2xl font-black text-indigo-400 mt-1">{metrics.totalBranches} Locations</div>
              <div className="text-[10px] text-slate-500">Kitchen facilities</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Building2 size={20} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Delivery Fleet</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{metrics.totalRiders} Riders</div>
              <div className="text-[10px] text-slate-500">Delivery personnel</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Bike size={20} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Customer Reach</div>
              <div className="text-2xl font-black text-blue-400 mt-1">{metrics.totalUniqueCust} Users</div>
              <div className="text-[10px] text-emerald-400 font-bold">{metrics.totalActiveCust} currently active</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users size={20} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Kitchen GMV Volume</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">₹{Math.round(metrics.totalKitchenGMV).toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-slate-500">Customer billings</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <IndianRupee size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* REVENUE TREND */}
         <div className="lg:col-span-2 bg-slate-900/70 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-sm h-96 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
               <TrendingUp size={20} className="text-cyan-400" />
               <h3 className="text-white font-black uppercase tracking-widest text-sm">Monthly Revenue Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={trendData}>
                  <defs>
                     <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontWeight: 900, fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontWeight: 900, fontSize: 10}} tickFormatter={(v) => `₹${v >= 1000 ? v/1000 + 'k' : v}`} />
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }} 
                     formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="#06b6d4" strokeWidth={4} fill="url(#colorRev)" />
               </AreaChart>
            </ResponsiveContainer>
         </div>

         {/* PLAN DISTRIBUTION */}
         <div className="bg-slate-900/70 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-sm h-96 shadow-xl relative">
            <div className="flex items-center gap-3 mb-2">
               <Activity size={20} className="text-violet-400" />
               <h3 className="text-white font-black uppercase tracking-widest text-sm">Plan Popularity</h3>
            </div>
            <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                  <Pie 
                    data={metrics.planDistribution} 
                    cx="50%" cy="50%" 
                    innerRadius={65} 
                    outerRadius={90} 
                    paddingAngle={8} 
                    dataKey="value"
                  >
                     {metrics.planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                     ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none' }} />
               </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center mt-4">
               <p className="text-2xl font-black text-white">{metrics.active}</p>
               <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Users</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AdminDashboard;