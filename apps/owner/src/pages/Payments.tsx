import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  DollarSign, AlertCircle, TrendingUp, Calendar, Search, 
  Loader2, Phone, ChevronDown, Receipt, Filter, ArrowRight, Wallet, Building2
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const StatCard = ({ title, value, icon: Icon, colorClass, iconColor, subtext }: any) => (
  <div className="glass-card p-5 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between hover:shadow-glass-hover transition-all duration-300 min-h-[130px]">
    <div className="flex justify-between items-start gap-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
          {typeof value === 'number' 
            ? `₹${Math.round(value).toLocaleString('en-IN')}` 
            : value}
        </h3>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass} bg-opacity-10 shadow-xs`}>
        <Icon size={18} className={iconColor || colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
    {subtext && (
      <div className="mt-2">
        <p className="text-[11px] text-slate-400 font-medium">{subtext}</p>
      </div>
    )}
  </div>
);

const Payments = () => {
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: payments = [], loading: l2 } = useStreamCollection<any>('payments');
  const { data: branches = [], loading: l3 } = useStreamCollection<any>('branches');

  const isLoading = l1 || l2 || l3;

  // Top Global Filters - UPDATED DEFAULT TO 'All'
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  // Outstanding List Specific Filters
  const [listBranch, setListBranch] = useState('All');
  const [listYear, setListYear] = useState('All');
  const [listMonth, setListMonth] = useState('All');
  const [listSearch, setListSearch] = useState('');

  // Auto-lock branch filter to single branch (e.g. for branch manager)
  React.useEffect(() => {
    if (branches.length === 1) {
      if (selectedBranch !== branches[0].id) setSelectedBranch(branches[0].id);
      if (listBranch !== branches[0].id) setListBranch(branches[0].id);
    }
  }, [branches, selectedBranch, listBranch]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    customers.forEach(c => { if(c.createdAt) years.add(new Date(c.createdAt).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [customers]);

  // Derived Metrics based on Global Filters
  const metrics = useMemo(() => {
    const filteredCust = customers.filter(c => {
      const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || !c.createdAt || new Date(c.createdAt).getFullYear().toString() === selectedYear;
      return matchesBranch && matchesYear;
    });

    const totalRevenue = filteredCust.reduce((acc, c) => acc + (Number(c.planPrice) || 0) + (Number(c.deliveryCharges) || 0), 0);
    const totalCollected = filteredCust.reduce((acc, c) => acc + (Number(c.amountPaid) || 0), 0);
    const totalPending = filteredCust.reduce((acc, c) => acc + (Number(c.pendingAmount) || 0), 0);

    const branchPending: Record<string, number> = {};
    filteredCust.forEach(c => {
      const bName = branches.find(b => b.id === c.branchId)?.name || 'Main';
      branchPending[bName] = (branchPending[bName] || 0) + (Number(c.pendingAmount) || 0);
    });

    return { totalRevenue, totalCollected, totalPending, branchPending };
  }, [customers, branches, selectedBranch, selectedYear]);

  // Charts Logic
  const chartYear = selectedYear === 'All' ? new Date().getFullYear().toString() : selectedYear;

  const cashFlowTrend = useMemo(() => {
    return MONTHS.map((m, idx) => {
      const total = payments
        .filter((p: any) => {
          const d = new Date(p.date);
          const matchesDate = d.getMonth() === idx && d.getFullYear().toString() === chartYear;
          const cust = customers.find(c => c.id === p.customerId);
          const matchesBranch = selectedBranch === 'All' || (cust && cust.branchId === selectedBranch);
          return matchesDate && matchesBranch;
        })
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      return { name: m, amount: total };
    });
  }, [payments, customers, chartYear, selectedBranch]);

  const pendingDuesTrend = useMemo(() => {
    return MONTHS.map((m, idx) => {
      const total = customers
        .filter((c: any) => {
          const d = new Date(c.createdAt || c.startDate);
          const matchesDate = d.getMonth() === idx && d.getFullYear().toString() === chartYear;
          const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
          return matchesDate && matchesBranch;
        })
        .reduce((acc, c) => acc + (Number(c.pendingAmount) || 0), 0);
      return { name: m, amount: total };
    });
  }, [customers, chartYear, selectedBranch]);

  const realizationData = [
    { name: 'Paid', value: metrics.totalCollected },
    { name: 'Pending', value: metrics.totalPending }
  ];

  // Outstanding List Logic
  const outstandingList = useMemo(() => {
    return customers.filter(c => {
      if ((Number(c.pendingAmount) || 0) <= 0) return false;
      const d = new Date(c.createdAt || c.startDate);
      const matchesBranch = listBranch === 'All' || c.branchId === listBranch;
      const matchesYear = listYear === 'All' || d.getFullYear().toString() === listYear;
      const matchesMonth = listMonth === 'All' || d.getMonth().toString() === listMonth;
      const matchesSearch = c.name.toLowerCase().includes(listSearch.toLowerCase()) || c.mobile.includes(listSearch);
      return matchesBranch && matchesYear && matchesMonth && matchesSearch;
    }).sort((a, b) => (Number(b.pendingAmount) || 0) - (Number(a.pendingAmount) || 0));
  }, [customers, listBranch, listYear, listMonth, listSearch]);

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" size={48} /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* Header & Global Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display tracking-tight flex items-center gap-2.5">
             Payments & Collections
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Track collections, outstanding balances, and cash flow</p>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-44">
            <select 
              className="w-full pl-3 pr-8 py-2 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer appearance-none" 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="All">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
          <div className="relative flex-1 sm:flex-none sm:w-36">
            <select 
              className="w-full pl-3 pr-8 py-2 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer appearance-none" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="All">All Years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard title="Total Revenue" value={metrics.totalRevenue} icon={DollarSign} colorClass="bg-blue-50" iconColor="text-blue-600" subtext="Plans + Delivery Charges" />
        <StatCard title="Total Collected" value={metrics.totalCollected} icon={Receipt} colorClass="bg-emerald-50" iconColor="text-emerald-600" subtext="Received from Customers" />
        <StatCard title="Total Pending" value={metrics.totalPending} icon={AlertCircle} colorClass="bg-rose-50" iconColor="text-rose-600" subtext="Outstanding Dues" />
        <div className="glass-card p-5 rounded-2xl border border-white/80 shadow-glass min-h-[130px] flex flex-col justify-between overflow-hidden relative">
           <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Branch-wise Pending</p>
              <div className="space-y-1.5 max-h-[70px] overflow-y-auto no-scrollbar relative z-10">
                 {Object.entries(metrics.branchPending).map(([name, amt]) => (
                   <div key={name} className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-600 truncate mr-2">{name}</span>
                      <span className="font-bold font-mono text-rose-600 shrink-0">₹{amt.toLocaleString()}</span>
                   </div>
                 ))}
                 {Object.keys(metrics.branchPending).length === 0 && <p className="text-xs text-slate-400 italic">No pending balances</p>}
              </div>
           </div>
           <Building2 className="absolute -right-2 -bottom-2 text-slate-200/40 pointer-events-none" size={56} />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-white/80 shadow-glass flex flex-col h-[380px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/60 shadow-xs"><TrendingUp size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Month-on-Month Cash Flow ({chartYear})</h3>
                <p className="text-xs text-slate-400 font-medium">Realized revenue timeline</p>
              </div>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={cashFlowTrend}>
                    <defs>
                      <linearGradient id="paymentCashFlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs">
                              <p className="font-bold text-slate-800 font-display mb-0.5">{label}</p>
                              <p className="text-emerald-600 font-bold font-mono text-sm">₹{Number(payload[0].value).toLocaleString()}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fill="url(#paymentCashFlow)" dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, fill: '#059669', stroke: '#fff', strokeWidth: 2 }} />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Realization Pie */}
        <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass flex flex-col h-[380px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/60 shadow-xs"><Wallet size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Revenue Realization</h3>
                <p className="text-xs text-slate-400 font-medium">Collected vs Pending ratio</p>
              </div>
           </div>
           <div className="flex-1 relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={realizationData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="value">
                       {realizationData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0];
                          return (
                            <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs">
                              <p className="font-bold text-slate-800 font-display">{item.name}</p>
                              <p className="text-primary-600 font-bold font-mono mt-0.5">₹{Number(item.value).toLocaleString()}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569' }} />
                 </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                 <p className="text-base font-extrabold text-slate-900 font-display">₹{Math.round(metrics.totalRevenue / 1000)}k</p>
              </div>
           </div>
        </div>
      </div>

      {/* Pending Dues Trend */}
      <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass flex flex-col h-[350px]">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/60 shadow-xs"><AlertCircle size={18}/></div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Month-on-Month Pending Dues ({chartYear})</h3>
              <p className="text-xs text-slate-400 font-medium">Uncollected balance trend</p>
            </div>
         </div>
         <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={pendingDuesTrend}>
                  <defs>
                    <linearGradient id="pendingBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95}/>
                      <stop offset="100%" stopColor="#fb7185" stopOpacity={0.5}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255, 241, 242, 0.6)', radius: 8}} 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs">
                            <p className="font-bold text-slate-800 font-display mb-0.5">{label}</p>
                            <p className="text-rose-600 font-bold font-mono">₹{Number(payload[0].value).toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Pending</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" fill="url(#pendingBarGrad)" radius={[8, 8, 2, 2]} barSize={26} />
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* Outstanding Payments List Section */}
      <div className="space-y-6">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
               <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/60 shadow-xs"><AlertCircle size={20}/></div>
               <div>
                  <h2 className="text-lg font-bold text-slate-900 font-display tracking-tight">Outstanding Payments List</h2>
                  <p className="text-xs text-slate-500 font-medium">Subscribers with pending fee balance</p>
               </div>
            </div>
            
            {/* List Sub-Filters */}
            <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
               <div className="relative flex-1 sm:flex-none">
                  <select 
                    className="w-full sm:w-36 pl-3 pr-8 py-2 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none appearance-none"
                    value={listBranch} onChange={e => setListBranch(e.target.value)}
                  >
                     <option value="All">All Branches</option>
                     {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13}/>
               </div>
               <div className="relative flex-1 sm:flex-none">
                  <select 
                    className="w-full sm:w-32 pl-3 pr-8 py-2 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none appearance-none"
                    value={listYear} onChange={e => setListYear(e.target.value)}
                  >
                     <option value="All">All Years</option>
                     {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13}/>
               </div>
               <div className="relative flex-1 sm:flex-none">
                  <select 
                    className="w-full sm:w-32 pl-3 pr-8 py-2 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none appearance-none"
                    value={listMonth} onChange={e => setListMonth(e.target.value)}
                  >
                     <option value="All">All Months</option>
                     {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13}/>
               </div>
            </div>
         </div>

         <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center gap-3 bg-white/40">
               <Search className="text-slate-400" size={18} />
               <input 
                 className="flex-1 bg-transparent border-none outline-none font-bold text-slate-600 text-xs placeholder:text-slate-300" 
                 placeholder="Search by name or number..." 
                 value={listSearch} onChange={e => setListSearch(e.target.value)}
               />
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                     <tr>
                        <th className="p-5">Customer</th>
                        <th className="p-5">Branch</th>
                        <th className="p-5">Plan Status</th>
                        <th className="p-5 text-right">Paid</th>
                        <th className="p-5 text-right">Pending Amount</th>
                        <th className="p-5 text-center">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {outstandingList.map((c) => {
                        const branchName = branches.find(b => b.id === c.branchId)?.name || 'Main';
                        const primaryPlan = (c.activePlans && c.activePlans.length > 0) ? c.activePlans[0].planName : 'No Plan';

                        return (
                           <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="p-5">
                                 <div className="font-black text-slate-900 text-sm uppercase">{c.name}</div>
                                 <div className="text-[10px] font-mono text-slate-400">{c.mobile}</div>
                              </td>
                              <td className="p-5">
                                 <span className="text-[10px] font-black text-slate-500 uppercase">{branchName}</span>
                              </td>
                              <td className="p-5">
                                 <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${c.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                    <span className="text-xs font-bold text-slate-700">{primaryPlan}</span>
                                 </div>
                              </td>
                              <td className="p-5 text-right font-black text-slate-400 text-sm">₹{c.amountPaid || 0}</td>
                              <td className="p-5 text-right">
                                 <div className="font-black text-rose-600 text-lg">₹{c.pendingAmount}</div>
                              </td>
                              <td className="p-5 text-center">
                                 <a 
                                   href={`tel:${c.mobile}`}
                                   className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
                                 >
                                    <Phone size={14}/> Call
                                 </a>
                              </td>
                           </tr>
                        );
                     })}
                     {outstandingList.length === 0 && (
                        <tr><td colSpan={6} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">No outstanding payments found.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

    </div>
  );
};

export default Payments;