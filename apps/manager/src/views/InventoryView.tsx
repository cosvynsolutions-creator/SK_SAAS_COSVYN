import React, { useState } from 'react';
import { Archive, Plus, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection, addDocument, deleteDocument, updateDocument } from '../services/dbService';

export const InventoryView: React.FC = () => {
  const { bizId, branchId } = useManagerAuth();
  const { data: inventory, loading } = useStreamCollection<any>('inventory');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [unit, setUnit] = useState('kg');
  const [minAlert, setMinAlert] = useState('5');
  const [submitting, setSubmitting] = useState(false);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await addDocument(bizId, 'inventory', {
        name: name.trim(),
        quantity: Number(quantity) || 0,
        unit,
        minAlert: Number(minAlert) || 0,
        branchId,
      });
      setShowAdd(false);
      setName('');
    } catch (err) {
      console.error("Inventory error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateQty = async (item: any, delta: number) => {
    const newQty = Math.max(0, (Number(item.quantity) || 0) + delta);
    try {
      await updateDocument(bizId, 'inventory', item.id, { quantity: newQty });
    } catch (err) {
      console.error("Update qty error:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-slate-900">Branch Kitchen Pantry & Inventory</h1>
          </div>
          <p className="text-xs text-slate-500">Track raw materials, staples, and packaging boxes for Branch: {branchId}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs"
        >
          <Plus size={14} /> Add Stock Item
        </button>
      </div>

      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading pantry stock...</div>
        ) : inventory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No stock items added yet for this kitchen branch.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Reorder Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Quick Stock Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map(item => {
                  const isLow = Number(item.quantity) <= Number(item.minAlert);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                      <td className="py-3 px-4 font-black text-slate-800">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        Min {item.minAlert} {item.unit}
                      </td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle size={10} /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={10} /> Sufficient
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => handleUpdateQty(item, -1)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold"
                          title="Decrease 1"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => handleUpdateQty(item, 1)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-700 font-bold"
                          title="Increase 1"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => handleUpdateQty(item, 5)}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-bold"
                          title="Add 5"
                        >
                          +5
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-900">Add Pantry / Stock Item</h3>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice, Paneer, Tiffin Containers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Alert Below Quantity</label>
                <input
                  type="number"
                  value={minAlert}
                  onChange={(e) => setMinAlert(e.target.value)}
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
                  {submitting ? 'Adding...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
