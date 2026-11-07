import React from 'react';
import { DollarSign, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection } from '../services/dbService';

export const PaymentsView: React.FC = () => {
  const { branchId } = useManagerAuth();
  const { data: payments, loading } = useStreamCollection<any>('payments');

  const totalCollected = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-slate-900">Branch Payments & Collections</h1>
          </div>
          <p className="text-xs text-slate-500">Subscription and cash collections for Branch: {branchId}</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs text-right">
          <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Payments</span>
          <div className="text-base font-black text-emerald-600">₹{totalCollected.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No payment records logged for this branch yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Transaction / Customer</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(payment => (
                  <tr key={payment.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{payment.customerName || 'Customer'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{payment.id}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {payment.method || payment.paymentMethod || 'UPI / Cash'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{payment.date || payment.createdAt?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      ₹{Number(payment.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {payment.status || 'Success'}
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
