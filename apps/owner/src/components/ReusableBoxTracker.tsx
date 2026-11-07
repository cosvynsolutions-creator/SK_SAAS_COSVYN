import React, { useState, useMemo } from 'react';
import { 
  Package, RotateCcw, AlertTriangle, CheckCircle2, 
  Search, Plus, Minus, MessageSquare, Phone, 
  Clock, ShieldAlert, Sparkles, Filter, ChevronRight,
  RefreshCw, Check, X, Info
} from 'lucide-react';
import { 
  GlobalCustomer, REUSABLE_BOX_TYPES, 
  getCustomerBoxHealth, getCustomerUncollectedBoxesCount, 
  BoxRecollectionStatus, getTodayStr, formatDateDDMMYYYY 
} from '../services/store';
import { doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getReusableBoxReminderMessage, buildWhatsAppUrl } from '../services/messageTemplates';

interface ReusableBoxTrackerProps {
  customers: GlobalCustomer[];
  currentUser: any;
  todayStr: string;
  businessName?: string;
}

export const ReusableBoxTracker: React.FC<ReusableBoxTrackerProps> = ({
  customers,
  currentUser,
  todayStr,
  businessName
}) => {
  const [internalBizName, setInternalBizName] = useState<string>(businessName || 'Your Kitchen');

  React.useEffect(() => {
    if (businessName) {
      setInternalBizName(businessName);
      return;
    }
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'businesses', currentUser.uid), snap => {
      if (snap.exists() && snap.data().businessName) {
        setInternalBizName(snap.data().businessName);
      }
    });
    return () => unsub();
  }, [businessName, currentUser]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'WithBoxes' | 'Overdue' | 'Issues'>('All');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<any | null>(null);

  // Filter customers that have reusable boxes configured or active
  const reusableCustomers = useMemo(() => {
    return customers.map(c => {
      const activeReusablePlan = (c.activePlans || []).find(p => p.reusableBoxType && p.reusableBoxType !== 'None');
      const boxType = activeReusablePlan?.reusableBoxType || c.reusableBoxType || (c.reusableBoxEnabled ? 'Stainless Steel 3-Tier Dabba' : 'None');
      const hasReusable = boxType !== 'None' || Boolean(c.reusableBoxEnabled);
      const uncollectedCount = getCustomerUncollectedBoxesCount(c);
      const health = getCustomerBoxHealth(c);
      const isOverdue = uncollectedCount >= 2;

      return {
        ...c,
        boxType,
        hasReusable,
        uncollectedCount,
        health,
        isOverdue,
        activeReusablePlan
      };
    }).filter(c => c.hasReusable);
  }, [customers]);

  // Applied Search and Filter
  const filteredList = useMemo(() => {
    return reusableCustomers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.mobile.includes(searchTerm) ||
        (c.area || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.boxType || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === 'WithBoxes') return c.uncollectedCount > 0;
      if (filterType === 'Overdue') return c.uncollectedCount >= 2;
      if (filterType === 'Issues') return c.health.damaged > 0 || c.health.unclean > 0;
      return true;
    }).sort((a, b) => b.uncollectedCount - a.uncollectedCount);
  }, [reusableCustomers, searchTerm, filterType]);

  // Overall KPI Statistics
  const stats = useMemo(() => {
    let totalInCirculation = 0;
    let customersHoldingBoxes = 0;
    let totalClean = 0;
    let totalDamaged = 0;
    let totalUnclean = 0;

    reusableCustomers.forEach(c => {
      totalInCirculation += c.uncollectedCount;
      if (c.uncollectedCount > 0) customersHoldingBoxes++;
      totalClean += c.health.clean;
      totalDamaged += c.health.damaged;
      totalUnclean += c.health.unclean;
    });

    return {
      totalInCirculation,
      customersHoldingBoxes,
      totalClean,
      totalDamaged,
      totalUnclean,
      totalCustomers: reusableCustomers.length
    };
  }, [reusableCustomers]);

  // Update Box Count Direct (+ / -)
  const handleUpdateBoxCount = async (customerId: string, newCount: number) => {
    if (!currentUser) return;
    const sanitized = Math.max(0, newCount);
    setActionLoadingId(customerId);

    try {
      const custRef = doc(db, 'businesses', currentUser.uid, 'customers', customerId);
      await updateDoc(custRef, {
        uncollectedBoxesCount: sanitized,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Update box count error:", err);
      alert("Failed to update box count.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark Box Collected (Clean or Unclean)
  const handleMarkCollected = async (customer: any, status: BoxRecollectionStatus = 'Collected Clean') => {
    if (!currentUser) return;
    setActionLoadingId(customer.id);
    const now = new Date();
    const timeKey = `${todayStr}_Manual_${Date.now()}`;

    try {
      const custRef = doc(db, 'businesses', currentUser.uid, 'customers', customer.id);
      const isClean = status === 'Collected Clean';
      const isCollected = isClean || status === 'Collected Unclean';
      const newCount = isCollected ? Math.max(0, customer.uncollectedCount - 1) : customer.uncollectedCount;

      await updateDoc(custRef, {
        uncollectedBoxesCount: newCount,
        [`boxCollections.${timeKey}`]: {
          status,
          boxType: customer.boxType,
          issueNote: status === 'Collected Clean' ? 'Marked collected by kitchen owner' : 'Recorded container condition by owner',
          collectedAt: now.toISOString(),
          updatedBy: 'Kitchen Owner'
        },
        updatedAt: now.toISOString()
      });
    } catch (err) {
      console.error("Mark collected error:", err);
      alert("Failed to record box collection.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendReminder = (customer: any) => {
    const boxName = customer.boxType || 'Reusable Tiffin Box';
    const msg = getReusableBoxReminderMessage(customer.name, customer.uncollectedCount, boxName, internalBizName);
    window.open(buildWhatsAppUrl(customer.mobile, msg), '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="text-primary-600" size={24} />
            Customer Reusable Box Inventory & Tracker
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Real-time tally of reusable containers at customers, quick returns, and condition logging.
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-card p-4 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500">Boxes With Customers</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-slate-900 mt-0.5">
                {stats.totalInCirculation}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <Package size={20} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-2">
            Held by {stats.customersHoldingBoxes} active customers
          </p>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500">Clean Returns Logged</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-emerald-600 mt-0.5">
                {stats.totalClean}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-2">
            Hygienic & sanitized containers
          </p>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500">Unclean / Washing Due</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-yellow-600 mt-0.5">
                {stats.totalUnclean}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-600">
              <RotateCcw size={20} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-2">
            Containers sent to dishwashing
          </p>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500">Damaged / Missing Parts</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-rose-600 mt-0.5">
                {stats.totalDamaged}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600">
              <AlertTriangle size={20} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-2">
            Broken latches, dents or lost lids
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Search by customer name, mobile, area or box type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/85 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-white/80 border border-slate-200/80 rounded-xl shadow-xs overflow-x-auto no-scrollbar">
          {[
            { id: 'All', label: 'All Box Subscribers' },
            { id: 'WithBoxes', label: 'Holding Boxes (>0)' },
            { id: 'Overdue', label: 'Overdue (2+ Boxes)' },
            { id: 'Issues', label: 'Damage / Unclean Issues' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                filterType === tab.id 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Box Table */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[950px] text-xs">
            <thead className="bg-slate-50/70 backdrop-blur-sm text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200/60">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Box Type & Identifier</th>
                <th className="py-3 px-4 text-center">Boxes With Customer</th>
                <th className="py-3 px-4 text-center">Collection History</th>
                <th className="py-3 px-4 text-center">Quick Adjust</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredList.map(customer => {
                const isLoading = actionLoadingId === customer.id;

                return (
                  <tr key={customer.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Customer Info */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{customer.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-slate-400">{customer.mobile}</span>
                          {customer.area && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                              {customer.area}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Box Type */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 bg-amber-50/80 border border-amber-200/60 px-2 py-0.5 rounded-lg text-xs">
                          <span>🍱</span>
                          <span>{customer.boxType}</span>
                        </span>
                        {customer.boxTagOrNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Tag: #{customer.boxTagOrNumber}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Boxes With Customer (Count) */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <div className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1.5 border shadow-xs ${
                          customer.uncollectedCount === 0 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : customer.uncollectedCount === 1 
                            ? 'bg-amber-50 text-amber-800 border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                        }`}>
                          <Package size={13} />
                          <span>{customer.uncollectedCount} {customer.uncollectedCount === 1 ? 'Box' : 'Boxes'}</span>
                        </div>
                        {customer.uncollectedCount >= 2 && (
                          <span className="text-[10px] text-rose-600 font-semibold mt-1">
                            ⚠️ Overdue return
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Collection History breakdown */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.5 rounded" title="Clean Returns">
                          ✅ {customer.health.clean}
                        </span>
                        <span className="bg-yellow-50 text-yellow-700 border border-yellow-200/60 px-1.5 py-0.5 rounded" title="Dirty / Unclean">
                          🧽 {customer.health.unclean}
                        </span>
                        <span className="bg-rose-50 text-rose-700 border border-rose-200/60 px-1.5 py-0.5 rounded" title="Damaged">
                          💥 {customer.health.damaged}
                        </span>
                      </div>
                    </td>

                    {/* Quick Count Adjuster (+ / -) */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center border border-slate-200 bg-white rounded-xl shadow-xs overflow-hidden">
                        <button
                          onClick={() => handleUpdateBoxCount(customer.id, customer.uncollectedCount - 1)}
                          disabled={customer.uncollectedCount <= 0 || isLoading}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Decrease uncollected boxes count"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="px-2.5 font-bold font-mono text-xs text-slate-800 min-w-[28px] text-center">
                          {customer.uncollectedCount}
                        </span>
                        <button
                          onClick={() => handleUpdateBoxCount(customer.id, customer.uncollectedCount + 1)}
                          disabled={isLoading}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors"
                          title="Increase uncollected boxes count"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Quick Mark 1 Collected */}
                        <button
                          onClick={() => handleMarkCollected(customer, 'Collected Clean')}
                          disabled={isLoading || customer.uncollectedCount <= 0}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-semibold rounded-lg text-[11px] shadow-xs flex items-center gap-1 transition-all active:scale-95"
                          title="Mark 1 Box Returned Clean"
                        >
                          <Check size={12} />
                          <span>Collected</span>
                        </button>

                        {/* WhatsApp Return Reminder */}
                        <button
                          onClick={() => handleSendReminder(customer)}
                          className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors"
                          title="Send Return Reminder on WhatsApp"
                        >
                          <MessageSquare size={14} />
                        </button>

                        {/* Call */}
                        <a
                          href={`tel:${customer.mobile}`}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors"
                          title="Call Customer"
                        >
                          <Phone size={14} />
                        </a>

                        {/* Detailed Audit History */}
                        <button
                          onClick={() => setHistoryCustomer(customer)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          title="View Complete Recollection Audit"
                        >
                          <ChevronRight size={14} />
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Package size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No reusable box records found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try changing your search term or filter criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Recollection Audit Modal / Drawer */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="glass-card bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-glass-xl space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display text-base text-slate-900">{historyCustomer.name}</h3>
                <p className="text-xs text-slate-500 font-mono">{historyCustomer.mobile} • {historyCustomer.area}</p>
              </div>
              <button onClick={() => setHistoryCustomer(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Box Type</span>
                <span className="font-bold text-slate-800">{historyCustomer.boxType}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Uncollected</span>
                <span className="font-bold text-amber-700">{historyCustomer.uncollectedCount} Containers</span>
              </div>
            </div>

            {/* Past Recollections List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-700">Audit History & Condition Logs</h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                {historyCustomer.health.history.map((h, i) => (
                  <div key={i} className="p-2.5 rounded-xl border border-slate-100 bg-white shadow-xs flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <span>{h.status === 'Collected Clean' ? '✅ Clean' : h.status === 'Collected Unclean' ? '🧽 Unwashed' : h.status === 'Damaged / Missing Part' ? '💥 Damaged' : '⏳ Pending'}</span>
                        <span className="text-[11px] text-slate-400 font-normal">• {formatDateDDMMYYYY(h.date)} ({h.mealTime})</span>
                      </div>
                      {h.notes && <p className="text-[11px] text-slate-500 italic mt-0.5">"{h.notes}"</p>}
                    </div>
                  </div>
                ))}
                {historyCustomer.health.history.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-4">No logged history records yet.</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setHistoryCustomer(null)}
              className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
