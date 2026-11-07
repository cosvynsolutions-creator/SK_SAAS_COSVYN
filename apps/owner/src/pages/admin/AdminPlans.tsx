import React, { useState, useEffect } from 'react';
import { Save, Tag, Clock, DollarSign, Check, Percent, AlertCircle, Loader2, Plus, Trash2, Sparkles, Calendar } from 'lucide-react';
import { SaasPlan, SpecialOffer } from '../../services/saasStore';
import { useGlobalPricing, saveGlobalPricing } from '../../services/dbService';

const AdminPlans = () => {
  // Use the hook to fetch real data directly from Firestore (global_settings/saas_config)
  const { plans: fetchedPlans, offer: fetchedOffer, loading } = useGlobalPricing();
  
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [offer, setOffer] = useState<SpecialOffer | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when data is loaded from Firestore
  useEffect(() => {
    if (!loading) {
      setPlans(fetchedPlans);
      setOffer(fetchedOffer);
    }
  }, [loading, fetchedPlans, fetchedOffer]);

  const handleUpdatePlan = (id: string, field: keyof SaasPlan, value: any) => {
    setPlans(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      // If setting isBestValue to true on this plan, unset it on others
      if (field === 'isBestValue' && value === true) {
        return { ...p, isBestValue: false };
      }
      return p;
    }));
  };

  const handleAddNewPlan = () => {
    const newId = `plan_${Date.now()}`;
    const newPlan: SaasPlan = {
      id: newId,
      label: '8 Months',
      price: 8999,
      durationMonths: 8,
      description: 'Special 8 months tier. Save more.',
      isBestValue: false
    };
    setPlans(prev => [...prev, newPlan]);
  };

  const handleDeletePlan = (id: string) => {
    if (plans.length <= 1) {
      alert("At least one plan must remain active.");
      return;
    }
    if (confirm("Are you sure you want to remove this plan tier?")) {
      setPlans(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleSave = async () => {
    if (!offer) return;
    setIsSaving(true);
    try {
      await saveGlobalPricing(plans, offer);
      setIsSaving(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
      setIsSaving(false);
      console.error("Error saving plans:", e);
      alert("Failed to save changes to Firestore.");
    }
  };

  if (loading || !offer) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            Plans & Special Offers
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Live Real-Time Database Sync
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Prices and plans configured here update the Landing Page, the Business Owner Renew modal, and Razorpay Checkout in real time.
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : isSaved ? <Check size={18} /> : <Save size={18} />}
          <span>{isSaving ? 'Publishing...' : isSaved ? 'Published Live!' : 'Publish Changes'}</span>
        </button>
      </div>

      {/* Info Callout */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
        <Sparkles size={18} className="text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white font-semibold">100% Real-Time Alignment:</strong> Whenever you change any plan price (e.g. ₹8,999) or duration (e.g. 8 months), clicking <em>Publish Changes</em> writes it directly to Firestore (<code className="text-cyan-300">global_settings/saas_config</code>). The exact same amount appears on the public Landing Page, the Business Owner Profile Renew modal, and the official Razorpay Checkout pop-up window.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* LEFT: PRICING CONFIG */}
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400"><DollarSign size={20} /></div>
              <h2 className="text-xl font-bold text-white">Subscription Tiers</h2>
            </div>
            <button
              type="button"
              onClick={handleAddNewPlan}
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20 transition-colors"
            >
              <Plus size={14} /> Add New Tier
            </button>
          </div>

          <div className="space-y-5">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm hover:border-slate-700 transition-colors space-y-4">
                
                {/* Row 1: Plan Title and Best Value Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Plan Name / Label</label>
                    <input 
                      type="text"
                      value={plan.label}
                      onChange={(e) => handleUpdatePlan(plan.id, 'label', e.target.value)}
                      placeholder="e.g. 8 Months, Monthly, Yearly"
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-cyan-500 font-bold text-sm"
                    />
                  </div>
                  
                  <div className="pt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdatePlan(plan.id, 'isBestValue', !plan.isBestValue)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                        plan.isBestValue 
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' 
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {plan.isBestValue ? '★ Best Value' : 'Mark as Best Value'}
                    </button>
                    {plans.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(plan.id)}
                        className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete Plan"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Price and Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Total Price (₹)</label>
                    <input 
                      type="number"
                      value={plan.price}
                      onChange={(e) => handleUpdatePlan(plan.id, 'price', parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-cyan-500 font-mono text-base font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Duration (Months)</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-3 text-slate-500" />
                      <input 
                        type="number"
                        min="1"
                        max="60"
                        value={plan.durationMonths || 1}
                        onChange={(e) => handleUpdatePlan(plan.id, 'durationMonths', parseInt(e.target.value) || 1)}
                        className="w-full pl-8 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-cyan-500 font-mono text-base font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Description */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Description / Subtext</label>
                  <input 
                    type="text"
                    value={plan.description || ''}
                    onChange={(e) => handleUpdatePlan(plan.id, 'description', e.target.value)}
                    placeholder="e.g. Save ~15% vs monthly"
                    className="w-full bg-slate-950 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 outline-none focus:border-cyan-500 text-xs"
                  />
                </div>

                {/* Summary calculation */}
                <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Effective Monthly Rate:</span>
                  <span className="font-bold text-white font-mono">
                    ₹{Math.round((plan.price || 0) / (plan.durationMonths || 1)).toLocaleString()} / mo
                  </span>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: SPECIAL OFFER CONFIG */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400"><Tag size={20} /></div>
            <h2 className="text-xl font-bold text-white">Global Promotional Campaign</h2>
          </div>

          <div className={`bg-slate-900/70 border rounded-2xl p-6 backdrop-blur-sm transition-all ${offer.isActive ? 'border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.1)]' : 'border-slate-800'}`}>
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <span className="text-slate-200 font-semibold text-sm block">Active Campaign Status</span>
                <span className="text-xs text-slate-400">Apply automatic discount across all subscription plans</span>
              </div>
              <button 
                onClick={() => setOffer({...offer, isActive: !offer.isActive})}
                className={`w-14 h-8 rounded-full p-1 transition-colors ${offer.isActive ? 'bg-violet-600' : 'bg-slate-700'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full transition-transform ${offer.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className={`space-y-5 transition-opacity ${offer.isActive ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div>
                <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Campaign Title</label>
                <input 
                  type="text"
                  value={offer.title}
                  onChange={(e) => setOffer({...offer, title: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-violet-500 text-sm"
                  placeholder="e.g. Special Founder Discount"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Discount %</label>
                  <div className="relative">
                    <Percent size={16} className="absolute left-3 top-3 text-slate-500" />
                    <input 
                      type="number"
                      min="1"
                      max="90"
                      value={offer.discountPercent}
                      onChange={(e) => setOffer({...offer, discountPercent: parseInt(e.target.value) || 0})}
                      className="w-full pl-9 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-violet-500 font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Offer Ends At</label>
                  <input 
                    type="datetime-local"
                    value={offer.endsAt ? offer.endsAt.slice(0, 16) : ''} 
                    onChange={(e) => setOffer({...offer, endsAt: new Date(e.target.value).toISOString()})}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-violet-500 text-sm"
                  />
                </div>
              </div>

              {/* Preview Box */}
              <div className="bg-violet-900/20 border border-violet-500/20 p-4 rounded-xl flex items-start gap-3">
                <Clock className="text-violet-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-violet-200 font-bold text-sm">Banner Preview in App</p>
                  <p className="text-violet-300/80 text-xs mt-1">
                    "{offer.title} - Get {offer.discountPercent}% OFF!"
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPlans;
