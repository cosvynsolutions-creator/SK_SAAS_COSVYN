import React from 'react';
import {
  Users, UtensilsCrossed, Truck, AlertCircle, CheckCircle2,
  TrendingUp, Calendar, Clock, MapPin, RefreshCw
} from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection } from '../services/dbService';
import { Customer, getTodayStr, isPlanActiveOnDate } from '../services/managerStore';
import { VegNonVegBadge } from '../components/VegNonVegIndicator';

export const DashboardView: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { loggedInManager, branchId } = useManagerAuth();
  const { data: customers, loading: custLoading } = useStreamCollection<Customer>('customers');
  const { data: plans } = useStreamCollection<any>('plans');
  const { data: staff } = useStreamCollection<any>('staff');
  const { data: singleOrders } = useStreamCollection<any>('single_orders');
  const { data: expenses } = useStreamCollection<any>('expenses');

  const todayStr = getTodayStr();

  // Filter active subscription customers for today
  const activeTodayCustomers = customers.filter(c => isPlanActiveOnDate(c, todayStr));

  // Tally Veg vs Non-Veg for today
  let vegCount = 0;
  let nonVegCount = 0;

  activeTodayCustomers.forEach(c => {
    const plan = plans.find(p => p.id === c.planId);
    const dayOfWeek = new Date().getDay();
    let isVeg = true;

    if (plan?.dayDietSchedule && plan.dayDietSchedule[dayOfWeek]) {
      isVeg = plan.dayDietSchedule[dayOfWeek] === 'Veg';
    } else if (c.dietPreference) {
      isVeg = c.dietPreference === 'Veg';
    } else if (plan?.dietPreference) {
      isVeg = plan.dietPreference === 'Veg';
    }

    if (isVeg) vegCount++;
    else nonVegCount++;
  });

  const drivers = staff.filter(s => s.role === 'driver' || s.role === 'delivery');
  const todayExpenses = expenses.filter(e => e.date === todayStr);
  const totalExpenseToday = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-2">
                <MapPin size={12} />
                Branch: {branchId === 'All' ? 'All Organization Branches' : branchId}
              </span>
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome back, {loggedInManager?.name || 'Branch Manager'}
              </h1>
              <p className="text-xs text-indigo-200 mt-1 max-w-xl">
                Real-time operational dashboard for daily kitchen prep, scheduled subscription dispatches, and rider fleet management.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right bg-white/10 px-4 py-2 rounded-xl backdrop-blur-xs border border-white/10">
                <div className="text-[10px] uppercase font-bold text-indigo-300">Today's Date</div>
                <div className="text-sm font-black font-mono">{todayStr}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Subscriptions */}
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Active Today</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {custLoading ? '...' : activeTodayCustomers.length}
            </h3>
            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 size={12} />
              <span>{customers.length} total subscribers</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={24} />
          </div>
        </div>

        {/* Meal Breakdown */}
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Kitchen Prep Count</p>
            <div className="flex items-center gap-2 mt-1.5">
              <VegNonVegBadge diet="Veg" count={vegCount} size="sm" />
              <VegNonVegBadge diet="Non-Veg" count={nonVegCount} size="sm" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total meals: {vegCount + nonVegCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UtensilsCrossed size={24} />
          </div>
        </div>

        {/* Active Fleet */}
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Delivery Fleet</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{drivers.length}</h3>
            <p className="text-[11px] text-slate-500 mt-1">Assigned branch riders</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Truck size={24} />
          </div>
        </div>

        {/* Today's Expense */}
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Today's Petty Cash</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              ₹{totalExpenseToday.toLocaleString('en-IN')}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">{todayExpenses.length} entries recorded</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      {/* Operational Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Kitchen Prep Overview */}
        <div className="glass-card bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={18} className="text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-900">Today's Kitchen Batch</h3>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('prep')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Open Kitchen Prep →
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900">Vegetarian</span>
                <VegNonVegBadge diet="Veg" size="xs" showLabel={false} />
              </div>
              <div className="text-2xl font-black text-emerald-900 mt-1">{vegCount}</div>
              <p className="text-[11px] text-emerald-700 mt-0.5">Tiffin packages</p>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900">Non-Vegetarian</span>
                <VegNonVegBadge diet="Non-Veg" size="xs" showLabel={false} />
              </div>
              <div className="text-2xl font-black text-rose-900 mt-1">{nonVegCount}</div>
              <p className="text-[11px] text-rose-700 mt-0.5">Tiffin packages</p>
            </div>
          </div>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Single Meal Orders Today: <strong>{singleOrders.length}</strong></span>
            <span>Active branch: <strong>{branchId}</strong></span>
          </div>
        </div>

        {/* Assigned Drivers / Fleet Status */}
        <div className="glass-card bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-900">Active Branch Riders</h3>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('deliveries')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                View Dispatches →
              </button>
            )}
          </div>

          {drivers.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              No delivery drivers assigned to this branch yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {drivers.slice(0, 5).map((driver) => (
                <div
                  key={driver.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
                      {driver.name?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{driver.name}</div>
                      <div className="text-[10px] text-slate-400">{driver.mobile || 'No contact'}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
