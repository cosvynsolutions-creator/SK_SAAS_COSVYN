import React, { useState, useMemo } from 'react';
import { 
  Send, Users, ShieldCheck, Clock, Trash2, Loader2, Search, Info, AlertTriangle, 
  CheckCircle2, UserCheck, UserX, Check, Rocket, Sparkles, Eye, ArrowRight, X, 
  ExternalLink, MessageSquare, Mail, History, ChevronRight, Filter
} from 'lucide-react';
import { useAdminTenants, useGlobalCollection, addGlobalItem } from '../../services/dbService';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { WhatsAppOutreach } from '../../components/admin/WhatsAppOutreach';
import { EmailOutreach } from '../../components/admin/EmailOutreach';
import { formatDateDDMMYYYY } from '../../services/store';

const AdminMessages = () => {
  const { currentUser } = useAuth();
  const { tenants, loading: tenantsLoading } = useAdminTenants();
  const { data: messages, loading: messagesLoading } = useGlobalCollection('admin_messages');

  // Active Tab: 'whatsapp' | 'email' | 'in_app' | 'history'
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'in_app' | 'history'>('whatsapp');

  // Existing In-App Broadcast & Feature Pop-up Form Data
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetType: 'ALL' as 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SPECIFIC',
    recipientIds: [] as string[],
    priority: 'info' as 'info' | 'warning' | 'urgent',
    // Feature Announcement Pop-up Fields
    isFeaturePopup: false,
    featureTag: 'Release v2.0',
    actionUrl: '/app/analytics',
    actionText: 'Explore Feature Now',
    highlightsText: 'KRI Early Warning Radar (7-Day Churn Risk Alert)\nUnit Economics per Meal Box & Net Margin Tracking\nDelivery Area Cluster Density Intelligence\nReusable Dabba Shrinkage Risk & Capital Loss'
  });
  
  const [sending, setSending] = useState(false);
  const [searchTenant, setSearchTenant] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedPreviewMessage, setSelectedPreviewMessage] = useState<any | null>(null);

  const targetedTenants = useMemo(() => {
    if (formData.targetType === 'ALL') return tenants;
    if (formData.targetType === 'ACTIVE') return tenants.filter(t => t.planStatus === 'Active');
    if (formData.targetType === 'INACTIVE') return tenants.filter(t => t.planStatus !== 'Active');
    if (formData.targetType === 'SPECIFIC') {
      return tenants.filter(t => formData.recipientIds.includes(t.id));
    }
    return [];
  }, [tenants, formData.targetType, formData.recipientIds]);

  const pickerTenants = useMemo(() => {
    return tenants.filter(t => 
      (t.businessName || '').toLowerCase().includes(searchTenant.toLowerCase()) ||
      (t.ownerName || '').toLowerCase().includes(searchTenant.toLowerCase())
    );
  }, [tenants, searchTenant]);

  const toggleRecipient = (id: string) => {
    setFormData(prev => ({
      ...prev,
      recipientIds: prev.recipientIds.includes(id) 
        ? prev.recipientIds.filter(rid => rid !== id) 
        : [...prev.recipientIds, id]
    }));
  };

  const loadAnalyticsTemplate = () => {
    setFormData(prev => ({
      ...prev,
      isFeaturePopup: true,
      title: 'New: Advanced Analytics, KPIs & Risk Intelligence! 🚀',
      content: 'We have upgraded your Analytics dashboard with real-time Unit Economics, predictive 7-Day Churn Risk radar, Food Cost (COGS) tracking, and Delivery Area density insights to help you scale kitchen margins.',
      featureTag: 'Analytics v2.0',
      actionUrl: '/app/analytics',
      actionText: 'Explore Analytics Now',
      highlightsText: 'KRI Early Warning Radar: Churn & pause alerts\nUnit Economics: Profit & cost per meal box\nCluster Density: Delivery area concentration ranking\nContainer Shrinkage: Real-time box capital loss',
      priority: 'info',
      targetType: 'ALL'
    }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Initiating broadcast deployment for:", currentUser?.email);
    
    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Please enter a title and message content.");
      return;
    }

    if (formData.targetType === 'SPECIFIC' && formData.recipientIds.length === 0) {
      alert("Please select at least one recipient business.");
      return;
    }

    setSending(true);
    try {
      // Parse highlights text into structured cards if in feature popup mode
      const parsedHighlights = formData.isFeaturePopup
        ? formData.highlightsText
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
              const parts = line.split(':');
              return {
                title: parts[0]?.trim() || 'Feature Highlight',
                desc: parts[1]?.trim() || line,
                icon: 'Sparkles'
              };
            })
        : [];

      // Clean structure for Firestore
      const messagePayload: any = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        channel: 'in_app',
        targetType: formData.targetType,
        recipientIds: formData.targetType === 'SPECIFIC' ? formData.recipientIds : [],
        priority: formData.priority,
        sentAt: new Date().toISOString(),
        createdBy: currentUser?.email || 'Admin',
        isFeaturePopup: formData.isFeaturePopup,
        featureTag: formData.featureTag.trim() || 'New Update',
        actionUrl: formData.actionUrl.trim() || '/app/analytics',
        actionText: formData.actionText.trim() || 'Explore Now',
        highlights: parsedHighlights
      };

      // Add to global collection
      await addGlobalItem('admin_messages', messagePayload);
      
      console.log("Broadcast successfully stored in database.");
      
      setFormData({
        title: '',
        content: '',
        targetType: 'ALL',
        recipientIds: [],
        priority: 'info',
        isFeaturePopup: false,
        featureTag: 'Release v2.0',
        actionUrl: '/app/analytics',
        actionText: 'Explore Feature Now',
        highlightsText: ''
      });
      setSearchTenant('');
      alert(formData.isFeaturePopup 
        ? "Feature Release Pop-up successfully deployed! Business owners will see it on their next login." 
        : "Broadcast deployed successfully!"
      );
    } catch (err: any) {
      console.error("Critical Deployment Error Detail:", err);
      
      if (err.code === 'permission-denied') {
        alert(
          `Security Rejection: Permission Denied.\n\nLogged-in Email: ${currentUser?.email}\n\nACTION REQUIRED:\n1. Your email MUST BE an authorized Super Admin account.\n2. Log out and back in to refresh token claims.`
        );
      } else {
        alert(`Deployment failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this broadcast from history?")) return;
    try {
      await deleteDoc(doc(db, 'admin_messages', id));
    } catch (err: any) {
      console.error("Delete error:", err);
      alert("Failed to delete log: " + err.message);
    }
  };

  if (tenantsLoading || messagesLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      
      {/* TOP COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500/20 via-primary-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-lg">
            <Send size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-white tracking-tight">Admin Outreach & Broadcast Hub</h2>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100% Free Tools
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Send bulk WhatsApp messages, free bulk emails with images & links, or deploy in-app feature announcements.
            </p>
          </div>
        </div>

        {/* TOP TAB NAVIGATOR */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-stretch lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare size={15} />
            <span>Bulk WhatsApp</span>
            <span className="text-[9px] bg-emerald-950 text-emerald-200 px-1.5 py-0.2 rounded font-mono font-bold">FREE</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'email'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail size={15} />
            <span>Bulk Email</span>
            <span className="text-[9px] bg-violet-950 text-violet-200 px-1.5 py-0.2 rounded font-mono font-bold">FREE</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('in_app')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'in_app'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket size={15} />
            <span>In-App Pop-up</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History size={15} />
            <span>Logs ({messages.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BULK WHATSAPP (100% FREE) */}
      {activeTab === 'whatsapp' && (
        <WhatsAppOutreach 
          tenants={tenants} 
          currentUserEmail={currentUser?.email}
          onCampaignLogged={() => setActiveTab('history')}
        />
      )}

      {/* TAB 2: BULK EMAIL (100% FREE) */}
      {activeTab === 'email' && (
        <EmailOutreach 
          tenants={tenants} 
          currentUserEmail={currentUser?.email}
          onCampaignLogged={() => setActiveTab('history')}
        />
      )}

      {/* TAB 3: IN-APP POP-UP & NOTICE (EXISTING BROADCAST BUILDER) */}
      {activeTab === 'in_app' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* LEFT: FORM BUILDER */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-7 sm:p-8 shadow-2xl backdrop-blur-sm">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400">
                    <Rocket size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Deploy In-App Broadcast & What's New Pop-up</h3>
                    <p className="text-xs text-slate-400 font-medium">Delivers an interactive popup or notification bell alert to kitchen dashboards</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={loadAnalyticsTemplate}
                  className="px-4 py-2 bg-gradient-to-r from-primary-600/30 to-cyan-600/30 hover:from-primary-600/40 hover:to-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs"
                >
                  <Sparkles size={14} />
                  Load Analytics v2 Template
                </button>
              </div>

              <form onSubmit={handleSend} className="space-y-8">
                
                {/* ANNOUNCEMENT MODE TOGGLE */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
                    Announcement Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-2 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, isFeaturePopup: false }))}
                      className={`py-3.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 ${
                        !formData.isFeaturePopup 
                          ? 'bg-slate-800 text-white shadow-md' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Info size={16} className={!formData.isFeaturePopup ? 'text-cyan-400' : ''} />
                      <span>Standard Notification Broadcast</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, isFeaturePopup: true }))}
                      className={`py-3.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 ${
                        formData.isFeaturePopup 
                          ? 'bg-gradient-to-r from-primary-600 to-cyan-600 text-white shadow-lg shadow-cyan-900/30' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Rocket size={16} className="text-amber-300" />
                      <span>🚀 Feature Release Pop-up (What's New Modal)</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 ml-1">
                    {formData.isFeaturePopup 
                      ? '✨ Feature Release mode displays an interactive pop-up modal the first time business owners open the SaaS, encouraging high adoption.' 
                      : 'Delivers a notification to the in-app bell and message center.'}
                  </p>
                </div>

                {/* MESSAGE TARGET */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Recipient Target</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                    {[
                      { id: 'ALL', label: 'All Users' },
                      { id: 'ACTIVE', label: 'Active Only' },
                      { id: 'INACTIVE', label: 'Inactive / Trial' },
                      { id: 'SPECIFIC', label: 'Specific Selected' }
                    ].map(opt => (
                      <button 
                        key={opt.id}
                        type="button"
                        onClick={() => setFormData({...formData, targetType: opt.id as any, recipientIds: []})}
                        className={`py-3 px-1 rounded-xl text-[10px] font-black uppercase transition-all ${
                          formData.targetType === opt.id 
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FORM FIELDS & USER PICKER */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    
                    {/* Priority */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Priority Level</label>
                      <div className="flex gap-6">
                        {['info', 'warning', 'urgent'].map(p => (
                          <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                            <input 
                              type="radio" 
                              name="priority" 
                              className="hidden" 
                              checked={formData.priority === p} 
                              onChange={() => setFormData({...formData, priority: p as any})} 
                            />
                            <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                              formData.priority === p 
                                ? (p === 'info' ? 'bg-cyan-500 border-cyan-500' : p === 'warning' ? 'bg-amber-500 border-amber-500' : 'bg-red-500 border-red-500 scale-110 shadow-lg')
                                : 'border-slate-700 bg-transparent'
                            }`}>
                              {formData.priority === p && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${formData.priority === p ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Announcement Title</label>
                      <input 
                        required
                        placeholder="e.g. New: Advanced Analytics, KPIs & Risk Intelligence! 🚀"
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-cyan-500 outline-none transition-all placeholder:text-slate-700"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                      />
                    </div>

                    {/* Message Content */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Overview Description</label>
                      <textarea 
                        required
                        rows={formData.isFeaturePopup ? 4 : 7}
                        placeholder="Describe the new feature or update value for business owners..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-cyan-500 outline-none transition-all resize-none placeholder:text-slate-700 leading-relaxed"
                        value={formData.content}
                        onChange={e => setFormData({...formData, content: e.target.value})}
                      />
                    </div>

                    {/* EXTRA FEATURE RELEASE POP-UP CONFIGURATION */}
                    {formData.isFeaturePopup && (
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                          <Rocket size={14} /> Pop-Up Interactive Settings
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Badge Tag</label>
                            <input 
                              placeholder="e.g. Analytics v2.0"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 outline-none font-mono"
                              value={formData.featureTag}
                              onChange={e => setFormData({...formData, featureTag: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Target Route</label>
                            <input 
                              placeholder="e.g. /app/analytics"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 outline-none font-mono"
                              value={formData.actionUrl}
                              onChange={e => setFormData({...formData, actionUrl: e.target.value})}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Action Button Text</label>
                          <input 
                            placeholder="e.g. Explore Analytics Now"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 outline-none"
                            value={formData.actionText}
                            onChange={e => setFormData({...formData, actionText: e.target.value})}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Key Highlights (1 per line)</label>
                          <textarea 
                            rows={3}
                            placeholder="Title: Short description of the feature benefit..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 outline-none resize-none placeholder:text-slate-700 leading-relaxed font-mono"
                            value={formData.highlightsText}
                            onChange={e => setFormData({...formData, highlightsText: e.target.value})}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RECIPIENT PREVIEW & PICKER */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[520px]">
                    <div className="p-5 border-b border-slate-800 bg-slate-950/80">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          {formData.targetType === 'SPECIFIC' ? 'Select Recipients' : 'Audience Reach'}
                        </h3>
                        <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-black px-2.5 py-1 rounded-full border border-cyan-500/20">
                          {targetedTenants.length} Business Owners
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-600" size={14} />
                        <input 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-[11px] text-slate-200 focus:border-cyan-500 outline-none placeholder:text-slate-600"
                          placeholder="Search users..."
                          value={searchTenant}
                          onChange={e => setSearchTenant(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 no-scrollbar divide-y divide-slate-800/50">
                      {(formData.targetType === 'SPECIFIC' ? pickerTenants : targetedTenants).map(t => {
                        const isSelected = formData.recipientIds.includes(t.id);
                        const isFilteredOut = searchTenant && 
                          !(t.businessName || '').toLowerCase().includes(searchTenant.toLowerCase()) && 
                          !(t.ownerName || '').toLowerCase().includes(searchTenant.toLowerCase());
                        
                        if (isFilteredOut && formData.targetType !== 'SPECIFIC') return null;

                        return (
                          <div 
                            key={t.id} 
                            onClick={() => formData.targetType === 'SPECIFIC' && toggleRecipient(t.id)}
                            className={`p-3 flex items-center justify-between transition-colors ${
                              formData.targetType === 'SPECIFIC' ? 'cursor-pointer hover:bg-slate-900/50' : ''
                            } ${isSelected && formData.targetType === 'SPECIFIC' ? 'bg-cyan-500/5' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${
                                t.planStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'
                              }`}>
                                {t.businessName?.charAt(0) || 'B'}
                              </div>
                              <div>
                                <p className="text-[11px] font-bold text-slate-200">{t.businessName || 'Unnamed'}</p>
                                <p className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">{t.ownerName || 'Unknown Owner'}</p>
                              </div>
                            </div>
                            {formData.targetType === 'SPECIFIC' ? (
                              <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                                isSelected ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-800'
                              }`}>
                                {isSelected && <Check size={12} strokeWidth={4} />}
                              </div>
                            ) : (
                              <div className="text-[9px] font-black uppercase text-slate-700">Recipient</div>
                            )}
                          </div>
                        );
                      })}
                      {pickerTenants.length === 0 && <p className="p-10 text-center text-[10px] text-slate-600 font-black uppercase italic">No users found</p>}
                    </div>
                  </div>
                </div>

                {/* BUTTON ROW */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  {formData.isFeaturePopup && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPreviewMessage({
                          title: formData.title || 'Feature Title Preview',
                          content: formData.content || 'Feature description overview...',
                          featureTag: formData.featureTag || 'Update v2.0',
                          actionText: formData.actionText || 'Explore Feature',
                          actionUrl: formData.actionUrl || '/app/analytics',
                          highlights: (formData.highlightsText || '')
                            .split('\n')
                            .filter(Boolean)
                            .map(l => {
                              const [t, ...rest] = l.split(':');
                              return { title: t.trim(), desc: rest.join(':').trim() || t.trim() };
                            })
                        });
                        setPreviewModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <Eye size={16} />
                      <span>Preview Pop-Up Modal</span>
                    </button>
                  )}

                  <button 
                    disabled={sending}
                    type="submit"
                    className="w-full sm:flex-1 py-4 bg-gradient-to-r from-cyan-500 via-primary-600 to-indigo-600 hover:from-cyan-400 hover:via-primary-500 hover:to-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-cyan-900/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    <span>{formData.isFeaturePopup ? 'Deploy Release Pop-up to Users' : 'Send Standard Broadcast'}</span>
                  </button>
                </div>

              </form>

            </div>
          </div>

          {/* RIGHT: RECENT LOGS SUMMARY */}
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} className="text-cyan-500" /> Recent Deployments
              </h3>
              <span className="text-[10px] font-bold text-slate-600 uppercase">{messages.length} total</span>
            </div>

            <div className="space-y-3 max-h-[700px] overflow-y-auto no-scrollbar">
              {messages.slice(0, 5).map(msg => (
                <div key={msg.id} className="bg-slate-900 border border-slate-800/80 p-5 rounded-3xl space-y-3 group hover:border-slate-700 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        msg.isFeaturePopup ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' :
                        msg.priority === 'urgent' ? 'bg-red-500/10 text-red-400' :
                        msg.priority === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-cyan-500/10 text-cyan-400'
                      }`}>
                        {msg.isFeaturePopup ? <Rocket size={15} /> : <Info size={15} />}
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-xs leading-snug">{msg.title}</h4>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {formatDateDDMMYYYY(msg.sentAt)}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDelete(msg.id)}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                      title="Delete log"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              ))}

              {messages.length === 0 && (
                <div className="py-12 text-center text-slate-600 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
                  <p className="text-xs">No broadcast history found</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: COMPREHENSIVE OUTREACH LOGS & HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-5 border-b border-slate-800">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <History size={20} className="text-cyan-400" />
                <span>Outreach & Broadcast Campaign History</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Audit trail of all WhatsApp dispatches, Email broadcasts, and In-App announcements.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              Total Recorded: <strong className="text-white">{messages.length}</strong>
            </span>
          </div>

          <div className="space-y-4">
            {messages.map(msg => {
              const isWa = msg.channel === 'whatsapp';
              const isEmail = msg.channel === 'email';
              const isPopup = msg.isFeaturePopup;

              return (
                <div 
                  key={msg.id}
                  className="bg-slate-950 border border-slate-800/80 rounded-3xl p-5 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                        isWa ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        isEmail ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' :
                        isPopup ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {isWa ? <MessageSquare size={18} /> : isEmail ? <Mail size={18} /> : isPopup ? <Rocket size={18} /> : <Info size={18} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-white font-bold text-sm">{msg.title}</h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isWa ? 'bg-emerald-500/20 text-emerald-300' :
                            isEmail ? 'bg-violet-500/20 text-violet-300' :
                            isPopup ? 'bg-cyan-500/20 text-cyan-300' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {isWa ? 'WhatsApp Bulk' : isEmail ? 'Bulk Email' : isPopup ? 'Feature Pop-up' : 'In-App Notice'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Sent: {formatDateDDMMYYYY(msg.sentAt)} {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Target: <span className="text-slate-300 font-bold">{msg.targetType || 'ALL'}</span>
                          {msg.recipientCount != null && ` (${msg.recipientCount} clients)`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isPopup && (
                        <button
                          onClick={() => { setSelectedPreviewMessage(msg); setPreviewModalOpen(true); }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Eye size={13} />
                          <span>View Modal</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete campaign log"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-900 whitespace-pre-wrap font-sans">
                    {msg.content}
                  </p>

                  {msg.actionLink && (
                    <div className="flex items-center gap-2 text-[11px] text-cyan-400 font-mono">
                      <ExternalLink size={12} />
                      <a href={msg.actionLink} target="_blank" rel="noreferrer" className="hover:underline truncate max-w-md">
                        {msg.actionLink}
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            {messages.length === 0 && (
              <div className="py-20 text-center text-slate-600 bg-slate-950 rounded-3xl border border-dashed border-slate-800">
                <History size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-wider">No campaign logs recorded yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIVE PREVIEW MODAL FOR IN-APP POPUP */}
      {previewModalOpen && selectedPreviewMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white overflow-hidden shrink-0">
              <button 
                onClick={() => setPreviewModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full"
              >
                <X size={18} />
              </button>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 border border-primary-400/30 text-xs font-bold uppercase tracking-wider">
                  <Rocket size={13} className="text-primary-400" />
                  <span>{selectedPreviewMessage.featureTag || 'Preview Tag'}</span>
                </div>
                <h2 className="text-2xl font-black font-display text-white">{selectedPreviewMessage.title}</h2>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedPreviewMessage.content}</p>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 bg-slate-50/50">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">What's New for Your Kitchen</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(selectedPreviewMessage.highlights || []).map((h: any, i: number) => (
                  <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-xl shrink-0"><Sparkles size={16} className="text-primary-500" /></div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{h.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-snug">{h.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center">
              <button 
                onClick={() => setPreviewModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Close Preview
              </button>
              <button 
                onClick={() => setPreviewModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-primary-600/30"
              >
                <span>{selectedPreviewMessage.actionText || 'Try It Out'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminMessages;