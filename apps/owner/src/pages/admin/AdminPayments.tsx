
import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, Loader2, Download, Search, Calendar, FileText
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useAdminBillingHistory, useAdminTenants } from '../../services/dbService';
import { formatDateDDMMYYYY } from '../../services/store';

const AdminPayments = () => {
  const [filterPlan, setFilterPlan] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // FETCH REAL DATA
  const { history, loading: l1 } = useAdminBillingHistory();
  const { tenants, loading: l2 } = useAdminTenants();

  const loading = l1 || l2;

  // Combine Payment Data with Tenant Info
  const paymentsWithDetails = useMemo(() => {
    return history.map(pay => {
      const tenant = tenants.find(t => t.id === pay.tenantId);

      return {
        ...pay,
        businessName: tenant?.businessName || 'Unknown Business',
        ownerName: tenant?.ownerName || 'Unknown Owner',
        mobile: tenant?.mobile || 'Unknown',
        planType: pay.planName || 'Unknown',
        amountPaid: pay.amount || 0,
        startDate: pay.date || new Date().toISOString(),
        transactionId: pay.paymentId || pay.id // Prefer paymentId if available
      };
    }).sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [history, tenants]);

  // Apply Filters
  const filteredPayments = useMemo(() => {
     return paymentsWithDetails.filter(p => {
        const matchesPlan = filterPlan === 'All' || (p.planType && p.planType.includes(filterPlan));
        const matchesSearch = 
           (p.businessName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
           (p.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
           (p.transactionId || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesPlan && matchesSearch;
     });
  }, [paymentsWithDetails, filterPlan, searchQuery]);

  const totalCollected = filteredPayments.reduce((acc, curr) => acc + curr.amountPaid, 0);

  // Real chart data for trend based on Filtered Payments
  const chartData = useMemo(() => {
     if (filteredPayments.length === 0) return [];
     
     // Group by Date YYYY-MM-DD
     const grouped = filteredPayments.reduce((acc: any, curr: any) => {
        const date = curr.startDate.split('T')[0];
        if (!acc[date]) acc[date] = 0;
        acc[date] += curr.amountPaid;
        return acc;
     }, {});

     const sortedDates = Object.keys(grouped).sort();
     return sortedDates.map(date => ({ name: formatDateDDMMYYYY(date), value: grouped[date] }));
  }, [filteredPayments]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-white">Payment History</h1>
           <p className="text-xs text-slate-400">Real-time SaaS subscription transactions.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex justify-between items-center w-full md:w-auto gap-4">
              <p className="text-xs text-slate-400 uppercase font-bold whitespace-nowrap">Total Collected</p>
              <p className="text-xl font-bold text-emerald-400">₹{totalCollected.toLocaleString()}</p>
           </div>
           <button className="p-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors">
              <Download size={20} />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* CHART */}
         <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-400"/> Revenue Trend</h3>
            <div className="h-60 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData}>
                      <defs>
                         <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                         </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }} />
                      <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fill="url(#colorPaid)" />
                   </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
              )}
            </div>
         </div>

         {/* CONTROLS */}
         <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-white font-bold mb-4">Search & Filter</h3>
            <div className="space-y-4">
               <div>
                  <div className="relative">
                     <Search className="absolute left-3 top-3 text-slate-500" size={16} />
                     <input 
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:border-emerald-500 outline-none transition-colors"
                       placeholder="Search business, owner or ID..."
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                     />
                  </div>
               </div>
               <div>
                  <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Subscription Plan</label>
                  <div className="flex flex-wrap gap-2">
                     {['All', 'Monthly', '6 Months', 'Yearly'].map(plan => (
                        <button 
                          key={plan}
                          onClick={() => setFilterPlan(plan)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${
                            filterPlan === plan 
                             ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold' 
                             : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                          }`}
                        >
                           {plan}
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-950/50 text-xs uppercase font-bold text-slate-500">
                   <tr>
                      <th className="px-6 py-4">Transaction Date</th>
                      <th className="px-6 py-4">Business Details</th>
                      <th className="px-6 py-4">Plan</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Transaction ID</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                   {filteredPayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                         <td className="px-6 py-4 text-slate-400 text-sm">
                            <div className="flex items-center gap-2">
                               <Calendar size={14} />
                               {formatDateDDMMYYYY(p.startDate)}
                            </div>
                            <div className="text-xs text-slate-500 pl-6 mt-0.5">
                               {new Date(p.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="font-bold text-white text-sm">{p.businessName}</div>
                            <div className="text-xs text-slate-500">{p.ownerName} • {p.mobile}</div>
                         </td>
                         <td className="px-6 py-4">
                            <span className="text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 px-2 py-1 rounded inline-block">
                               {p.planType}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right text-emerald-400 font-bold font-mono">
                            ₹{p.amountPaid.toLocaleString()}
                         </td>
                         <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Paid
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <div className="text-xs text-slate-500 font-mono flex items-center justify-end gap-1">
                               <FileText size={12} /> {p.transactionId}
                            </div>
                         </td>
                      </tr>
                   ))}
                   {filteredPayments.length === 0 && (
                      <tr><td colSpan={6} className="p-12 text-center text-slate-500">No payment records found.</td></tr>
                   )}
                </tbody>
             </table>
          </div>
      </div>

    </div>
  );
};

export default AdminPayments;
