import React, { useState, useMemo } from 'react';
import { 
  FileStack, Search, Loader2, CreditCard, Sparkles, Receipt, 
  History, User, ArrowRight, TrendingUp, DollarSign, ChevronDown, ChevronUp, Download, Clock
} from 'lucide-react';
import { useAdminTenants, useAdminBillingHistory } from '../services/adminDbService';
import { formatDateDDMMYYYY } from '../services/adminStore';

const AdminInvoiceCredits = () => {
  const { tenants, loading: tenantsLoading } = useAdminTenants();
  const { history, loading: historyLoading } = useAdminBillingHistory();
  
  const [search, setSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const loading = tenantsLoading || historyLoading;

  // 1. Filter only Invoice Recharges from global history
  const invoiceRecharges = useMemo(() => {
    return history.filter(h => h.type === 'Invoice Recharge');
  }, [history]);

  // 2. Group data per user for the list
  const userCreditData = useMemo(() => {
    return tenants.map(t => {
      const userHistory = invoiceRecharges
        .filter(h => h.tenantId === t.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const totalSpent = userHistory.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
      const freeLeft = Math.max(0, 3 - (t.monthlyFreeUsed || 0));
      
      return {
        ...t,
        freeLeft,
        paidLeft: t.purchasedInvoiceCredits || 0,
        totalSpent,
        rechargeCount: userHistory.length,
        history: userHistory
      };
    }).filter(u => 
      u.businessName?.toLowerCase().includes(search.toLowerCase()) || 
      u.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [tenants, invoiceRecharges, search]);

  // 3. Global Dashboard Stats
  const globalStats = useMemo(() => {
    const totalCollected = invoiceRecharges.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
    const activePaidCredits = tenants.reduce((sum, t) => sum + (t.purchasedInvoiceCredits || 0), 0);
    return { totalCollected, activePaidCredits, totalTransactions: invoiceRecharges.length };
  }, [invoiceRecharges, tenants]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-8 pb-12">
      
      {/* GLOBAL HUD */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
           <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <FileStack className="text-cyan-400" /> Invoice Credit Management
           </h1>
           <p className="text-slate-500 font-medium mt-1">Live tracking of user invoice balances and add-on revenue.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full xl:w-auto">
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex flex-col justify-center min-w-[220px] shadow-xl hover:border-emerald-500/30 transition-colors">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                 <DollarSign size={10} className="text-emerald-400" /> Invoice Revenue
              </p>
              <h3 className="text-3xl font-black text-white">₹{globalStats.totalCollected.toLocaleString()}</h3>
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex flex-col justify-center min-w-[220px] shadow-xl hover:border-cyan-500/30 transition-colors">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                 <CreditCard size={10} className="text-cyan-400" /> Active Credits
              </p>
              <h3 className="text-3xl font-black text-white">{globalStats.activePaidCredits} <span className="text-xs text-slate-500 uppercase font-black ml-1">Paid</span></h3>
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex flex-col justify-center min-w-[220px] shadow-xl hover:border-violet-500/30 transition-colors">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                 <TrendingUp size={10} className="text-violet-400" /> Sales Volume
              </p>
              <h3 className="text-3xl font-black text-white">{globalStats.totalTransactions} <span className="text-xs text-slate-500 uppercase font-black ml-1">Orders</span></h3>
           </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-slate-900/50 p-4 border border-slate-800 rounded-[2.5rem] backdrop-blur-sm">
         <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              className="w-full bg-slate-950/50 border border-slate-800 rounded-[1.5rem] py-5 pl-14 pr-6 text-slate-200 outline-none focus:border-cyan-500/50 transition-all font-bold placeholder:text-slate-700"
              placeholder="Search by business, owner or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
         </div>
      </div>

      {/* USER LIST */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-md">
         <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
               <thead className="bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800">
                  <tr>
                     <th className="p-6 pl-10">SaaS Business</th>
                     <th className="p-6 text-center">Monthly Free</th>
                     <th className="p-6 text-center">Paid Wallet</th>
                     <th className="p-6 text-center">Lifetime Spent</th>
                     <th className="p-6 text-center">Latest Activity</th>
                     <th className="p-6 text-right pr-10">Details</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800/50">
                  {userCreditData.map(user => {
                     const isExpanded = expandedUserId === user.id;
                     const lastRecharge = user.history[0];

                     return (
                        <React.Fragment key={user.id}>
                           <tr className={`hover:bg-slate-800/30 transition-colors group ${isExpanded ? 'bg-slate-800/50' : ''}`}>
                              <td className="p-6 pl-10">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-lg text-cyan-400 shadow-xl group-hover:scale-110 transition-transform">
                                       {user.businessName?.charAt(0) || 'B'}
                                    </div>
                                    <div>
                                       <h4 className="font-black text-white uppercase tracking-tight">{user.businessName || 'Unnamed'}</h4>
                                       <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{user.ownerName}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="p-6 text-center">
                                 <div className="inline-flex flex-col items-center">
                                    <span className={`text-xl font-black ${user.freeLeft > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>{user.freeLeft}/3</span>
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">Available</span>
                                 </div>
                              </td>
                              <td className="p-6 text-center">
                                 <div className="inline-flex flex-col items-center bg-cyan-500/5 px-4 py-2 rounded-2xl border border-cyan-500/10">
                                    <span className={`text-2xl font-black ${user.paidLeft > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>{user.paidLeft}</span>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Credits</span>
                                 </div>
                              </td>
                              <td className="p-6 text-center">
                                 <div className="inline-flex flex-col items-center">
                                    <span className="text-xl font-black text-white">₹{user.totalSpent.toLocaleString()}</span>
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">{user.rechargeCount} Times</span>
                                 </div>
                              </td>
                              <td className="p-6 text-center">
                                 {lastRecharge ? (
                                    <div className="flex flex-col items-center">
                                       <span className="text-white font-bold text-xs">{lastRecharge.planName}</span>
                                       <span className="text-[10px] text-slate-500 uppercase font-black">{formatDateDDMMYYYY(lastRecharge.date)}</span>
                                    </div>
                                 ) : <span className="text-slate-700 uppercase font-black text-[10px]">No History</span>}
                              </td>
                              <td className="p-6 text-right pr-10">
                                 <button 
                                   onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                                   className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                      isExpanded 
                                      ? 'bg-slate-700 text-white' 
                                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                                   }`}
                                 >
                                    {isExpanded ? <ChevronUp size={14} strokeWidth={3} /> : <History size={14} strokeWidth={3} />}
                                    {isExpanded ? 'Hide' : 'Log'}
                                 </button>
                              </td>
                           </tr>

                           {isExpanded && (
                              <tr>
                                 <td colSpan={6} className="p-0 bg-slate-950/40 border-b border-slate-800">
                                    <div className="p-10 space-y-8 animate-in slide-in-from-top-2 duration-300">
                                       <div className="flex justify-between items-center px-2">
                                          <h5 className="text-[11px] font-black text-cyan-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                             <History size={14} /> Comprehensive Transaction Log
                                          </h5>
                                          <button className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white transition-colors">
                                             <Download size={14} /> EXPORT USER LOG
                                          </button>
                                       </div>

                                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                          {user.history.map((log: any) => (
                                             <div key={log.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl hover:border-slate-600 transition-all group relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                   <Sparkles size={60} />
                                                </div>
                                                <div className="flex justify-between items-start mb-6">
                                                   <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                                                      <Sparkles size={20} fill="currentColor" />
                                                   </div>
                                                   <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-[0.1em]">
                                                      SUCCESS
                                                   </span>
                                                </div>
                                                <div>
                                                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Package</p>
                                                   <h4 className="text-white font-black text-lg mb-4">{log.planName}</h4>
                                                   
                                                   <div className="flex justify-between items-end border-t border-slate-800/50 pt-4">
                                                      <div>
                                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Date</p>
                                                         <p className="text-xs text-slate-300 font-bold">{formatDateDDMMYYYY(log.date)}</p>
                                                      </div>
                                                      <div className="text-right">
                                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Value</p>
                                                         <p className="text-xl font-black text-emerald-400">₹{log.amount}</p>
                                                      </div>
                                                   </div>
                                                   <div className="mt-4 text-[9px] text-slate-600 font-mono truncate uppercase tracking-tighter">
                                                      TX: {log.paymentId || 'N/A'}
                                                   </div>
                                                </div>
                                             </div>
                                          ))}
                                          {user.history.length === 0 && (
                                             <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[3rem]">
                                                <Receipt size={48} className="text-slate-800 mb-4" />
                                                <p className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Zero purchase history</p>
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 </td>
                              </tr>
                           )}
                        </React.Fragment>
                     );
                  })}

                  {userCreditData.length === 0 && (
                     <tr>
                        <td colSpan={6} className="p-40 text-center">
                           <div className="flex flex-col items-center justify-center opacity-20">
                              <FileStack size={80} className="mb-6 text-slate-500" />
                              <p className="text-2xl font-black text-slate-400 uppercase tracking-[0.3em]">No users found</p>
                              <p className="text-xs font-bold text-slate-600 mt-4 uppercase tracking-widest">Adjust your search parameters</p>
                           </div>
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

    </div>
  );
};

export default AdminInvoiceCredits;