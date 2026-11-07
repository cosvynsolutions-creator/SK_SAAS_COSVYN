
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Shield, Zap, Loader2, Tag, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { calculateEffectivePrice } from '../services/saasStore';
import { useGlobalPricing, addItem, checkFreeTrialEligibility, recordFreeTrialClaim } from '../services/dbService';
import { handleRazorpayPayment } from '../services/razorpayService';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, claimFreeTrialCallable } from '../services/firebase';
import { getDaysDifference } from '../services/store';

const OnboardingPayment = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPlanId = new URLSearchParams(location.search).get('plan');
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true);
  const [isTrialEligible, setIsTrialEligible] = useState(true);
  const [trialIneligibleReason, setTrialIneligibleReason] = useState('');
  const [trialError, setTrialError] = useState<string | null>(null);
  const [businessData, setBusinessData] = useState<any>(null);
  const [hasSetDefault, setHasSetDefault] = useState(false);
  
  // Use Global Pricing
  const { plans, offer, loading: pricingLoading } = useGlobalPricing();
  
  // Selection State (Default to FreeTrial or Yearly)
  const [selectedPlanId, setSelectedPlanId] = useState<string>(requestedPlanId || 'FreeTrial');

  // Helper to reliably get the active UID
  const getActiveUid = (): string => {
    if (currentUser?.uid) return currentUser.uid;
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    try {
      const stored = localStorage.getItem('scalekitchen_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.uid) return parsed.uid;
      }
    } catch (e) {}
    return '';
  };

  // Check if user is new and if they are eligible for the Free Trial
  useEffect(() => {
    const checkUserStatus = async () => {
      const uid = getActiveUid();
      if (!uid) return;

      try {
        const [docSnap, userClaimSnap] = await Promise.all([
          getDoc(doc(db, 'businesses', uid)).catch(() => null),
          getDoc(doc(db, 'trial_claims', `user_${uid}`)).catch(() => null)
        ]);

        if (docSnap && docSnap.exists()) {
          const data = docSnap.data();
          setBusinessData(data);
          
          // If already active, route straight to dashboard
          if (data.planStatus === 'Active') {
            navigate('/app/dashboard');
            return;
          }

          // Historical footprint analysis
          const today = new Date().toISOString().split('T')[0];
          const historicalDates: string[] = [];
          if (data.createdAt) historicalDates.push(data.createdAt.split('T')[0]);
          if (data.trialStartDate) historicalDates.push(data.trialStartDate.split('T')[0]);
          if (data.trialOriginalStartDate) historicalDates.push(data.trialOriginalStartDate.split('T')[0]);
          if (Array.isArray(data.recentLoginDates)) {
            data.recentLoginDates.forEach((d: string) => {
              if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) historicalDates.push(d);
            });
          }
          historicalDates.sort();

          const earliestFootprint = historicalDates.length > 0 ? historicalDates[0] : null;

          // SECURITY CHECK: Has this account ALREADY claimed or used a Free Trial?
          const alreadyClaimed = Boolean(
            data.trialClaimed === true || 
            data.trialStartDate || 
            (data.planName === 'Free Trial') ||
            (userClaimSnap && userClaimSnap.exists()) ||
            (earliestFootprint && earliestFootprint < today)
          );

          if (alreadyClaimed) {
            // Business has already used their one-time Free Trial
            setIsNewUser(false);
            setIsTrialEligible(false);
            const startLabel = earliestFootprint || (data.trialStartDate ? data.trialStartDate.split('T')[0] : '');
            setTrialIneligibleReason(`Your 30-day Free Trial was already activated${startLabel ? ` on ${startLabel}` : ''}. Free trial is strictly 1 time per business.`);
            // Automatically select paid plan
            setSelectedPlanId(
              plans.find(p => p.id === requestedPlanId)?.id ||
              plans.find(p => p.isBestValue)?.id ||
              plans[0]?.id ||
              'monthly'
            );
          } else {
            // Truly new business account
            const isNew = !data.planName || data.planName === 'None' || data.planStatus === 'Pending' || data.planStatus === 'Inactive';
            setIsNewUser(isNew);
            setIsTrialEligible(isNew);
          }
        } else {
          // Check if trial_claims has this user
          if (userClaimSnap && userClaimSnap.exists()) {
            setIsNewUser(false);
            setIsTrialEligible(false);
            setTrialIneligibleReason("A Free Trial was already activated on this account. Free trial is strictly 1 time per business.");
            setSelectedPlanId(
              plans.find(p => p.id === requestedPlanId)?.id ||
              plans.find(p => p.isBestValue)?.id ||
              plans[0]?.id ||
              'monthly'
            );
          } else {
            setIsNewUser(true);
            setIsTrialEligible(true);
          }
        }
      } catch (e) {
        console.error("Error checking user status:", e);
        setIsNewUser(true);
        setIsTrialEligible(true);
      }
    };
    checkUserStatus();
  }, [currentUser]);

  // Ensure selection defaults correctly once plans load
  useEffect(() => {
    if (!pricingLoading && plans.length > 0 && !hasSetDefault) {
      const requestedPlan = plans.find(plan => plan.id === requestedPlanId);
      if (requestedPlan) {
        setSelectedPlanId(requestedPlan.id);
      } else if (isNewUser && isTrialEligible) {
        setSelectedPlanId('FreeTrial');
      } else {
        setSelectedPlanId(plans.find(p => p.isBestValue)?.id || plans[0].id);
      }
      setHasSetDefault(true);
    }
  }, [pricingLoading, plans, isNewUser, isTrialEligible, hasSetDefault, requestedPlanId]);
  
  // Check offer validity
  const isOfferActive = offer.isActive && new Date() < new Date(offer.endsAt);

  const activateFreeTrial = async () => {
    const uid = getActiveUid();
    if (!uid) {
      setTrialError("Account session not found. Please log in again to activate your trial.");
      return;
    }

    setActivating(true);
    setTrialError(null);

    try {
      // 1. Fetch fresh server document and check trial_claims
      const [freshSnap, userClaimSnap] = await Promise.all([
        getDoc(doc(db, 'businesses', uid)),
        getDoc(doc(db, 'trial_claims', `user_${uid}`)).catch(() => null)
      ]);

      const currentData = freshSnap.exists() ? freshSnap.data() : {};
      const today = new Date().toISOString().split('T')[0];

      // Collect historical timestamps
      const historicalDates: string[] = [];
      if (currentData.createdAt) historicalDates.push(currentData.createdAt.split('T')[0]);
      if (currentData.trialStartDate) historicalDates.push(currentData.trialStartDate.split('T')[0]);
      if (currentData.trialOriginalStartDate) historicalDates.push(currentData.trialOriginalStartDate.split('T')[0]);
      if (Array.isArray(currentData.recentLoginDates)) {
        currentData.recentLoginDates.forEach((d: string) => {
          if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) historicalDates.push(d);
        });
      }
      if (userClaimSnap && userClaimSnap.exists()) {
        const uData = userClaimSnap.data();
        if (uData.claimedAt) historicalDates.push(uData.claimedAt.split('T')[0]);
        if (uData.trialStartDate) historicalDates.push(uData.trialStartDate.split('T')[0]);
      }
      historicalDates.sort();

      const earliestOrigin = historicalDates.length > 0 ? historicalDates[0] : today;

      // Calculate true trial expiry from earliest historical origin
      const originObj = new Date(earliestOrigin);
      const trueExpiryObj = new Date(originObj);
      trueExpiryObj.setDate(trueExpiryObj.getDate() + 30);
      let trueExpiryDate = trueExpiryObj.toISOString().split('T')[0];
      const daysLeft = getDaysDifference(today, trueExpiryDate);

      const alreadyClaimed = Boolean(
        currentData.trialClaimed === true || 
        currentData.trialStartDate || 
        (currentData.planName === 'Free Trial') ||
        (userClaimSnap && userClaimSnap.exists()) ||
        (historicalDates.length > 0 && historicalDates[0] < today)
      );

      if (alreadyClaimed) {
        // SECURITY GUARD: User has ALREADY activated a Free Trial previously!
        setIsTrialEligible(false);
        setTrialError("Your one-time Free Trial was already activated or has expired. Please subscribe to continue.");
        setSelectedPlanId(plans.find(p => p.isBestValue)?.id || plans[0]?.id || 'monthly');
        setActivating(false);
        return;
      }

      // 2. First-time brand new trial claim via server callable (Cloud Functions Admin SDK)
      const email = currentData.email || businessData?.email || currentUser?.email || auth.currentUser?.email || '';
      const mobile = currentData.mobile || businessData?.mobile || '';

      const res = await claimFreeTrialCallable({
        bizId: uid,
        mobile,
        email
      });

      if (!res.data?.success) {
        throw new Error("Could not activate free trial on the server.");
      }

      // Update local session cache so components immediately know the account is Active
      try {
        const stored = localStorage.getItem('scalekitchen_auth_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.planStatus = 'Active';
          parsed.planName = 'Free Trial';
          parsed.planExpiryDate = res.data.planExpiryDate;
          parsed.trialClaimed = true;
          localStorage.setItem('scalekitchen_auth_session', JSON.stringify(parsed));
        }
      } catch (e) {}

      navigate('/app/dashboard');
    } catch (error: any) {
      console.error("Trial Activation Failed:", error);
      const cleanMsg = (error?.message || "Failed to activate free trial. Please check your internet connection and try again.")
        .replace(/^Firebase:\s*/i, '')
        .trim();
      setTrialError(cleanMsg);
      setActivating(false);
    }
  };

  const activateSubscription = async (paymentId: string, plan: any, result: any) => {
    const uid = getActiveUid();
    if (!uid) return;
    setActivating(true);

    try {
      // Server already computed expiry and wrote planName, planStatus, planExpiryDate, lastPaymentId & billing_history
      // Update local session cache immediately
      try {
        const stored = localStorage.getItem('scalekitchen_auth_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.planStatus = 'Active';
          parsed.planName = `COSVYN ONE (${plan.label})`;
          if (result?.planExpiryDate) parsed.planExpiryDate = result.planExpiryDate;
          localStorage.setItem('scalekitchen_auth_session', JSON.stringify(parsed));
        }
      } catch (e) {}

      // Navigate to Dashboard
      navigate('/app/dashboard');
    } catch (error) {
      console.error("Activation Completion Failed:", error);
      alert("Subscription activated on server. Redirecting to dashboard...");
      navigate('/app/dashboard');
    }
  };

  const initiatePayment = (planId = selectedPlanId) => {
    if (!currentUser) return;
    
    const selectedPlan = plans.find(p => p.id === planId);
    if (!selectedPlan) return;

    const email = currentUser.email || "";
    const mobile = businessData?.mobile || ""; 
    const effectivePrice = calculateEffectivePrice(selectedPlan.price, offer);

    setLoading(true);

    handleRazorpayPayment({
      planId: selectedPlan.id,
      planName: selectedPlan.label,
      amount: effectivePrice,
      durationMonths: selectedPlan.durationMonths,
      userId: getActiveUid(),
      userEmail: email,
      userContact: mobile,
      businessName: currentUser.displayName || "Business Owner",
      onSuccess: (result: any) => {
        setLoading(false);
        activateSubscription(result.paymentId, selectedPlan, result);
      },
      onFailure: (error: any) => {
        setLoading(false);
        console.log("Payment Cancelled/Failed", error);
        if (error && error.message && !error.message.includes('cancelled') && !error.message.includes('dismissed')) {
          alert(error.message || 'Payment could not be completed.');
        }
      }
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading || pricingLoading || activating) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-900">
          {activating ? 'Activating Subscription...' : 'Processing Secure Payment...'}
        </h2>
        <p className="text-slate-500 mt-2 mb-6">Please do not close this window.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-violet-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/30 mx-auto mb-6 transform hover:scale-110 transition-transform duration-500">
            <Zap size={28} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Activate Your Account</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">Select the plan that fits your business needs. You can upgrade or cancel at any time.</p>
          
          {isOfferActive && (
            <div className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 px-5 py-2.5 rounded-full text-sm font-bold border border-emerald-500/20 animate-pulse">
              <Tag size={16} className="text-emerald-600" /> 
              <span>{offer.title} - <span className="underline decoration-wavy">{offer.discountPercent}% OFF</span> applied!</span>
            </div>
          )}

          {trialError && (
            <div className="mt-6 max-w-lg mx-auto bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3 text-left shadow-sm animate-in fade-in duration-300">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm">Trial Activation Notice</p>
                <p className="text-xs text-amber-800 mt-0.5">{trialError}</p>
                <button 
                  onClick={activateFreeTrial}
                  className="mt-2.5 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <RefreshCw size={12} /> Retry Free Trial Activation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plan Preview Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch mb-12 px-2 md:px-0">
          {/* FREE TRIAL PLAN (ONLY FOR NEW USERS) */}
          {isNewUser && (
            <div 
              onClick={() => {
                if (isTrialEligible) setSelectedPlanId('FreeTrial');
              }}
              className={`
                relative rounded-3xl p-8 transition-all duration-300 flex flex-col
                ${!isTrialEligible
                  ? 'bg-slate-100/80 border border-slate-200 cursor-not-allowed opacity-60'
                  : selectedPlanId === 'FreeTrial' 
                    ? 'bg-white border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.15)] ring-4 ring-emerald-500/10 scale-105 z-10 cursor-pointer' 
                    : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 opacity-80 hover:opacity-100 cursor-pointer'
                }
              `}
            >
              {selectedPlanId === 'FreeTrial' && isTrialEligible && (
                <div className="absolute -top-3 -right-3 bg-emerald-600 text-white rounded-full p-1.5 shadow-lg shadow-emerald-600/40 animate-in zoom-in duration-300">
                  <Check size={20} strokeWidth={3} />
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} className={isTrialEligible ? "text-emerald-500" : "text-slate-400"} />
                  <h3 className={`text-xl font-bold ${isTrialEligible ? (selectedPlanId === 'FreeTrial' ? 'text-slate-900' : 'text-slate-700') : 'text-slate-500'}`}>Free Trial</h3>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed min-h-[40px]">
                  {isTrialEligible 
                    ? 'Test all premium features for 30 days. No credit card required.' 
                    : (trialIneligibleReason || 'Free Trial already redeemed for this account.')}
                </p>
                {!isTrialEligible && (
                  <span className="inline-block mt-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    1 Trial Per Business Limit Reached
                  </span>
                )}
              </div>
              
              <div className="flex items-baseline gap-2 mb-8">
                <span className={`text-4xl font-extrabold tracking-tight ${isTrialEligible && selectedPlanId === 'FreeTrial' ? 'text-emerald-600' : 'text-slate-600'}`}>
                  ₹0
                </span>
                <span className="text-slate-400 text-sm font-medium">/ 30 days</span>
              </div>

              <div className="mt-auto">
                <ul className="space-y-4 mb-8">
                  {['Full Access', 'All Features Included', 'No Commitment', '30 Day Duration'].map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <div className={`mt-0.5 rounded-full p-0.5 ${isTrialEligible && selectedPlanId === 'FreeTrial' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {isTrialEligible ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlanId('FreeTrial');
                      activateFreeTrial();
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                      selectedPlanId === 'FreeTrial' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Start Free Trial
                  </button>
                ) : (
                  <div className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs text-center">
                    Trial Already Claimed
                  </div>
                )}
              </div>
            </div>
          )}

          {plans.map((plan) => {
            const effectivePrice = calculateEffectivePrice(plan.price, offer);
            const isSelected = selectedPlanId === plan.id;
            
            return (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`
                  relative rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col
                  ${isSelected 
                    ? 'bg-white border-2 border-primary-500 shadow-[0_0_40px_rgba(37,99,235,0.15)] ring-4 ring-primary-500/10 scale-105 z-10' 
                    : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 opacity-70 hover:opacity-100 grayscale hover:grayscale-0'
                  }
                `}
              >
                {/* BLUE CIRCLE DOT INDICATOR */}
                {isSelected && (
                  <div className="absolute -top-3 -right-3 bg-primary-600 text-white rounded-full p-1.5 shadow-lg shadow-primary-600/40 animate-in zoom-in spin-in-12 duration-300">
                    <Check size={20} strokeWidth={3} />
                  </div>
                )}

                {plan.isBestValue && (
                  <div className={`absolute top-0 inset-x-0 mx-auto w-fit -mt-3 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm ${isSelected ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-200 text-slate-500'}`}>
                    Best Value
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-xl font-bold mb-2 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{plan.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed min-h-[40px]">{plan.description}</p>
                </div>
                
                <div className="flex items-baseline gap-2 mb-8">
                  {isOfferActive && (
                    <span className="text-lg text-slate-400 line-through font-medium">₹{plan.price.toLocaleString()}</span>
                  )}
                  <span className={`text-4xl font-extrabold tracking-tight ${isOfferActive ? 'text-emerald-600' : isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                    ₹{effectivePrice.toLocaleString()}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">/ {plan.durationMonths === 1 ? 'mo' : plan.durationMonths === 6 ? '6mo' : 'yr'}</span>
                </div>

                <div className="mt-auto">
                  <ul className="space-y-4 mb-8">
                    {['Unlimited Customers', 'Smart Delivery Routes', 'Expenses & Inventory', 'Priority Support'].map((feat, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <div className={`mt-0.5 rounded-full p-0.5 ${isSelected ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <span className={isSelected ? 'text-slate-700 font-medium' : ''}>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlanId(plan.id);
                      initiatePayment(plan.id);
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                      isSelected 
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected ? 'Proceed to Payment' : 'Select & Pay'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-md mx-auto text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <button 
            onClick={selectedPlanId === 'FreeTrial' ? activateFreeTrial : () => initiatePayment()}
            disabled={selectedPlanId === 'FreeTrial' && !isTrialEligible}
            className={`group w-full text-white font-bold py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 text-lg relative overflow-hidden ${
              selectedPlanId === 'FreeTrial' && !isTrialEligible
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            {selectedPlanId === 'FreeTrial' ? <Zap size={22} className="text-emerald-400" /> : <Shield size={22} className="text-emerald-400" />}
            <span>
              {selectedPlanId === 'FreeTrial' 
                ? (isTrialEligible ? 'Start Free Trial Now' : 'Free Trial Already Claimed') 
                : 'Pay Securely with Razorpay'}
            </span>
          </button>
          
          <div className="flex items-center justify-center gap-6 text-sm">
            <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600 font-medium transition-colors">
              Sign Out
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
              <Lock size={12} /> SSL Encrypted Payment
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OnboardingPayment;
