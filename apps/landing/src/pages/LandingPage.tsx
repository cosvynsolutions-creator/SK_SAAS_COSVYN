import React, { useState, useId } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu, X, ArrowRight, Zap, TrendingUp, Package, CreditCard, 
  MapPin, Star, Check, LogIn, 
  Smartphone, RotateCcw, Truck,
  ChevronDown, ChevronUp, ShieldCheck,
  Navigation, CheckCircle, Building,
  FileText, Calendar, MessageCircle
} from 'lucide-react';
import { useGlobalPricing, calculateEffectivePrice } from '../services/pricing';

const appBaseUrl = (
  import.meta.env.VITE_APP_URL ||
  (import.meta.env.PROD ? 'https://scalekitchen.vercel.app' : '')
).replace(/\/$/, '');

const AuthLink: React.FC<{
  to: '/signup' | '/login';
  planId?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ to, planId, className, children }) => {
  const search = planId ? `?plan=${encodeURIComponent(planId)}` : '';

  if (appBaseUrl) {
    return (
      <a href={`${appBaseUrl}/#${to}${search}`} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={`${to}${search}`} className={className}>
      {children}
    </Link>
  );
};

export const LandingPage: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeAppTab, setActiveAppTab] = useState<'owner' | 'manager' | 'rider'>('owner');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Unique IDs for accessibility
  const subscribersInputId = useId();
  const mealPriceInputId = useId();
  const churnRateInputId = useId();

  // Interactive Profit & Loss Calculator State
  const [subscribers, setSubscribers] = useState<number>(120);
  const [avgMealPrice, setAvgMealPrice] = useState<number>(3200); // monthly subscription price in INR
  const [churnRate, setChurnRate] = useState<number>(14); // % missed renewals/leakage per month

  // Calculated ROI Metrics
  const monthlyRevenue = subscribers * avgMealPrice;
  const monthlyLeakage = Math.round(monthlyRevenue * (churnRate / 100));
  const annualLeakage = monthlyLeakage * 12;
  const lostTiffinsPerYear = Math.round(subscribers * 0.18 * 12); // ~18% tiffins lost annually without recovery tracker
  const packagingCostLoss = lostTiffinsPerYear * 250; // average ₹250 per stainless steel tiffin container
  const hoursWastedPerWeek = Math.round(subscribers * 0.08); // hours spent manually chasing WhatsApp payments

  const { plans, offer } = useGlobalPricing();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  const isOfferActive = offer.isActive && new Date() < new Date(offer.endsAt);

  const getPlanButtonText = (plan: { durationMonths: number; label: string }) => {
    if (plan.durationMonths === 1) return 'Choose Monthly';
    if (plan.durationMonths === 6) return 'Choose 6 Months';
    if (plan.durationMonths === 8) return 'Choose 8 Months';
    if (plan.durationMonths === 12) return 'Choose Yearly';
    return `Choose ${plan.label}`;
  };

  const whatsappDemoUrl = "https://wa.me/917702667567?text=Hi%2C%20I%20would%20like%20to%20book%20a%20live%20demo%20of%20ScaleKitchen%20for%20my%20meal%20subscription%20business.";

  const faqs = [
    {
      q: "How does the Delivery Boy App work? Do my riders need to download an APP?",
      a: "No app store download is required. Your riders simply open the mobile web app on their smartphone browser. They log in with their registered phone number and a 4-digit PIN. They get an optimized delivery route with turn-by-turn Google Maps navigation, live status update (Delivered / Skipped), and the reusable tiffin box tracker."
    },
    {
      q: "What is the Branch Manager Portal and how does it help my business?",
      a: "If you operate multiple kitchens or dispatch hubs, the Branch Manager portal provides each branch manager with unique access to only their branch's active customer, daily kitchen prep sheets, and local rider dispatch. Managers cannot view your overall financial balance, owner bank accounts, or data from other branches. An audit trail tracks every action for complete operational accountability."
    },
    {
      q: "How does the Reusable Tiffin Box (Dabba) Recovery Tracker save money?",
      a: "Commercial kitchens lose thousands of rupees every month in unreturned stainless steel tiffins and containers. With ScaleKitchen, your delivery rider marks how many empty boxes were collected at each doorstep in real-time. If a customer has unreturned boxes from previous days, the system alerts the rider and automatically sends friendly WhatsApp return reminders."
    },
    {
      q: "Can customers pause their subscriptions or skip Sundays?",
      a: "Yes. ScaleKitchen includes an automated meal calendar. You can configure custom delivery days (e.g. Monday–Friday, Monday–Saturday, or 7 days). When a customer requests a vacation pause or skips a day, the system automatically pushes forward their subscription end date without any manual spreadsheet adjustments."
    },
    {
      q: "Are the invoices GST compliant and can they be sent via WhatsApp?",
      a: "Yes. ScaleKitchen includes a built-in GST invoice generator supporting your GSTIN, SAC codes, SGST/CGST breakdown, and customer billing address. Invoices are generated as clean PDF documents that can be downloaded or sent straight to the customer's WhatsApp in a single click."
    },
    {
      q: "What happens during the 30-day free trial?",
      a: "You get 100% unrestricted access to all features: Owner HQ, Branch Manager Portal, Rider Delivery App, Route Optimizer, Kitchen Prep Sheet, and GST Invoicing. No credit card is required to sign up. If you decide to continue, choose one of our simple plans."
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-primary-200 selection:text-primary-900 overflow-x-hidden">
      
      {/* 1. TOP STRIP */}
      {isOfferActive ? (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold py-2.5 text-center tracking-wide uppercase relative z-50 animate-pulse">
           {offer.title} - Get {offer.discountPercent}% OFF Limited Time!
        </div>
      ) : (
        <div className="bg-slate-900 text-white text-xs font-bold py-2.5 text-center tracking-widest uppercase relative z-50">
          <span className="bg-gradient-to-r from-primary-400 to-violet-400 text-transparent bg-clip-text">
            SAAS BY COSVYN
          </span>
        </div>
      )}

      {/* 2. HEADER / NAVIGATION */}
      <header className="sticky top-0 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30 group-hover:scale-105 transition-transform duration-300">
                <Zap size={22} fill="currentColor" />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-slate-900">ScaleKitchen</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {['Features', 'How It Works', 'Pricing', 'Testimonials'].map((item) => (
                <button 
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase().replace(/\s+/g, '-'))} 
                  className="text-sm font-bold text-slate-600 hover:text-primary-600 transition-colors"
                >
                  {item}
                </button>
              ))}

              <button 
                onClick={() => scrollToSection('book-demo')} 
                className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1.5"
              >
                <MessageCircle size={16} />
                Book Demo
              </button>

              <div className="h-6 w-px bg-slate-200 mx-2" />
              <AuthLink to="/login" className="text-sm font-bold text-slate-700 hover:text-primary-600 transition-colors">Log In</AuthLink>
              <AuthLink 
                to="/signup" 
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Start Free Trial
              </AuthLink>
            </nav>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden text-slate-900 p-2" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 p-4 absolute w-full shadow-2xl animate-in slide-in-from-top-5">
            <div className="flex flex-col space-y-4">
              {['Features', 'How It Works', 'Pricing', 'Testimonials'].map((item) => (
                <button key={item} onClick={() => scrollToSection(item.toLowerCase().replace(/\s+/g, '-'))} className="text-left font-bold text-slate-700 py-2 border-b border-slate-50">
                  {item}
                </button>
              ))}
              <button onClick={() => scrollToSection('book-demo')} className="text-left font-bold text-emerald-600 py-2 border-b border-slate-50 flex items-center gap-2">
                <MessageCircle size={18} /> Book a Demo
              </button>
              <AuthLink to="/login" className="text-left font-bold text-slate-900 py-2 flex items-center gap-2"><LogIn size={18}/> Log In</AuthLink>
              <AuthLink to="/signup" className="bg-gradient-to-r from-primary-600 to-violet-600 text-white py-3 rounded-xl font-bold text-center shadow-lg">Start Free Trial</AuthLink>
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative pt-20 pb-32 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-primary-100/40 via-violet-100/20 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Hero Text */}
            <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0 animate-in slide-in-from-bottom-10 duration-700 fade-in relative z-20">
              <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 mb-8 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">NOW LIVE IN 30+ CITIES</span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1]">
                We handle the pain and pressure. <br className="hidden lg:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-violet-600">You enjoy the profits and peace.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-slate-500 mb-10 leading-relaxed font-medium">
                ScaleKitchen is a SaaS platform for subscription meal businesses that centralizes customer management, deliveries, payments, expenses, and analytics into one dashboard.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <AuthLink 
                  to="/signup" 
                  className="group relative inline-flex justify-center items-center gap-2 bg-gradient-to-r from-primary-600 to-violet-600 text-white text-lg px-8 py-4 rounded-full font-bold transition-all transform hover:scale-[1.02] shadow-xl hover:shadow-primary-500/40"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </AuthLink>
                <button 
                  onClick={() => scrollToSection('ecosystem')}
                  className="inline-flex justify-center items-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 text-lg px-8 py-4 font-bold rounded-full transition-all shadow-sm hover:shadow-md"
                >
                  View Live Dashboard
                </button>
              </div>
            </div>

            {/* Hero Visual - Dashboard Mockup */}
            <div className="relative animate-in zoom-in-95 duration-1000 delay-200 fade-in mt-12 lg:mt-0">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-500/20 rounded-full blur-[80px] -z-10" />
              
              <div className="relative z-10 bg-white/60 backdrop-blur-md border border-white/50 rounded-3xl shadow-2xl p-6 ring-1 ring-slate-900/5 rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center justify-between mb-6 border-b border-slate-200/50 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                    <div className="w-3 h-3 rounded-full bg-green-400/80" />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">dashboard.scalekitchen.in</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2 bg-white/80 rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                            <h3 className="text-3xl font-bold text-slate-900 mt-1">₹12,45,592</h3>
                         </div>
                         <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <TrendingUp size={20} />
                         </div>
                      </div>
                      <div className="mt-4 h-16 flex items-end gap-1">
                         {[40, 65, 45, 70, 55, 85, 60, 90, 75, 95].map((h, i) => (
                           <div key={i} className="flex-1 bg-gradient-to-t from-primary-500 to-violet-500 rounded-t-sm opacity-80" style={{ height: `${h}%` }} />
                         ))}
                      </div>
                   </div>

                   <div className="bg-white/80 rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                         <Package size={18} /> <span className="text-xs font-bold uppercase">Boxes To Pack</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">1,248</div>
                      <div className="text-[10px] text-green-600 font-bold bg-green-50 self-start px-2 py-0.5 rounded-full mt-2">On Track</div>
                   </div>

                   <div className="bg-white/80 rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                         <CreditCard size={18} /> <span className="text-xs font-bold uppercase">Pending</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">₹34k</div>
                      <div className="text-[10px] text-red-500 font-bold bg-red-50 self-start px-2 py-0.5 rounded-full mt-2">Action Req.</div>
                   </div>
                </div>

                <div className="absolute -right-6 top-1/4 bg-white p-4 rounded-xl shadow-xl border border-slate-100 animate-float hidden sm:block">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                         <MapPin size={20} className="text-primary-600" />
                      </div>
                      <div>
                         <p className="text-xs text-slate-400 font-bold">Driver Arrived</p>
                         <p className="text-sm font-bold text-slate-900">Sector 42, Gurgaon</p>
                      </div>
                   </div>
                </div>
              </div>
              
              <div className="absolute top-10 -right-10 w-64 h-64 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
            </div>

          </div>
        </div>
      </section>

      {/* 4. TRUSTED BY STRIP */}
      <section className="py-10 bg-white border-y border-slate-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 mb-6">
           <p className="text-center text-slate-400 text-xs font-bold tracking-[0.2em] uppercase">Trusted by fast-growing meal subscription brands</p>
        </div>
        <div className="relative flex overflow-x-hidden group">
          <div className="animate-scroll whitespace-nowrap flex gap-16 px-8 items-center">
            {[...Array(4)].map((_, i) => (
              <React.Fragment key={i}>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">FitFuel Meals</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">DailyBite Box</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">HealthyTiffin Co.</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">MuscleBox</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">NutriGrams</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">UrbanMealCo</span>
              </React.Fragment>
            ))}
          </div>
          <div className="absolute top-0 left-0 h-full w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute top-0 right-0 h-full w-32 bg-gradient-l from-white to-transparent z-10" />
        </div>
      </section>

      {/* 5. THE 3-APP ECOSYSTEM SHOWCASE */}
      <section id="ecosystem" className="py-24 bg-slate-50 border-y border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-primary-600 font-extrabold uppercase text-xs tracking-wider block mb-2">
              Three Portals. One Source of Truth.
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              A unified operating suite for owners, branch managers, and riders
            </h2>
            <p className="text-slate-600 text-base sm:text-lg mt-3">
              ScaleKitchen provides dedicated portals tailored to each role in your food subscription business.
            </p>
          </div>

          {/* Interactive Portal Switcher */}
          <div className="flex justify-center mb-10">
            <div className="bg-slate-200/80 p-1.5 rounded-2xl inline-flex flex-wrap gap-1 max-w-full justify-center">
              <button
                onClick={() => setActiveAppTab('owner')}
                className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeAppTab === 'owner'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap size={18} className="text-primary-600" />
                <span>1. Business Owner Operations HQ</span>
              </button>

              <button
                onClick={() => setActiveAppTab('manager')}
                className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeAppTab === 'manager'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building size={18} className="text-violet-600" />
                <span>2. Branch Manager Hub</span>
              </button>

              <button
                onClick={() => setActiveAppTab('rider')}
                className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeAppTab === 'rider'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone size={18} className="text-emerald-600" />
                <span>3. Delivery Rider Mobile App</span>
              </button>
            </div>
          </div>

          {/* TAB 1: OWNER HQ */}
          {activeAppTab === 'owner' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xl grid lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-md">
                  <Zap size={14} /> Full Business Operations & Financial HQ
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                  Automate your meal renewals, kitchen prep, and financial ledgers
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                  Track recurring subscriptions, pending payments, daily prep sheets, and customer pause dates. Prevent revenue leakage before it costs you a single rupee.
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>Auto-Calculated Kitchen Prep Counts:</strong> Live box tallies by meal session (Breakfast, Lunch, Dinner) and diet tags (Veg, Non-Veg, Jain).
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>Automated Renewal Reminders:</strong> Sends instant WhatsApp payment links 3 days before a customer's meal plan expires.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>1-Click GST Invoice PDF:</strong> Professional tax invoices with SAC code, SGST, CGST, and business details.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>Multi-Branch Command:</strong> Oversee multiple cloud kitchens and city hubs with aggregated financial analytics.
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <AuthLink 
                    to="/signup" 
                    className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all inline-flex items-center gap-2"
                  >
                    <span>Start Free Trial</span>
                    <ArrowRight size={16} />
                  </AuthLink>
                </div>
              </div>

              {/* Owner HQ Mockup */}
              <div className="lg:col-span-7 bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs font-mono text-slate-400 ml-2">dashboard.scalekitchen.in</span>
                  </div>
                  <span className="text-xs font-bold bg-primary-500/20 text-primary-300 px-2.5 py-1 rounded">
                    Central Kitchen HQ
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Today's Prep</span>
                    <div className="text-2xl font-black text-white mt-1">482 <span className="text-xs font-normal text-slate-400">Boxes</span></div>
                    <div className="text-[10px] text-emerald-400 font-bold mt-1">Zero Overpacking</div>
                  </div>
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Monthly Revenue</span>
                    <div className="text-2xl font-black text-white mt-1">₹4,28,400</div>
                    <div className="text-[10px] text-emerald-400 font-bold mt-1">↑ 22% vs last mo</div>
                  </div>
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Pending Renewals</span>
                    <div className="text-2xl font-black text-amber-400 mt-1">18 <span className="text-xs font-normal text-slate-400">Due</span></div>
                    <div className="text-[10px] text-primary-400 font-bold mt-1">Auto-notified</div>
                  </div>
                </div>

                {/* Prep Breakdown Matrix */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300 pb-2 border-b border-slate-700">
                    <span>Lunch Session Kitchen Dispatch</span>
                    <span className="text-primary-400">Prep Sheet #204</span>
                  </div>
                  <div className="space-y-2.5 mt-3 text-xs">
                    <div className="flex justify-between items-center bg-slate-900/60 px-3 py-2 rounded-lg">
                      <span className="font-semibold text-slate-200">Standard Veg Thali (3 Roti + Dal + Sabzi)</span>
                      <span className="font-bold text-emerald-400">240 Units Packed</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900/60 px-3 py-2 rounded-lg">
                      <span className="font-semibold text-slate-200">High-Protein Non-Veg (Grilled Chicken + Brown Rice)</span>
                      <span className="font-bold text-amber-400">165 Units Packed</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900/60 px-3 py-2 rounded-lg">
                      <span className="font-semibold text-slate-200">Jain Special (No Onion, No Garlic)</span>
                      <span className="font-bold text-indigo-400">77 Units Packed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BRANCH MANAGER PORTAL */}
          {activeAppTab === 'manager' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xl grid lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-violet-700 bg-violet-50 px-3 py-1 rounded-md">
                  <Building size={14} /> Branch-Isolated Kitchen Operations
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                  Branch Manager Web Portal
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                  Empower your kitchen branch heads to manage daily cooking manifests, rider assignments, and staff attendance without exposing your bank accounts or overall business profits.
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>PIN / Password Protected Hub Access:</strong> Each branch manager logs into their specific kitchen with encrypted credentials.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>Branch-Specific Customer Roster:</strong> Shows only active subscribers assigned to this kitchen, with meal preferences and pause status.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>Rider Fleet Dispatch:</strong> Assign delivery routes, track which riders have punched in, and monitor completion progress.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>Anti-Theft Manager Audit Log:</strong> Logs manager actions to maintain complete accountability across all kitchen units.
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <AuthLink 
                    to="/signup" 
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all inline-flex items-center gap-2"
                  >
                    <span>Get Started with ScaleKitchen</span>
                    <ArrowRight size={16} />
                  </AuthLink>
                </div>
              </div>

              {/* Manager Portal Mockup */}
              <div className="lg:col-span-7 bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-violet-400" />
                    <span className="text-sm font-bold text-white">Hub: Andheri West Cloud Kitchen</span>
                  </div>
                  <span className="text-xs font-mono bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded">
                    Branch PIN: Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Active Branch Riders</span>
                    <div className="text-xl font-bold text-emerald-400 mt-1">4 of 4 On Duty</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Morning Attendance Marked</div>
                  </div>
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Branch Customers</span>
                    <div className="text-xl font-bold text-white mt-1">142 Active</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">3 Paused for Vacation</div>
                  </div>
                </div>

                {/* Rider Dispatch Table */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="text-xs font-bold text-slate-300 mb-3 flex justify-between">
                    <span>Active Route Dispatch (Lunch)</span>
                    <span className="text-emerald-400 font-semibold">126/142 Delivered</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg">
                      <div>
                        <div className="font-bold text-slate-200">Ramesh (Route A - Lokhandwala)</div>
                        <div className="text-[10px] text-slate-400">38 Boxes • 34 Delivered • 4 Left</div>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded font-bold">
                        90% Complete
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg">
                      <div>
                        <div className="font-bold text-slate-200">Vikas (Route B - Versova)</div>
                        <div className="text-[10px] text-slate-400">42 Boxes • 42 Delivered • Complete</div>
                      </div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-1 rounded font-bold">
                        100% Finished
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DELIVERY RIDER MOBILE APP */}
          {activeAppTab === 'rider' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xl grid lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md">
                  <Smartphone size={14} /> Mobile Web App for Drivers & Delivery Staff
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                  Delivery Rider Mobile App
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                  Riders open the mobile link directly in their phone's browser. Log in with their mobile number and a 4-digit PIN. No complex app store download or memory issues.
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>Shortest Route Optimizer:</strong> Reorders multiple drop stops to minimize transit distance and bike fuel consumption.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>1-Tap Turn-by-Turn GPS:</strong> Instant button opens exact customer delivery addresses in Google Maps.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>Reusable Tiffin Box (Dabba) Tracker:</strong> Riders record empty containers picked up at each door, stopping packaging loss.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-sm font-medium text-slate-700">
                      <strong>1-Click WhatsApp Drop Confirmation:</strong> Sends instantaneous drop updates directly to customers without typing.
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <AuthLink 
                    to="/signup" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all inline-flex items-center gap-2"
                  >
                    <span>Get Started with ScaleKitchen</span>
                    <ArrowRight size={16} />
                  </AuthLink>
                </div>
              </div>

              {/* Rider Phone Mockup */}
              <div className="lg:col-span-7 flex justify-center">
                <div className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] p-4 text-white border-4 border-slate-700 shadow-2xl">
                  {/* Phone Notch */}
                  <div className="w-32 h-4 bg-slate-800 rounded-full mx-auto mb-4"></div>
                  
                  {/* Driver Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-emerald-400">ScaleKitchen Rider App</div>
                      <div className="text-base font-extrabold text-white">Ramesh (Route A)</div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-1 rounded">
                      Lunch Manifest
                    </span>
                  </div>

                  {/* Route Stat Bar */}
                  <div className="grid grid-cols-2 gap-2 my-3">
                    <div className="bg-slate-800 p-2.5 rounded-xl text-center">
                      <div className="text-xs text-slate-400">Total Drops</div>
                      <div className="text-lg font-bold text-white">32 Stops</div>
                    </div>
                    <div className="bg-slate-800 p-2.5 rounded-xl text-center">
                      <div className="text-xs text-slate-400">Tiffins Collected</div>
                      <div className="text-lg font-bold text-emerald-400">28 / 32</div>
                    </div>
                  </div>

                  {/* Stop Card */}
                  <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-extrabold text-amber-400">STOP #4 • UP NEXT</span>
                      <span className="text-[10px] bg-primary-500/20 text-primary-300 font-bold px-2 py-0.5 rounded">
                        Veg Meal Box
                      </span>
                    </div>
                    <div className="font-extrabold text-sm text-white">Aditya Sharma</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={12} className="text-primary-400" />
                      Flat 402, Royal Palms, Goregaon East
                    </div>

                    {/* Dabba Return Alert */}
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-300 flex items-center gap-1.5 font-medium">
                      <RotateCcw size={13} className="shrink-0" />
                      <span>Collect 1 Pending Steel Dabba from yesterday</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-slate-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1">
                        <Navigation size={14} className="text-primary-400" /> Maps
                      </div>
                      <div className="bg-emerald-600 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1">
                        <Check size={14} /> Delivered
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-[11px] text-slate-500 pb-1">
                    Shortest sequence calculated • 4.2 km total route
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* 6. INTERACTIVE MISSED RENEWAL & PROFIT LOSS CALCULATOR */}
      <section id="calculator" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-rose-600 font-extrabold uppercase text-xs tracking-wider block mb-2">
              ROI & Revenue Leakage Audit
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              How much money is your meal business leaking every month?
            </h2>
            <p className="text-slate-600 text-base sm:text-lg mt-3">
              When meal subscription kitchens rely on manual WhatsApp messages and spreadsheets, renewal drop-offs and lost tiffins quietly eat 15–25% of annual profits.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-center bg-slate-50 rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xl">
            
            {/* Interactive Inputs */}
            <div className="lg:col-span-6 space-y-7">
              <h3 className="text-xl font-bold text-slate-900">
                Enter your current kitchen numbers:
              </h3>

              {/* Slider 1: Active Subscribers */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor={subscribersInputId} className="text-sm font-bold text-slate-700">Active Daily Subscribers</label>
                  <span className="text-base font-extrabold text-primary-600 bg-primary-50 px-3 py-0.5 rounded-lg">
                    {subscribers} Subscribers
                  </span>
                </div>
                <input 
                  id={subscribersInputId}
                  type="range" 
                  min="20" 
                  max="1000" 
                  step="10"
                  value={subscribers} 
                  onChange={(e) => setSubscribers(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>20 (Boutique)</span>
                  <span>500 (Growth)</span>
                  <span>1,000+ (Commercial)</span>
                </div>
              </div>

              {/* Slider 2: Average Monthly Plan Price */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor={mealPriceInputId} className="text-sm font-bold text-slate-700">Average Monthly Subscription Price (₹)</label>
                  <span className="text-base font-extrabold text-primary-600 bg-primary-50 px-3 py-0.5 rounded-lg">
                    ₹{avgMealPrice.toLocaleString()} / month
                  </span>
                </div>
                <input 
                  id={mealPriceInputId}
                  type="range" 
                  min="1500" 
                  max="8000" 
                  step="100"
                  value={avgMealPrice} 
                  onChange={(e) => setAvgMealPrice(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>₹1,500 (Basic Lunch)</span>
                  <span>₹3,500 (Standard)</span>
                  <span>₹8,000 (Diet/Gourmet)</span>
                </div>
              </div>

              {/* Slider 3: Churn / Missed Renewal Rate */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor={churnRateInputId} className="text-sm font-bold text-slate-700">Estimated Missed Renewals via Manual WhatsApp (%)</label>
                  <span className="text-base font-extrabold text-rose-600 bg-rose-50 px-3 py-0.5 rounded-lg">
                    {churnRate}% Dropped
                  </span>
                </div>
                <input 
                  id={churnRateInputId}
                  type="range" 
                  min="5" 
                  max="30" 
                  step="1"
                  value={churnRate} 
                  onChange={(e) => setChurnRate(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>5% (Strict Follow-up)</span>
                  <span>14% (Average Kitchen)</span>
                  <span>30% (High Leakage)</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-3">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
                <span>
                  ScaleKitchen automates 3-day renewal alerts, Razorpay payment links, and box returns so this revenue goes straight back to your bottom line.
                </span>
              </div>
            </div>

            {/* Calculated Output Card */}
            <div className="lg:col-span-6 bg-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="text-xs uppercase font-extrabold text-rose-400 tracking-wider mb-2">
                Your Annual Leakage Analysis
              </div>
              <h4 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">
                Potential Lost Revenue:
              </h4>

              <div className="space-y-4">
                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-slate-400">Monthly Leaked Renewals</div>
                    <div className="text-xs text-slate-500">Uncollected subscriptions due to manual chasing</div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-400">
                    ₹{monthlyLeakage.toLocaleString()}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-slate-400">Annual Profit Lost to Churn</div>
                    <div className="text-xs text-slate-500">12-month compounded renewal loss</div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-rose-500">
                    ₹{annualLeakage.toLocaleString()}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-slate-400">Unrecovered Tiffin Dabbas Cost</div>
                    <div className="text-xs text-slate-500">~{lostTiffinsPerYear} stainless steel containers lost/yr</div>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-amber-400">
                    ₹{packagingCostLoss.toLocaleString()}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-slate-400">Staff Time Wasted on WhatsApp</div>
                    <div className="text-xs text-slate-500">Manual payment reminders & reconciliation</div>
                  </div>
                  <div className="text-lg font-black text-primary-400">
                    ~{hoursWastedPerWeek} hrs / week
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                <div className="text-xs text-slate-300 font-semibold mb-4">
                  ScaleKitchen costs starting from just ₹999/month and recovers up to <strong>10x its fee</strong> in the very first month.
                </div>
                <AuthLink
                  to="/signup"
                  className="w-full inline-flex justify-center items-center gap-2 bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-500 hover:to-violet-500 text-white font-bold py-3.5 px-6 rounded-xl text-base shadow-lg transition-all"
                >
                  <span>Stop The Leakage — Start Free Trial</span>
                  <ArrowRight size={18} />
                </AuthLink>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 7. SIX DEEP-DIVE CORE FEATURES */}
      <section id="features" className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-primary-600 font-extrabold uppercase text-xs tracking-wider block mb-2">
              End-to-End Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Engineered specifically for how meal subscription businesses work
            </h2>
            <p className="text-slate-600 text-base sm:text-lg mt-3">
              Standard POS systems fail subscription kitchens. ScaleKitchen handles recurring billing cycles, meal skips, hub logistics, and packaging recovery out of the box.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold mb-6">
                <Truck size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Delivery Boy Mobile App & GPS Optimizer
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Riders log into the mobile web portal using mobile phone & 4-digit PIN. Displays sequenced drop lists, 1-tap Google Maps directions, and delivery status updates live on your dashboard.
              </p>
              <div className="text-xs font-bold text-primary-600 flex items-center gap-1">
                Zero app store install required
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold mb-6">
                <RotateCcw size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Reusable Tiffin Box (Dabba) Recovery
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Stop losing ₹250+ stainless steel meal containers. Riders mark uncollected dabbas at the door. Customers receive automated return reminders on Day 2+.
              </p>
              <div className="text-xs font-bold text-violet-600 flex items-center gap-1">
                99.4% average packaging return rate
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-6">
                <Package size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Live Kitchen Prep Matrix (KDS)
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Accurate daily box counts and diet breakdowns for Breakfast, Lunch, and Dinner. Cooks pack only what is active today, ending costly food wastage.
              </p>
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                Breakdown by Veg, Non-Veg, Jain & Keto
              </div>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-6">
                <Calendar size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Smart Pause & Vacation Calendar
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Customers can pause for specific dates or select 5/6-day subscription cycles. Plan expiration auto-extends automatically without spreadsheet math.
              </p>
              <div className="text-xs font-bold text-amber-600 flex items-center gap-1">
                Eliminates customer billing disputes
              </div>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold mb-6">
                <FileText size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                GST Invoices & WhatsApp Dispatch
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Generate professional B2B or B2C GST invoices with GSTIN, SAC codes, and CGST/SGST lines. Download as clean PDFs or dispatch straight to WhatsApp in 1-click.
              </p>
              <div className="text-xs font-bold text-rose-600 flex items-center gap-1">
                Compliant with Indian Tax Regulations
              </div>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-6">
                <Building size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Multi-Branch Hub Isolation
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Scale from 1 cloud kitchen to 10+ regional dispatch hubs. Managers only see their branch customers and riders; owners see complete unified business analytics.
              </p>
              <div className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                Role-based security & audit logging
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. REAL-TIME DYNAMIC PRICING SECTION */}
      <section id="pricing" className="py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-primary-400 font-extrabold uppercase text-xs tracking-wider block mb-2">
              Transparent Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Invest in your kitchen's operating system
            </h2>
            <p className="text-slate-400 text-base sm:text-lg mt-3">
              Every plan includes unlimited active customers, branch manager portals, driver mobile apps, and automated GST billing. No hidden tier restrictions.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {plans.map((plan) => {
              const effectivePrice = calculateEffectivePrice(plan.price, offer);
              const isDiscounted = effectivePrice < plan.price;
              const monthlyRate = Math.round(effectivePrice / plan.durationMonths);

              return (
                <div 
                  key={plan.id}
                  className={`
                    rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 relative
                    ${plan.isBestValue 
                      ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-primary-500 shadow-2xl shadow-primary-500/20 md:-translate-y-2' 
                      : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700'
                    }
                  `}
                >
                  {plan.isBestValue && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-violet-500 text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">
                      Most Popular
                    </div>
                  )}

                  {!plan.isBestValue && plan.durationMonths === 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-300 text-[11px] font-bold px-3 py-0.5 rounded-full border border-slate-700">
                      Starter Plan
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{plan.label}</h3>
                    <p className="text-slate-400 text-xs mb-6 min-h-[36px]">{plan.description}</p>

                    <div className="mb-4">
                      {isDiscounted && (
                        <span className="block text-sm text-slate-500 line-through mb-1">
                          ₹{plan.price.toLocaleString()}
                        </span>
                      )}
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl sm:text-5xl font-black text-white">
                          ₹{effectivePrice.toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-xs font-semibold">
                          / {plan.durationMonths} {plan.durationMonths === 1 ? 'Month' : 'Months'}
                        </span>
                      </div>
                    </div>

                    {plan.durationMonths > 1 ? (
                      <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 inline-block px-2.5 py-1 rounded-md mb-6">
                        Effective ~₹{monthlyRate.toLocaleString()} / month
                      </div>
                    ) : (
                      <div className="h-6 mb-6" />
                    )}

                    {/* Features List */}
                    <div className="space-y-3 pt-4 border-t border-slate-800/80 text-xs text-slate-300 mb-8">
                      <div className="flex items-center gap-2.5">
                        <Check size={15} className="text-primary-400 shrink-0" />
                        <span>All SaaS Features & Updates</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Check size={15} className="text-primary-400 shrink-0" />
                        <span>Branch Manager Web Portal</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Check size={15} className="text-primary-400 shrink-0" />
                        <span>Delivery Rider Mobile App</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Check size={15} className="text-primary-400 shrink-0" />
                        <span>Reusable Box (Dabba) Tracker</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Check size={15} className="text-primary-400 shrink-0" />
                        <span>GST Invoicing & WhatsApp Engine</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Check size={15} className="text-primary-400 shrink-0" />
                        <span>Shortest Route Optimizer</span>
                      </div>
                    </div>
                  </div>

                  <AuthLink 
                    to="/signup" 
                    planId={plan.id}
                    className={`
                      w-full font-bold py-3.5 rounded-xl text-center text-sm transition-all block
                      ${plan.isBestValue 
                        ? 'bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-500 hover:to-violet-500 text-white shadow-lg shadow-primary-600/30' 
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }
                    `}
                  >
                    {getPlanButtonText(plan)}
                  </AuthLink>
                </div>
              );
            })}
          </div>

          <div className="max-w-2xl mx-auto mt-12 text-center text-xs text-slate-400">
            All prices are in Indian Rupees (INR). 30-day free trial applies immediately upon account creation.
          </div>

        </div>
      </section>

      {/* 9. BOOK A DEMO SECTION */}
      <section id="book-demo" className="py-20 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white relative overflow-hidden border-y border-emerald-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-gradient-to-r from-emerald-900/30 to-slate-900/60 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase px-3.5 py-1.5 rounded-full">
                <MessageCircle size={14} className="text-emerald-400" />
                Live 1-on-1 Walkthrough
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Want to see ScaleKitchen in action for your kitchen?
              </h2>
              <p className="text-slate-300 text-base leading-relaxed">
                Connect directly with our team on WhatsApp. We will set up a quick 15-minute live screen walkthrough showing how ScaleKitchen manages your recurring renewals, kitchen prep sheets, branch managers, and rider deliveries.
              </p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-emerald-300 font-semibold pt-2">
                <span className="flex items-center gap-1.5"><CheckCircle size={15} /> Tailored to your kitchen size</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={15} /> Instant response within 15 mins</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 shrink-0 w-full sm:w-auto">
              <a
                href={whatsappDemoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base px-8 py-4 rounded-2xl shadow-xl shadow-emerald-500/30 hover:scale-105 transition-all"
              >
                <MessageCircle size={22} className="text-slate-950" />
                <span>Book a Demo</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 10. TESTIMONIALS & TRUST */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-primary-600 font-extrabold uppercase text-xs tracking-wider block mb-2">
              Customer Feedback
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Trusted by commercial kitchens & tiffin providers
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                brand: "FitFuel Meals",
                location: "Bangalore",
                quote: "ScaleKitchen reduced our WhatsApp chaos by 90%. Riders love the mobile portal because they don't have to call customers for location pins anymore.",
                author: "Anand R., Founder"
              },
              {
                brand: "HealthyTiffin Co.",
                location: "Mumbai",
                quote: "The Dabba Recovery Tracker alone saved us over ₹35,000 in lost stainless steel containers in our first two months. It literally pays for itself.",
                author: "Pooja Mehta, Operations Head"
              },
              {
                brand: "DailyBite Box",
                location: "Pune",
                quote: "Branch manager login gives our kitchen head the exact prep sheet without showing our business revenues. Clean, fast, and remarkably stable.",
                author: "Siddharth K., Director"
              }
            ].map((t, idx) => (
              <div key={idx} className="bg-slate-50 p-8 rounded-3xl border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 mb-4 text-amber-400">
                    {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                  </div>
                  <p className="text-slate-700 text-sm sm:text-base leading-relaxed italic mb-6">
                    "{t.quote}"
                  </p>
                </div>
                
                <div className="flex items-center gap-3 pt-4 border-t border-slate-200/60">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-sm">
                    {t.brand.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{t.brand}</div>
                    <div className="text-xs text-slate-500 font-medium">{t.author} • {t.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 11. FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <span className="text-primary-600 font-extrabold uppercase text-xs tracking-wider block mb-2">
              Got Questions?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 text-base mt-2">
              Everything you need to know about ScaleKitchen by COSVYN
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full text-left p-6 flex justify-between items-center gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <span className="font-bold text-slate-900 text-base sm:text-lg">
                      {faq.q}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-slate-600 text-sm leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 12. FINAL CALL TO ACTION */}
      <section className="py-24 bg-white relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-[2.5rem] p-8 sm:p-14 text-white text-center shadow-2xl relative overflow-hidden border border-slate-800">
            
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6">
                Ready to put your meal subscription operations on autopilot?
              </h2>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-10">
                Join forward-thinking cloud kitchens and tiffin operators running their business with ScaleKitchen. Start your 30-day free trial today.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <AuthLink
                  to="/signup"
                  className="w-full sm:w-auto bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-base px-8 py-4 rounded-xl shadow-xl transition-all"
                >
                  Start 30 Days Free Trial
                </AuthLink>
                <AuthLink
                  to="/login"
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold text-base px-8 py-4 rounded-xl transition-all"
                >
                  Existing Customer Login
                </AuthLink>
              </div>

              <div className="text-xs text-slate-500 mt-6 font-medium">
                No credit card required • Instant setup in under 5 minutes • Dedicated WhatsApp onboarding support
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 13. FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-14 border-t border-slate-900 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-12 border-b border-slate-800/80">
            
            {/* Col 1: Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                  <Zap size={18} fill="currentColor" />
                </div>
                <span className="text-xl font-extrabold text-white tracking-tight">ScaleKitchen</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Operating System for Meal Subscriptions & Tiffin Kitchens by COSVYN. Designed for growth, reliability, and zero billing leakage.
              </p>
              <div className="pt-2">
                <a 
                  href={whatsappDemoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  <MessageCircle size={14} /> WhatsApp Support: +91 7702667567
                </a>
              </div>
            </div>

            {/* Col 2: Core Solutions */}
            <div>
              <div className="font-bold text-white text-xs uppercase tracking-wider mb-4">Core Solutions</div>
              <ul className="space-y-2 text-xs">
                <li><span className="text-slate-400">Tiffin Service Management</span></li>
                <li><span className="text-slate-400">Shortest Route Optimizer</span></li>
                <li><span className="text-slate-400">Reusable Dabba Recovery</span></li>
                <li><span className="text-slate-400">GST Invoice Generator</span></li>
                <li><span className="text-slate-400">Kitchen Prep Display (KDS)</span></li>
              </ul>
            </div>

            {/* Col 3: Legal & Support */}
            <div>
              <div className="font-bold text-white text-xs uppercase tracking-wider mb-4">Legal & Support</div>
              <ul className="space-y-2 text-xs">
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/refunds" className="hover:text-white transition-colors">Cancellation & Refunds</Link></li>
                <li><Link to="/shipping" className="hover:text-white transition-colors">Shipping & Delivery Policy</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <div>
              © 2026 ScaleKitchen by COSVYN. All rights reserved. SaaS for Subscription Meal Businesses.
            </div>
            <div className="flex items-center gap-6">
              <a href={whatsappDemoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                Book Demo (+91 7702667567)
              </a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
