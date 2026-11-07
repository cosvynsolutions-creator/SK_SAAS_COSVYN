import React, { useState, useEffect } from 'react';
import { 
  Building, UserCheck, Shield, Lock, Mail, Eye, EyeOff, 
  LogOut, CheckCircle, AlertCircle, Loader2, ArrowRight, 
  Sparkles, Layers, RefreshCw, ChevronRight, Menu, X,
  LayoutDashboard, UtensilsCrossed, Truck, Users, FileText, 
  ShoppingBag, Archive, MessageSquare, DollarSign, Receipt, 
  CreditCard, BarChart3, Settings as SettingsIcon, User, HelpCircle, Zap
} from 'lucide-react';
import { db, auth, managerLoginCallable } from '../services/firebase';
import { 
  collection, query, getDocs, doc, setDoc, updateDoc, getDoc, onSnapshot 
} from 'firebase/firestore';
import { signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { BranchManager, ALL_SAAS_PAGES, getTodayStr } from '../services/store';


// Import SaaS page components so managers can seamlessly access their permitted views
import Dashboard from './Dashboard';
import Prep from './Prep';
import Deliveries from './Deliveries';
import Customers from './Customers';
import Notes from './Notes';
import SingleOrders from './SingleOrders';
import Inventory from './Inventory';
import Messages from './Messages';
import Payments from './Payments';
import Invoices from './Invoices';
import Expenses from './Expenses';
import Analytics from './Analytics';
import Settings from './Settings';
import Profile from './Profile';
import Support from './Support';

const PAGE_COMPONENTS: Record<string, React.ComponentType<any>> = {
  dashboard: Dashboard,
  prep: Prep,
  deliveries: Deliveries,
  customers: Customers,
  notes: Notes,
  'single-orders': SingleOrders,
  inventory: Inventory,
  messages: Messages,
  payments: Payments,
  invoices: Invoices,
  expenses: Expenses,
  analytics: Analytics,
  settings: Settings,
  profile: Profile,
  support: Support
};

const PAGE_ICONS: Record<string, React.ComponentType<any>> = {
  dashboard: LayoutDashboard,
  prep: UtensilsCrossed,
  deliveries: Truck,
  customers: Users,
  notes: FileText,
  'single-orders': ShoppingBag,
  inventory: Archive,
  messages: MessageSquare,
  payments: DollarSign,
  invoices: Receipt,
  expenses: CreditCard,
  analytics: BarChart3,
  settings: SettingsIcon,
  profile: User,
  support: HelpCircle
};

export const ManagerPortal: React.FC = () => {
  // Read params from URL or localStorage
  const getParam = (key: string) => {
    const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const hashParams = new URLSearchParams(hashPart);
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get(key) || searchParams.get(key) || '';
  };

  const paramBiz = getParam('biz') || localStorage.getItem('manager_biz_id') || auth.currentUser?.uid || '';
  const [bizId, setBizId] = useState<string>(paramBiz);
  const [bizInput, setBizInput] = useState<string>('');

  // Business Profile (Business Name & Logo)
  const [businessName, setBusinessName] = useState<string>('ScaleKitchen');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);

  // Auth / Login state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Logged-in Manager session
  const [loggedInManager, setLoggedInManager] = useState<BranchManager | null>(null);
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto sign in anonymously for Firestore rules if unauthenticated
  // Fetch Business Profile (Name and Logo) and branches once manager is authenticated
  useEffect(() => {
    if (!bizId || !loggedInManager) return;
    localStorage.setItem('manager_biz_id', bizId);

    const bizDocRef = doc(db, 'businesses', bizId);
    const unsubBiz = onSnapshot(bizDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.businessName) setBusinessName(data.businessName);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      }
    }, (err) => console.warn("Biz profile fetch error:", err));

    const branchesRef = collection(db, 'businesses', bizId, 'branches');
    const unsubBranches = onSnapshot(branchesRef, (snap) => {
      let bList: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const savedManager = localStorage.getItem('manager_data');
      if (savedManager) {
        try {
          const parsed = JSON.parse(savedManager);
          if (parsed.branchId && parsed.branchId !== 'All') {
            bList = bList.filter((b: any) => b.id === parsed.branchId || b.name === parsed.branchId);
          }
        } catch (e) {}
      }
      setBranches(bList);
    }, (err) => console.warn("Branches fetch error:", err));

    return () => {
      unsubBiz();
      unsubBranches();
    };
  }, [bizId]);

  // Restore existing session from localStorage if present
  useEffect(() => {
    const savedManager = localStorage.getItem('manager_data');
    const savedLogId = localStorage.getItem('manager_session_log_id');
    const savedBiz = localStorage.getItem('manager_biz_id');

    if (savedManager && savedBiz === bizId) {
      try {
        const parsed = JSON.parse(savedManager);
        setLoggedInManager(parsed);
        localStorage.setItem('active_portal', 'manager');
        if (parsed.branchId) {
          localStorage.setItem('manager_branch_id', parsed.branchId);
        }
        if (savedLogId) setSessionLogId(savedLogId);
        if (parsed.allowedPages && parsed.allowedPages.length > 0) {
          setActiveTab(parsed.allowedPages[0]);
        }
      } catch (e) {
        console.error("Error restoring manager session:", e);
      }
    }
  }, [bizId]);

  // Handle Login
  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!bizId) {
      setAuthError('Please connect a Kitchen / Business ID first.');
      return;
    }
    if (!emailInput.trim() || !passwordInput) {
      setAuthError('Please enter both Email and Password.');
      return;
    }

    setAuthLoading(true);

    try {
      let matched: BranchManager | null = null;
      // 1. Primary & Only: Server-verified Cloud Function callable with lockout enforcement
      try {
        const result = await managerLoginCallable({
          email: emailInput.trim(),
          password: passwordInput,
          bizId: bizId.trim()
        });

        if (result?.data?.token) {
          await signInWithCustomToken(auth, result.data.token);
          matched = result.data.manager as unknown as BranchManager;
        } else {
          throw new Error("No token returned by server.");
        }
      } catch (callableErr: any) {
        console.error("Manager login error:", callableErr?.code, callableErr?.message, callableErr);
        const errorCode = callableErr?.code || '';
        const errorMsg = callableErr?.message || '';

        if (errorCode === 'functions/resource-exhausted' || errorMsg.includes('locked') || errorMsg.includes('attempts remaining')) {
          setAuthError(errorMsg);
        } else if (
          errorCode === 'functions/unauthenticated' ||
          errorCode === 'functions/not-found' ||
          errorMsg.includes('Invalid email or password')
        ) {
          setAuthError('Invalid email or password.');
        } else {
          setAuthError('Cannot reach server. Check internet and try again.');
        }
        setAuthLoading(false);
        return;
      }

      if (!matched) {
        setAuthError('Invalid email or password.');
        setAuthLoading(false);
        return;
      }

      // Check allowed pages
      const allowedPages = matched.allowedPages && matched.allowedPages.length > 0 
        ? matched.allowedPages 
        : ['dashboard'];

      // Create new session audit log
      const todayStr = getTodayStr();
      const now = new Date();
      const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const branchName = branches.find(b => b.id === matched?.branchId)?.name || (matched?.branchId === 'All' ? 'All Branches' : 'Main Branch');

      const logData = {
        id: logId,
        managerId: matched.id,
        managerName: matched.name,
        managerEmail: matched.email,
        branchId: matched.branchId || 'All',
        branchName: branchName,
        date: todayStr,
        loginTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        logoutTime: null,
        status: 'Active',
        createdAt: now.toISOString()
      };

      try {
        await setDoc(doc(db, 'businesses', bizId, 'manager_logs', logId), logData);
      } catch (logErr) {
        console.warn("Could not record manager login log:", logErr);
      }

      // Store in state and localStorage
      setLoggedInManager(matched);
      setSessionLogId(logId);
      setActiveTab(allowedPages[0]);
      localStorage.setItem('manager_biz_id', bizId);
      localStorage.setItem('manager_data', JSON.stringify(matched));
      localStorage.setItem('manager_branch_id', matched.branchId || '');
      localStorage.setItem('active_portal', 'manager');
      localStorage.setItem('manager_session_log_id', logId);

      // Re-filter branches in state to manager's assigned branch
      if (matched.branchId && matched.branchId !== 'All') {
        setBranches(prev => prev.filter(b => b.id === matched?.branchId || b.name === matched?.branchId));
      }

    } catch (err: any) {
      console.error("Manager Login Error:", err);
      setAuthError('Failed to sign in. Please check your internet connection.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Logout
  const handleManagerLogout = async () => {
    if (!window.confirm("Are you sure you want to log out of the Manager Portal?")) return;

    if (bizId && sessionLogId) {
      try {
        const now = new Date();
        const logDocRef = doc(db, 'businesses', bizId, 'manager_logs', sessionLogId);
        await updateDoc(logDocRef, {
          logoutTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: 'Logged Out',
          updatedAt: now.toISOString()
        });
      } catch (err) {
        console.warn("Could not update manager logout time:", err);
      }
    }

    localStorage.removeItem('manager_data');
    localStorage.removeItem('manager_branch_id');
    localStorage.removeItem('active_portal');
    localStorage.removeItem('manager_session_log_id');
    setLoggedInManager(null);
    setSessionLogId(null);
    setEmailInput('');
    setPasswordInput('');
  };

  // 1. Business ID Connection Screen (if no bizId specified)
  if (!bizId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-card bg-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl max-w-md w-full border border-white/20 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-inner">
            <UserCheck size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight text-white">Branch Manager Portal</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Connect to your kitchen's business portal to manage customer subscriptions, fleet deliveries, and daily meal batches.
            </p>
          </div>

          <div className="space-y-2 pt-1 text-left">
            <label className="text-[11px] font-semibold text-slate-300">Kitchen / Business ID</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. User ID or business code"
                value={bizInput}
                onChange={(e) => setBizInput(e.target.value)}
                className="flex-1 p-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = bizInput.trim();
                    if (val) setBizId(val);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const val = bizInput.trim();
                  if (val) setBizId(val);
                  else alert("Please enter the Kitchen Business ID provided by your owner.");
                }}
                className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
              >
                Connect
              </button>
            </div>
          </div>

          {auth.currentUser && (
            <button
              onClick={() => setBizId(auth.currentUser!.uid)}
              className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <span>Connect As Current Account ({auth.currentUser.email})</span>
              <ArrowRight size={14} className="text-indigo-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Manager Login Screen (when not logged in)
  if (!loggedInManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col font-sans">
        
        {/* Top Header: Business Name in Middle, Logo in Top Right Corner */}
        <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between shadow-glass">
          
          {/* Left: Role Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold">
              <UserCheck size={18} />
            </div>
            <div className="hidden sm:block">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest block">Portal</span>
              <span className="text-xs font-semibold text-slate-300">Manager Access</span>
            </div>
          </div>

          {/* Middle: Business Name in Middle of Top */}
          <div className="flex-1 text-center px-2">
            <h1 className="font-bold font-display text-base sm:text-lg tracking-tight text-white truncate max-w-xs sm:max-w-md mx-auto">
              {businessName || 'ScaleKitchen'}
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block">Branch Operations & Cloud Kitchen SaaS</p>
          </div>

          {/* Top Right Corner: Company / Business Logo */}
          <div className="flex items-center justify-end min-w-[36px]">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={`${businessName} Logo`} 
                className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-white/20 shadow-xs"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 text-indigo-300 flex items-center justify-center font-bold text-sm shadow-xs">
                {businessName?.charAt(0) || 'K'}
              </div>
            )}
          </div>
        </header>

        {/* Login Form Container */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="glass-card bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-inner">
                <Lock size={26} />
              </div>
              <h2 className="text-2xl font-bold font-display text-white tracking-tight">Manager Sign In</h2>
              <p className="text-xs text-slate-300">
                Log in with the manager email and password assigned by your kitchen business owner.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleManagerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Manager Login Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="manager@kitchen.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Manager Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter fixed manager password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying Credentials & Starting Shift...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={16} />
                    <span>Log In to Manager Portal</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Kitchen ID: <span className="font-mono text-slate-200">{bizId.slice(0, 10)}...</span></span>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('manager_biz_id');
                  setBizId('');
                }}
                className="text-indigo-400 hover:underline"
              >
                Change Kitchen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Logged-in Manager Application View
  const allowedPages = loggedInManager.allowedPages && loggedInManager.allowedPages.length > 0 
    ? loggedInManager.allowedPages 
    : ['dashboard'];

  // Current active component
  const CurrentComponent = PAGE_COMPONENTS[activeTab] || Dashboard;
  const currentBranchName = branches.find(b => b.id === loggedInManager.branchId)?.name || (loggedInManager.branchId === 'All' ? 'All Branches' : 'Main Branch');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* TOP HEADER: Business Name in Middle, Company Logo in Top Right Corner */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        
        {/* Left: Mobile menu toggle & Manager Details */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold text-xs shadow-xs">
              {loggedInManager.name?.charAt(0) || 'M'}
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900">{loggedInManager.name}</span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md">
                  Manager
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                {currentBranchName}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Business Name in Middle of Top (Requirement from Part 4) */}
        <div className="flex-1 text-center px-2">
          <h1 className="font-bold font-display text-sm sm:text-base tracking-tight text-slate-900 truncate max-w-xs sm:max-w-md mx-auto">
            {businessName || 'ScaleKitchen'}
          </h1>
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-block">
            {currentBranchName} Dispatch & Operations
          </span>
        </div>

        {/* Top Right Corner: Company / Business Logo & Logout Button (Requirement from Part 4) */}
        <div className="flex items-center gap-2.5 justify-end">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={`${businessName} Logo`} 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shadow-xs"
            />
          ) : (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs">
              {businessName?.charAt(0) || 'K'}
            </div>
          )}

          <button
            onClick={handleManagerLogout}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            title="Log Out & Record Exit Time"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar Navigation for Allowed Pages */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Navigation Sidebar (Desktop) */}
        <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-200/80 p-3 space-y-1 overflow-y-auto shrink-0">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Permitted Modules ({allowedPages.length})
          </div>

          {ALL_SAAS_PAGES.filter(p => allowedPages.includes(p.id)).map(p => {
            const Icon = PAGE_ICONS[p.id] || LayoutDashboard;
            const isSelected = activeTab === p.id;

            return (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} />
                <span className="truncate">{p.label}</span>
              </button>
            );
          })}

          <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 px-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Zap size={13} className="text-primary-600 fill-primary-600" />
              <span>ScaleKitchen</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Ops Portal</span>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex">
            <div className="w-64 bg-white h-full p-4 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {loggedInManager.name?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{loggedInManager.name}</h3>
                    <p className="text-[10px] text-slate-400">{currentBranchName}</p>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1 flex-1 overflow-y-auto">
                {ALL_SAAS_PAGES.filter(p => allowedPages.includes(p.id)).map(p => {
                  const Icon = PAGE_ICONS[p.id] || LayoutDashboard;
                  const isSelected = activeTab === p.id;

                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActiveTab(p.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <Zap size={13} className="text-primary-600 fill-primary-600" />
                    <span>ScaleKitchen</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Suite</span>
                </div>
                <button
                  onClick={handleManagerLogout}
                  className="w-full py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <LogOut size={14} />
                  <span>Log Out Shift</span>
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 bg-slate-50/60">
          <div className="max-w-7xl mx-auto">
            {allowedPages.includes(activeTab) ? (
              <CurrentComponent />
            ) : (
              <div className="glass-card bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-md mx-auto my-12 space-y-3">
                <Shield size={36} className="text-amber-500 mx-auto" />
                <h3 className="font-bold text-base text-slate-900">Permission Restricted</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You do not have permission from the business owner to access the "{activeTab}" module. Please contact your kitchen administrator if you require access.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

    </div>
  );
};

export default ManagerPortal;
