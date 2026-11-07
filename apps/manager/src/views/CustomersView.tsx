import React, { useState } from 'react';
import {
  Users, Search, Filter, Phone, MapPin, Calendar, CheckCircle2,
  XCircle, Clock, PauseCircle, ChevronRight
} from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection } from '../services/dbService';
import { Customer, formatDateDDMMYYYY, isPlanActiveOnDate, getTodayStr } from '../services/managerStore';
import { VegNonVegBadge } from '../components/VegNonVegIndicator';

export const CustomersView: React.FC = () => {
  const { branchId } = useManagerAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const todayStr = getTodayStr();

  const { data: customers, loading } = useStreamCollection<Customer>('customers');
  const { data: plans } = useStreamCollection<any>('plans');

  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm) ||
      (c.deliveryAddress && c.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const isActive = isPlanActiveOnDate(c, todayStr);
    if (statusFilter === 'active') return isActive;
    if (statusFilter === 'paused') return !isActive;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-slate-900">Branch Customers & Subscriptions</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Managing subscriber records for Branch: <strong className="text-slate-800">{branchId}</strong>
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone, address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Active Today
          </button>
          <button
            onClick={() => setStatusFilter('paused')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'paused'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Paused / Inactive
          </button>
        </div>
      </div>

      {/* Customer List */}
      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading customer directory...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No customers found matching the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Plan & Diet</th>
                  <th className="py-3 px-4">Delivery Address</th>
                  <th className="py-3 px-4">Subscription Period</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(customer => {
                  const plan = plans.find(p => p.id === customer.planId);
                  const active = isPlanActiveOnDate(customer, todayStr);

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{customer.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={10} />
                          <span>{customer.mobile}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{plan?.name || 'Standard Tiffin'}</div>
                        <div className="mt-1">
                          <VegNonVegBadge diet={customer.dietPreference || plan?.dietPreference || 'Veg'} size="xs" />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700 max-w-xs line-clamp-2">
                          {customer.flatNumber ? `${customer.flatNumber}, ` : ''}{customer.deliveryAddress}
                        </div>
                        {customer.locationLink && (
                          <a
                            href={customer.locationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <MapPin size={9} /> Map Location
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>From: {formatDateDDMMYYYY(customer.startDate)}</div>
                        <div>To: {formatDateDDMMYYYY(customer.endDate) || 'Ongoing'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            active
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {active ? <CheckCircle2 size={10} /> : <PauseCircle size={10} />}
                          <span>{active ? 'Active Today' : 'Paused / Expired'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
