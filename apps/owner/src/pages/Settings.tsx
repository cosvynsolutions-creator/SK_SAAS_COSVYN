import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, X, Store, Truck, Calendar, Loader2, Edit2, Check, Package, 
  ShieldCheck, UserCheck, Image as ImageIcon, Upload, Link as LinkIcon, 
  Share2, Copy, ExternalLink, Shield, Key, Clock, Eye, EyeOff, Building, 
  Users, CheckCircle2, ChevronRight, AlertCircle, RefreshCw, CreditCard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, deleteItem, updateItem, setItem } from '../services/dbService';
import { 
  INDIA_STATES, REUSABLE_BOX_TYPES, ALL_SAAS_PAGES, BranchManager, ManagerLogEntry,
  formatDateDDMMYYYY
} from '../services/store';
import { 
  db, 
  createDeliveryBoyAccountCallable, 
  updateDeliveryBoyAccountCallable, 
  resetDeliveryBoyPasswordCallable, 
  deactivateDeliveryBoyAccountCallable, 
  reactivateDeliveryBoyAccountCallable, 
  setDriverPasswordCallable, 
  setManagerPasswordCallable, 
  deleteDriverCallable 
} from '../services/firebase';
import { doc, onSnapshot, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { VegNonVegBadge, VegNonVegIcon, DayDietScheduleSelector } from '../components/VegNonVegIndicator';
import { getPlanDietSummaryLabel, DietType, PlanDietPreference } from '../services/store';
import bcrypt from 'bcryptjs';

/**
 * TEMPORARY MIGRATION FLAG:
 * Kept strictly for backward compatibility during Phase 1 deployment transition.
 * REMOVAL CRITERIA: Once Cloud Functions (firebase deploy --only functions) are deployed
 * and migratePlaintextCredentials has run, set this to false and remove the fallback branch.
 */
const ENABLE_LEGACY_CLIENT_AUTH_FALLBACK = true;

// --- Types ---
interface Branch { 
  id: string; 
  name: string; 
  city: string; 
  state: string; 
  hubAddress?: string;
  hubLocationLink?: string;
}

interface Plan { 
  id: string; 
  branchId: string; 
  name: string; 
  description: string; 
  price: number; 
  category: string; 
  numberOfDeliveryDays: number; 
  weekdays: number[]; 
  deliveryTypeLabel: string; 
  dietPreference?: PlanDietPreference;
  dayDietSchedule?: Record<number, DietType>;
}

interface DeliveryBoy { 
  id: string; 
  branchId: string; 
  name: string; 
  mobile: string; 
  email?: string;
  password?: string;
  dateOfJoining: string; 
  salary: number; 
  aadharNumber?: string;
  homeLocation?: string;
  vehicleNumber?: string;
  status?: 'Active' | 'Inactive';
  active?: boolean;
  authUid?: string;
}

interface CustomBoxType { 
  id: string; 
  name: string; 
  shortLabel?: string; 
  description?: string; 
  defaultDeposit?: number; 
  isCustom?: boolean;
}

const WEEKDAYS_MAP = [
  { id: 0, label: 'Sun' }, { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, 
  { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' },
];

const generateDeliveryLabel = (days: number[]): string => {
  if (!days || days.length === 0) return 'No days';
  if (days.length === 7) return 'All 7 Days';
  const sorted = [...days].sort();
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return 'Mon-Fri';
  if (sorted.length === 6 && sorted.every((d, i) => d === i + 1)) return 'Mon-Sat';
  return sorted.map(d => WEEKDAYS_MAP.find(w => w.id === d)?.label).join(', ');
};

const Settings = () => {
  const { currentUser } = useAuth();
  
  // --- REAL DATA STREAMS ---
  const { data: branches, loading: l1 } = useStreamCollection<Branch>('branches');
  const { data: plans, loading: l2 } = useStreamCollection<Plan>('plans');
  const { data: deliveryBoys, loading: l3 } = useStreamCollection<DeliveryBoy>('staff');
  const { data: dbBoxTypes = [], loading: l4 } = useStreamCollection<CustomBoxType>('box_types');
  const { data: managers = [], loading: l5 } = useStreamCollection<BranchManager>('managers');
  const { data: managerLogs = [], loading: l6 } = useStreamCollection<ManagerLogEntry>('manager_logs');

  const isLoading = l1 || l2 || l3 || l4 || l5;

  // Business Profile (Business Name & Logo)
  const [businessName, setBusinessName] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandSavedSuccess, setBrandSavedSuccess] = useState(false);
  const [logoInputMethod, setLogoInputMethod] = useState<'url' | 'upload'>('url');

  // Sub-tabs for staff section: 'managers' or 'logs'
  const [managerTab, setManagerTab] = useState<'list' | 'logs'>('list');

  // Modal State
  const [activeModal, setActiveModal] = useState<'branch' | 'plan' | 'delivery' | 'boxType' | 'manager' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Fetch business profile (name & logo)
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'businesses', currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.businessName) setBusinessName(data.businessName);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      }
    }, (err) => console.warn("Error loading business logo in settings:", err));
    return () => unsub();
  }, [currentUser]);




  // Delivery partner credentials are managed server-side by Cloud Functions.

  // Combine built-in standard box types with custom box types
  const allBoxTypes = useMemo(() => {
    const customMap = new Map<string, CustomBoxType>();
    REUSABLE_BOX_TYPES.forEach(b => {
      customMap.set(b.id, {
        id: b.id,
        name: b.name,
        shortLabel: b.shortLabel,
        description: b.description,
        defaultDeposit: b.defaultDeposit,
        isCustom: false
      });
    });
    dbBoxTypes.forEach((b: any) => {
      if (b.isDeleted) {
        customMap.delete(b.id);
      } else {
        customMap.set(b.id, {
          ...b,
          isCustom: true
        });
      }
    });
    return Array.from(customMap.values());
  }, [dbBoxTypes]);

  // Sorted Manager Activity Logs (newest first)
  const sortedManagerLogs = useMemo(() => {
    return [...managerLogs].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date).getTime();
      const timeB = new Date(b.createdAt || b.date).getTime();
      return timeB - timeA;
    });
  }, [managerLogs]);

  // --- ACTIONS ---
  
  const handleOpenModal = (type: 'branch' | 'plan' | 'delivery' | 'boxType' | 'manager', item?: any) => {
    setEditingItem(item || null);
    setActiveModal(type);
  };

  const handleSaveBrand = async () => {
    if (!currentUser) return;
    setIsSavingBrand(true);
    setBrandSavedSuccess(false);
    try {
      await updateDoc(doc(db, 'businesses', currentUser.uid), {
        businessName: businessName.trim(),
        logoUrl: logoUrl.trim(),
        updatedAt: new Date().toISOString()
      });
      setBrandSavedSuccess(true);
      setTimeout(() => setBrandSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save brand logo:", err);
      alert("Failed to update logo. Please check connection.");
    } finally {
      setIsSavingBrand(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert("Please upload an image smaller than 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        setLogoUrl(result);
        if (currentUser) {
          try {
            await updateDoc(doc(db, 'businesses', currentUser.uid), {
              logoUrl: result,
              updatedAt: new Date().toISOString()
            });
            setBrandSavedSuccess(true);
            setTimeout(() => setBrandSavedSuccess(false), 3500);
          } catch (err) {
            console.warn("Auto-syncing brand logo to business doc:", err);
          }
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranch = async (data: Omit<Branch, 'id'>) => {
    if(!currentUser) return;
    if (editingItem) {
      await updateItem(currentUser.uid, 'branches', editingItem.id, data);
    } else {
      await addItem(currentUser.uid, 'branches', data);
    }
    setActiveModal(null);
    setEditingItem(null);
  };

  const handleSavePlan = async (data: Omit<Plan, 'id'>) => {
    if(!currentUser) return;
    if (editingItem) {
      await updateItem(currentUser.uid, 'plans', editingItem.id, data);
    } else {
      await addItem(currentUser.uid, 'plans', data);
    }
    setActiveModal(null);
    setEditingItem(null);
  };

  const handleSaveStaff = async (data: Omit<DeliveryBoy, 'id'>) => {
    if (!currentUser) return;
    const cleanPhone = (data.mobile || '').replace(/\D/g, '').slice(-10);
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const rawPassword = (data.password || '').trim();
    const cleanStatus = data.status === 'Inactive' ? 'Inactive' : 'Active';
    const isActive = cleanStatus !== 'Inactive';

    const staffData = {
      name: data.name.trim(),
      branchId: data.branchId || branches[0]?.id || '',
      mobile: cleanPhone,
      email: cleanEmail,
      dateOfJoining: data.dateOfJoining || new Date().toISOString().split('T')[0],
      salary: Number(data.salary) || 0,
      aadharNumber: (data.aadharNumber || '').trim(),
      homeLocation: (data.homeLocation || '').trim(),
      vehicleNumber: (data.vehicleNumber || '').trim(),
      status: cleanStatus,
      active: isActive,
      role: 'driver',
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingItem && editingItem.id) {
        await updateDeliveryBoyAccountCallable({
          bizId: currentUser.uid,
          staffId: editingItem.id,
          name: staffData.name,
          email: cleanEmail,
          password: rawPassword || undefined,
          branchId: staffData.branchId,
          mobile: cleanPhone,
          dateOfJoining: staffData.dateOfJoining,
          salary: staffData.salary,
          aadharNumber: staffData.aadharNumber,
          homeLocation: staffData.homeLocation,
          vehicleNumber: staffData.vehicleNumber,
          status: cleanStatus
        });
      } else {
        await createDeliveryBoyAccountCallable({
          bizId: currentUser.uid,
          name: staffData.name,
          email: cleanEmail,
          password: rawPassword,
          branchId: staffData.branchId,
          mobile: cleanPhone,
          dateOfJoining: staffData.dateOfJoining,
          salary: staffData.salary,
          aadharNumber: staffData.aadharNumber,
          homeLocation: staffData.homeLocation,
          vehicleNumber: staffData.vehicleNumber,
          status: cleanStatus
        });
      }
    } catch (callableErr) {
      console.error("Delivery partner account callable failed:", callableErr);
      throw callableErr;
    }

    setActiveModal(null);
    setEditingItem(null);
  };

  const handleSaveManager = async (data: Omit<BranchManager, 'id'>) => {
    if (!currentUser) return;
    const rawPassword = (data as any).password;
    // SECURITY (Phase 1): Remove plaintext password from client doc write
    const { password: _omitPassword, ...managerFieldsWithoutPassword } = data as any;
    let managerId = editingItem?.id;

    if (editingItem) {
      await updateItem(currentUser.uid, 'managers', editingItem.id, {
        ...managerFieldsWithoutPassword,
        updatedAt: new Date().toISOString()
      });
    } else {
      const addedDoc = await addItem(currentUser.uid, 'managers', {
        ...managerFieldsWithoutPassword,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      managerId = (addedDoc as any)?.id;
    }

    // Call server-side callable to hash password securely and update passwordHash
    let callableSucceeded = false;
    if (rawPassword) {
      try {
        await setManagerPasswordCallable({
          bizId: currentUser.uid,
          managerId: managerId || editingItem?.id || '',
          password: rawPassword,
          managerData: managerFieldsWithoutPassword
        });
        callableSucceeded = true;
      } catch (callableErr) {
        console.warn("setManagerPassword callable warning:", callableErr);
      }
    }

    // TEMPORARY MIGRATION FALLBACK: Only used before Cloud Functions deployment
    if (!callableSucceeded && ENABLE_LEGACY_CLIENT_AUTH_FALLBACK && rawPassword && editingItem) {
      console.warn("[Migration Fallback] Writing temporary manager password until Cloud Functions are deployed.");
      await updateItem(currentUser.uid, 'managers', editingItem.id, {
        password: rawPassword
      }).catch(() => {});
    }

    setActiveModal(null);
    setEditingItem(null);
  };

  const handleSaveBoxType = async (data: Omit<CustomBoxType, 'id'>) => {
    if(!currentUser) return;
    if (editingItem && editingItem.id) {
      await setItem(currentUser.uid, 'box_types', editingItem.id, { 
        ...data, 
        id: editingItem.id, 
        isCustom: true,
        isDeleted: false,
        updatedAt: new Date().toISOString() 
      });
    } else {
      await addItem(currentUser.uid, 'box_types', { 
        ...data, 
        isCustom: true,
        isDeleted: false,
        createdAt: new Date().toISOString() 
      });
    }
    setActiveModal(null);
    setEditingItem(null);
  };

  const handleDeleteBoxType = async (box: CustomBoxType) => {
    if (!currentUser || !window.confirm(`Are you sure you want to delete "${box.name}"?`)) return;
    try {
      await setItem(currentUser.uid, 'box_types', box.id, {
        id: box.id,
        name: box.name,
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error deleting box type:", err);
      alert("Failed to delete box type.");
    }
  };

  const handleDelete = async (collection: string, id: string) => {
    if(!currentUser || !window.confirm("Are you sure? This cannot be undone.")) return;
    if (collection === 'staff') {
      const boy = deliveryBoys.find(b => b.id === id);
      const cleanPhone = (boy?.mobile || '').replace(/\D/g, '').slice(-10);
      try {
        await deleteDriverCallable({
          bizId: currentUser.uid,
          staffId: id,
          phone: cleanPhone
        });
      } catch (e) {
        console.warn("deleteDriver callable notice:", e);
      }
    }
    await deleteItem(currentUser.uid, collection, id);
  };

  // --- MODALS ---
  
  const BranchModal = ({ initialData, onClose }: { initialData?: Branch, onClose: () => void }) => {
    const [formData, setFormData] = useState({ 
      name: initialData?.name || '', 
      city: initialData?.city || '',
      state: initialData?.state || '',
      hubAddress: initialData?.hubAddress || '',
      hubLocationLink: initialData?.hubLocationLink || ''
    });
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.city || !formData.state) return;
      handleSaveBranch({ 
        name: formData.name, 
        city: formData.city, 
        state: formData.state,
        hubAddress: formData.hubAddress,
        hubLocationLink: formData.hubLocationLink
      });
    };
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-7 border border-white/80">
          <div className="flex justify-between mb-5 items-center">
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900">{initialData ? 'Edit Kitchen Branch' : 'Add Kitchen Branch'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Physical dispatch hub and service geography</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name</label>
              <input 
                required autoFocus
                placeholder="e.g. Bandra Cloud Kitchen" 
                className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input 
                  required 
                  placeholder="e.g. Mumbai" 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                <select 
                  required
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium"
                  value={formData.state}
                  onChange={e => setFormData({...formData, state: e.target.value})}
                >
                  <option value="">Select State</option>
                  {INDIA_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-primary-700 mb-1">
                  Kitchen Hub Address (For Route Optimization)
                </label>
                <input 
                  placeholder="e.g. Shop 4, Food Court, Andheri West" 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  value={formData.hubAddress}
                  onChange={e => setFormData({...formData, hubAddress: e.target.value})} 
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Used as starting & return point for delivery boy shortest paths.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary-700 mb-1">
                  Google Maps URL or Lat, Lng
                </label>
                <input 
                  placeholder="e.g. https://maps.app.goo.gl/... or 19.1136, 72.8697" 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  value={formData.hubLocationLink}
                  onChange={e => setFormData({...formData, hubLocationLink: e.target.value})} 
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Paste Google Maps share link or GPS coordinates.</p>
              </div>
            </div>
            
            <div className="pt-2">
              <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95">
                {initialData ? 'Update Branch' : 'Create Branch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const PlanModal = ({ initialData, onClose }: { initialData?: Plan, onClose: () => void }) => {
    const [formData, setFormData] = useState<Partial<Plan>>({
      branchId: branches[0]?.id || '', 
      category: 'Monthly', 
      weekdays: [1, 2, 3, 4, 5], 
      numberOfDeliveryDays: 20,
      ...initialData
    });

    // Default day diet schedule: if initialData has it, use it; else if name suggests non-veg, set to Non-Veg; else Veg
    const initialSchedule: Record<number, DietType> = useMemo(() => {
      if (initialData?.dayDietSchedule && Object.keys(initialData.dayDietSchedule).length > 0) {
        return initialData.dayDietSchedule;
      }
      const isDefaultNonVeg = Boolean(
        initialData?.name && (
          initialData.name.toLowerCase().includes('non-veg') ||
          initialData.name.toLowerCase().includes('chicken') ||
          initialData.name.toLowerCase().includes('meat')
        )
      );
      const sched: Record<number, DietType> = {};
      [0, 1, 2, 3, 4, 5, 6].forEach(d => {
        sched[d] = isDefaultNonVeg ? 'Non-Veg' : 'Veg';
      });
      return sched;
    }, [initialData]);

    const [dayDietSchedule, setDayDietSchedule] = useState<Record<number, DietType>>(initialSchedule);

    const toggleDay = (d: number) => {
      const days = formData.weekdays || [];
      const updatedDays = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
      setFormData({...formData, weekdays: updatedDays});
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!formData.name || !formData.price || !formData.branchId) return;

      const activeDays = formData.weekdays || [];
      const hasVeg = activeDays.some(d => (dayDietSchedule[d] || 'Veg') === 'Veg');
      const hasNonVeg = activeDays.some(d => dayDietSchedule[d] === 'Non-Veg');
      const dietPreference: PlanDietPreference = (!hasNonVeg) ? 'Veg' : (!hasVeg) ? 'Non-Veg' : 'Mixed';

      handleSavePlan({
        ...formData,
        price: Number(formData.price),
        numberOfDeliveryDays: Number(formData.numberOfDeliveryDays),
        deliveryTypeLabel: generateDeliveryLabel(formData.weekdays || []),
        dayDietSchedule,
        dietPreference
      } as any);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-7 overflow-y-auto max-h-[90vh] border border-white/80">
          <div className="flex justify-between mb-5 items-center">
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900">{initialData ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Meal subscription offering, billing frequency and Veg/Non-Veg schedule</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kitchen Branch</label>
              <select 
                className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                value={formData.branchId}
                onChange={e => setFormData({...formData, branchId: e.target.value})}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name</label>
                <input required placeholder="e.g. Standard Tiffin Lunch" value={formData.name} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹)</label>
                <input required type="number" placeholder="e.g. 2500" value={formData.price} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <textarea placeholder="e.g. 4 chapatis, 1 sabzi, dal, rice & salad" value={formData.description} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium resize-none h-18" onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Cycle</label>
                 <select className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                   <option value="Monthly">Monthly</option>
                   <option value="Weekly">Weekly</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">Total Delivery Days</label>
                 <input type="number" placeholder="e.g. 26" value={formData.numberOfDeliveryDays} className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" onChange={e => setFormData({...formData, numberOfDeliveryDays: Number(e.target.value)})} />
               </div>
            </div>

            {/* Delivery Weekdays Selection */}
            <div>
              <label className="text-xs font-semibold block mb-2 text-slate-700">Delivery Weekdays</label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS_MAP.map(d => (
                  <button type="button" key={d.id} onClick={() => toggleDay(d.id)} className={`px-3 py-1.5 text-xs rounded-xl border transition-all font-medium ${formData.weekdays?.includes(d.id) ? 'bg-primary-600 text-white border-primary-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'}`}>{d.label}</button>
                ))}
              </div>
            </div>

            {/* Veg / Non-Veg Day-by-Day Configuration - Matching Screenshot 1 Wireframe */}
            <DayDietScheduleSelector
              weekdays={formData.weekdays || []}
              dayDietSchedule={dayDietSchedule}
              onChange={setDayDietSchedule}
            />

            <div className="pt-2">
              <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95">
                {initialData ? 'Update Plan' : 'Save Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // --- DELIVERY PARTNER MODAL (Email + Password Account Management) ---
  const DeliveryBoyModal = ({ initialData, onClose }: { initialData?: DeliveryBoy, onClose: () => void }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<DeliveryBoy>>({ 
      branchId: branches[0]?.id || '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      salary: 15000,
      aadharNumber: '',
      homeLocation: '',
      vehicleNumber: '',
      email: '',
      password: '',
      status: 'Active',
      ...initialData
    });
    
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setModalError(null);

      const email = (formData.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        setModalError('Please enter a valid email address for delivery login.');
        return;
      }

      if (!initialData && (!formData.password || formData.password.length < 6)) {
        setModalError('Password must be at least 6 characters.');
        return;
      }

      if (formData.password && formData.password.length < 6) {
        setModalError('Password must be at least 6 characters.');
        return;
      }

      const mobileDigits = (formData.mobile || '').replace(/\D/g, '').slice(-10);
      if (mobileDigits.length !== 10) {
        setModalError('Please enter a valid 10-digit mobile number.');
        return;
      }

      setIsSubmitting(true);
      try {
        await handleSaveStaff({ 
          ...formData, 
          name: (formData.name || '').trim(),
          email,
          password: formData.password || '',
          branchId: formData.branchId || branches[0]?.id || '',
          mobile: mobileDigits,
          salary: Number(formData.salary) || 0,
          dateOfJoining: formData.dateOfJoining || new Date().toISOString().split('T')[0],
          aadharNumber: formData.aadharNumber?.trim() || '',
          homeLocation: formData.homeLocation?.trim() || '',
          vehicleNumber: formData.vehicleNumber?.trim() || '',
          status: formData.status || 'Active'
        } as any);
      } catch (err: any) {
        setModalError(err?.message || 'Failed to save delivery partner account.');
        setIsSubmitting(false);
      }
    };
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-7 border border-white/80 max-h-[92vh] overflow-y-auto">
          <div className="flex justify-between mb-4 items-center">
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900">
                {initialData ? 'Edit Delivery Partner' : 'Create Delivery Partner Account'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Staff profile, branch assignment and email/password portal credentials
              </p>
            </div>
            <button 
              onClick={onClose} 
              disabled={isSubmitting}
              className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {modalError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1 font-medium">{modalError}</div>
              <button onClick={() => setModalError(null)} className="text-rose-400 hover:text-rose-600">
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Branch <span className="text-rose-500">*</span>
                </label>
                <select 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  value={formData.branchId}
                  onChange={e => setFormData({...formData, branchId: e.target.value})}
                >
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Status <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium"
                  value={formData.status || 'Active'}
                  onChange={e => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                >
                  <option value="Active">Active (Can Deliver)</option>
                  <option value="Inactive">Inactive (Deactivated)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input 
                required 
                placeholder="e.g. Ramesh Kumar" 
                value={formData.name || ''} 
                className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input 
                  required 
                  placeholder="e.g. 9876543210" 
                  value={formData.mobile || ''} 
                  maxLength={10}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium font-mono" 
                  onChange={e => setFormData({...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vehicle Number <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <input 
                  placeholder="e.g. MH 02 AB 1234" 
                  value={formData.vehicleNumber || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium uppercase font-mono" 
                  onChange={e => setFormData({...formData, vehicleNumber: e.target.value.toUpperCase()})} 
                />
              </div>
            </div>

            {/* Email & Password Authentication Section */}
            <div className="p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-blue-950 font-bold text-xs">
                <ShieldCheck size={15} className="text-blue-600" />
                <span>Delivery App Login Credentials</span>
              </div>
              
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-blue-900 mb-1">
                    Login Email Address <span className="text-rose-600">*</span>
                  </label>
                  <input 
                    required 
                    type="email"
                    placeholder="e.g. ramesh.rider@kitchen.com" 
                    value={formData.email || ''} 
                    className="w-full p-2.5 border border-blue-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs font-medium" 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-semibold text-blue-900">
                      Password {!initialData && <span className="text-rose-600">*</span>}
                    </label>
                    <span className="text-[10px] text-blue-600 font-medium">
                      {initialData ? 'Leave blank to keep unchanged' : 'Min 6 characters'}
                    </span>
                  </div>
                  <div className="relative">
                    <input 
                      required={!initialData}
                      type={showPassword ? "text" : "password"}
                      placeholder={initialData ? "•••••••• (unchanged)" : "Enter login password"} 
                      value={formData.password || ''} 
                      className="w-full p-2.5 pr-10 border border-blue-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs font-medium" 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-blue-700/90 leading-relaxed">
                Share this email and password with the delivery partner so they can sign in to the Delivery portal.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Joining Date <span className="text-rose-500">*</span>
                </label>
                <input 
                  required 
                  type="date" 
                  value={formData.dateOfJoining || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, dateOfJoining: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Salary (₹) <span className="text-rose-500">*</span>
                </label>
                <input 
                  required 
                  type="number" 
                  placeholder="e.g. 15000" 
                  value={formData.salary || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, salary: Number(e.target.value)})} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aadhaar Number <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <input 
                  placeholder="e.g. 1234 5678 9012" 
                  value={formData.aadharNumber || ''} 
                  maxLength={16}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium font-mono" 
                  onChange={e => setFormData({...formData, aadharNumber: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Home Location <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <input 
                  placeholder="e.g. Andheri East, Mumbai" 
                  value={formData.homeLocation || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, homeLocation: e.target.value})} 
                />
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving Account...</span>
                  </>
                ) : (
                  <span>{initialData ? 'Update Partner' : 'Create Partner Account'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // --- MANAGER MODAL (Part 3: Manager details, branch access, SaaS page permissions & login credentials) ---
  const ManagerModal = ({ initialData, onClose }: { initialData?: BranchManager, onClose: () => void }) => {
    const [formData, setFormData] = useState<Partial<BranchManager>>({
      name: initialData?.name || '',
      mobile: initialData?.mobile || '',
      aadharNumber: initialData?.aadharNumber || '',
      location: initialData?.location || '',
      salary: initialData?.salary ?? 25000,
      dateOfJoining: initialData?.dateOfJoining || new Date().toISOString().split('T')[0],
      homeLocation: initialData?.homeLocation || '',
      branchId: initialData?.branchId || (branches[0]?.id || 'All'),
      allowedPages: initialData?.allowedPages && initialData.allowedPages.length > 0 
        ? initialData.allowedPages 
        : ['dashboard', 'prep', 'deliveries', 'customers', 'notes', 'inventory'],
      email: initialData?.email || '',
      password: initialData?.password || ''
    });

    const [showPass, setShowPass] = useState(false);

    const togglePage = (pageId: string) => {
      const current = formData.allowedPages || [];
      if (current.includes(pageId)) {
        setFormData({ ...formData, allowedPages: current.filter(p => p !== pageId) });
      } else {
        setFormData({ ...formData, allowedPages: [...current, pageId] });
      }
    };

    const selectAllPages = () => {
      setFormData({ ...formData, allowedPages: ALL_SAAS_PAGES.map(p => p.id) });
    };

    const clearAllPages = () => {
      setFormData({ ...formData, allowedPages: ['dashboard'] });
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name?.trim() || !formData.mobile?.trim() || !formData.email?.trim() || !formData.password?.trim()) {
        alert("Please fill in Manager Name, Mobile, Email, and Password.");
        return;
      }

      handleSaveManager({
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        aadharNumber: formData.aadharNumber?.trim() || '',
        location: formData.location?.trim() || '',
        salary: Number(formData.salary) || 0,
        dateOfJoining: formData.dateOfJoining || new Date().toISOString().split('T')[0],
        homeLocation: formData.homeLocation?.trim() || '',
        branchId: formData.branchId || 'All',
        allowedPages: formData.allowedPages && formData.allowedPages.length > 0 ? formData.allowedPages : ['dashboard'],
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      });
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl w-full max-w-xl p-5 sm:p-7 border border-white/80 max-h-[92vh] overflow-y-auto">
          <div className="flex justify-between mb-5 items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold">
                <UserCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold font-display text-lg text-slate-900">
                  {initialData ? 'Edit Branch Manager' : 'Add Kitchen Manager'}
                </h3>
                <p className="text-xs text-slate-400">Configure role permissions, branch assignment & login credentials</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manager Full Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  required autoFocus
                  placeholder="e.g. Anand Sharma" 
                  value={formData.name || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp / Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input 
                  required 
                  placeholder="e.g. 9820012345" 
                  value={formData.mobile || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-xs font-medium font-mono" 
                  onChange={e => setFormData({...formData, mobile: e.target.value})} 
                />
              </div>
            </div>

            {/* Aadhar & Work Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aadhar Number <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <input 
                  placeholder="e.g. 2345 6789 0123" 
                  value={formData.aadharNumber || ''} 
                  maxLength={16}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-xs font-medium font-mono" 
                  onChange={e => setFormData({...formData, aadharNumber: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kitchen / Office Location
                </label>
                <input 
                  placeholder="e.g. Bandra Cloud Hub, Floor 2" 
                  value={formData.location || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                />
              </div>
            </div>

            {/* Salary, Joining Date & Home Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Salary (₹)</label>
                <input 
                  type="number" 
                  placeholder="Salary" 
                  value={formData.salary || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, salary: Number(e.target.value)})} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Joining</label>
                <input 
                  type="date" 
                  value={formData.dateOfJoining || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, dateOfJoining: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Home Location <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <input 
                  placeholder="e.g. Malad West" 
                  value={formData.homeLocation || ''} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, homeLocation: e.target.value})} 
                />
              </div>
            </div>

            {/* Branch Assignment */}
            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100/80 space-y-2">
              <label className="block text-xs font-bold text-indigo-900">
                Assigned Branch / Kitchen Role Access
              </label>
              <select 
                className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-xs font-semibold" 
                value={formData.branchId}
                onChange={e => setFormData({...formData, branchId: e.target.value})}
              >
                <option value="All">All Branches (Full Organization Access)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                ))}
              </select>
              <p className="text-[11px] text-indigo-700">
                The manager will only see orders, customer subscriptions, and dispatch routes tied to this branch.
              </p>
            </div>

            {/* SaaS Page Access Permissions */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    SaaS Page Permissions
                  </label>
                  <p className="text-[11px] text-slate-400">Select which pages the manager is allowed to access in the web app</p>
                </div>
                <div className="flex gap-2 text-[11px]">
                  <button type="button" onClick={selectAllPages} className="text-indigo-600 hover:underline font-semibold">Select All</button>
                  <span className="text-slate-300">•</span>
                  <button type="button" onClick={clearAllPages} className="text-slate-500 hover:underline">Reset</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200/80 rounded-xl bg-slate-50/50">
                {ALL_SAAS_PAGES.map(page => {
                  const isChecked = formData.allowedPages?.includes(page.id);
                  return (
                    <label 
                      key={page.id} 
                      className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 font-medium' 
                          : 'bg-white border-slate-200/70 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => togglePage(page.id)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-xs flex items-center justify-between">
                          <span>{page.label}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-normal">
                            {page.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{page.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Login Credentials (Fixed/Edited by SaaS Owner) */}
            <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Key size={15} className="text-indigo-400" />
                <span className="text-xs font-bold text-white tracking-wide uppercase">
                  Manager Web App Login Credentials
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Set the email & password that the manager will use to log into their web app. You can edit and update these credentials anytime.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Manager Login Email <span className="text-rose-400">*</span>
                  </label>
                  <input 
                    required 
                    type="email"
                    placeholder="manager@kitchen.com" 
                    value={formData.email || ''} 
                    className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400 outline-none text-xs font-mono" 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Manager Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      required 
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter strong password" 
                      value={formData.password || ''} 
                      className="w-full p-2 pr-8 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400 outline-none text-xs font-mono" 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-white"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                <span>{initialData ? 'Update Manager Profile & Permissions' : 'Save Manager & Generate Access Link'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const BoxTypeModal = ({ initialData, onClose }: { initialData?: CustomBoxType, onClose: () => void }) => {
    const [formData, setFormData] = useState({ 
      name: initialData?.name || '', 
      shortLabel: initialData?.shortLabel || '',
      defaultDeposit: initialData?.defaultDeposit ?? 200,
      description: initialData?.description || ''
    });
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) return;
      handleSaveBoxType({
        name: formData.name.trim(),
        shortLabel: formData.shortLabel.trim() || formData.name.slice(0, 12),
        defaultDeposit: Number(formData.defaultDeposit) || 0,
        description: formData.description.trim()
      });
    };
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-7 border border-white/80">
          <div className="flex justify-between mb-5 items-center">
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900">{initialData ? 'Edit Box Type' : 'Add Custom Box Type'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Reusable tiffin packaging for recollection tracking</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Box / Container Name</label>
              <input 
                required autoFocus 
                placeholder="e.g. 5-Compartment Bento Box" 
                value={formData.name} 
                className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Short Label / Badge</label>
                <input 
                  placeholder="e.g. 5-Bento" 
                  value={formData.shortLabel} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, shortLabel: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Deposit (₹)</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder="e.g. 300" 
                  value={formData.defaultDeposit} 
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium" 
                  onChange={e => setFormData({...formData, defaultDeposit: Number(e.target.value)})} 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <textarea 
                placeholder="e.g. Leakproof stainless steel container with silicone gasket lid" 
                value={formData.description} 
                className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none text-xs font-medium resize-none h-18" 
                onChange={e => setFormData({...formData, description: e.target.value})} 
              />
            </div>

            <div className="pt-2">
              <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95">
                {initialData ? 'Update Box Type' : 'Save Box Type'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary-600" size={36} />
        <p className="text-xs font-medium text-slate-400">Loading configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 pt-1 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">Business Configuration</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
          Configure company branding, kitchen hubs, subscription tiers, branch managers, and delivery fleet.
        </p>
      </div>

      {/* SECTION 4: COMPANY / BUSINESS LOGO & BRANDING */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap gap-3 justify-between items-center bg-gradient-to-r from-indigo-50/40 via-white to-amber-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Company & Brand Logo</h2>
              <p className="text-[11px] text-slate-400">
                Shown on the top right corner of the Manager Web App and Delivery Boy Web App with business name in the middle
              </p>
            </div>
          </div>

          {brandSavedSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full animate-in fade-in">
              <CheckCircle2 size={14} /> Saved & Synced Live
            </span>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            
            {/* Logo Input & Controls */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business / Kitchen Display Name
                </label>
                <input 
                  type="text" 
                  value={businessName} 
                  placeholder="e.g. Royal Kitchens & Tiffin Co."
                  onChange={e => setBusinessName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This name is displayed prominently in the middle of top in both Manager and Rider web apps.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Company / Business Logo</label>
                  <div className="flex gap-2 text-[11px]">
                    <button 
                      type="button" 
                      onClick={() => setLogoInputMethod('url')} 
                      className={`font-semibold ${logoInputMethod === 'url' ? 'text-indigo-600 underline' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Image URL
                    </button>
                    <span className="text-slate-300">•</span>
                    <button 
                      type="button" 
                      onClick={() => setLogoInputMethod('upload')} 
                      className={`font-semibold ${logoInputMethod === 'upload' ? 'text-indigo-600 underline' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Upload Image
                    </button>
                  </div>
                </div>

                {logoInputMethod === 'url' ? (
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      placeholder="https://example.com/logo.png"
                      value={logoUrl}
                      onChange={e => setLogoUrl(e.target.value)}
                      className="flex-1 p-2.5 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-900 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                    />
                    {logoUrl && (
                      <button 
                        type="button" 
                        onClick={() => setLogoUrl('')}
                        className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all active:scale-95">
                      <Upload size={14} />
                      <span>Choose Logo File</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    {logoUrl && (
                      <button 
                        type="button" 
                        onClick={() => setLogoUrl('')}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">Recommended: Square format (PNG/SVG/JPG), transparent or light background.</p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleSaveBrand}
                  disabled={isSavingBrand}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingBrand ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{isSavingBrand ? 'Saving...' : 'Save & Publish Logo'}</span>
                </button>
              </div>
            </div>

            {/* Live Visual Header Preview */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                Live Top Header Preview
              </span>
              <p className="text-[11px] text-slate-400">
                How managers and delivery boys will see your company brand in their respective web apps:
              </p>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-white/10 flex items-center justify-between gap-2 shadow-inner">
                {/* Left: Role indicator */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-semibold text-slate-300 text-[11px]">Portal</span>
                </div>

                {/* Center: Business name in middle of top */}
                <div className="text-center flex-1 px-1">
                  <span className="font-bold text-xs sm:text-sm text-white truncate block max-w-[150px] sm:max-w-xs mx-auto">
                    {businessName || 'ScaleKitchen'}
                  </span>
                </div>

                {/* Right: Logo in top right corner */}
                <div className="shrink-0 flex items-center justify-end min-w-[32px]">
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Brand Preview" 
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain bg-white/10 p-0.5 border border-white/20 shadow-xs" 
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs">
                      {businessName?.charAt(0) || 'K'}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>



      {/* SECTION 3: STAFF / BRANCH MANAGERS & AUDIT TIMINGS */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Branch Managers & Staff Access</h2>
              <p className="text-[11px] text-slate-400">
                Grant branch-specific manager roles, customize allowed SaaS pages, and monitor login/logout audit timings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch between Managers list & Login audit logs */}
            <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold">
              <button
                onClick={() => setManagerTab('list')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  managerTab === 'list' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Managers ({managers.length})
              </button>
              <button
                onClick={() => setManagerTab('logs')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  managerTab === 'logs' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock size={12} />
                <span>Login Logs ({managerLogs.length})</span>
              </button>
            </div>

            <button 
              onClick={() => handleOpenModal('manager')} 
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <Plus size={15}/> Add Manager
            </button>
          </div>
        </div>

        {managerTab === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-3">Manager Details</th>
                  <th className="px-6 py-3">Branch Access</th>
                  <th className="px-6 py-3">Allowed SaaS Pages</th>
                  <th className="px-6 py-3">Salary & Joining</th>
                  <th className="px-6 py-3">Aadhar / Home</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {managers.map(m => {
                  const branchName = branches.find(b => b.id === m.branchId)?.name || (m.branchId === 'All' ? 'All Branches' : 'Main Branch');
                  const allowedCount = m.allowedPages?.length || 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{m.name}</span>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                            Manager
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{m.mobile} • {m.email}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          m.branchId === 'All' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {branchName}
                        </span>
                        {m.location && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">
                            {m.location}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {allowedCount} Pages
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                          {m.allowedPages?.slice(0, 3).join(', ')}{allowedCount > 3 ? '...' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-900">₹{(m.salary || 0).toLocaleString()}</div>
                        <div className="text-[11px] text-slate-400 font-medium">Joined {m.dateOfJoining ? formatDateDDMMYYYY(m.dateOfJoining) : '—'}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-mono text-[11px] text-slate-700">{m.aadharNumber || '—'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{m.homeLocation || '—'}</div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            title="Independent Email & Password Login Active"
                          >
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Email & Pass</span>
                          </span>
                          <button 
                            onClick={() => handleOpenModal('manager', m)} 
                            className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" 
                            title="Edit Manager & Credentials"
                          >
                            <Edit2 size={14}/>
                          </button>
                          <button 
                            onClick={() => handleDelete('managers', m.id)} 
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" 
                            title="Delete Manager"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {managers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      <UserCheck size={28} className="mx-auto mb-2 opacity-40 text-indigo-500" />
                      <p className="font-semibold text-slate-600">No branch managers added yet.</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Click "+ Add Manager" to create accounts with email/password credentials and custom page access.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* MANAGER LOGIN & LOGOUT TIMINGS AUDIT LOG */
          <div className="overflow-x-auto">
            <div className="p-3 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-950 flex items-center gap-1.5">
                <Clock size={14} className="text-indigo-600" />
                <span>Live Audit: Track what date and time each manager logs in and logs out</span>
              </span>
              <span className="text-[11px] text-indigo-700 font-medium">
                Auto-recorded upon web app session start & end
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Manager Name</th>
                  <th className="px-6 py-3">Branch</th>
                  <th className="px-6 py-3">Login Time</th>
                  <th className="px-6 py-3">Logout Time</th>
                  <th className="px-6 py-3">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedManagerLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">{formatDateDDMMYYYY(log.date)}</td>
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-slate-900">{log.managerName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{log.managerEmail}</div>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-700">{log.branchName || 'Main Hub'}</td>
                    <td className="px-6 py-3.5 font-mono text-emerald-700 font-semibold">{log.loginTime}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">
                      {log.logoutTime || <span className="text-amber-600 font-semibold italic">Session In Progress</span>}
                    </td>
                    <td className="px-6 py-3.5">
                      {log.status === 'Active' && !log.logoutTime ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Logged In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          Logged Out
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {sortedManagerLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No manager web app login records yet. Login and logout times will appear here as soon as managers sign in.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BRANCHES */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Store size={18} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Kitchen Branches & Hubs</h2>
              <p className="text-[11px] text-slate-400">Dispatch centers and starting points for delivery route calculation</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal('branch')} 
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
            <Plus size={15}/> Add Branch
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Branch Details</th>
                <th className="px-6 py-3">City & State</th>
                <th className="px-6 py-3">Hub Map / GPS Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {branches.map(b => (
                <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-900">{b.name}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-xs">{b.hubAddress || 'No address set'}</div>
                  </td>
                  <td className="px-6 py-3.5 font-medium">{b.city}, {b.state}</td>
                  <td className="px-6 py-3.5">
                    {b.hubLocationLink ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        GPS Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        No Maps Pin
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal('branch', b)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Edit"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete('branches', b.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Delete"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No branches configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* PLANS */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Subscription Plans</h2>
              <p className="text-[11px] text-slate-400">Menu tier offerings, recurring pricing, and weekly schedules</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal('plan')} 
            disabled={branches.length === 0} 
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <Plus size={15}/> Add Plan
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Plan Name & Schedule</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Days</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {plans.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      {p.dietPreference === 'Mixed' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          <VegNonVegIcon diet="Veg" size={10} />
                          <VegNonVegIcon diet="Non-Veg" size={10} />
                          <span>Mixed (Veg & Non-Veg)</span>
                        </span>
                      ) : (
                        <VegNonVegBadge 
                          diet={p.dietPreference || (p.name.toLowerCase().includes('non-veg') ? 'Non-Veg' : 'Veg')} 
                          size="xs" 
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {p.deliveryTypeLabel} • {p.category}
                      {p.dayDietSchedule && (
                        <span className="text-slate-500 ml-1.5 font-normal">
                          • {getPlanDietSummaryLabel(p.dayDietSchedule, p.weekdays).label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 font-medium">{branches.find(b => b.id === p.branchId)?.name || 'General'}</td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">₹{p.price.toLocaleString()}</td>
                  <td className="px-6 py-3.5 text-slate-500">{p.numberOfDeliveryDays} Days</td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal('plan', p)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Edit"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete('plans', p.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Delete"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No meal plans configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELIVERY STAFF (Includes Aadhar Number & Delivery Boy Home Location - Part 2) */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Truck size={18} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Delivery Staff</h2>
              <p className="text-[11px] text-slate-400">Riders and partners receiving WhatsApp route dispatches with optional Aadhar & home address</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal('delivery')} 
            disabled={branches.length === 0} 
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <Plus size={15}/> Add Partner
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">Partner Name</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">Login Email</th>
                <th className="px-5 py-3">Mobile</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Salary</th>
                <th className="px-5 py-3">Aadhaar / Home</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {deliveryBoys.map(d => {
                const isActive = d.status !== 'Inactive' && d.active !== false;
                return (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      <div>{d.name}</div>
                      {d.vehicleNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">{d.vehicleNumber}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-medium">{branches.find(b => b.id === d.branchId)?.name || 'General'}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-700">
                      {d.email || <span className="text-slate-400 font-sans italic text-[11px]">No login email</span>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">{d.mobile}</td>
                    <td className="px-5 py-3.5">
                      <span 
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">₹{d.salary?.toLocaleString() || 0}</td>
                    <td className="px-5 py-3.5">
                      {d.aadharNumber || d.homeLocation ? (
                        <div className="text-[11px]">
                          {d.aadharNumber && <div className="font-mono text-slate-700">{d.aadharNumber}</div>}
                          {d.homeLocation && <div className="text-slate-400 truncate max-w-[130px]">{d.homeLocation}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenModal('delivery', d)} 
                          className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" 
                          title="Edit Partner & Credentials"
                        >
                          <Edit2 size={14}/>
                        </button>
                        <button 
                          onClick={() => handleDelete('staff', d.id)} 
                          className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" 
                          title="Delete Partner Account"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {deliveryBoys.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No delivery partners registered yet. Click &quot;Add Partner&quot; to configure delivery accounts with email and password.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REUSABLE BOX TYPES */}
      <div className="glass-card rounded-2xl border border-white/80 shadow-glass overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package size={18} />
            </div>
            <div>
              <h2 className="font-bold font-display text-base text-slate-900">Reusable Box Types & Configurations</h2>
              <p className="text-[11px] text-slate-400">Custom containers available in the Customer dropdown and driver collection portal</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal('boxType')} 
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
            <Plus size={15}/> Add Box Type
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Box Type Name</th>
                <th className="px-6 py-3">Tag / Badge</th>
                <th className="px-6 py-3">Refundable Deposit</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {allBoxTypes.map(box => (
                <tr key={box.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span>{box.name}</span>
                      {box.isCustom ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                          Custom
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                          Standard
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {box.shortLabel || box.id}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">
                    {box.defaultDeposit && box.defaultDeposit > 0 ? `₹${box.defaultDeposit}` : 'No Deposit'}
                  </td>
                  <td className="px-6 py-3.5 text-slate-400 text-[11px] max-w-xs truncate">
                    {box.description || '—'}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleOpenModal('boxType', box)} 
                        className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold" 
                        title={`Edit ${box.name}`}
                      >
                        <Edit2 size={14}/>
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteBoxType(box)} 
                        className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold" 
                        title={`Delete ${box.name}`}
                      >
                        <Trash2 size={14}/>
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {allBoxTypes.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No box types found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {activeModal === 'branch' && <BranchModal initialData={editingItem} onClose={() => { setActiveModal(null); setEditingItem(null); }} />}
      {activeModal === 'plan' && <PlanModal initialData={editingItem} onClose={() => { setActiveModal(null); setEditingItem(null); }} />}
      {activeModal === 'delivery' && <DeliveryBoyModal initialData={editingItem} onClose={() => { setActiveModal(null); setEditingItem(null); }} />}
      {activeModal === 'manager' && <ManagerModal initialData={editingItem} onClose={() => { setActiveModal(null); setEditingItem(null); }} />}
      {activeModal === 'boxType' && <BoxTypeModal initialData={editingItem} onClose={() => { setActiveModal(null); setEditingItem(null); }} />}
    </div>
  );
};

export default Settings;
