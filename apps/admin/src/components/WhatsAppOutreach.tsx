import React, { useState, useMemo, useEffect } from 'react';
import { 
  MessageSquare, Send, Users, Sparkles, Image as ImageIcon, Link as LinkIcon, 
  ExternalLink, Copy, Check, Download, AlertTriangle, CheckCircle2, Play, 
  SkipForward, RotateCcw, Smartphone, Laptop, Filter, Search, ShieldCheck,
  ChevronRight, ArrowRight, Clock, Eye
} from 'lucide-react';
import { 
  cleanWhatsAppNumber, replacePlaceholders, copyImageToClipboard, exportWhatsAppCsv 
} from './outreachUtils';
import { addGlobalItem } from '../services/adminDbService';

interface WhatsAppOutreachProps {
  tenants: any[];
  currentUserEmail?: string;
  onCampaignLogged?: () => void;
}

const PRESET_TEMPLATES = [
  {
    id: 'feature_release',
    name: '🚀 New Feature: Analytics v2.0 & Risk Radar',
    title: 'Analytics v2.0 Platform Release',
    link: window.location.origin + '/#/app/analytics',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    message: `Hello {{ownerName}}! 👋\n\nExciting news for *{{businessName}}* from ScaleKitchen! 🚀\n\nWe have just released the brand-new *Analytics & Risk Intelligence v2.0* update:\n\n✨ *KRI Early Warning Radar:* 7-day predictive churn & renewal alerts\n✨ *Unit Economics Engine:* Real-time profit & cost breakdown per meal box\n✨ *Delivery Cluster Density:* Identify top neighborhood delivery hubs\n✨ *Reusable Dabba Shrinkage:* Track unreturned container capital loss\n\n👉 *Explore your live numbers now:*\n{{link}}\n\nLet us know if you need any assistance scaling your kitchen today! 🙌`
  },
  {
    id: 'renewal_reminder',
    name: '⏰ Plan Renewal / Free Trial Expiry Notice',
    title: 'Subscription Expiry & Renewal Reminder',
    link: window.location.origin + '/#/onboarding',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
    message: `Hi {{ownerName}}, quick update from ScaleKitchen! ⏰\n\nYour *{{businessName}}* account plan (*{{planName}}*) has *{{daysLeft}} days remaining* (Valid till {{expiryDate}}).\n\nTo ensure your kitchen meal deliveries, driver route dispatch, and customer billing run without interruption, please renew your subscription:\n\n👉 *One-Click Instant Renewal:*\n{{link}}\n\nNeed help or custom credits? Reply directly to this message!`
  },
  {
    id: 'special_offer',
    name: '🎁 20% Off Seasonal Upgrade Promo',
    title: 'Exclusive 20% Upgrade Discount',
    link: window.location.origin + '/#/onboarding',
    imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80',
    message: `Special Festive Upgrade for {{businessName}}! 🎁✨\n\nHey {{ownerName}}, for the next 48 hours, enjoy an *exclusive 20% discount* on COSVYN ONE Semi-Annual and Annual plans.\n\nUse Code: *KITCHEN20* at checkout.\n\n👉 *Claim Your Offer Now:*\n{{link}}\n\nUnlock unlimited active meal subscribers, multi-driver live GPS route tracking, and custom invoice credits. Valid this week only!`
  },
  {
    id: 'kitchen_tip',
    name: '💡 Pro Tip: Stop Tiffin Dabba Loss',
    title: 'Kitchen Operations Tip & Shrinkage Control',
    link: window.location.origin + '/#/app/dashboard',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    message: `Hello {{ownerName}}! 💡 Kitchen Growth Tip for *{{businessName}}*:\n\nDid you know the average cloud kitchen loses ₹8,000 - ₹15,000 every month in uncollected steel dabbas and reusable meal containers?\n\nCheck your *ScaleKitchen Dabba Shrinkage Radar* under the Dashboard to see unreturned customer boxes and assign recovery tasks to your drivers with 1 tap.\n\n👉 *Review your container balance:*\n{{link}}\n\nKeep scaling with zero leakages!`
  },
  {
    id: 'feedback_checkin',
    name: '⭐ Customer Satisfaction & Review Check-In',
    title: 'Customer Satisfaction & Review Check-In',
    link: window.location.origin + '/#/app/support',
    imageUrl: '',
    message: `Hey {{ownerName}}, hope *{{businessName}}* is cooking great meals today! 🍲\n\nHow has your experience been using ScaleKitchen over the past week? Is there any specific feature or customization that would make your kitchen dispatch faster?\n\n👉 *Share feedback or talk with our team:*\n{{link}}\n\nWe are here to support your growth!`
  }
];

export const WhatsAppOutreach: React.FC<WhatsAppOutreachProps> = ({ 
  tenants, 
  currentUserEmail,
  onCampaignLogged 
}) => {
  // Target Audience Filter
  const [targetType, setTargetType] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'INACTIVE' | 'SPECIFIC'>('ALL');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Message Form State
  const [campaignTitle, setCampaignTitle] = useState('Analytics v2.0 Platform Release');
  const [messageTemplate, setMessageTemplate] = useState(PRESET_TEMPLATES[0].message);
  const [actionLink, setActionLink] = useState(PRESET_TEMPLATES[0].link);
  const [imageUrl, setImageUrl] = useState(PRESET_TEMPLATES[0].imageUrl);
  const [defaultCountryCode, setDefaultCountryCode] = useState('91');

  // Dispatch Runner State
  const [queueIndex, setQueueIndex] = useState(0);
  const [sentRecipientIds, setSentRecipientIds] = useState<Record<string, 'sent' | 'skipped'>>({});
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // UI helpers
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [imageCopyFeedback, setImageCopyFeedback] = useState<string | null>(null);
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Filter Tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      if (targetType === 'ALL') return true;
      if (targetType === 'ACTIVE') return t.planStatus === 'Active';
      if (targetType === 'EXPIRING') {
        const days = t.daysLeft != null ? Number(t.daysLeft) : 999;
        const isTrial = (t.planName || '').toLowerCase().includes('trial');
        return isTrial || (days <= 7 && days >= 0);
      }
      if (targetType === 'INACTIVE') return t.planStatus !== 'Active';
      if (targetType === 'SPECIFIC') return selectedRecipientIds.includes(t.id);
      return true;
    });
  }, [tenants, targetType, selectedRecipientIds]);

  // Search filtered
  const displayedTenants = useMemo(() => {
    if (!searchQuery.trim()) return filteredTenants;
    const q = searchQuery.toLowerCase();
    return filteredTenants.filter(t => 
      (t.businessName || '').toLowerCase().includes(q) ||
      (t.ownerName || '').toLowerCase().includes(q) ||
      (t.mobile || '').includes(q) ||
      (t.email || '').toLowerCase().includes(q)
    );
  }, [filteredTenants, searchQuery]);

  // Clients with valid mobile
  const validMobileCount = useMemo(() => {
    return filteredTenants.filter(t => Boolean(cleanWhatsAppNumber(t.mobile, defaultCountryCode))).length;
  }, [filteredTenants, defaultCountryCode]);

  // First client for preview
  const previewClient = filteredTenants[0] || {
    businessName: 'My Kitchen',
    ownerName: 'Chef Rahul',
    planName: 'COSVYN ONE',
    planExpiryDate: '2026-11-04',
    daysLeft: 24,
    mobile: '9876543210'
  };

  const previewRenderedMessage = useMemo(() => {
    return replacePlaceholders(messageTemplate, previewClient, {
      link: actionLink,
      imageUrl: imageUrl
    });
  }, [messageTemplate, previewClient, actionLink, imageUrl]);

  // Load Preset
  const handleLoadPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setCampaignTitle(preset.title);
    setMessageTemplate(preset.message);
    setActionLink(preset.link);
    setImageUrl(preset.imageUrl);
  };

  // Toggle selection for SPECIFIC
  const toggleSelectTenant = (id: string) => {
    setSelectedRecipientIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Current client in queue runner
  const currentQueueTenant = filteredTenants[queueIndex];
  const currentCleanPhone = currentQueueTenant ? cleanWhatsAppNumber(currentQueueTenant.mobile, defaultCountryCode) : '';
  const currentRenderedMessage = currentQueueTenant 
    ? replacePlaceholders(messageTemplate, currentQueueTenant, { link: actionLink, imageUrl: imageUrl })
    : '';

  // Open WhatsApp for single contact
  const openWhatsAppChat = (phone: string, text: string, useWeb = true) => {
    if (!phone) {
      alert("This client does not have a valid mobile number.");
      return;
    }
    const encoded = encodeURIComponent(text);
    const url = useWeb 
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`
      : `https://wa.me/${phone}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Queue runner handlers
  const handleMarkSent = () => {
    if (!currentQueueTenant) return;
    setSentRecipientIds(prev => ({ ...prev, [currentQueueTenant.id]: 'sent' }));
    if (queueIndex < filteredTenants.length - 1) {
      setQueueIndex(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    if (!currentQueueTenant) return;
    setSentRecipientIds(prev => ({ ...prev, [currentQueueTenant.id]: 'skipped' }));
    if (queueIndex < filteredTenants.length - 1) {
      setQueueIndex(prev => prev + 1);
    }
  };

  const handleResetQueue = () => {
    setQueueIndex(0);
    setSentRecipientIds({});
  };

  // Copy helpers
  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("Personalized message copied to clipboard!");
      setTimeout(() => setCopyFeedback(null), 3000);
    } catch {
      alert("Failed to copy message.");
    }
  };

  const handleCopyImage = async () => {
    if (!imageUrl) return;
    setImageCopyFeedback("Copying...");
    const res = await copyImageToClipboard(imageUrl);
    setImageCopyFeedback(res.message);
    setTimeout(() => setImageCopyFeedback(null), 4000);
  };

  // Insert placeholder token into textarea
  const insertToken = (token: string) => {
    setMessageTemplate(prev => prev + ` {{${token}}}`);
  };

  // Export CSV
  const handleExportCsv = () => {
    const items = filteredTenants.map(t => ({
      business: t.businessName || '',
      name: t.ownerName || '',
      phone: t.mobile || '',
      message: replacePlaceholders(messageTemplate, t, { link: actionLink, imageUrl })
    }));
    exportWhatsAppCsv(items);
  };

  // Copy all clean phone numbers
  const handleCopyAllPhones = async () => {
    const phones = filteredTenants
      .map(t => cleanWhatsAppNumber(t.mobile, defaultCountryCode))
      .filter(Boolean);
    if (phones.length === 0) {
      alert("No valid phone numbers found in current filter.");
      return;
    }
    await navigator.clipboard.writeText(phones.join(', '));
    alert(`Copied ${phones.length} WhatsApp numbers to clipboard!`);
  };

  // Save campaign log to Firestore
  const handleSaveCampaignLog = async () => {
    if (!campaignTitle.trim()) {
      alert("Please provide a campaign title.");
      return;
    }
    setIsSavingLog(true);
    try {
      await addGlobalItem('admin_messages', {
        title: `[WhatsApp] ${campaignTitle.trim()}`,
        content: messageTemplate,
        channel: 'whatsapp',
        isExternalCampaign: true,
        targetType: targetType,
        recipientCount: filteredTenants.length,
        validMobileCount: validMobileCount,
        actionLink: actionLink || '',
        imageUrl: imageUrl || '',
        sentAt: new Date().toISOString(),
        createdBy: currentUserEmail || 'Admin',
        priority: 'info'
      });
      alert("Campaign outreach saved to database logs!");
      if (onCampaignLogged) onCampaignLogged();
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Failed to save log: " + err.message);
    } finally {
      setIsSavingLog(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ZERO COST NOTICE BANNER */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/30">
            <MessageSquare size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base sm:text-lg tracking-tight">Zero-Cost Bulk WhatsApp Outreach</h3>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                100% Free · No API Fees
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Send personalized WhatsApp messages with images and links directly via WhatsApp Web & Mobile. Zero Meta Cloud billing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
          <button
            onClick={handleExportCsv}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            title="Download CSV for WhatsApp Bulk Tools"
          >
            <Download size={14} className="text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleCopyAllPhones}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            title="Copy all phone numbers separated by comma"
          >
            <Copy size={14} className="text-cyan-400" />
            <span>Copy Phones</span>
          </button>
        </div>
      </div>

      {/* AUDIENCE SELECTOR & PRESET TEMPLATES */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-7 shadow-2xl">
        {/* Preset Loaders */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-400" />
              1-Click High-Converting Free Templates
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_TEMPLATES.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 transition-all flex items-center gap-2 shadow-xs"
              >
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Audience Filter Pills */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Select Recipient Audience
            </label>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400 font-medium">
                Targeting: <strong className="text-white">{filteredTenants.length}</strong> clients
              </span>
              <span className="text-emerald-400 font-bold">
                ({validMobileCount} with valid WhatsApp)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            {[
              { id: 'ALL', label: `All (${tenants.length})` },
              { id: 'ACTIVE', label: `Active (${tenants.filter(t => t.planStatus === 'Active').length})` },
              { id: 'EXPIRING', label: `Expiring/Trial (${tenants.filter(t => (t.planName || '').toLowerCase().includes('trial') || (t.daysLeft <= 7 && t.daysLeft >= 0)).length})` },
              { id: 'INACTIVE', label: `Inactive (${tenants.filter(t => t.planStatus !== 'Active').length})` },
              { id: 'SPECIFIC', label: `Custom (${selectedRecipientIds.length})` }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTargetType(opt.id as any)}
                className={`py-2.5 px-2 rounded-xl text-[11px] font-black uppercase transition-all ${
                  targetType === opt.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: COMPOSER & LIVE WHATSAPP SIMULATOR */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: COMPOSER FORM (7 COLS) */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Message & Media Composer</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Country Code:</span>
                <input
                  type="text"
                  value={defaultCountryCode}
                  onChange={e => setDefaultCountryCode(e.target.value)}
                  className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-white"
                  title="Default international dialing prefix (91 for India)"
                />
              </div>
            </div>

            {/* Campaign Name */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Campaign Reference Name
              </label>
              <input
                type="text"
                value={campaignTitle}
                onChange={e => setCampaignTitle(e.target.value)}
                placeholder="e.g. Analytics v2.0 Release Broadcast"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
              />
            </div>

            {/* Action Web Link */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <LinkIcon size={13} className="text-cyan-400" />
                Action Link (Replaces {'{{link}}'})
              </label>
              <input
                type="url"
                value={actionLink}
                onChange={e => setActionLink(e.target.value)}
                placeholder="https://your-saas.com/#/app/analytics"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs font-mono text-cyan-300 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
              />
            </div>

            {/* Media / Image URL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-emerald-400" />
                  Media / Image URL (Banner, Screenshot, Promo Poster)
                </label>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={handleCopyImage}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                  >
                    <Copy size={12} />
                    Copy Image to Clipboard
                  </button>
                )}
              </div>
              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://example.com/banner.png"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs font-mono text-slate-200 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
              />
              {imageCopyFeedback && (
                <p className="text-[11px] text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={13} /> {imageCopyFeedback}
                </p>
              )}
            </div>

            {/* Dynamic Placeholders Chips */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Click to Insert Dynamic Personalized Variable
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: 'ownerName', desc: 'Owner Name' },
                  { tag: 'businessName', desc: 'Kitchen Name' },
                  { tag: 'planName', desc: 'Plan Name' },
                  { tag: 'daysLeft', desc: 'Days Left' },
                  { tag: 'expiryDate', desc: 'Expiry Date' },
                  { tag: 'link', desc: 'Action Link' },
                  { tag: 'mobile', desc: 'Phone' }
                ].map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertToken(v.tag)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-emerald-400 font-mono font-bold transition-all shadow-xs"
                    title={`Insert {{${v.tag}}}`}
                  >
                    + &#123;&#123;{v.tag}&#125;&#125;
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp Text Message Content */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  WhatsApp Message Template
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Supports *bold*, _italic_, emojis
                </span>
              </div>
              <textarea
                rows={9}
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-sans text-white focus:border-emerald-500 outline-none transition-all leading-relaxed resize-y"
                placeholder="Type your WhatsApp message..."
              />
            </div>

            {/* SAVE LOG & QUICK ACTIONS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={handleSaveCampaignLog}
                disabled={isSavingLog}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>{isSavingLog ? 'Saving...' : 'Save to Outreach History'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyText(previewRenderedMessage)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/40"
              >
                <Copy size={16} />
                <span>Copy Sample Message</span>
              </button>
            </div>
            {copyFeedback && (
              <p className="text-xs text-emerald-400 text-center font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} /> {copyFeedback}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: REALISTIC WHATSAPP CHAT SIMULATOR (5 COLS) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-emerald-400" />
                <h4 className="text-sm font-bold text-white tracking-tight">Live WhatsApp Chat Preview</h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                For: {previewClient.businessName || 'Sample Kitchen'}
              </span>
            </div>

            {/* PHONE CONTAINER FRAME */}
            <div className="bg-[#0b141a] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
              
              {/* WhatsApp App Top Bar */}
              <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between text-white border-b border-[#2a3942]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center">
                    {(previewClient.businessName || 'K').charAt(0)}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#e9edef] leading-tight">
                      {previewClient.businessName || 'My Kitchen'}
                    </h5>
                    <p className="text-[10px] text-[#8696a0] leading-none">
                      {previewClient.ownerName || 'Kitchen Partner'} • online
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono">
                  +{cleanWhatsAppNumber(previewClient.mobile, defaultCountryCode) || '919876543210'}
                </div>
              </div>

              {/* Chat Message Canvas */}
              <div className="p-4 flex-1 flex flex-col justify-end space-y-3 bg-[radial-gradient(#1f2c34_1px,transparent_1px)] bg-[size:16px_16px]">
                
                {/* Date Pill */}
                <div className="flex justify-center my-1">
                  <span className="bg-[#182229] text-[#8696a0] text-[10px] font-medium px-3 py-0.5 rounded-md shadow-xs">
                    TODAY
                  </span>
                </div>

                {/* Sent Bubble */}
                <div className="self-end max-w-[92%] sm:max-w-[85%] bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-xs p-3 shadow-md border border-[#005c4b]/50 space-y-2">
                  
                  {/* Attached Image Card */}
                  {imageUrl && (
                    <div className="rounded-xl overflow-hidden bg-black/30 border border-white/10 relative group">
                      <img 
                        src={imageUrl} 
                        alt="Outreach Media" 
                        className="w-full h-36 object-cover"
                        onError={(e) => { (e.target as any).style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Rendered Text with basic WhatsApp markdown */}
                  <div className="text-[12px] leading-relaxed whitespace-pre-wrap select-text font-sans break-words">
                    {previewRenderedMessage}
                  </div>

                  {/* Bubble Timestamp and Read status */}
                  <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-[#8696a0]">
                    <span>11:42 AM</span>
                    <span className="text-[#53bdeb] font-bold">✓✓</span>
                  </div>
                </div>

              </div>

              {/* WhatsApp Input Bar Mockup */}
              <div className="bg-[#202c33] p-2.5 flex items-center gap-2 border-t border-[#2a3942]">
                <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-1.5 text-xs text-[#8696a0]">
                  Type a message...
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Send size={14} />
                </div>
              </div>
            </div>

            {/* Quick helper note */}
            <p className="text-[11px] text-slate-500 mt-3 text-center">
              💡 Tip: Click below to run the automated queue or launch individual chats with zero setup.
            </p>
          </div>
        </div>

      </div>

      {/* DISPATCH RUNNER & CLIENT CONTACT MATRIX */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-8">
        
        {/* SECTION HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Play size={20} className="text-emerald-400" />
              <span>Zero-Cost Queue Dispatcher & Client Matrix</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Automated sequential runner: opens WhatsApp Web or App for each recipient with pre-filled message.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Completed: <strong className="text-emerald-400">{Object.keys(sentRecipientIds).length}</strong> / {filteredTenants.length}
            </span>
            <button
              onClick={handleResetQueue}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <RotateCcw size={13} />
              <span>Reset Queue</span>
            </button>
          </div>
        </div>

        {/* ACTIVE QUEUE RUNNER CARD */}
        {filteredTenants.length > 0 && currentQueueTenant && (
          <div className="bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-lg shrink-0">
                  {queueIndex + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      Step {queueIndex + 1} of {filteredTenants.length}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      currentQueueTenant.planStatus === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {currentQueueTenant.planStatus || 'Trial'}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-white mt-1">
                    {currentQueueTenant.businessName || 'Unnamed Kitchen'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Owner: {currentQueueTenant.ownerName || 'Unknown'} • Mobile: <span className="font-mono text-emerald-400 font-bold">+{currentCleanPhone || 'Missing'}</span>
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full md:w-64 space-y-2">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Progress</span>
                  <span className="font-bold text-white">{Math.round(((queueIndex + 1) / filteredTenants.length) * 100)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(((queueIndex + 1) / filteredTenants.length) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* RUNNER ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => openWhatsAppChat(currentCleanPhone, currentRenderedMessage, true)}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
              >
                <Laptop size={16} />
                <span>Launch WhatsApp Web</span>
              </button>

              <button
                type="button"
                onClick={() => openWhatsAppChat(currentCleanPhone, currentRenderedMessage, false)}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition-all"
              >
                <Smartphone size={16} />
                <span>Open in WhatsApp App</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyText(currentRenderedMessage)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Copy size={15} />
                <span>Copy Text</span>
              </button>

              {imageUrl && (
                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <ImageIcon size={15} />
                  <span>Copy Image</span>
                </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <SkipForward size={14} />
                  <span>Skip</span>
                </button>

                <button
                  type="button"
                  onClick={handleMarkSent}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
                >
                  <span>Mark Sent & Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FULL CLIENT MATRIX TABLE */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h4 className="text-sm font-bold text-white tracking-tight">
              All Targeted Kitchen Contacts ({displayedTenants.length})
            </h4>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-600" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search business or phone..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Kitchen & Owner</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">Plan Status</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Instant Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedTenants.map((t, idx) => {
                    const clean = cleanWhatsAppNumber(t.mobile, defaultCountryCode);
                    const rendered = replacePlaceholders(messageTemplate, t, { link: actionLink, imageUrl });
                    const status = sentRecipientIds[t.id];

                    return (
                      <tr key={t.id || idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{t.businessName || 'Unnamed'}</div>
                          <div className="text-[11px] text-slate-400">{t.ownerName || 'Unknown Owner'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {clean ? (
                            <span className="text-emerald-400 font-semibold">+{clean}</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1 text-[11px]">
                              <AlertTriangle size={12} /> No Mobile
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.planStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {t.planName || 'Free Trial'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {status === 'sent' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                              <CheckCircle2 size={13} /> Sent
                            </span>
                          ) : status === 'skipped' ? (
                            <span className="inline-flex items-center gap-1 text-slate-500 font-bold text-[11px]">
                              Skipped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-600 text-[11px]">
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyText(rendered)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                              title="Copy personalized message for this client"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openWhatsAppChat(clean, rendered, true);
                                setSentRecipientIds(prev => ({ ...prev, [t.id]: 'sent' }));
                              }}
                              disabled={!clean}
                              className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-all ${
                                clean 
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs' 
                                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                              }`}
                            >
                              <Send size={12} />
                              <span>Send WA</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
