
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { Plus, Receipt, Loader2, X, Trash2, ShoppingBag, Edit2, Store, Download, Calendar, ChevronDown, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, updateItem, deleteItem, getTargetBusinessId } from '../services/dbService';
import { GlobalExpense, ExpenseItem, formatDateDDMMYYYY } from '../services/store';

const EXPENSE_CATEGORIES = ['Food', 'Salaries', 'Packaging', 'Rent', 'Marketing', 'Transportation', 'Others'];
const UNITS = ['kg', 'g', 'L', 'ml', 'dozen', 'pcs', 'pkt'];
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

interface Branch { id: string; name: string; city: string; state: string; }

const Expenses = () => {
  const { currentUser } = useAuth();
  
  // Real Data
  const { data: expenses, loading: l1 } = useStreamCollection<GlobalExpense>('expenses');
  const { data: branches, loading: l2 } = useStreamCollection<Branch>('branches');

  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GlobalExpense | null>(null);

  // Auto-lock branch filter to single branch (e.g. for branch manager)
  React.useEffect(() => {
    if (branches.length === 1 && selectedBranch !== branches[0].id) {
      setSelectedBranch(branches[0].id);
    }
  }, [branches, selectedBranch]);

  // Derived available years
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);
    expenses.forEach(e => {
      if (e.date) {
        const y = new Date(e.date).getFullYear().toString();
        if (y !== 'NaN') years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  // Summary KPI Calculations
  const totalLifetimeOutflow = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const currentMonthOutflow = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return expenses
      .filter(e => e.date?.startsWith(currentMonthPrefix))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const foodPurchases = useMemo(() => {
    return expenses
      .filter(e => e.category === 'Food')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const pendingBills = useMemo(() => {
    return expenses
      .filter(e => e.paymentStatus === 'Pending')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  // Derived Data
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesBranch = selectedBranch === 'All' || e.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || (e.date && new Date(e.date).getFullYear().toString() === selectedYear);
      return matchesBranch && matchesYear;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, selectedBranch, selectedYear]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => map[e.category] = (map[e.category] || 0) + (Number(e.amount) || 0));
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredExpenses]);

  // Monthly Trend Data
  const monthlyTrendData = useMemo(() => {
    const data = [
        { name: 'Jan', amount: 0 }, { name: 'Feb', amount: 0 }, { name: 'Mar', amount: 0 },
        { name: 'Apr', amount: 0 }, { name: 'May', amount: 0 }, { name: 'Jun', amount: 0 },
        { name: 'Jul', amount: 0 }, { name: 'Aug', amount: 0 }, { name: 'Sep', amount: 0 },
        { name: 'Oct', amount: 0 }, { name: 'Nov', amount: 0 }, { name: 'Dec', amount: 0 }
    ];

    filteredExpenses.forEach(e => {
        if(e.date) {
            const d = new Date(e.date);
            if(!isNaN(d.getTime())) {
                data[d.getMonth()].amount += (Number(e.amount) || 0);
            }
        }
    });
    return data;
  }, [filteredExpenses]);

  const handleExport = () => {
    if (filteredExpenses.length === 0) return alert("No expenses to export.");

    // CSV Header
    const headers = ["Date", "Branch", "Category", "Title", "Vendor", "Amount", "Status", "Method", "Description", "Items Count"];
    
    // CSV Rows
    const rows = filteredExpenses.map(e => {
      const branchName = branches.find(b => b.id === e.branchId)?.name || 'Unknown';
      return [
        formatDateDDMMYYYY(e.date),
        `"${branchName}"`,
        `"${e.category}"`,
        `"${e.title}"`,
        `"${e.vendor || ''}"`,
        e.amount,
        `"${e.paymentStatus}"`,
        `"${e.paymentMethod}"`,
        `"${e.description || ''}"`,
        e.items?.length || 0
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_${selectedBranch}_${selectedYear}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAddOrEditExpense = async (data: any) => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz) {
      setSaveError("No active business account found. Please log in again.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Clean and sanitize all fields (CRITICAL: Firestore rejects undefined values)
      const cleanData: any = {
        branchId: data.branchId || branches[0]?.id || 'main',
        date: data.date || new Date().toISOString().split('T')[0],
        category: data.category || 'Food',
        title: String(data.title || '').trim(),
        vendor: String(data.vendor || '').trim(),
        description: String(data.description || '').trim(),
        amount: Math.max(0, Number(data.amount) || 0),
        paymentStatus: data.paymentStatus || 'Paid',
        paymentMethod: data.paymentMethod || 'UPI',
        items: Array.isArray(data.items) && data.items.length > 0
          ? data.items.map((it: any) => ({
              name: String(it.name || '').trim(),
              quantity: Number(it.quantity) || 1,
              unit: String(it.unit || 'kg'),
              amount: Number(it.amount) || 0
            }))
          : [],
        updatedAt: new Date().toISOString()
      };

      if (!cleanData.title) {
        throw new Error("Expense title / purpose is required.");
      }
      if (cleanData.amount <= 0) {
        throw new Error("Total amount must be greater than ₹0.");
      }

      if (editingExpense) {
        await updateItem(effectiveBiz, 'expenses', editingExpense.id, cleanData);
      } else {
        cleanData.createdAt = new Date().toISOString();
        await addItem(effectiveBiz, 'expenses', cleanData);
      }

      setIsModalOpen(false);
      setEditingExpense(null);
      setSaveError(null);
    } catch (err: any) {
      console.error("Expense save failed:", err);
      const cleanMsg = (err?.message || "Failed to save expense. Please check connection.")
        .replace(/^Firebase:\s*/i, '')
        .trim();
      setSaveError(cleanMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const effectiveBiz = getTargetBusinessId(currentUser?.uid);
    if (!effectiveBiz || !window.confirm("Delete this expense record?")) return;
    try {
      await deleteItem(effectiveBiz, 'expenses', id);
    } catch (err: any) {
      alert("Failed to delete expense: " + err.message);
    }
  };

  const openAddModal = () => {
     setEditingExpense(null);
     setSaveError(null);
     setIsModalOpen(true);
  };

  const openEditModal = (expense: GlobalExpense) => {
     setEditingExpense(expense);
     setSaveError(null);
     setIsModalOpen(true);
  };

  if (l1 || l2) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary-600" size={36} />
        <p className="text-xs font-medium text-slate-400">Loading business expenses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 pt-1 animate-in fade-in duration-300">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
            Operating Expenses & Outflow
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">Track ingredient purchases, kitchen wages, utilities, and daily spend.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Branch Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select 
                className="w-full sm:w-40 py-2.5 pl-3.5 pr-8 bg-white/85 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-glass outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 appearance-none cursor-pointer transition-all" 
                value={selectedBranch} 
                onChange={e => setSelectedBranch(e.target.value)}
              >
                {branches.length > 1 && <option value="All">All Branches</option>}
                {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>

            {/* Year Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select 
                className="w-full sm:w-32 py-2.5 pl-3.5 pr-8 bg-white/85 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-glass outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 appearance-none cursor-pointer transition-all" 
                value={selectedYear} 
                onChange={e => setSelectedYear(e.target.value)}
              >
                <option value="All">All Years</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>

            {/* Export Button */}
            <button 
              onClick={handleExport}
              className="glass-card hover:bg-slate-50/80 border border-slate-200/80 text-slate-700 py-2.5 px-3.5 rounded-xl transition-all shadow-glass flex items-center gap-2 font-semibold text-xs active:scale-95"
              title="Export to CSV"
            >
               <Download size={15}/> <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Add Button */}
            <button 
              onClick={openAddModal} 
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 font-semibold text-xs active:scale-95"
            >
               <Plus size={16}/> <span>Add Expense</span>
            </button>
        </div>
      </div>

      {/* 4 Summary KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Lifetime Outflow */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lifetime Outflow</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Receipt size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-display text-slate-900">
            ₹{totalLifetimeOutflow.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">{expenses.length} total entries recorded</p>
        </div>

        {/* Card 2: This Month */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Month</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-display text-slate-900">
            ₹{currentMonthOutflow.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Outflow for current calendar month</p>
        </div>

        {/* Card 3: Food & Groceries */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Food & Ingredients</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-display text-slate-900">
            ₹{foodPurchases.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Raw ingredients & grocery spend</p>
        </div>

        {/* Card 4: Pending Bills */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Bills</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-display text-slate-900">
            ₹{pendingBills.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-rose-500 mt-1 font-medium">Unsettled vendor & supplier bills</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
         {/* Category Breakdown */}
         <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass h-80 flex flex-col">
            <h3 className="text-base font-bold font-display text-slate-900 mb-4 flex items-center gap-2">
               <Receipt size={18} className="text-violet-600"/> Category Breakdown
            </h3>
            <div className="flex-1 relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={pieData} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={4}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
                        ))}
                     </Pie>
                     <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0];
                            return (
                              <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs">
                                <p className="font-bold text-slate-800 font-display">{item.name}</p>
                                <p className="text-violet-600 font-bold font-mono mt-0.5">₹{Number(item.value).toLocaleString()}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                     />
                     <Legend iconSize={8} iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569' }} />
                  </PieChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Recent List */}
         <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass flex flex-col h-80">
            <h3 className="text-base font-bold font-display text-slate-900 mb-4 flex items-center gap-2">
               <ShoppingBag size={18} className="text-primary-600"/> Recent Expenses
            </h3>
            <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
               {filteredExpenses.map((e: any, i) => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/70 px-2.5 -mx-2.5 rounded-xl transition-colors group cursor-default">
                     <div className="flex-1 min-w-0 pr-3">
                        <div className="font-semibold text-slate-800 text-xs truncate flex items-center gap-2">
                           <span className="truncate">{e.title || e.category}</span>
                           {e.vendor && (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0">
                                 Vendor: {e.vendor}
                              </span>
                           )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                           <span>{formatDateDDMMYYYY(e.date)}</span>
                           {e.items && e.items.length > 0 && (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px]">
                                 {e.items.length} items
                              </span>
                           )}
                           <span className="text-slate-300">•</span>
                           <span className="text-slate-500 text-[11px] truncate">
                             {branches.find(b => b.id === e.branchId)?.name}
                           </span>
                        </div>
                     </div>
                     <div className="text-right flex items-center gap-3">
                        <div>
                           <div className="font-bold text-slate-900 text-sm">₹{Number(e.amount).toLocaleString()}</div>
                           <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                             e.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                           }`}>
                              {e.paymentStatus}
                           </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openEditModal(e)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg" title="Edit"><Edit2 size={13} /></button>
                           <button onClick={() => handleDeleteExpense(e.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg" title="Delete"><Trash2 size={13} /></button>
                        </div>
                     </div>
                  </div>
               ))}
               {filteredExpenses.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                   <Receipt size={32} className="mb-2 text-slate-300"/>
                   <p className="font-medium text-xs">No expenses recorded for this filter</p>
                 </div>
               )}
            </div>
         </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass h-[380px]">
          <h3 className="text-base font-bold font-display text-slate-900 mb-6 flex items-center gap-2">
             <Calendar size={18} className="text-emerald-600"/> Monthly Spending Trend {selectedYear === 'All' ? '(All Years)' : `(${selectedYear})`}
          </h3>
          <div className="h-full pb-14">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData}>
                   <defs>
                     <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95}/>
                       <stop offset="100%" stopColor="#818cf8" stopOpacity={0.4}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                   <Tooltip 
                       cursor={{fill: 'rgba(241, 245, 249, 0.6)', radius: 8}}
                       content={({ active, payload, label }) => {
                         if (active && payload && payload.length) {
                           return (
                             <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs">
                               <p className="font-bold text-slate-800 font-display mb-0.5">{label}</p>
                               <p className="text-indigo-600 font-bold font-mono text-sm">₹{Number(payload[0].value).toLocaleString()}</p>
                               <p className="text-[10px] text-slate-400 mt-0.5">Total Spent</p>
                             </div>
                           );
                         }
                         return null;
                       }}
                   />
                   <Bar dataKey="amount" fill="url(#expenseBarGrad)" radius={[8, 8, 2, 2]} barSize={28} />
                </BarChart>
             </ResponsiveContainer>
          </div>
      </div>

      {isModalOpen && (
         <AddExpenseModal 
            branches={branches} 
            initialData={editingExpense} 
            isSaving={isSaving}
            saveError={saveError}
            onClose={() => setIsModalOpen(false)} 
            onSubmit={handleAddOrEditExpense} 
         />
      )}
    </div>
  );
};

// --- MODALS ---

const AddExpenseModal = ({ branches, initialData, isSaving, saveError, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({
      branchId: initialData?.branchId || branches[0]?.id || '', 
      date: initialData?.date || new Date().toISOString().split('T')[0], 
      category: initialData?.category || 'Food', 
      title: initialData?.title || '', 
      vendor: initialData?.vendor || '',
      description: initialData?.description || '',
      paymentStatus: initialData?.paymentStatus || 'Paid',
      paymentMethod: initialData?.paymentMethod || 'UPI',
      ...initialData,
      amount: initialData ? String(initialData.amount) : '', 
   });

   // Line Items State
   const [items, setItems] = useState<ExpenseItem[]>(initialData?.items || []);
   const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: 'kg', price: '' });

   // Update branchId if branches load after modal is mounted
   useEffect(() => {
     if (!formData.branchId && branches.length > 0) {
       setFormData(prev => ({ ...prev, branchId: branches[0].id }));
     }
   }, [branches, formData.branchId]);

   // Update total amount when items change
   useEffect(() => {
      if (items.length > 0) {
         const total = items.reduce((sum, item) => sum + item.amount, 0);
         setFormData(prev => ({ ...prev, amount: String(total) }));
      }
   }, [items]);

   const handleAddItem = () => {
      if (!newItem.name || !newItem.price) return;
      const amount = parseFloat(newItem.price);
      const quantity = parseFloat(newItem.quantity) || 1;
      
      setItems([...items, {
         name: newItem.name.trim(),
         quantity,
         unit: newItem.unit,
         amount
      }]);
      setNewItem({ name: '', quantity: '', unit: 'kg', price: '' });
   };

   const handleRemoveItem = (index: number) => {
      const updated = items.filter((_, i) => i !== index);
      setItems(updated);
      if (updated.length === 0) {
         setFormData(prev => ({ ...prev, amount: '' }));
      }
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      // Auto-include pending line item if name & price are typed
      let finalItems = [...items];
      if (newItem.name.trim() && newItem.price) {
        const amt = parseFloat(newItem.price) || 0;
        const qty = parseFloat(newItem.quantity) || 1;
        if (amt > 0) {
          finalItems.push({
            name: newItem.name.trim(),
            quantity: qty,
            unit: newItem.unit,
            amount: amt
          });
        }
      }

      const totalAmount = finalItems.length > 0
        ? finalItems.reduce((sum, item) => sum + item.amount, 0)
        : Number(formData.amount);

      onSubmit({
         ...formData,
         title: formData.title.trim(),
         vendor: formData.vendor.trim(),
         description: formData.description.trim(),
         amount: totalAmount,
         items: finalItems.length > 0 ? finalItems : undefined
      });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
         <div className="glass-card bg-white/95 w-full max-w-2xl rounded-2xl p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar relative border border-white/80">
            <div className="flex justify-between items-center mb-6">
               <div>
                  <h3 className="text-xl font-bold font-display text-slate-900">{initialData ? 'Edit Expense Record' : 'Record New Expense'}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Log operational kitchen outlays and vendor bills</p>
               </div>
               <button onClick={onClose} disabled={isSaving} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50"><X size={20}/></button>
            </div>

            {saveError && (
               <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span className="font-semibold">{saveError}</span>
               </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
               
               {/* Top Section: Basic Info */}
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                     <ModalLabel>Branch</ModalLabel>
                     <select className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-800 font-medium text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}>
                        {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
                  <div>
                     <ModalLabel>Date</ModalLabel>
                     <input required type="date" value={formData.date} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-800 font-medium text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div>
                     <ModalLabel>Category</ModalLabel>
                     <select className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-800 font-medium text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
               </div>

               {/* Middle Section: Details with Vendor */}
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                     <ModalLabel>Title / Purpose</ModalLabel>
                     <input required placeholder="e.g. Weekly Market Run / Fresh Produce" className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-800 font-medium text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div>
                     <ModalLabel>Vendor / Supplier (Optional)</ModalLabel>
                     <input placeholder="e.g. Metro Wholesale, Sharma Dairy..." className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-800 font-medium text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" value={formData.vendor} onChange={e => setFormData({...formData, vendor: e.target.value})} />
                  </div>
               </div>

               <div>
                  <ModalLabel>Description (Optional)</ModalLabel>
                  <input placeholder="Bill invoice number, payment reference, or kitchen notes..." className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-800 font-medium text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
               </div>

               {/* Line Items Section */}
               <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/70">
                  <label className="block text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                     <ShoppingBag size={14} className="text-primary-600"/> Item Breakdown (Optional)
                  </label>
                  
                  {/* Item Input Row */}
                  <div className="flex flex-wrap sm:flex-nowrap gap-2 mb-3">
                     <input 
                        placeholder="Item name (e.g. Basmati Rice)" 
                        className="flex-[2] min-w-[120px] p-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20"
                        value={newItem.name}
                        onChange={e => setNewItem({...newItem, name: e.target.value})}
                     />
                     <input 
                        type="number" 
                        placeholder="Qty" 
                        className="w-16 p-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20"
                        value={newItem.quantity}
                        onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                     />
                     <select 
                        className="w-20 p-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20"
                        value={newItem.unit}
                        onChange={e => setNewItem({...newItem, unit: e.target.value})}
                     >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                     </select>
                     <input 
                        type="number" 
                        placeholder="Amount (₹)" 
                        className="w-24 p-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20"
                        value={newItem.price}
                        onChange={e => setNewItem({...newItem, price: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                     />
                     <button 
                        type="button" 
                        onClick={handleAddItem}
                        className="bg-slate-900 text-white p-2 rounded-lg hover:bg-black transition-all flex items-center justify-center active:scale-95"
                        title="Add item"
                     >
                        <Plus size={16} />
                     </button>
                  </div>

                  {/* Items List */}
                  {items.length > 0 && (
                     <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
                        <table className="w-full text-xs text-left">
                           <thead className="bg-slate-50 text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
                              <tr>
                                 <th className="py-2 pl-3">Item</th>
                                 <th className="py-2">Qty</th>
                                 <th className="py-2">Amount</th>
                                 <th className="py-2 w-8"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {items.map((item, idx) => (
                                 <tr key={idx}>
                                    <td className="py-2 pl-3 text-slate-800 font-medium">{item.name}</td>
                                    <td className="py-2 text-slate-500">{item.quantity} {item.unit}</td>
                                    <td className="py-2 font-semibold text-slate-900">₹{item.amount}</td>
                                    <td className="py-2 text-center">
                                       <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-rose-600 transition-colors">
                                          <X size={14} />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>

               {/* Bottom Section: Totals & Payment */}
               <div className="flex flex-col sm:flex-row gap-3 items-end bg-slate-900 p-4 sm:p-5 rounded-xl text-white">
                  <div className="w-full sm:w-1/3">
                     <ModalLabel><span className="text-slate-300">Total Amount (₹)</span></ModalLabel>
                     <input 
                        required 
                        type="number" 
                        className={`w-full p-2.5 bg-slate-800/90 border border-slate-700 rounded-lg text-white font-bold text-lg outline-none ${items.length > 0 ? 'opacity-70' : ''}`} 
                        value={formData.amount} 
                        onChange={e => items.length === 0 && setFormData({...formData, amount: e.target.value})}
                        readOnly={items.length > 0}
                     />
                  </div>
                  <div className="w-full sm:w-1/3">
                     <ModalLabel><span className="text-slate-300">Payment Status</span></ModalLabel>
                     <select className="w-full p-2.5 bg-slate-800/90 border border-slate-700 rounded-lg text-white font-medium text-xs outline-none" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value})}>
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                     </select>
                  </div>
                  <div className="w-full sm:w-1/3">
                     <ModalLabel><span className="text-slate-300">Payment Method</span></ModalLabel>
                     <select className="w-full p-2.5 bg-slate-800/90 border border-slate-700 rounded-lg text-white font-medium text-xs outline-none" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3 pt-3">
                  <button type="button" onClick={onClose} disabled={isSaving} className="py-2.5 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors text-xs disabled:opacity-50">Cancel</button>
                  <button 
                     type="submit" 
                     disabled={isSaving} 
                     className="py-2.5 bg-primary-600 text-white rounded-xl font-semibold shadow-sm hover:bg-primary-700 transition-all active:scale-95 text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     {isSaving && <Loader2 size={14} className="animate-spin" />}
                     <span>{isSaving ? 'Saving...' : initialData ? 'Update Expense' : 'Save Expense'}</span>
                  </button>
               </div>
            </form>
         </div>
      </div>
   );
}

const ModalLabel = ({ children }: React.PropsWithChildren<{}>) => (
  <label className="text-[11px] font-semibold text-slate-600 mb-1.5 block">{children}</label>
);

export default Expenses;
