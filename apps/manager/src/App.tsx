import React, { useState, useEffect } from 'react';
import {
  Shield, Lock, Mail, Eye, EyeOff,
  LogOut, CheckCircle, AlertCircle, Loader2, ArrowRight,
  Menu, X, LayoutDashboard, UtensilsCrossed, Truck, Users, FileText,
  ShoppingBag, Archive, MessageSquare, DollarSign, Receipt,
  CreditCard, BarChart3, Settings as SettingsIcon, User, HelpCircle, Zap,
  MapPin, RefreshCw
} from 'lucide-react';
import { ManagerAuthProvider, useManagerAuth } from './contexts/ManagerAuthContext';
import { ALL_SAAS_PAGES, SaasPagePermission } from './services/managerStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './services/firebase';

// Views
import { DashboardView } from './views/DashboardView';
import { PrepView } from './views/PrepView';
import { DeliveriesView } from './views/DeliveriesView';
import { CustomersView } from './views/CustomersView';
import { NotesView } from './views/NotesView';
import { SingleOrdersView } from './views/SingleOrdersView';
import { InventoryView } from './views/InventoryView';
import { MessagesView } from './views/MessagesView';
import { PaymentsView } from './views/PaymentsView';
import { InvoicesView } from './views/InvoicesView';
import { ExpensesView } from './views/ExpensesView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import { ProfileView } from './views/ProfileView';
import { SupportView } from './views/SupportView';

const VIEW_COMPONENTS: Record<string, React.ComponentType<any>> = {
  dashboard: DashboardView,
  prep: PrepView,
  deliveries: DeliveriesView,
  customers: CustomersView,
  notes: NotesView,
  'single-orders': SingleOrdersView,
  inventory: InventoryView,
  messages: MessagesView,
  payments: PaymentsView,
  invoices: InvoicesView,
  expenses: ExpensesView,
  analytics: AnalyticsView,
  settings: SettingsView,
  profile: ProfileView,
  support: SupportView,
};

const VIEW_ICONS: Record<string, React.ComponentType<any>> = {
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
  support: HelpCircle,
};

const ManagerAppInner: React.FC = () => {
  const {
    bizId,
    loggedInManager,
    branchId,
    allowedPages,
    login,
    logout,
    loading: authLoading,
    authError: contextAuthError
  } = useManagerAuth();

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localAuthError, setLocalAuthError] = useState('');

  const displayAuthError = localAuthError || contextAuthError;

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Business profile
  const [businessName, setBusinessName] = useState('ScaleKitchen');
  const [logoUrl, setLogoUrl] = useState('');

  // Fetch business profile if bizId is set
  useEffect(() => {
    if (!bizId) return;
    const unsub = onSnapshot(doc(db, 'businesses', bizId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.businessName) setBusinessName(data.businessName);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      }
    }, (err) => console.warn("Biz profile error:", err));

    return () => unsub();
  }, [bizId]);

  // Set initial active tab from permitted pages
  useEffect(() => {
    if (allowedPages && allowedPages.length > 0) {
      if (!allowedPages.includes(activeTab)) {
        setActiveTab(allowedPages[0]);
      }
    }
  }, [allowedPages]);

  // Manager Login Screen
  if (!loggedInManager) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLocalAuthError('');
      if (!emailInput.trim() || !passwordInput) {
        setLocalAuthError('Please enter both Email and Password.');
        return;
      }
      setSubmitting(true);
      try {
        await login(emailInput.trim(), passwordInput);
      } catch (err: any) {
        const msg = err?.message || 'Invalid email or password.';
        setLocalAuthError(msg);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-card bg-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl max-w-md w-full border border-white/20 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-inner">
              <Lock size={26} />
            </div>
            <h2 className="text-xl font-bold font-display tracking-tight text-white">Manager Sign In</h2>
            <p className="text-xs text-slate-300">Use the email and password provided by your kitchen owner.</p>
          </div>

          {displayAuthError && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{displayAuthError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Manager Email</label>
              <div className="relative mt-1">
                <input
                  type="email"
                  required
                  placeholder="manager@kitchen.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <Mail size={15} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <Lock size={15} className="absolute left-3 top-3 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Branch Manager</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Authenticated Layout
  const CurrentView = VIEW_COMPONENTS[activeTab] || DashboardView;

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to end your manager shift?")) return;
    await logout();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>

          {logoUrl ? (
            <img src={logoUrl} alt={businessName} className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
              {businessName.charAt(0)}
            </div>
          )}

          <div>
            <h1 className="font-bold text-sm text-slate-900 leading-tight">{businessName}</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Branch: <strong>{branchId === 'All' ? 'All Organization Branches' : branchId}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-slate-200 text-right">
            <div>
              <div className="font-bold text-xs text-slate-900">{loggedInManager.name}</div>
              <div className="text-[10px] text-indigo-600 font-semibold uppercase">Branch Manager</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
              {loggedInManager.name?.charAt(0) || 'M'}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-60 bg-white border-r border-slate-200 p-3.5 flex-col shrink-0 overflow-y-auto">
          <div className="text-[10px] uppercase font-bold text-slate-400 px-2.5 pb-2">
            Operations Menu
          </div>
          <nav className="space-y-1 flex-1">
            {ALL_SAAS_PAGES.filter(p => allowedPages.includes(p.id)).map(p => {
              const Icon = VIEW_ICONS[p.id] || LayoutDashboard;
              const isSelected = activeTab === p.id;

              return (
                <button
                  key={p.id}
                  onClick={() => setActiveTab(p.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={16} />
                  <span className="truncate">{p.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 px-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Zap size={13} className="text-indigo-600 fill-indigo-600" />
              <span>ScaleKitchen</span>
            </div>
            <span className="text-[10px] text-slate-400">Ops Portal</span>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex">
            <div className="w-64 bg-white h-full p-4 flex flex-col shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {loggedInManager.name?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{loggedInManager.name}</h3>
                    <p className="text-[10px] text-slate-400">{branchId}</p>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1 flex-1 overflow-y-auto">
                {ALL_SAAS_PAGES.filter(p => allowedPages.includes(p.id)).map(p => {
                  const Icon = VIEW_ICONS[p.id] || LayoutDashboard;
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
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={handleLogout}
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            {allowedPages.includes(activeTab) ? (
              <CurrentView onNavigate={(tab: string) => setActiveTab(tab)} />
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

export const App: React.FC = () => {
  return (
    <ManagerAuthProvider>
      <ManagerAppInner />
    </ManagerAuthProvider>
  );
};

export default App;
