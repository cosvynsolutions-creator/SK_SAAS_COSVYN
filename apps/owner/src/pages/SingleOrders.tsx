
import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, Plus, Search, Loader2, Edit, Trash2, X, ChevronRight, ChevronDown, Calendar, Store, CreditCard, DollarSign, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, updateItem, deleteItem, getManagerBranchId } from '../services/dbService';
import { formatDateDDMMYYYY } from '../services/store';

const StatCard = ({ title, value, textColor = "text-slate-900" }: any) => (
  <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center h-28 sm:h-32 hover:shadow-md transition-shadow">
    <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">{title}</p>
    <h3 className={`text-2xl sm:text-4xl font-bold tracking-tight ${textColor} truncate`}>
      {value}
    </h3>
  </div>
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SingleOrders = () => {
  const { currentUser } = useAuth();
  const { data: orders = [], loading: l1 } = useStreamCollection<any>('single_orders');
  const { data: branches = [], loading: l2 } = useStreamCollection<any>('branches');

  const isLoading = l1 || l2;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [filters, setFilters] = useState({ branchId: getManagerBranchId() || 'All', month: 'All', search: '' });

  // Auto-lock branch filter when manager is assigned to a specific branch or single branch
  React.useEffect(() => {
    const mgrBranch = getManagerBranchId();
    if (mgrBranch && filters.branchId !== mgrBranch) {
      setFilters(prev => ({ ...prev, branchId: mgrBranch }));
    } else if (branches.length === 1 && filters.branchId !== branches[0].id) {
      setFilters(prev => ({ ...prev, branchId: branches[0].id }));
    }
  }, [branches, filters.branchId]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const orderDate = new Date(o.date);
      const matchesBranch = filters.branchId === 'All' || o.branchId === filters.branchId;
      const matchesMonth = filters.month === 'All' || orderDate.getMonth() === parseInt(filters.month);
      const matchesSearch = (o.customerName || '').toLowerCase().includes(filters.search.toLowerCase()) || 
                           (o.orderId || '').toLowerCase().includes(filters.search.toLowerCase());
      return matchesBranch && matchesMonth && matchesSearch;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, filters]);

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (Number(o.amount) || 0) + (Number(o.deliveryCharges) || 0), 0);
    const totalCount = filteredOrders.length;
    const avgValue = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;
    return { totalRevenue, totalCount, avgValue };
  }, [filteredOrders]);

  const handleSaveOrder = async (data: any) => {
    if (!currentUser) return;
    if (editingOrder) {
      await updateItem(currentUser.uid, 'single_orders', editingOrder.id, data);
    } else {
      const orderCount = orders.length + 1;
      const orderId = `SK-${String(orderCount).padStart(5, '0')}`;
      await addItem(currentUser.uid, 'single_orders', { ...data, orderId });
    }
    setIsModalOpen(false);
    setEditingOrder(null);
  };

  const handleDeleteOrder = async (id: string) => {
    if (currentUser && window.confirm('Delete this order?')) {
      await deleteItem(currentUser.uid, 'single_orders', id);
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-4 sm:space-y-8 pb-20 pt-2 animate-in fade-in duration-500">
      
      {/* ROW 1: FILTERS (Always 2 columns on mobile) */}
      <div className="grid grid-cols-2 lg:flex lg:justify-end gap-3 sm:gap-4">
        <div className="relative">
          <select 
            className="w-full lg:w-44 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm outline-none appearance-none pr-8" 
            value={filters.branchId} 
            onChange={(e) => setFilters({...filters, branchId: e.target.value})}
          >
            {(!getManagerBranchId() && branches.length > 1) && <option value="All">All Branches</option>}
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
        </div>
        <div className="relative">
          <select 
            className="w-full lg:w-44 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm outline-none appearance-none pr-8" 
            value={filters.month} 
            onChange={(e) => setFilters({...filters, month: e.target.value})}
          >
            <option value="All">All Months</option>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
        </div>
      </div>

      {/* ROW 2 & 3: STATS + ADD BUTTON */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard title="REVENUE" value={`₹${stats.totalRevenue.toLocaleString()}`} textColor="text-green-600" />
        <StatCard title="TOTAL ORDERS" value={stats.totalCount} textColor="text-blue-600" />
        <StatCard title="AVG ORDER" value={`₹${stats.avgValue}`} textColor="text-violet-600" />
        
        {/* Add Button styled as a Card for symmetry */}
        <button 
          onClick={() => { setEditingOrder(null); setIsModalOpen(true); }} 
          className="bg-primary-600 text-white rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 transition-all active:scale-95 shadow-lg h-28 sm:h-32"
        >
          <Plus size={24} className="sm:w-8 sm:h-8" />
          <span className="font-bold text-[10px] sm:text-sm uppercase tracking-wide">Add Order</span>
        </button>
      </div>

      {/* SEARCH & TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="text-slate-400" size={18} />
          <input className="flex-1 bg-transparent border-none outline-none font-medium text-slate-600 text-sm" placeholder="Search by name or order ID..." value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
              <tr>
                <th className="p-4 w-8"></th>
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Item</th>
                <th className="p-4 text-center">Amount</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Method</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-900 text-xs font-medium">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4 text-center text-slate-300"><ChevronRight size={14} /></td>
                  <td className="p-4 font-mono font-bold text-primary-600">{o.orderId}</td>
                  <td className="p-4">
                    <div className="font-black text-sm">{o.customerName}</div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold">{branches.find(b => b.id === o.branchId)?.name || 'Main'}</div>
                  </td>
                  <td className="p-4 text-slate-600">{o.item}</td>
                  <td className="p-4 text-center font-black">₹{Number(o.amount) + Number(o.deliveryCharges)}</td>
                  <td className="p-4 text-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${o.status === 'Paid' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="p-4 text-center text-slate-500 font-bold text-[10px]">{o.paymentMethod}</td>
                  <td className="p-4 text-slate-400 text-[10px] font-mono">{formatDateDDMMYYYY(o.date)}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingOrder(o); setIsModalOpen(true); }} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"><Edit size={16}/></button>
                      <button onClick={() => handleDeleteOrder(o.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr><td colSpan={9} className="p-12 text-center text-slate-400 font-medium italic">No orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <OrderModal branches={branches} initialData={editingOrder} onClose={() => { setIsModalOpen(false); setEditingOrder(null); }} onSubmit={handleSaveOrder} />
      )}
    </div>
  );
};

const ModalLabel = ({ children }: React.PropsWithChildren<{}>) => (
  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{children}</label>
);

const ModalInput = (props: any) => (
  <input {...props} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm" />
);

const ModalSelect = (props: any) => (
  <select {...props} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_0.75rem_center] bg-no-repeat pr-8 text-sm" />
);

const OrderModal = ({ branches, initialData, onClose, onSubmit }: any) => {
  const [formData, setFormData] = useState({
    branchId: branches[0]?.id || '', date: new Date().toISOString().split('T')[0], time: 'Lunch', customerName: '', 
    item: '', amount: 0, deliveryCharges: 0, status: 'Paid', paymentMethod: 'UPI', ...initialData
  });

  const totalValue = Number(formData.amount) + Number(formData.deliveryCharges);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] relative text-left no-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-slate-900">{initialData ? 'Edit Order' : 'Add Single Order'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500"><X size={24}/></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><ModalLabel>Branch</ModalLabel><ModalSelect value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</ModalSelect></div>
            <div><ModalLabel>Date</ModalLabel><ModalInput type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><ModalLabel>Time</ModalLabel><ModalSelect value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})}>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
            </ModalSelect></div>
            <div><ModalLabel>Name</ModalLabel><ModalInput required value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} /></div>
          </div>
          <div><ModalLabel>Item Details</ModalLabel><ModalInput required placeholder="e.g. Chicken Biryani" value={formData.item} onChange={e => setFormData({...formData, item: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><ModalLabel>Amount (₹)</ModalLabel><ModalInput type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
            <div><ModalLabel>Delivery (₹)</ModalLabel><ModalInput type="number" value={formData.deliveryCharges} onChange={e => setFormData({...formData, deliveryCharges: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><ModalLabel>Status</ModalLabel><ModalSelect value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Paid">Paid</option><option value="Pending">Pending</option></ModalSelect></div>
            <div><ModalLabel>Method</ModalLabel><ModalSelect value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}><option value="UPI">UPI</option><option value="Cash">Cash</option></ModalSelect></div>
          </div>
          <div className="bg-slate-900 text-white p-5 rounded-2xl mt-2 flex justify-between items-center shadow-lg">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Value:</span>
            <span className="text-2xl font-black text-green-400">₹{totalValue}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button type="button" onClick={onClose} className="py-2.5 border-2 border-slate-100 rounded-xl font-bold text-slate-500">Cancel</button>
            <button type="submit" className="py-2.5 bg-primary-600 text-white rounded-xl font-bold shadow-lg">Save Order</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SingleOrders;
