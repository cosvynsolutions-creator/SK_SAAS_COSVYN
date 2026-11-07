
import React, { useState, useMemo } from 'react';
import { 
  ClipboardList, Plus, Search, Filter, AlertCircle, Edit2, Trash2, 
  ArrowUp, ArrowDown, Package, Layers, Scale, Loader2, X 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, updateItem, deleteItem } from '../services/dbService';
import { InventoryItem, formatDateDDMMYYYY } from '../services/store';

const CATEGORIES = ['Vegetables', 'Meat', 'Dairy', 'Spices', 'Grains', 'Packaging', 'Cleaning', 'Others'];
const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'box', 'packet'];

const Inventory = () => {
  const { currentUser } = useAuth();
  
  // Real Data
  const { data: inventory, loading: l1 } = useStreamCollection<InventoryItem>('inventory');
  const { data: branches, loading: l2 } = useStreamCollection<any>('branches');

  const isLoading = l1 || l2;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Computed
  const filteredItems = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [inventory, search, selectedCategory]);

  const lowStockItems = useMemo(() => {
    return inventory.filter(item => item.quantity <= item.minThreshold);
  }, [inventory]);

  const totalValue = useMemo(() => {
    return inventory.reduce((acc, item) => acc + ((item.costPerUnit || 0) * item.quantity), 0);
  }, [inventory]);

  // Actions
  const handleSaveItem = async (data: any) => {
    if (!currentUser) return;
    
    if (editingItem) {
      await updateItem(currentUser.uid, 'inventory', editingItem.id, {
        ...data,
        lastUpdated: new Date().toISOString()
      });
    } else {
      await addItem(currentUser.uid, 'inventory', {
        ...data,
        lastUpdated: new Date().toISOString()
      });
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    if (!currentUser || !window.confirm("Delete this item?")) return;
    await deleteItem(currentUser.uid, 'inventory', id);
  };

  const adjustStock = async (item: InventoryItem, adjustment: number) => {
    if (!currentUser) return;
    const newQty = Math.max(0, item.quantity + adjustment);
    await updateItem(currentUser.uid, 'inventory', item.id, {
      quantity: newQty,
      lastUpdated: new Date().toISOString()
    });
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            Inventory <span className="text-sm font-normal text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{inventory.length} Items</span>
          </h1>
          <p className="text-slate-500">Track raw materials and packaging stock.</p>
        </div>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-600/20 flex items-center gap-2 transition-all"
        >
          <Plus size={20} /> Add Item
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Low Stock Alerts</p>
              <h3 className={`text-2xl font-bold ${lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{lowStockItems.length}</h3>
           </div>
           <div className={`p-3 rounded-xl ${lowStockItems.length > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
              <AlertCircle size={24} />
           </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Total Stock Value (Est)</p>
              <h3 className="text-2xl font-bold text-slate-900">₹{totalValue.toLocaleString()}</h3>
           </div>
           <div className="p-3 rounded-xl bg-green-50 text-green-600">
              <Layers size={24} />
           </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Categories</p>
              <h3 className="text-2xl font-bold text-slate-900">{CATEGORIES.length}</h3>
           </div>
           <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Package size={24} />
           </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row gap-4">
         <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 bg-white"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
         </div>
         <select 
           className="px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 bg-white min-w-[180px]"
           value={selectedCategory}
           onChange={e => setSelectedCategory(e.target.value)}
         >
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
         </select>
      </div>

      {/* LIST */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
               <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                     <th className="p-4">Item Name</th>
                     <th className="p-4">Category</th>
                     <th className="p-4">Stock Level</th>
                     <th className="p-4 text-center">Adjust</th>
                     <th className="p-4 text-right">Value (₹)</th>
                     <th className="p-4 text-center">Status</th>
                     <th className="p-4 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="text-sm divide-y divide-slate-100">
                  {filteredItems.map(item => {
                     const isLow = item.quantity <= item.minThreshold;
                     const percentage = Math.min(100, Math.round((item.quantity / (item.minThreshold * 3)) * 100)); // Visual estimation

                     return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                           <td className="p-4">
                              <div className="font-bold text-slate-900">{item.name}</div>
                              <div className="text-xs text-slate-400">Updated: {formatDateDDMMYYYY(item.lastUpdated)}</div>
                           </td>
                           <td className="p-4">
                              <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium border border-slate-200">
                                 {item.category}
                              </span>
                           </td>
                           <td className="p-4 w-48">
                              <div className="flex justify-between mb-1 text-xs font-bold">
                                 <span>{item.quantity} {item.unit}</span>
                                 <span className="text-slate-400">Min: {item.minThreshold}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                 <div 
                                    className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-green-500'}`} 
                                    style={{ width: `${percentage}%` }}
                                 />
                              </div>
                           </td>
                           <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                 <button onClick={() => adjustStock(item, -1)} className="p-1 rounded bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors"><ArrowDown size={14}/></button>
                                 <button onClick={() => adjustStock(item, 1)} className="p-1 rounded bg-slate-100 hover:bg-green-50 text-slate-600 hover:text-green-600 transition-colors"><ArrowUp size={14}/></button>
                              </div>
                           </td>
                           <td className="p-4 text-right font-mono text-slate-600">
                              {item.costPerUnit ? `₹${(item.costPerUnit * item.quantity).toLocaleString()}` : '-'}
                           </td>
                           <td className="p-4 text-center">
                              {isLow ? (
                                 <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-100 animate-pulse">
                                    <AlertCircle size={12} /> Low Stock
                                 </span>
                              ) : (
                                 <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-100">
                                    In Stock
                                 </span>
                              )}
                           </td>
                           <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Edit2 size={16} />
                                 </button>
                                 <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     );
                  })}
                  {filteredItems.length === 0 && (
                     <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400 italic">
                           No inventory items found. Add some to get started!
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
         <InventoryModal 
            branches={branches}
            initialData={editingItem}
            onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
            onSubmit={handleSaveItem}
         />
      )}

    </div>
  );
};

const InventoryModal = ({ branches, initialData, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({
      name: '',
      category: 'Vegetables',
      quantity: 0,
      unit: 'kg',
      minThreshold: 5,
      costPerUnit: 0,
      branchId: branches[0]?.id || '',
      ...initialData
   });

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit({
         ...formData,
         quantity: Number(formData.quantity),
         minThreshold: Number(formData.minThreshold),
         costPerUnit: Number(formData.costPerUnit)
      });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95">
         <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-lg text-slate-900">{initialData ? 'Edit Item' : 'Add Inventory Item'}</h3>
               <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Name</label>
                  <input 
                     required autoFocus
                     placeholder="e.g. Basmati Rice"
                     className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary-500 text-slate-900 bg-white"
                     value={formData.name}
                     onChange={e => setFormData({...formData, name: e.target.value})}
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                     <select 
                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary-500 bg-white text-slate-900"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                     >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Branch</label>
                     <select 
                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary-500 bg-white text-slate-900"
                        value={formData.branchId}
                        onChange={e => setFormData({...formData, branchId: e.target.value})}
                     >
                        {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qty</label>
                     <input 
                        type="number" min="0" step="0.1"
                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary-500 text-slate-900 bg-white"
                        value={formData.quantity}
                        onChange={e => setFormData({...formData, quantity: e.target.value})}
                     />
                  </div>
                  <div className="col-span-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
                     <select 
                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary-500 bg-white text-slate-900"
                        value={formData.unit}
                        onChange={e => setFormData({...formData, unit: e.target.value})}
                     >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                     </select>
                  </div>
                  <div className="col-span-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-red-500">Min Alert</label>
                     <input 
                        type="number" min="0"
                        className="w-full p-2.5 border border-red-100 bg-red-50 rounded-lg outline-none focus:border-red-300 text-slate-900"
                        value={formData.minThreshold}
                        onChange={e => setFormData({...formData, minThreshold: e.target.value})}
                     />
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Est. Cost Per Unit (₹)</label>
                  <div className="relative">
                     <Scale size={16} className="absolute left-3 top-3 text-slate-400" />
                     <input 
                        type="number" min="0"
                        className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary-500 text-slate-900 bg-white"
                        placeholder="0.00"
                        value={formData.costPerUnit}
                        onChange={e => setFormData({...formData, costPerUnit: e.target.value})}
                     />
                  </div>
               </div>

               <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary-600/20 transition-all mt-2">
                  {initialData ? 'Save Changes' : 'Add to Inventory'}
               </button>
            </form>
         </div>
      </div>
   );
};

export default Inventory;
