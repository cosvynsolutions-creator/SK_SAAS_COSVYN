
import React, { useState, useEffect } from 'react';
import { 
  User, Building, CreditCard, Shield, CheckCircle, AlertCircle, 
  Globe, Rocket, Monitor, LayoutTemplate, ExternalLink, X, Zap, Loader2, Tag, Lock, Receipt, Calendar, Upload
} from 'lucide-react';
import { 
  INITIAL_BUSINESS_PROFILE, INDIA_STATES, BusinessProfile, getDaysDifference,
  formatDateDDMMYYYY 
} from '../services/store';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { calculateEffectivePrice } from '../services/saasStore';
import { useGlobalPricing, useStreamCollection, addItem } from '../services/dbService';
import { handleRazorpayPayment } from '../services/razorpayService';
import { getAmountInRupees } from '../services/moneyUtils';

const Profile = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>({...INITIAL_BUSINESS_PROFILE});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<BusinessProfile>({...INITIAL_BUSINESS_PROFILE});
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  // Fetch Billing History
  const { data: billingHistory } = useStreamCollection<any>('billing_history');
  
  // Sort history by date descending
  const sortedHistory = [...billingHistory].sort((a: any, b: any) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // FETCH PROFILE & REAL-TIME SYNC
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const docRef = doc(db, 'businesses', currentUser.uid);
    const unsub = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as BusinessProfile;
        setProfile(data);
        setFormData(prev => ({
          ...data,
          // if currently editing, preserve form field changes unless uninitialized
          ...(isEditing ? {} : data)
        }));
      } else {
        // Document has not yet been provisioned; create safe default profile without overwriting
        const newProfile = {
          ...INITIAL_BUSINESS_PROFILE,
          email: currentUser.email || '',
          ownerName: currentUser.displayName || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(docRef, newProfile, { merge: true }).catch(console.warn);
        setProfile(newProfile);
        setFormData(newProfile);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Profile snapshot notice:", err?.message);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser, isEditing]);

  // Days left helper
  const daysToExpiry = getDaysDifference(new Date().toISOString().split('T')[0], profile.planExpiryDate);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert("Please upload an image smaller than 1.5 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFormData(prev => ({ ...prev, logoUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    const isComplete = Boolean(
      formData.ownerName?.trim() && 
      formData.email?.trim() && 
      formData.mobile?.trim() && 
      formData.businessName?.trim() && 
      formData.state?.trim() && 
      formData.city?.trim()
    );

    // SECURITY FIX: Strictly isolate profile fields from subscription & trial lifecycle fields
    // This prevents profile updates from ever resetting planExpiryDate or planStatus
    const profileFieldsToUpdate = {
      ownerName: formData.ownerName?.trim() || '',
      email: formData.email?.trim() || currentUser.email || '',
      mobile: formData.mobile?.trim() || '',
      businessName: formData.businessName?.trim() || '',
      logoUrl: formData.logoUrl || profile.logoUrl || '',
      description: formData.description?.trim() || '',
      category: formData.category || 'Cloud Kitchen',
      country: formData.country || 'India',
      state: formData.state || '',
      city: formData.city || '',
      isProfileComplete: isComplete,
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = doc(db, 'businesses', currentUser.uid);
      await updateDoc(docRef, profileFieldsToUpdate);
      
      setProfile(prev => ({ ...prev, ...profileFieldsToUpdate }));
      setIsEditing(false);
      alert("Profile and brand logo updated successfully!");
    } catch (e) {
      console.error("Error saving profile:", e);
      alert("Failed to save changes.");
    }
  };

  const handleRenewalSuccess = async (paymentId: string, planDurationMonths: number, planName: string, result: any) => {
    if (!currentUser) return;
    
    try {
      const newExpiryDate = result?.planExpiryDate || profile.planExpiryDate;

      // Update local state immediately
      setProfile(prev => ({
         ...prev,
         planStatus: 'Active',
         planName: `COSVYN ONE (${planName})`,
         planExpiryDate: newExpiryDate,
         lastPaymentId: paymentId
      }));

      setIsRenewModalOpen(false);
      alert("🎉 Subscription Renewed Successfully! Your plan is now Active.");

    } catch (e) {
      console.error("Renewal UI Update Failed:", e);
      setIsRenewModalOpen(false);
    }
  };

  const ServiceCard = ({ title, desc, icon: Icon }: any) => (
    <a href="https://cosvyn.space" target="_blank" rel="noopener noreferrer" className="group block h-full">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700/50 hover:border-primary-500/50 transition-all h-full relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
           <ExternalLink className="text-primary-400" size={18} />
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center mb-4 text-primary-400 group-hover:text-white group-hover:bg-primary-600 transition-colors">
           <Icon size={24} />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </a>
  );

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center flex-col">
        <Loader2 className="animate-spin text-primary-600 mb-2" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Business Profile</h1>
          <p className="text-slate-500 mt-1">Complete your profile to unlock full features.</p>
        </div>
        {!profile.isProfileComplete && (
           <div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-amber-200">
              <AlertCircle size={16} /> Action Required: Complete Profile
           </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: EDITABLE FORM */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building size={20} className="text-primary-600" />
                <h3 className="font-bold text-slate-800">Business Details</h3>
              </div>
              <button 
                onClick={() => {
                   if (isEditing) handleSave();
                   else {
                     setFormData({...profile});
                     setIsEditing(true);
                   }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                   isEditing 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isEditing ? 'Save Changes' : 'Edit Profile'}
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="md:col-span-2 flex items-center gap-4 mb-2">
                  <div className="relative group shrink-0">
                     {(formData.logoUrl || profile.logoUrl) ? (
                       <img 
                         src={formData.logoUrl || profile.logoUrl} 
                         alt={profile.businessName || 'Business Logo'} 
                         className="w-20 h-20 rounded-2xl object-contain bg-white border-4 border-slate-100 shadow-md p-1"
                       />
                     ) : (
                       <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary-600 via-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl border-4 border-white shadow-md uppercase">
                          {profile.businessName ? profile.businessName.charAt(0) : 'B'}
                       </div>
                     )}
                     {isEditing && (
                       <label className="absolute -bottom-1 -right-1 bg-slate-900 hover:bg-slate-800 text-white p-1.5 rounded-xl cursor-pointer shadow-md transition-all hover:scale-105" title="Change Business Logo">
                         <Upload size={14} />
                         <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                       </label>
                     )}
                  </div>
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2">
                       <h2 className="text-xl font-bold text-slate-900 truncate">{profile.businessName || 'Your Business'}</h2>
                       <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Kitchen Owner</span>
                     </div>
                     <p className="text-slate-500 text-sm mt-0.5">{profile.ownerName || 'Account Administrator'}</p>
                     {isEditing && (
                       <label className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer">
                         <Upload size={12} />
                         <span>Upload new company logo</span>
                         <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                       </label>
                     )}
                  </div>
               </div>

               {/* Fields */}
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Owner Name *</label>
                  <input 
                    disabled={!isEditing}
                    type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.ownerName : profile.ownerName}
                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email *</label>
                  <input 
                    disabled={!isEditing}
                    type="email" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.email : profile.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mobile Number *</label>
                  <input 
                    disabled={!isEditing}
                    type="tel" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.mobile : profile.mobile}
                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Business Name *</label>
                  <input 
                    disabled={!isEditing}
                    type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.businessName : profile.businessName}
                    onChange={e => setFormData({...formData, businessName: e.target.value})}
                  />
               </div>
               <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                  <textarea 
                    rows={2}
                    disabled={!isEditing}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none"
                    value={isEditing ? formData.description : profile.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
                  <select
                    disabled={!isEditing}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.category : profile.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                     <option>Cloud Kitchen</option>
                     <option>Tiffin Service</option>
                     <option>Catering</option>
                     <option>Restaurant</option>
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Country</label>
                  <input 
                    disabled
                    type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                    value="India"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">State *</label>
                  <select
                    disabled={!isEditing}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={isEditing ? formData.state : profile.state}
                    onChange={e => setFormData({...formData, state: e.target.value})}
                  >
                     <option value="">Select State</option>
                     {INDIA_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">City *</label>
                  <input 
                    disabled={!isEditing}
                    type="text" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Enter City"
                    value={isEditing ? formData.city : profile.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                  />
               </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SUBSCRIPTION & UPSELL */}
        <div className="space-y-6">
           
           {/* SaaS Subscription Card */}
           <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-3 opacity-10">
                <Shield size={120} />
             </div>
             <div className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Current Plan</p>
                      <h3 className="text-xl font-bold text-white">{profile.planName}</h3>
                   </div>
                   <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                     <CheckCircle size={12} /> {profile.planStatus}
                   </span>
                </div>

                <div className="space-y-4 border-t border-white/10 pt-4 mb-6">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-300">Expires On</span>
                     <span className={`font-bold ${daysToExpiry <= 7 ? 'text-red-400' : 'text-white'}`}>
                        {formatDateDDMMYYYY(profile.planExpiryDate)}
                     </span>
                   </div>
                   {daysToExpiry <= 7 && (
                      <div className="bg-red-500/20 border border-red-500/30 p-2 rounded text-xs text-red-200 flex gap-2 items-center">
                         <AlertCircle size={14} /> Expiring in {daysToExpiry} days.
                      </div>
                   )}
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => setIsRenewModalOpen(true)}
                    className="w-full bg-white text-slate-900 font-bold py-2.5 rounded-xl hover:bg-slate-100 transition-colors shadow-lg"
                  >
                    Renew Subscription
                  </button>
                </div>
             </div>
          </div>

          {/* BILLING HISTORY CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                <Receipt size={18} className="text-slate-500" />
                <h3 className="font-bold text-slate-800">Billing History</h3>
             </div>
             <div className="max-h-60 overflow-y-auto">
                {sortedHistory.length === 0 ? (
                   <div className="p-6 text-center text-slate-400 text-sm italic">
                      No payment history available.
                   </div>
                ) : (
                   <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/50 text-slate-500 text-xs uppercase font-bold sticky top-0 backdrop-blur-sm">
                         <tr>
                            <th className="px-4 py-2 font-bold">Details</th>
                            <th className="px-4 py-2 text-right font-bold">Amount</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {sortedHistory.map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                               <td className="px-4 py-3 text-slate-600">
                                  <div className="font-bold text-slate-900 text-sm">{item.planName}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                     {formatDateDDMMYYYY(item.date)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {item.paymentId || 'N/A'}</div>
                               </td>
                               <td className="px-4 py-3 text-right">
                                  <div className="font-bold text-slate-900">₹{getAmountInRupees(item).toLocaleString('en-IN')}</div>
                                  <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider inline-block mt-1">
                                     Paid
                                  </span>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                )}
             </div>
          </div>

          {/* Upgrade / Marketing Upsell */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-6">
             <h4 className="font-bold text-violet-900 mb-2">Need a Website?</h4>
             <p className="text-violet-700 text-sm mb-4">Cosvyn can build a high-converting website for your kitchen.</p>
             <a href="https://cosvyn.space" target="_blank" rel="noreferrer" className="block w-full text-center bg-violet-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors">
                Explore Services
             </a>
          </div>

        </div>

      </div>

      {/* MARKETING SLIDES / MORE SERVICES */}
      <div className="pt-8 border-t border-slate-200">
         <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Rocket className="text-primary-600" /> Grow with Cosvyn
         </h2>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-48">
            <ServiceCard 
               title="Website Building" 
               desc="Get a custom, SEO-optimized landing page for your meal prep brand."
               icon={Monitor}
            />
            <ServiceCard 
               title="Digital Marketing" 
               desc="Run targeted Ads on Instagram & Facebook to get more subscribers."
               icon={Globe}
            />
            <ServiceCard 
               title="Branding & Design" 
               desc="Logo, menu design, and packaging assets that stand out."
               icon={LayoutTemplate}
            />
         </div>
      </div>

      {/* RENEWAL MODAL */}
      {isRenewModalOpen && (
        <RenewSaaSModal 
          profile={profile}
          onClose={() => setIsRenewModalOpen(false)} 
          onSuccess={handleRenewalSuccess}
        />
      )}

    </div>
  );
};

const RenewSaaSModal = ({ profile, onClose, onSuccess }: any) => {
  const { plans, offer, loading } = useGlobalPricing();
  const [selectedPlanId, setSelectedPlanId] = useState('Yearly');
  const [processing, setProcessing] = useState(false);
  
  // Set default selection
  useEffect(() => {
     if(!loading && plans.length) {
        setSelectedPlanId(plans.find(p => p.isBestValue)?.id || plans[0].id);
     }
  }, [loading, plans]);

  if (loading) return null;

  const isOfferActive = offer.isActive && new Date() < new Date(offer.endsAt);
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const effectivePrice = selectedPlan ? calculateEffectivePrice(selectedPlan.price, offer) : 0;

  const { currentUser } = useAuth();

  const initiatePayment = () => {
     if(!selectedPlan) return;
     setProcessing(true);
     
     handleRazorpayPayment({
        planId: selectedPlan.id,
        planName: selectedPlan.label,
        amount: effectivePrice,
        durationMonths: selectedPlan.durationMonths,
        userId: currentUser?.uid || profile?.id || '',
        userEmail: profile.email || currentUser?.email || '',
        userContact: profile.mobile || '',
        businessName: profile.businessName || 'Business Owner',
        onSuccess: (result: any) => {
           setProcessing(false);
           onSuccess(result.paymentId, selectedPlan.durationMonths, selectedPlan.label, result);
        },
        onFailure: (err: any) => {
           console.log("Renewal Cancelled/Failed", err);
           setProcessing(false);
           if (err && err.message && !err.message.includes('cancelled') && !err.message.includes('dismissed')) {
             alert(err.message || 'Payment could not be completed.');
           }
        }
     });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in zoom-in-95">
       <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <div className="flex items-center gap-2">
               <Zap className="text-primary-600" size={20} fill="currentColor" />
               <h3 className="font-bold text-xl text-slate-900">Renew Subscription</h3>
             </div>
             <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
          </div>
          
          <div className="p-6">
             <div className="mb-6 text-center">
                <p className="text-slate-500 mb-2">Extend your subscription to keep your business running smoothly.</p>
                {isOfferActive && (
                  <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-xs font-bold border border-green-200">
                     <Tag size={12}/> {offer.title} Applied!
                  </div>
                )}
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {plans.map(plan => {
                   const price = calculateEffectivePrice(plan.price, offer);
                   const isSelected = selectedPlanId === plan.id;
                   
                   return (
                      <div 
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                           isSelected 
                             ? 'border-primary-500 bg-primary-50/50 relative shadow-sm' 
                             : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                         {isSelected && <div className="absolute top-2 right-2 text-primary-600"><CheckCircle size={16}/></div>}
                         <div className="text-sm font-bold text-slate-900 mb-1">{plan.label}</div>
                         <div className="text-2xl font-extrabold text-slate-900 mb-1">₹{price.toLocaleString()}</div>
                         <div className="text-xs text-slate-500">{plan.durationMonths === 12 ? '/year' : plan.durationMonths === 1 ? '/month' : `/${plan.durationMonths}mo`}</div>
                      </div>
                   )
                })}
             </div>

             <button 
               onClick={initiatePayment}
               disabled={processing}
               className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
             >
                {processing ? <Loader2 className="animate-spin"/> : <><Shield size={20} className="text-green-400"/> Pay & Renew</>}
             </button>
             
             <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
                <Lock size={10}/> Secured by Razorpay
             </p>
          </div>
       </div>
    </div>
  );
};

export default Profile;
