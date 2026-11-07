import React from 'react';
import { BarChart3, TrendingUp, Users, UtensilsCrossed, CheckCircle2 } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection } from '../services/dbService';
import { Customer, getTodayStr, isPlanActiveOnDate } from '../services/managerStore';

export const AnalyticsView: React.FC = () => {
  const { branchId } = useManagerAuth();
  const todayStr = getTodayStr();

  const { data: customers } = useStreamCollection<Customer>('customers');
  const { data: singleOrders } = useStreamCollection<any>('single_orders');
  const { data: expenses } = useStreamCollection<any>('expenses');
  const { data: deliveryLogs } = useStreamCollection<any>('delivery_logs');

  const activeToday = customers.filter(c => isPlanActiveOnDate(c, todayStr)).length;
  const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const deliveredCount = deliveryLogs.filter(l => l.status === 'Delivered').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branch Operations Analytics</h1>
          <p className="text-xs text-slate-500">Fulfillment, subscriptions, and financial metrics for Branch: {branchId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Active Subscribers</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{customers.length}</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">{activeToday} eating today</p>
        </div>

        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Single Orders Handled</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{singleOrders.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Total guest orders</p>
        </div>

        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Branch Expenses Logged</span>
          <div className="text-2xl font-black text-rose-600 mt-1">₹{totalExpense.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">{expenses.length} expense tickets</p>
        </div>
      </div>

      <div className="glass-card bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Operational Health Summary</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Branch <strong>{branchId}</strong> operates under isolated tenant rules. All metrics displayed reflect this specific branch location, ensuring daily prep numbers match physical kitchen output.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total Subscriptions</div>
            <div className="text-lg font-black text-slate-900 mt-1">{customers.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Active Today</div>
            <div className="text-lg font-black text-emerald-600 mt-1">{activeToday}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Deliveries Completed</div>
            <div className="text-lg font-black text-indigo-600 mt-1">{deliveredCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Branch Petty Cash</div>
            <div className="text-lg font-black text-rose-600 mt-1">₹{totalExpense.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
