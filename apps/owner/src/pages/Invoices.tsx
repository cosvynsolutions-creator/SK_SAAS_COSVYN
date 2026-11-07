import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Download, Share2, Zap, Loader2, X, Upload, Plus, ChevronDown, Check, UserCircle, Settings2, Smartphone, Layout, FileText, Mail, MessageSquare, ChevronRight, Info, ShieldCheck, Printer, Phone, PenTool, CreditCard, Sparkles, AlertCircle, PartyPopper, Search
} from 'lucide-react';
import { useStreamCollection, updateItem, addItem } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { handleRazorpayPayment } from '../services/razorpayService';
import { formatDateDDMMYYYY } from '../services/store';
import { getInvoiceShareMessage, buildWhatsAppUrl } from '../services/messageTemplates';

type ThemeColor = 'black' | 'blue' | 'purple' | 'teal' | 'green' | 'amber' | 'orange' | 'red';

const THEMES: Record<ThemeColor, string> = {
  black: 'bg-slate-900',
  blue: 'bg-blue-600',
  purple: 'bg-violet-700',
  teal: 'bg-teal-700',
  green: 'bg-emerald-600',
  amber: 'bg-amber-600',
  orange: 'bg-orange-600',
  red: 'bg-rose-600'
};

type InvoiceSource = 'manual' | 'customer';

interface LineItem {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  sgstPercent: number;
  cgstPercent: number;
}

const RECHARGE_PLANS = [
  { id: 'mini', name: 'Mini', price: 10, count: 1, label: '' },
  { id: 'saver', name: 'Saver', price: 15, count: 2, label: 'Best for quick use', isOrange: true },
  { id: 'value', name: 'Value', price: 25, count: 5, label: '' },
  { id: 'smart', name: 'Smart', price: 40, count: 10, label: 'Most Popular', isPopular: true },
  { id: 'pro', name: 'Pro Saver', price: 60, count: 20, label: '' },
  { id: 'ultimate', name: 'Ultimate', price: 100, count: 50, label: 'Best Value', isGreen: true },
];

const Confetti = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti-fall"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-20px`,
            backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 5)],
            width: `${Math.random() * 10 + 5}px`,
            height: `${Math.random() * 10 + 5}px`,
            animationDelay: `${Math.random() * 3}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall {
          animation: confetti-fall 4s linear forwards;
        }
      `}</style>
    </div>
  );
};

const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const nToW = (n: number): string => {
    if (n < 20) return a[n];
    const tens = Math.floor(n / 10);
    const units = n % 10;
    return b[tens] + (units !== 0 ? ' ' + a[units] : '');
  };
  const convert = (n: number): string => {
    let str = '';
    if (n >= 10000000) { str += convert(Math.floor(n / 10000000)) + 'Crore '; n %= 10000000; }
    if (n >= 100000) { str += convert(Math.floor(n / 100000)) + 'Lakh '; n %= 100000; }
    if (n >= 1000) { str += convert(Math.floor(n / 1000)) + 'Thousand '; n %= 1000; }
    if (n >= 100) { str += convert(Math.floor(n / 100)) + 'Hundred '; n %= 100; }
    if (n > 0) { if (str !== '') str += 'and '; str += nToW(n); }
    return str;
  };
  const rounded = Math.floor(num);
  return rounded === 0 ? 'Zero' : convert(rounded).trim() + ' Only';
};

const Invoices = () => {
  const { currentUser } = useAuth();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: branches = [], loading: l2 } = useStreamCollection<any>('branches');
  
  const [invoiceSource, setInvoiceSource] = useState<InvoiceSource>('manual');
  const [selectedBranchId, setSelectedBranchId] = useState('All');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
  const customerSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSelectorRef.current && !customerSelectorRef.current.contains(e.target as Node)) {
        setIsCustomerSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [selectedTheme, setSelectedTheme] = useState<ThemeColor>('blue');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Credit Tracking State
  const [businessData, setBusinessData] = useState<any>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [rechargingPlanId, setRechargingPlanId] = useState<string | null>(null);

  const [sharePhone, setSharePhone] = useState('');
  const [shareEmail, setShareEmail] = useState('');

  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: `INV-${Math.floor(100 + Math.random() * 900)}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    from: { company: '', address: '', gstin: '', contact: '' },
    billTo: { company: '', address: '', gstin: '', contact: '' },
    shipTo: { company: '', address: '', contact: '' },
    items: [{ id: '1', description: 'Monthly Meal Subscription', hsn: '9963', qty: 1, rate: 0, sgstPercent: 2.5, cgstPercent: 2.5 }] as LineItem[],
    notes: 'It was great doing business with you.',
    terms: 'Please make the payment by the due date.',
    signatoryName: ''
  });

  // Fetch Business Credits Info & Real-Time Logo/Profile Sync
  useEffect(() => {
    if (!currentUser) return;
    const docRef = doc(db, 'businesses', currentUser.uid);
    const unsub = onSnapshot(docRef, async (s) => {
      if (s.exists()) {
        const d = s.data();
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        if (d.lastInvoiceResetMonth !== currentMonth) {
          await updateDoc(docRef, {
            monthlyFreeUsed: 0,
            lastInvoiceResetMonth: currentMonth
          });
          d.monthlyFreeUsed = 0;
          d.lastInvoiceResetMonth = currentMonth;
        }

        setBusinessData(d);
        if (d.logoUrl) {
          setLogoUrl(d.logoUrl);
        }
        setInvoiceData(prev => ({
          ...prev,
          from: {
            company: d.businessName || prev.from.company || '',
            address: `${d.description || ''}${d.city ? ', ' + d.city : ''}${d.state ? ', ' + d.state : ''}`.trim(),
            gstin: d.gstin || prev.from.gstin || 'URD',
            contact: d.mobile || d.email || prev.from.contact || ''
          },
          signatoryName: d.ownerName || prev.signatoryName || ''
        }));
      }
    }, (err) => console.warn("Error streaming business profile in invoices:", err));

    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (invoiceSource === 'customer' && selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust) {
        setSharePhone(cust.mobile || '');
        setShareEmail(cust.email || '');
        setInvoiceData(prev => ({
          ...prev,
          billTo: { 
            company: cust.name, 
            address: cust.address || '', 
            gstin: 'URD', 
            contact: cust.mobile || '' 
          },
          shipTo: { 
            company: cust.name, 
            address: cust.address || '', 
            contact: cust.mobile || '' 
          },
          items: cust.activePlans?.map((p: any) => ({
            id: Math.random().toString(),
            description: `${p.planName} (${p.mealTime})`,
            hsn: '9963',
            qty: 1,
            rate: p.price,
            sgstPercent: 2.5,
            cgstPercent: 2.5
          })) || prev.items
        }));
      }
    }
  }, [selectedCustomerId, invoiceSource, customers]);

  const totals = useMemo(() => {
    const subTotal = invoiceData.items.reduce((acc, item) => acc + (item.qty * item.rate), 0);
    const sgstTotal = invoiceData.items.reduce((acc, item) => acc + (item.qty * item.rate * (item.sgstPercent / 100)), 0);
    const cgstTotal = invoiceData.items.reduce((acc, item) => acc + (item.qty * item.rate * (item.cgstPercent / 100)), 0);
    return { subTotal, sgstTotal, cgstTotal, grandTotal: subTotal + sgstTotal + cgstTotal };
  }, [invoiceData.items]);

  const filteredCustomers = useMemo(() => {
    if (selectedBranchId === 'All') return customers;
    return customers.filter(c => c.branchId === selectedBranchId);
  }, [customers, selectedBranchId]);

  const searchedFilteredCustomers = useMemo(() => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return filteredCustomers;
    return filteredCustomers.filter((c: any) => 
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.mobile || '').includes(q) ||
      String(c.address || '').toLowerCase().includes(q)
    );
  }, [filteredCustomers, customerSearchQuery]);

  const currentSelectedCustomer = useMemo(() => {
    return customers.find((c: any) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const checkCredits = (): boolean => {
    if (!businessData) return false;
    const freeLeft = 3 - (businessData.monthlyFreeUsed || 0);
    const purchasedLeft = businessData.purchasedInvoiceCredits || 0;
    
    if (freeLeft <= 0 && purchasedLeft <= 0) {
      setIsLimitReached(true);
      return false;
    }
    return true;
  };

  const deductCredit = async () => {
    if (!currentUser || !businessData) return;
    const docRef = doc(db, 'businesses', currentUser.uid);
    const freeUsed = businessData.monthlyFreeUsed || 0;
    const purchasedLeft = businessData.purchasedInvoiceCredits || 0;

    if (freeUsed < 3) {
      const nextVal = freeUsed + 1;
      await updateDoc(docRef, { monthlyFreeUsed: nextVal });
      setBusinessData({ ...businessData, monthlyFreeUsed: nextVal });
    } else if (purchasedLeft > 0) {
      const nextVal = purchasedLeft - 1;
      await updateDoc(docRef, { purchasedInvoiceCredits: nextVal });
      setBusinessData({ ...businessData, purchasedInvoiceCredits: nextVal });
    }
  };

  const addItemRow = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Math.random().toString(),
          description: '',
          hsn: '9963',
          qty: 1,
          rate: 0,
          sgstPercent: 2.5,
          cgstPercent: 2.5
        }
      ]
    }));
  };

  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const handleDownloadPDF = (skipDeduct = false) => {
    if (!checkCredits()) return false;
    if (!invoiceRef.current) return false;
    const element = invoiceRef.current;
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${invoiceData.invoiceNo || 'Invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    try {
      // @ts-ignore
      window.html2pdf().from(element).set(opt).save();
      if (!skipDeduct) deductCredit();
      return true;
    } catch (e) {
      console.warn("PDF export err:", e);
      return false;
    }
  };

  const handleWhatsAppShare = () => {
    if (!checkCredits()) return;

    // 1. Download PDF invoice directly to device so user can easily attach it
    handleDownloadPDF(true);
    deductCredit();

    // 2. Format WhatsApp message informing client of invoice & attached PDF
    const msg = getInvoiceShareMessage(
      invoiceData.invoiceNo,
      totals.grandTotal,
      invoiceData.dueDate,
      invoiceData.from.company,
      true
    );
    const url = buildWhatsAppUrl(sharePhone, msg);
    
    setShareNotice("Invoice PDF downloaded! Attach it in the WhatsApp chat that opened.");
    window.open(url, '_blank');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Invoice ${invoiceData.invoiceNo} from ${invoiceData.from.company}`);
    const body = encodeURIComponent(
      `Hello ${invoiceData.billTo.company},\n\n` +
      `Please find the invoice details below:\n\n` +
      `Invoice No: ${invoiceData.invoiceNo}\n` +
      `Amount: ₹${totals.grandTotal.toLocaleString()}\n` +
      `Due Date: ${formatDateDDMMYYYY(invoiceData.dueDate)}\n\n` +
      `Notes: ${invoiceData.notes}\n\n` +
      `Thank you!`
    );
    window.location.href = `mailto:${shareEmail}?subject=${subject}&body=${body}`;
  };

  const handlePrint = () => {
    if (!checkCredits()) return;
    window.print();
    deductCredit();
  };

  const handleRecharge = async (plan: any) => {
    if (!currentUser) {
      alert("Please log in to recharge invoice credits.");
      return;
    }
    
    setRechargingPlanId(plan.id);

    try {
      await handleRazorpayPayment({
        planId: plan.id,
        planName: plan.name,
        amount: plan.price,
        creditsToAdd: plan.count,
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userContact: businessData?.mobile || '',
        businessName: businessData?.businessName || 'Business Owner',
        onSuccess: async (result: any) => {
          setRechargingPlanId(null);
          const currentCredits = businessData?.purchasedInvoiceCredits || 0;
          const newCredits = currentCredits + plan.count;
          
          setBusinessData((prev: any) => ({
            ...prev,
            purchasedInvoiceCredits: newCredits,
            lastRechargePlan: plan.name
          }));
          setIsRechargeModalOpen(false);
          setIsLimitReached(false);
          
          // Trigger celebration
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 4500);
        },
        onFailure: (err: any) => {
          setRechargingPlanId(null);
          console.warn("Recharge cancelled or failed:", err);
          if (err && err.message && !err.message.includes('cancelled') && !err.message.includes('dismissed')) {
            alert(err.message || 'Payment could not be completed.');
          }
        }
      });
    } catch (e: any) {
      setRechargingPlanId(null);
      console.error("Recharge invocation error:", e);
      alert(e?.message || 'Could not initiate payment gateway.');
    }
  };

  const updateItemRow = (id: string, field: keyof LineItem, value: any) => setInvoiceData(prev => ({ ...prev, items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item) }));
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert("Please upload an image smaller than 1.5 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        setLogoUrl(result);
        if (currentUser) {
          try {
            await updateDoc(doc(db, 'businesses', currentUser.uid), {
              logoUrl: result,
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            console.warn("Could not sync invoice logo to profile:", err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };
  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSignatureUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (l1 || l2 || !businessData) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;

  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
  const freeLeft = Math.max(0, 3 - (businessData.monthlyFreeUsed || 0));
  const purchasedLeft = businessData.purchasedInvoiceCredits || 0;

  return (
    <div className="space-y-8 pb-20 pt-2 animate-in fade-in duration-500 min-h-screen">
      
      {showCelebration && <Confetti />}

      {/* HEADER ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">Invoice Studio & Billing</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">Generate compliant GST invoices for subscription and corporate clients.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2.5 glass-card p-2 rounded-2xl border border-white/80 shadow-glass w-full md:w-auto">
          
          {/* CREDIT WIDGET */}
          <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50/80 rounded-xl border border-slate-200/60">
             <div className="text-right">
                {purchasedLeft > 0 ? (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold text-primary-600">{businessData.lastRechargePlan || 'Credits'} Pack</span>
                    <span className="text-xs font-bold text-slate-900">{purchasedLeft} Invoices Left</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold text-slate-400">{currentMonthName} Free</span>
                    <span className="text-xs font-bold text-slate-900">{freeLeft}/3 Left</span>
                  </div>
                )}
             </div>
             <button 
              onClick={() => setIsRechargeModalOpen(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all active:scale-95 flex items-center gap-1 shadow-xs"
             >
                <Sparkles size={11} fill="currentColor" /> Recharge
             </button>
          </div>

          <div className="h-6 w-px bg-slate-200/80 mx-1 hidden sm:block" />

          <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/40">
             <button onClick={() => setInvoiceSource('manual')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${invoiceSource === 'manual' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}><Settings2 size={12}/> Manual</button>
             <button onClick={() => setInvoiceSource('customer')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${invoiceSource === 'customer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}><UserCircle size={12}/> Customer</button>
          </div>
          {invoiceSource === 'customer' && (
             <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                <select 
                  className="pl-2.5 pr-6 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none cursor-pointer" 
                  value={selectedBranchId} 
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setCustomerSearchQuery('');
                  }}
                >
                    <option value="All">All Branches</option>
                    {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>

                {/* Searchable Customer Combobox */}
                <div ref={customerSelectorRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCustomerSelectorOpen(!isCustomerSelectorOpen)}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 hover:border-primary-500 transition-all min-w-[160px] max-w-[240px] shadow-xs"
                  >
                    <span className="truncate">
                      {currentSelectedCustomer ? (
                        <span>{currentSelectedCustomer.name} <span className="text-slate-400 font-normal">({currentSelectedCustomer.mobile || 'No phone'})</span></span>
                      ) : (
                        <span className="text-slate-400 font-normal">Search / Select Customer...</span>
                      )}
                    </span>
                    <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${isCustomerSelectorOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCustomerSelectorOpen && (
                    <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                      <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                        <div className="relative flex items-center">
                          <Search size={14} className="absolute left-2.5 text-slate-400" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Type to search customer or phone..."
                            value={customerSearchQuery}
                            onChange={(e) => setCustomerSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {customerSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setCustomerSearchQuery('')}
                              className="absolute right-2 text-slate-400 hover:text-slate-600"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 no-scrollbar">
                        {searchedFilteredCustomers.length === 0 ? (
                          <div className="p-3 text-center text-xs font-medium text-slate-400">
                            No customers match "{customerSearchQuery}"
                          </div>
                        ) : (
                          searchedFilteredCustomers.map((c: any) => {
                            const isSelected = c.id === selectedCustomerId;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setIsCustomerSelectorOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-primary-50/60 transition-colors ${isSelected ? 'bg-primary-50 font-bold text-primary-900' : 'text-slate-700'}`}
                              >
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                                    {c.name}
                                    {c.area && <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{c.area}</span>}
                                  </div>
                                  <div className="text-[11px] text-slate-400">{c.mobile || 'No phone'}</div>
                                </div>
                                {isSelected && <Check size={14} className="text-primary-600 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
             </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* LEFT: INVOICE CANVAS */}
        <div ref={invoiceRef} className="xl:col-span-8 bg-white rounded-2xl border border-slate-200/90 shadow-glass overflow-hidden print-area">
          <div className="p-6 sm:p-8 space-y-6 w-full max-w-[720px] mx-auto">
            
            {/* Header Row */}
            <div className="flex justify-between items-start">
              <div className="flex gap-8 items-start flex-1">
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleLogoUpload} />
                <div onClick={() => fileInputRef.current?.click()} className={`w-32 h-32 rounded-2xl flex flex-col items-center justify-center transition-colors cursor-pointer group relative overflow-hidden shrink-0 ${logoUrl ? '' : 'border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary-400'}`}>
                   {logoUrl ? <><img src={logoUrl} alt="Logo" className="w-full h-full object-contain" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity no-print"><Upload size={20} className="text-white" /></div></> : <div className="text-center px-2 no-print"><Upload size={24} className="mx-auto mb-1" /><span className="text-[8px] font-black uppercase tracking-widest">Logo</span></div>}
                </div>
                <div className="space-y-0.5 flex-1 text-left">
                   <EditableInput placeholder="Business Name" value={invoiceData.from.company} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, company: v}})} className="text-xl font-black uppercase text-slate-900 block" />
                   <EditableArea placeholder="Business Address" value={invoiceData.from.address} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, address: v}})} className="text-xs text-slate-500 w-full leading-tight" />
                   <div className="flex items-center gap-2 text-xs text-left">
                     <span className="font-bold uppercase text-[9px] tracking-widest text-slate-300">GST:</span>
                     <EditableInput placeholder="GSTIN No" value={invoiceData.from.gstin} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, gstin: v}})} className="font-mono w-40 text-slate-500" />
                   </div>
                   <div className="flex items-center gap-2 text-xs text-left">
                     <span className="font-bold uppercase text-[9px] tracking-widest text-slate-300">Contact:</span>
                     <EditableInput placeholder="Mobile / Email" value={invoiceData.from.contact} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, contact: v}})} className="w-48 text-slate-500" />
                   </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end shrink-0">
                <h2 className="text-5xl font-black text-slate-100 uppercase tracking-tighter mb-4">Invoice</h2>
                <div className="space-y-1">
                  <div className="flex items-center justify-end gap-3"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoice#</span><EditableInput value={invoiceData.invoiceNo} onChange={v => setInvoiceData({...invoiceData, invoiceNo: v})} className="text-right font-black text-slate-900 w-28" /></div>
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                    <div className="relative flex items-center">
                      <span className="text-right text-xs font-bold text-slate-800 font-mono">
                        {formatDateDDMMYYYY(invoiceData.invoiceDate)}
                      </span>
                      <input 
                        type="date" 
                        value={invoiceData.invoiceDate} 
                        onChange={e => setInvoiceData({...invoiceData, invoiceDate: e.target.value})} 
                        className="absolute inset-0 opacity-0 cursor-pointer no-print w-full h-full" 
                        title="Click to edit date"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due Date</span>
                    <div className="relative flex items-center">
                      <span className="text-right text-xs font-bold text-slate-800 font-mono">
                        {formatDateDDMMYYYY(invoiceData.dueDate)}
                      </span>
                      <input 
                        type="date" 
                        value={invoiceData.dueDate} 
                        onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})} 
                        className="absolute inset-0 opacity-0 cursor-pointer no-print w-full h-full" 
                        title="Click to edit due date"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing & Shipping */}
            <div className="grid grid-cols-2 gap-12 border-t border-b border-slate-50 py-4 text-left">
               <div className="space-y-2">
                  <h3 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em]">Billing To:</h3>
                  <div className="space-y-0.5">
                    <EditableInput placeholder="Client Name" value={invoiceData.billTo.company} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, company: v}})} className="text-lg font-black uppercase text-slate-900 block w-full" />
                    <EditableArea placeholder="Client Address" value={invoiceData.billTo.address} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, address: v}})} className="text-xs text-slate-600 w-full leading-tight" />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold uppercase text-[9px] tracking-widest text-slate-400">GST:</span>
                      <EditableInput placeholder="GSTIN (URD)" value={invoiceData.billTo.gstin} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, gstin: v}})} className="text-slate-500 font-mono w-40" />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold uppercase text-[9px] tracking-widest text-slate-400">Contact:</span>
                      <EditableInput placeholder="Mobile / Email" value={invoiceData.billTo.contact} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, contact: v}})} className="text-slate-500 w-48" />
                    </div>
                  </div>
               </div>
               <div className="space-y-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Shipping To:</h3>
                  <div className="space-y-0.5">
                    <EditableInput placeholder="Recipient Name" value={invoiceData.shipTo.company} onChange={v => setInvoiceData({...invoiceData, shipTo: {...invoiceData.shipTo, company: v}})} className="text-lg font-black uppercase text-slate-900 block w-full" />
                    <EditableArea placeholder="Shipping Address" value={invoiceData.shipTo.address} onChange={v => setInvoiceData({...invoiceData, shipTo: {...invoiceData.shipTo, address: v}})} className="text-xs text-slate-600 w-full leading-tight" />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold uppercase text-[9px] tracking-widest text-slate-400">Contact:</span>
                      <EditableInput placeholder="Mobile / Email" value={invoiceData.shipTo.contact} onChange={v => setInvoiceData({...invoiceData, shipTo: {...invoiceData.shipTo, contact: v}})} className="text-slate-500 w-48" />
                    </div>
                  </div>
               </div>
            </div>

            {/* Items Table */}
            <div className="rounded-xl border border-transparent overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className={`${THEMES[selectedTheme]} text-white`}>
                  <tr className="text-[10px] font-black uppercase tracking-widest">
                    <th className="p-4 w-1/3">Item Description</th>
                    <th className="p-4 text-center">Qty</th>
                    <th className="p-4 text-right">Rate</th>
                    <th className="p-4 text-center">Tax %</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 w-10 no-print"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {invoiceData.items.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-left">
                         <EditableInput value={item.description} onChange={v => updateItemRow(item.id, 'description', v)} placeholder="Enter item name" className="w-full text-slate-900 text-sm" />
                         <div className="flex gap-2 mt-1"><span className="text-[8px] font-black text-slate-300 uppercase">HSN:</span><EditableInput value={item.hsn} onChange={v => updateItemRow(item.id, 'hsn', v)} placeholder="Code" className="text-[8px] text-slate-400 font-mono w-16" /></div>
                      </td>
                      <td className="p-4 text-center"><input type="number" value={item.qty} onChange={e => updateItemRow(item.id, 'qty', Number(e.target.value))} className="w-12 bg-transparent text-center text-sm font-bold text-slate-600 outline-none" /></td>
                      <td className="p-4 text-right"><input type="number" value={item.rate} onChange={e => updateItemRow(item.id, 'rate', Number(e.target.value))} className="w-20 bg-transparent text-right text-sm font-bold text-slate-600 outline-none" /></td>
                      <td className="p-4 text-center"><input type="number" value={item.sgstPercent + item.cgstPercent} onChange={e => { const val = Number(e.target.value) / 2; updateItemRow(item.id, 'sgstPercent', val); updateItemRow(item.id, 'cgstPercent', val); }} className="w-10 bg-transparent text-center text-[10px] font-bold text-slate-400 outline-none" /></td>
                      <td className="p-4 text-right text-slate-900 text-sm">₹{(item.qty * item.rate).toLocaleString()}</td>
                      <td className="p-4 no-print text-center"><button onClick={() => setInvoiceData(prev => ({...prev, items: prev.items.filter(i => i.id !== item.id)}))} className="text-slate-300 hover:text-red-500 transition-colors"><X size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addItemRow} className="w-full py-4 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-primary-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all no-print"><Plus size={16} /> Add Line Item</button>
            </div>

            {/* Calculations & Footer */}
            <div className="flex flex-col md:flex-row justify-between gap-12 border-t border-slate-50 pt-8 text-left">
               <div className="flex-1 space-y-6">
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total in Words</p>
                     <p className="text-xs font-black text-slate-800 uppercase italic leading-relaxed">Rupees {numberToWords(totals.grandTotal)}</p>
                  </div>
                  <div className="space-y-4">
                     <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notes</p><EditableArea value={invoiceData.notes} onChange={v => setInvoiceData({...invoiceData, notes: v})} className="text-xs text-slate-600 leading-relaxed italic w-full" /></div>
                     <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Terms</p><EditableArea value={invoiceData.terms} onChange={v => setInvoiceData({...invoiceData, terms: v})} className="text-[10px] text-slate-500 leading-relaxed w-full" /></div>
                  </div>
               </div>
               <div className="w-full md:w-80 space-y-6">
                  <div className="space-y-2.5">
                     <div className="flex justify-between items-center text-sm px-2"><span className="text-slate-400 font-bold uppercase text-[10px]">Sub Total</span><span className="font-black text-slate-700">₹{totals.subTotal.toLocaleString()}</span></div>
                     <div className="flex justify-between items-center text-sm px-2"><span className="text-slate-400 font-bold uppercase text-[10px]">SGST Total</span><span className="font-black text-slate-700">₹{totals.sgstTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</span></div>
                     <div className="flex justify-between items-center text-sm px-2"><span className="text-slate-400 font-bold uppercase text-[10px]">CGST Total</span><span className="font-black text-slate-700">₹{totals.cgstTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</span></div>
                     <div className={`mt-4 p-6 rounded-2xl flex justify-between items-center ${THEMES[selectedTheme]} text-white shadow-xl shadow-slate-900/10`}><span className="text-xs font-black uppercase tracking-[0.2em]">Total</span><span className="text-2xl font-black tracking-tight">₹{totals.grandTotal.toLocaleString()}</span></div>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex flex-col items-center">
                     <input type="file" ref={sigInputRef} hidden accept="image/*" onChange={handleSigUpload} />
                     <div onClick={() => sigInputRef.current?.click()} className={`w-full h-24 rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer group relative overflow-hidden border border-dashed ${signatureUrl ? 'border-transparent' : 'border-slate-200 text-slate-300 hover:border-primary-400 hover:text-primary-500'}`}>
                        {signatureUrl ? <><img src={signatureUrl} alt="Signature" className="h-full object-contain" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity no-print"><Upload size={18} className="text-white" /></div></> : <div className="text-center no-print"><PenTool size={20} className="mx-auto mb-1 opacity-40" /><span className="text-[8px] font-black uppercase tracking-widest">Add Signature</span></div>}
                     </div>
                     <div className="mt-2 w-full border-t border-slate-900"></div>
                     <EditableInput placeholder="Authorized Signatory" value={invoiceData.signatoryName} onChange={v => setInvoiceData({...invoiceData, signatoryName: v})} className="text-center text-[10px] font-black uppercase tracking-widest mt-1 text-slate-900" />
                  </div>
               </div>
            </div>

            <div className="pt-8 border-t border-slate-100 text-center">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-primary-600 via-primary-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Zap size={11} fill="currentColor" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Powered by ScaleKitchen</span>
                  <span className="text-[11px] text-slate-400">• Automated Meal Ops & Subscription OS</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">Computer generated invoice valid without physical signature</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: CONTROL PANEL */}
        <div className="xl:col-span-4 space-y-6 no-print">
          <div className="glass-card p-6 rounded-2xl border border-white/80 shadow-glass space-y-6 sticky top-6">
            <div>
              <h3 className="text-base font-bold font-display text-slate-900 tracking-tight text-left">Document & Export Controls</h3>
              <p className="text-xs text-slate-400 mt-0.5 text-left">Customize styling, branding, and dispatch options</p>
            </div>
            
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-700 block text-left">Theme Accent</label>
              <div className="flex items-center gap-2.5 flex-wrap">
                {(Object.keys(THEMES) as ThemeColor[]).map((t) => (
                  <button 
                    key={t} 
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                    onClick={() => setSelectedTheme(t)} 
                    className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${THEMES[t]} ${selectedTheme === t ? 'border-primary-500 ring-2 ring-primary-500/30 scale-110 shadow-sm' : 'border-white/80 hover:scale-105 shadow-xs'}`}
                  >
                    {selectedTheme === t && <Check size={13} className="text-white" strokeWidth={3.5} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-700 block text-left">Layout Preset</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button className="p-3 rounded-xl border border-primary-500/40 bg-primary-50/50 text-center space-y-1 transition-all">
                  <Smartphone size={20} className="text-primary-600 mx-auto" />
                  <p className="text-xs font-semibold text-primary-700">Standard</p>
                </button>
                <div className="p-3 rounded-xl border border-slate-200/60 text-center space-y-1 opacity-50 cursor-not-allowed bg-slate-50/40 group relative">
                  <Layout size={20} className="text-slate-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">Corporate</p>
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <span className="text-[9px] font-semibold bg-slate-900 text-white px-2 py-0.5 rounded-full">Soon</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
               <button 
                onClick={() => setIsShareModalOpen(true)} 
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-all transform active:scale-95 text-xs flex items-center justify-center gap-2"
               >
                 <Share2 size={16} /> Save & Share with Client
               </button>
               
               <div className="grid grid-cols-2 gap-2.5">
                 <button 
                  onClick={() => handleDownloadPDF()} 
                  className="glass-card border border-slate-200/80 hover:bg-slate-50/80 text-slate-800 font-semibold py-2.5 rounded-xl transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5 shadow-xs"
                 >
                   <Download size={14} /> PDF
                 </button>
                 <button 
                  onClick={handlePrint} 
                  className="glass-card border border-slate-200/80 hover:bg-slate-50/80 text-slate-800 font-semibold py-2.5 rounded-xl transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5 shadow-xs"
                 >
                   <Printer size={14} /> Print
                 </button>
               </div>
               
               <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200/60 flex items-start gap-2.5 mt-2">
                  <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-amber-900 leading-snug">
                    Each share, download PDF, or print deducts 1 invoice credit from your balance.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* RECHARGE MODAL */}
      {isRechargeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in no-print">
           <div className="glass-card bg-white/95 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/80">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                 <div>
                    <h3 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                       <CreditCard className="text-primary-600" size={20} /> Pay-Per-Invoice Recharge
                    </h3>
                    <p className="text-slate-500 text-xs font-normal mt-0.5">Add credits to continue creating professional invoices.</p>
                 </div>
                 <button onClick={() => setIsRechargeModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {RECHARGE_PLANS.map((plan) => (
                      <div 
                        key={plan.id}
                        onClick={() => handleRecharge(plan)}
                        className={`group relative p-6 rounded-3xl border-2 transition-all cursor-pointer hover:-translate-y-1 active:scale-95 ${
                          plan.isPopular ? 'border-primary-500 bg-primary-50/30' : 
                          plan.isOrange ? 'border-orange-500 bg-orange-50/30' : 
                          plan.isGreen ? 'border-emerald-500 bg-emerald-50/30' : 
                          'border-slate-100 hover:border-slate-300 bg-white'
                        }`}
                      >
                         {plan.label && (
                           <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                             plan.isPopular ? 'bg-primary-600 text-white' : 
                             plan.isOrange ? 'bg-orange-500 text-white' :
                             plan.isGreen ? 'bg-emerald-500 text-white' :
                             'bg-slate-500 text-white'
                           }`}>
                              {plan.label}
                           </span>
                         )}
                         
                         <div className="text-center space-y-2">
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">{plan.name}</h4>
                            <div className="flex flex-col items-center">
                               <span className="text-4xl font-black text-slate-900">₹{plan.price}</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">{plan.count} Invoice{plan.count > 1 ? 's' : ''}</span>
                            </div>
                            <div className="pt-4 mt-4 border-t border-slate-100/50">
                               <p className="text-[9px] font-black text-slate-500 uppercase">₹{(plan.price / plan.count).toFixed(2)} per invoice</p>
                            </div>
                         </div>

                         <div className="mt-6">
                            <button className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                              plan.isPopular ? 'bg-primary-600 text-white group-hover:bg-primary-700' :
                              plan.isOrange ? 'bg-orange-600 text-white group-hover:bg-orange-700' :
                              plan.isGreen ? 'bg-emerald-600 text-white group-hover:bg-emerald-700' :
                              'bg-slate-900 text-white group-hover:bg-black'
                            }`}>
                               {rechargingPlanId === plan.id ? 'Processing...' : 'Buy Pack'}
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>

                 <div className="mt-12 bg-primary-50 border border-primary-100 p-8 rounded-[2rem] flex flex-col md:flex-row items-center gap-8">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary-600 shadow-sm shrink-0">
                       <Sparkles size={32} fill="currentColor" />
                    </div>
                    <div className="text-center md:text-left">
                       <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Why Recharge?</h4>
                       <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                          Invoices never expire. Credits are only deducted when you download or share. Recharge once and use whenever you need.
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showCelebration && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-white/40 backdrop-blur-md animate-in fade-in zoom-in duration-300 pointer-events-none">
           <div className="bg-white p-12 rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.15)] text-center flex flex-col items-center gap-6 border-4 border-green-500 animate-in slide-in-from-bottom-10">
              <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center animate-bounce">
                 <PartyPopper size={56} />
              </div>
              <div>
                <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Payment Successful!</h3>
                <p className="text-slate-500 font-bold text-lg mt-2">Credits have been added to your wallet.</p>
              </div>
              <div className="flex gap-2">
                 {[...Array(3)].map((_, i) => (
                    <Sparkles key={i} className="text-amber-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* LIMIT REACHED POPUP */}
      {isLimitReached && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in no-print">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl text-center relative">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                 <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Limit Reached!</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                 You've used your 3 free invoices for <strong>{currentMonthName}</strong>. 
                 You'll receive 3 more free next month.
              </p>
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8 text-left">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Instant Continuation</p>
                 <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                    <div>
                       <p className="font-black text-slate-900">Mini Pack</p>
                       <p className="text-xs text-slate-500">1 Invoice Credit</p>
                    </div>
                    <span className="text-xl font-black text-primary-600">₹10</span>
                 </div>
              </div>

              <div className="space-y-3">
                 <button 
                  onClick={() => { setIsLimitReached(false); setIsRechargeModalOpen(true); }}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/30 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                 >
                    View All Recharge Plans <ChevronRight size={16}/>
                 </button>
                 <button onClick={() => setIsLimitReached(false)} className="w-full text-slate-400 font-bold py-2 text-[10px] uppercase tracking-widest hover:text-slate-600">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in no-print">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Share2 className="text-primary-600" /> Share Invoice</h3>
                 <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                 {shareNotice && (
                   <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <Check size={16} className="text-emerald-600 shrink-0" />
                      <span>{shareNotice}</span>
                   </div>
                 )}
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block">WhatsApp Number</label>
                    <div className="flex gap-2">
                       <div className="flex-1 relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input type="tel" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="e.g. 9876543210" value={sharePhone} onChange={(e) => setSharePhone(e.target.value)} />
                       </div>
                       <button 
                         onClick={handleWhatsAppShare} 
                         className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg transition-all active:scale-90 flex items-center gap-1.5 font-bold text-xs"
                         title="Download invoice and share via WhatsApp"
                       >
                         <MessageSquare size={16} fill="currentColor" />
                         <span>Share & Attach</span>
                       </button>
                    </div>
                    <p className="text-[11px] text-slate-500 text-left font-medium leading-relaxed">
                      💡 Clicking share automatically downloads the official PDF invoice onto your device and prepares the WhatsApp message so you can immediately attach the PDF in chat.
                    </p>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block">Email Address</label>
                    <div className="flex gap-2">
                       <div className="flex-1 relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input type="email" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="client@example.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                       </div>
                       <button onClick={() => { if(checkCredits()) { handleEmailShare(); deductCredit(); setIsShareModalOpen(false); } }} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl shadow-lg transition-all active:scale-90"><SendIcon /></button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; -webkit-print-color-adjust: exact; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
          @page { size: auto; margin: 10mm; }
        }
      `}</style>
    </div>
  );
};

// --- SUB-COMPONENTS ---
const EditableInput = ({ value, onChange, placeholder, className }: { value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) => (
  <input type="text" placeholder={placeholder} className={`bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-primary-500 transition-colors placeholder:text-slate-300 placeholder:italic ${className}`} value={value} onChange={e => onChange(e.target.value)} />
);
const EditableArea = ({ value, onChange, placeholder, className }: { value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) => (
  <textarea rows={2} placeholder={placeholder} className={`bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-primary-500 transition-colors resize-none placeholder:text-slate-300 placeholder:italic no-scrollbar ${className}`} value={value} onChange={e => onChange(e.target.value)} />
);
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
);

const ModalLabel = ({ children }: React.PropsWithChildren<{}>) => (
  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{children}</label>
);

export default Invoices;