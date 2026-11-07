import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { FeatureAnnouncementModal } from './components/FeatureAnnouncementModal';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OnboardingPayment from './pages/OnboardingPayment';
import Dashboard from './pages/Dashboard';
import Prep from './pages/Prep';
import Customers from './pages/Customers';
import SingleOrders from './pages/SingleOrders';
import Notes from './pages/Notes';
import Analytics from './pages/Analytics';
import Support from './pages/Support';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Payments from './pages/Payments';
import Invoices from './pages/Invoices';
import Expenses from './pages/Expenses';
import Deliveries from './pages/Deliveries';
import DriverPortal from './pages/DriverPortal';
import ManagerPortal from './pages/ManagerPortal';
import Inventory from './pages/Inventory';
import Messages from './pages/Messages';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPayments from './pages/admin/AdminPayments';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminFeatureSupport from './pages/admin/AdminFeatureSupport';
import AdminProfile from './pages/admin/AdminProfile';
import AdminPlans from './pages/admin/AdminPlans';
import AdminLogin from './pages/admin/AdminLogin';
import AdminMessages from './pages/admin/AdminMessages';
import AdminInvoiceCredits from './pages/admin/AdminInvoiceCredits';

// Legal Pages
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Shipping from './pages/legal/Shipping';
import Refunds from './pages/legal/Refunds';
import Contact from './pages/legal/Contact';

import { 
  Menu, X, Zap, LogOut, Bell, AlertTriangle, Loader2, User, CheckCircle, Phone, MapPin, ArrowRight, MessageSquare
} from 'lucide-react';
import { getDaysDifference, calculateRemainingDeliveries, getCustomerActiveDaysLeft } from './services/store';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ADMIN_EMAIL, isAdminEmail } from './services/adminStore';
import { doc, onSnapshot, updateDoc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useStreamCollection, recordOwnerDailyLogin, syncBusinessLiveStats } from './services/dbService';

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState { 
    return { hasError: true, error }; 
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { 
    console.group("ScaleKitchen Runtime Crash");
    console.error("Error:", error);
    console.error("Info:", errorInfo);
    console.groupEnd();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md border border-slate-200">
             <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
             </div>
             <h1 className="text-2xl font-black text-slate-900 mb-2">Something went wrong</h1>
             <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                The application encountered an unexpected error. This usually happens due to a temporary network glitch or missing data.
             </p>
             <div className="space-y-3">
                <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                  Try Refreshing
                </button>
                <button onClick={() => window.location.href = '/'} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all">
                  Back to Home
                </button>
             </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- SUBSCRIPTION MANAGER ---
const SubscriptionManager = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const capturePaymentParams = () => {
      try {
        const rawParams = new URLSearchParams(window.location.search);
        const urlStatus = rawParams.get('status');
        if (urlStatus === 'success') {
          const planId = rawParams.get('plan_id');
          const paymentId = rawParams.get('payment_id');
          if (planId) {
            localStorage.setItem('pending_subscription', JSON.stringify({
              planId, paymentId: paymentId || 'manual_entry', timestamp: Date.now()
            }));
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.history.state;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }
      } catch (e) { console.error("URL Param processing failed:", e); }
    };
    capturePaymentParams();

    const getPlanDetails = (planId: string) => {
      let durationMonths = 1, internalPlanName = 'Monthly';
      const pid = (planId || '').toLowerCase();
      if (pid.includes('6months') || pid.includes('half')) { durationMonths = 6; internalPlanName = '6 Months'; }
      else if (pid.includes('yearly') || pid.includes('annual')) { durationMonths = 12; internalPlanName = 'Yearly'; }
      return { durationMonths, internalPlanName };
    };

    const processActivation = async () => {
      if (!currentUser || !currentUser.email || status !== 'idle') return;
      const pendingStr = localStorage.getItem('pending_subscription');
      let pendingFirestoreData = null;
      
      if (!pendingStr) {
         try {
            const docRef = doc(db, 'pending_activations', currentUser.email);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) { pendingFirestoreData = { ...docSnap.data(), ref: docRef }; }
         } catch (e) {}
      }

      if (pendingStr || pendingFirestoreData) {
        setStatus('processing');
        try {
          let planId, paymentId;
          if (pendingStr) {
             const parsed = JSON.parse(pendingStr);
             planId = parsed.planId; paymentId = parsed.paymentId;
          } else {
             planId = pendingFirestoreData.planId; paymentId = pendingFirestoreData.paymentId || 'external';
          }
          const { durationMonths, internalPlanName } = getPlanDetails(planId);
          const now = new Date();
          now.setMonth(now.getMonth() + durationMonths);
          const newExpiryDate = now.toISOString().split('T')[0];
          
          await updateDoc(doc(db, 'businesses', currentUser.uid), {
            planName: `COSVYN ONE (${internalPlanName})`,
            planStatus: 'Active',
            planExpiryDate: newExpiryDate,
            lastPaymentId: paymentId,
            updatedAt: new Date().toISOString()
          });

          if (pendingStr) localStorage.removeItem('pending_subscription');
          if (pendingFirestoreData) await deleteDoc(pendingFirestoreData.ref);
          
          setStatus('success');
          setTimeout(() => { setStatus('idle'); navigate('/app/dashboard', { replace: true }); }, 2000);
        } catch (error) { 
          console.error("Subscription Activation Error:", error);
          setStatus('error'); 
        }
      }
    };
    processActivation();
  }, [currentUser, navigate, status]);

  if (status === 'idle') return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        {status === 'processing' && (
          <div className="flex flex-col items-center"><Loader2 className="animate-spin text-primary-600 mb-4" size={48} /><h2 className="text-xl font-bold text-slate-900 mb-2">Activating Plan...</h2></div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center"><div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"><CheckCircle size={32} /></div><h2 className="text-2xl font-bold text-slate-900 mb-2">Success!</h2></div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32} /></div><h2 className="text-xl font-bold text-slate-900 mb-2">Error</h2><button onClick={() => setStatus('idle')} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold">Close</button></div>
        )}
      </div>
    </div>
  );
};

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  const [businessData, setBusinessData] = useState<any>(null);
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (currentUser && !isAdminEmail(currentUser.email)) {
      // Record daily login & sync business aggregate statistics
      recordOwnerDailyLogin(currentUser.uid);
      syncBusinessLiveStats(currentUser.uid);

      const unsubscribe = onSnapshot(doc(db, 'businesses', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) { 
          const data = docSnap.data();
          setBusinessData(data);
          const isStatusActive = data.planStatus === 'Active';
          const expiryDate = data.planExpiryDate;
          const today = new Date().toISOString().split('T')[0];
          const daysLeft = expiryDate ? getDaysDifference(today, expiryDate) : 100;
          
          const isActuallyActive = isStatusActive && daysLeft >= 0;
          setHasActivePlan(isActuallyActive);

          // Auto-update status in DB if expired
          if (isStatusActive && daysLeft < 0) {
            updateDoc(doc(db, 'businesses', currentUser.uid), { 
              planStatus: 'Expired',
              updatedAt: new Date().toISOString()
            }).catch(err => console.error("Auto-update plan status failed:", err));
          }
        } 
        else { 
          setBusinessData(null);
          setHasActivePlan(false); 
        }
      }, (err) => {
        console.error("Protected Route Error:", err);
        setBusinessData(null);
        setHasActivePlan(false);
      });
      return () => unsubscribe();
    } else if (currentUser) { setHasActivePlan(true); }
  }, [currentUser]);

  if (loading || (currentUser && hasActivePlan === null)) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;
  }
  
  if (currentUser?.email && isAdminEmail(currentUser.email)) return <Navigate to="/admin/dashboard" replace />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (hasActivePlan === false) return <Navigate to="/onboarding" replace />;
  
  return <AppLayout businessData={businessData} />;
};

const AdminRoute = () => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-white" size={40} /></div>;
  if (currentUser && isAdminEmail(currentUser.email)) return <AdminLayout />;
  return <Navigate to="/admin/login" replace />;
};

const AppLayout = ({ businessData }: { businessData?: any }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const planExpiryDate = businessData?.planExpiryDate || null;
  const planName = businessData?.planName || null;
  
  const { data: customers = [] } = useStreamCollection<any>('customers');
  const { data: plans = [] } = useStreamCollection<any>('plans');
  const { data: staff = [] } = useStreamCollection<any>('staff');
  const { data: branches = [] } = useStreamCollection<any>('branches');
  const { data: deliveryLogs = [] } = useStreamCollection<any>('delivery_logs');


  // FIX: CANONICAL UNIFIED CALCULATION FOR NOTIFICATIONS (ZERO DATA INCONSISTENCY)
  const expiringCustomers = React.useMemo(() => {
    return (customers || [])
      .map((c: any) => {
        const status = getCustomerActiveDaysLeft(c, plans);
        return {
          ...c,
          realDaysLeft: status.daysLeft,
          isExpired: status.isExpired,
          computedEndDate: status.endDate,
          computedPlanName: status.activePlanName
        };
      })
      // Strictly exclude customers whose plans have already expired in the past!
      // Only show currently active customers whose plans are expiring between 10 to 0 days (0 days = ending today)
      .filter((c: any) => c.isActive !== false && !c.isExpired && c.realDaysLeft <= 10 && c.realDaysLeft >= 0)
      .sort((a: any, b: any) => a.realDaysLeft - b.realDaysLeft);
  }, [customers, plans]);

  const daysToExpiry = planExpiryDate ? getDaysDifference(new Date().toISOString().split('T')[0], planExpiryDate) : 100;
  const showExpiryWarning = daysToExpiry <= 10 && daysToExpiry >= 0;
  const isFreeTrial = planName === 'Free Trial';

  const handleLogout = async () => { await logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-slate-50/60 relative overflow-hidden font-sans">
      {/* Ambient Glassmorphic Glow Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-28 -right-28 w-96 h-96 bg-primary-200/25 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-28 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-28 right-1/4 w-[450px] h-[450px] bg-sky-200/20 rounded-full blur-3xl" />
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} businessData={businessData} />
      <FeatureAnnouncementModal businessData={businessData} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {showExpiryWarning && (
          <div className={`${isFreeTrial ? 'bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 border-emerald-900' : 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 border-red-800'} border-b text-white text-xs sm:text-sm font-semibold py-2.5 px-3 sm:px-4 z-40 flex flex-wrap items-center justify-center gap-2 sm:gap-3 shadow-md animate-in slide-in-from-top-full duration-300`}>
            {isFreeTrial ? <Zap size={16} className="text-emerald-200 fill-emerald-200" /> : <AlertTriangle size={16} className="text-amber-200" />}
            <span className="text-center drop-shadow-xs">{isFreeTrial ? `Your Free Trial ends in ${daysToExpiry} days. Subscribe to keep full access.` : `Your subscription expires in ${daysToExpiry} days. Renew now to avoid interruption.`}</span>
            <button onClick={() => navigate('/app/profile')} className="bg-white text-slate-900 px-3.5 py-1 rounded-full text-xs font-bold transition-all hover:bg-slate-100 active:scale-95 shadow-sm shrink-0">
              {isFreeTrial ? 'Subscribe Now' : 'Renew Plan'}
            </button>
          </div>
        )}
        
        <header className="h-13 bg-white border-b border-slate-200 shadow-xs flex items-center justify-between px-3.5 md:px-6 z-30 shrink-0">
           <div className="flex items-center gap-2 sm:gap-3">
             <button 
               onClick={() => setIsSidebarOpen(true)} 
               className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all shadow-xs"
               aria-label="Open navigation menu"
             >
               <Menu size={18} />
             </button>

             {/* ScaleKitchen Platform Identity Brand */}
             <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
               <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary-600 via-primary-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                 <Zap size={14} fill="currentColor" />
               </div>
               <div className="flex flex-col text-left">
                 <div className="flex items-center gap-1.5">
                   <span className="text-xs sm:text-sm font-black tracking-tight text-slate-900 font-display leading-tight">ScaleKitchen</span>
                   <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider bg-primary-50 text-primary-700 border border-primary-200 px-1 py-0.2 rounded">OS</span>
                 </div>
                 <span className="hidden sm:block text-[9px] text-slate-400 font-medium leading-none">Meal Subscription Platform</span>
               </div>
             </div>
           </div>
           
           <div className="flex items-center gap-2 md:gap-3 ml-auto">
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} 
                  className={`p-2 text-slate-600 hover:text-primary-600 rounded-xl border transition-all ${isNotificationsOpen ? 'bg-primary-50 text-primary-600 border-primary-300' : 'bg-white hover:bg-slate-50 border-slate-200'}`}
                  aria-label="View notifications"
                >
                   <Bell size={17} />
                   {(expiringCustomers.length > 0 || showExpiryWarning) && (
                     <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white ring-1 ring-red-400 animate-pulse" />
                   )}
                </button>
                {isNotificationsOpen && (
                   <>
                    {/* Transparent Click-away layer: does not black out the screen */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsNotificationsOpen(false)} 
                    />
                    
                    {/* Solid Opaque Notification Popup - Absolutely anchored below button, 100% visible */}
                    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-28px)] sm:w-[440px] max-w-[440px] max-h-[85vh] sm:max-h-[560px] bg-white border-2 border-slate-300 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden ring-1 ring-slate-900/15 animate-in fade-in zoom-in-95 duration-200">
                      {/* High-Contrast Header */}
                      <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                            <Bell size={16} />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm font-display tracking-tight">System & Meal Notifications</h4>
                            <p className="text-[11px] text-slate-300">Live renewals & subscription alerts</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-rose-600 text-white font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                            {expiringCustomers.length + (showExpiryWarning ? 1 : 0)} Urgent
                          </span>
                          <button 
                            onClick={() => setIsNotificationsOpen(false)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            aria-label="Close notifications"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Content List with Pure Solid White Background */}
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white no-scrollbar">
                        {/* 1. SaaS Platform Subscription Alert if near expiry */}
                        {showExpiryWarning && (
                          <div className={`p-4 ${isFreeTrial ? 'bg-emerald-50 border-b border-emerald-200' : 'bg-rose-50 border-b border-rose-200'}`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isFreeTrial ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                                <AlertTriangle size={16} />
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <h5 className={`font-bold text-xs ${isFreeTrial ? 'text-emerald-900' : 'text-rose-900'}`}>
                                    {isFreeTrial ? 'Free Trial Expiring Soon' : 'SaaS Plan Expiring'}
                                  </h5>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isFreeTrial ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                                    {daysToExpiry}d left
                                  </span>
                                </div>
                                <p className={`text-xs mt-1 ${isFreeTrial ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isFreeTrial 
                                    ? `Your ScaleKitchen Free Trial ends in ${daysToExpiry} days. Subscribe to maintain active operations.` 
                                    : `Your subscription concludes in ${daysToExpiry} days. Renew now to avoid disruption.`}
                                </p>
                                <button 
                                  onClick={() => { navigate('/app/profile'); setIsNotificationsOpen(false); }}
                                  className={`mt-2.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition-transform active:scale-95 ${isFreeTrial ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'}`}
                                >
                                  {isFreeTrial ? 'Subscribe to Full Plan' : 'Renew Subscription'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. Customer Subscriptions Expiring */}
                        {expiringCustomers.length === 0 && !showExpiryWarning ? (
                          <div className="p-10 text-center text-slate-400 flex flex-col items-center bg-white">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-3">
                              <CheckCircle size={28} />
                            </div>
                            <p className="text-sm font-bold text-slate-800">All Subscriptions Active</p>
                            <p className="text-xs text-slate-500 mt-1">No customer meal plans expiring in the next 10 days.</p>
                          </div>
                        ) : expiringCustomers.map((cust: any) => {
                          const customerPlan = cust.computedPlanName || plans.find((p:any) => p.id === cust.planId)?.name || 'Standard Meal Plan';
                          const planConcludeDate = cust.computedEndDate || cust.endDate || '';
                          const whatsappMsg = `Hello ${cust.name}, your meal subscription plan (${customerPlan}) is scheduled to conclude on ${planConcludeDate}. We would love to continue delivering fresh meals to you! Please reply to renew your plan.`;
                          const whatsappLink = `https://wa.me/${(cust.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;
                          
                          return (
                            <div key={cust.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                              <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0 flex-1 text-left">
                                  <h5 className="font-bold text-slate-900 text-sm truncate">{cust.name}</h5>
                                  <p className="text-slate-600 font-mono text-xs mt-0.5">{cust.mobile || 'No contact'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-md shadow-xs ${
                                    cust.realDaysLeft <= 0 
                                      ? 'bg-rose-600 text-white' 
                                      : cust.realDaysLeft <= 3
                                        ? 'bg-amber-500 text-white' 
                                        : 'bg-indigo-600 text-white'
                                  }`}>
                                    {cust.realDaysLeft <= 0 ? 'Ending Today' : `${cust.realDaysLeft} days left`}
                                  </span>
                                  <div className="flex gap-1.5">
                                    <a 
                                      href={whatsappLink} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      title="Chat on WhatsApp" 
                                      className="w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center shadow-xs transition-colors"
                                    >
                                      <MessageSquare size={14} />
                                    </a>
                                    <a 
                                      href={`tel:${cust.mobile}`} 
                                      title="Call customer" 
                                      className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center shadow-xs transition-colors"
                                    >
                                      <Phone size={14} />
                                    </a>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                                  {customerPlan}
                                </span>
                                <button 
                                  onClick={() => { navigate('/app/customers'); setIsNotificationsOpen(false); }} 
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors shrink-0"
                                >
                                  Renew Plan <ArrowRight size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Solid Footer */}
                      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[11px]">ScaleKitchen Live Alerts</span>
                        <button 
                          onClick={() => { navigate('/app/customers'); setIsNotificationsOpen(false); }}
                          className="text-primary-700 hover:text-primary-800 font-bold hover:underline"
                        >
                          View All Customers →
                        </button>
                      </div>
                    </div>
                   </>
                )}
              </div>
              <button 
                onClick={() => navigate('/app/profile')} 
                className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 hover:border-primary-400 shadow-xs transition-all hover:bg-white max-w-[190px] sm:max-w-xs group active:scale-95"
                title={`${businessData?.businessName || currentUser?.displayName || 'My Kitchen'} Profile & Brand Identity`}
              >
                {businessData?.logoUrl ? (
                  <img 
                    src={businessData.logoUrl} 
                    alt={businessData.businessName || 'Brand Logo'} 
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-contain bg-white border border-slate-200/80 p-0.5 shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                    {(businessData?.businessName || currentUser?.displayName || 'K').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col text-left min-w-0 pr-0.5">
                  <span className="text-[11px] sm:text-xs font-bold text-slate-900 truncate block leading-tight max-w-[85px] sm:max-w-[150px]">
                    {businessData?.businessName || currentUser?.displayName || 'My Kitchen'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium truncate block leading-tight">
                    Kitchen Owner
                  </span>
                </div>
              </button>
           </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

// Multi-browser route normalizer for HashRouter:
// If opened in Safari, Chrome, or mobile webviews as /driver instead of /#/driver,
// smoothly redirect preserving query params so it works in any browser.
if (typeof window !== 'undefined') {
  try {
    const p = window.location.pathname;
    if (p === '/driver' || p.startsWith('/driver/')) {
      const search = window.location.search || '';
      window.location.replace(`${window.location.origin}/#/driver${search}`);
    } else if (p === '/manager' || p.startsWith('/manager/')) {
      const search = window.location.search || '';
      window.location.replace(`${window.location.origin}/#/manager${search}`);
    }
  } catch (e) {
    console.warn("Route normalizer error:", e);
  }
}

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <SubscriptionManager />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<OnboardingPayment />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/driver" element={<DriverPortal />} />
            <Route path="/manager" element={<ManagerPortal />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/app" element={<ProtectedRoute />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="prep" element={<Prep />} />
              <Route path="customers" element={<Customers />} />
              <Route path="single-orders" element={<SingleOrders />} />
              <Route path="payments" element={<Payments />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="deliveries" element={<Deliveries />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="notes" element={<Notes />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="messages" element={<Messages />} />
              <Route path="support" element={<Support />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="/admin" element={<AdminRoute />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="feature-support" element={<AdminFeatureSupport />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="invoice-credits" element={<AdminInvoiceCredits />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;