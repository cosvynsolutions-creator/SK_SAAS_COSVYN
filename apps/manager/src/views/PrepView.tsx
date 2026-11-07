import React, { useState } from 'react';
import {
  UtensilsCrossed, Calendar, CheckCircle2, Clock, Filter,
  Layers, AlertCircle, ChefHat
} from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection } from '../services/dbService';
import { Customer, getTodayStr, isPlanActiveOnDate } from '../services/managerStore';
import { VegNonVegBadge } from '../components/VegNonVegIndicator';

export const PrepView: React.FC = () => {
  const { branchId } = useManagerAuth();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const { data: customers, loading: custLoading } = useStreamCollection<Customer>('customers');
  const { data: plans } = useStreamCollection<any>('plans');
  const { data: singleOrders } = useStreamCollection<any>('single_orders');

  const targetDateObj = new Date(selectedDate);
  const targetDayOfWeek = targetDateObj.getDay();

  // Filter customers active on the selected date
  const activeCustomers = customers.filter(c => isPlanActiveOnDate(c, selectedDate));

  // Categorize preparations
  let vegCount = 0;
  let nonVegCount = 0;

  const prepItems = activeCustomers.map(c => {
    const plan = plans.find(p => p.id === c.planId);
    let dietType: 'Veg' | 'Non-Veg' = 'Veg';

    if (plan?.dayDietSchedule && plan.dayDietSchedule[targetDayOfWeek]) {
      dietType = plan.dayDietSchedule[targetDayOfWeek];
    } else if (c.dietPreference) {
      dietType = c.dietPreference === 'Non-Veg' ? 'Non-Veg' : 'Veg';
    } else if (plan?.dietPreference) {
      dietType = plan.dietPreference === 'Non-Veg' ? 'Non-Veg' : 'Veg';
    }

    if (dietType === 'Veg') vegCount++;
    else nonVegCount++;

    return {
      customer: c,
      plan,
      dietType,
    };
  });

  // Single orders for this date
  const dateSingleOrders = singleOrders.filter(o => o.deliveryDate === selectedDate);
  const singleVeg = dateSingleOrders.filter(o => (o.diet || 'Veg') === 'Veg').length;
  const singleNonVeg = dateSingleOrders.filter(o => o.diet === 'Non-Veg').length;

  const grandTotalVeg = vegCount + singleVeg;
  const grandTotalNonVeg = nonVegCount + singleNonVeg;
  const grandTotal = grandTotalVeg + grandTotalNonVeg;

  return (
    <div className="space-y-6">
      {/* Header and Date Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-slate-900">Kitchen Prep & Daily Production</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time meal cooking tallies for Branch: <strong className="text-slate-800">{branchId}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs font-semibold text-slate-800 outline-none bg-transparent cursor-pointer"
          />
        </div>
      </div>

      {/* Production Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Total Kitchen Batch</span>
          <div className="text-3xl font-black text-slate-900 mt-1">{grandTotal}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {activeCustomers.length} subscriptions + {dateSingleOrders.length} ad-hoc
          </p>
        </div>

        <div className="glass-card bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">Pure Vegetarian</span>
            <VegNonVegBadge diet="Veg" size="xs" showLabel={false} />
          </div>
          <div className="text-3xl font-black text-emerald-900 mt-1">{grandTotalVeg}</div>
          <p className="text-[11px] text-emerald-700 mt-1">Green label containers</p>
        </div>

        <div className="glass-card bg-rose-50/70 p-5 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">Non-Vegetarian</span>
            <VegNonVegBadge diet="Non-Veg" size="xs" showLabel={false} />
          </div>
          <div className="text-3xl font-black text-rose-900 mt-1">{grandTotalNonVeg}</div>
          <p className="text-[11px] text-rose-700 mt-1">Red label containers</p>
        </div>
      </div>

      {/* Itemized Prep Table */}
      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Preparation Manifest</h3>
          <span className="text-xs text-slate-500">{prepItems.length} active tiffins</span>
        </div>

        {prepItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No meal deliveries scheduled for this branch on {selectedDate}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Dietary Prep</th>
                  <th className="py-3 px-4">Kitchen Notes & Allergies</th>
                  <th className="py-3 px-4">Address / Flat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prepItems.map(({ customer, plan, dietType }) => (
                  <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{customer.name}</div>
                      <div className="text-[10px] text-slate-400">{customer.mobile}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-700">{plan?.name || 'Standard Plan'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <VegNonVegBadge diet={dietType} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-600 italic">
                        {customer.notes || 'Standard packaging'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-600 line-clamp-1 max-w-xs">
                        {customer.flatNumber ? `${customer.flatNumber}, ` : ''}{customer.deliveryAddress}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
