import React, { useState } from 'react';
import { ShoppingBag, Plus, Calendar, Phone, MapPin, CheckCircle2 } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection, addDocument } from '../services/dbService';
import { getTodayStr } from '../services/managerStore';
import { VegNonVegBadge } from '../components/VegNonVegIndicator';

export const SingleOrdersView: React.FC = () => {
  const { bizId, branchId } = useManagerAuth();
  const { data: singleOrders, loading } = useStreamCollection<any>('single_orders');
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [diet, setDiet] = useState<'Veg' | 'Non-Veg'>('Veg');
  const [amount, setAmount] = useState('150');
  const [submitting, setSubmitting] = useState(false);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !mobile) return;
    setSubmitting(true);
    try {
      await addDocument(bizId, 'single_orders', {
        customerName,
        mobile,
        deliveryAddress,
        diet,
        amount: Number(amount) || 0,
        branchId,
        deliveryDate: getTodayStr(),
        status: 'Confirmed',
      });
      setShowModal(false);
      setCustomerName('');
      setMobile('');
      setDeliveryAddress('');
    } catch (err) {
      console.error("Order error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-slate-900">Single & On-Demand Meal Orders</h1>
          </div>
          <p className="text-xs text-slate-500">Ad-hoc guest bookings and catering for Branch: {branchId}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs"
        >
          <Plus size={14} /> Add Single Order
        </button>
      </div>

      {/* Orders List */}
      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading single orders...</div>
        ) : singleOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No on-demand single orders booked yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Diet</th>
                  <th className="py-3 px-4">Delivery Address</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {singleOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{order.customerName}</div>
                      <div className="text-[10px] text-slate-400">{order.mobile}</div>
                    </td>
                    <td className="py-3 px-4">
                      <VegNonVegBadge diet={order.diet || 'Veg'} size="xs" />
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {order.deliveryAddress || 'Pick-up from counter'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{order.amount || 0}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {order.deliveryDate}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {order.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-900">Book Single Meal Order</h3>
            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Customer Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Phone</label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Address</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Diet</label>
                  <select
                    value={diet}
                    onChange={(e: any) => setDiet(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <option value="Veg">Vegetarian</option>
                    <option value="Non-Veg">Non-Vegetarian</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl"
                >
                  {submitting ? 'Booking...' : 'Book Meal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
