import React from 'react';
import { Receipt, Download, FileText, CheckCircle2 } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection } from '../services/dbService';

export const InvoicesView: React.FC = () => {
  const { branchId } = useManagerAuth();
  const { data: invoices, loading } = useStreamCollection<any>('invoices');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Receipt className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branch GST & Tax Invoices</h1>
          <p className="text-xs text-slate-500">Customer billing receipts and invoices for Branch: {branchId}</p>
        </div>
      </div>

      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading branch invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No invoices generated for this branch yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{inv.invoiceNumber || inv.id}</td>
                    <td className="py-3 px-4 text-slate-800">{inv.customerName || 'Subscriber'}</td>
                    <td className="py-3 px-4 text-slate-500">{inv.date || inv.createdAt?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      ₹{Number(inv.total || inv.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {inv.status || 'Paid'}
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
