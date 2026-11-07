import React, { useState } from 'react';
import { CreditCard, Plus, Calendar, DollarSign, Trash2 } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection, addDocument, deleteDocument } from '../services/dbService';
import { getTodayStr } from '../services/managerStore';

export const ExpensesView: React.FC = () => {
  const { bizId, branchId, loggedInManager } = useManagerAuth();
  const { data: expenses, loading } = useStreamCollection<any>('expenses');
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [submitting, setSubmitting] = useState(false);

  const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;
    setSubmitting(true);
    try {
      await addDocument(bizId, 'expenses', {
        title: title.trim(),
        amount: Number(amount),
        category,
        branchId,
        date: getTodayStr(),
        addedBy: loggedInManager?.name || 'Manager',
      });
      setShowAdd(false);
      setTitle('');
      setAmount('');
    } catch (err) {
      console.error("Expense error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this expense entry?")) return;
    try {
      await deleteDocument(bizId, 'expenses', id);
    } catch (err) {
      console.error("Delete expense error:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-slate-900">Branch Petty Cash & Expenses</h1>
          </div>
          <p className="text-xs text-slate-500">Record daily local kitchen operational expenses for Branch: {branchId}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs text-right">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Recorded</span>
            <div className="text-base font-black text-rose-600">₹{totalExpense.toLocaleString('en-IN')}</div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs"
          >
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading branch expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No expenses recorded for this branch yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Logged By</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{expense.title}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {expense.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{expense.date}</td>
                    <td className="py-3 px-4 text-slate-600">{expense.addedBy || 'Manager'}</td>
                    <td className="py-3 px-4 text-right font-black text-rose-600">
                      ₹{Number(expense.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-900">Record Branch Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Fresh Vegetables, LPG Cylinder, Fuel"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                >
                  <option value="Groceries">Fresh Groceries</option>
                  <option value="Fuel / Transport">Fuel / Transport</option>
                  <option value="Packaging">Packaging Boxes</option>
                  <option value="Kitchen Gas">Kitchen Gas / Utilities</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
