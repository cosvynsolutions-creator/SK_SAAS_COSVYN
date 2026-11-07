import React, { useState, useMemo } from 'react';
import { 
  Mail, Send, Users, Sparkles, Image as ImageIcon, Link as LinkIcon, 
  ExternalLink, Copy, Check, Download, AlertTriangle, CheckCircle2, 
  Search, ShieldCheck, Laptop, HelpCircle, ChevronRight, Eye, Code, FileText
} from 'lucide-react';
import { 
  replacePlaceholders, copyRichEmailToClipboard, copyImageToClipboard,
  launchGmailWebBcc, launchMailtoBcc 
} from './outreachUtils';
import { addGlobalItem } from '../services/adminDbService';

interface EmailOutreachProps {
  tenants: any[];
  currentUserEmail?: string;
  onCampaignLogged?: () => void;
}

const PRESET_EMAIL_TEMPLATES = [
  {
    id: 'feature_release',
    name: '🚀 Feature Launch: Analytics v2.0 & KRI Radar',
    campaignTitle: 'Analytics v2.0 Platform Launch Email',
    subject: '🚀 Major Update: Advanced Analytics & Risk Radar is Live on ScaleKitchen',
    headline: 'Upgrade Your Kitchen Intelligence: Analytics v2.0 is Here',
    greeting: 'Dear {{ownerName}},',
    bannerUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    bodyText: `We are thrilled to introduce Analytics & Risk Intelligence v2.0 for {{businessName}}! 

Running a subscription meal kitchen requires sharp visibility over recurring revenues, meal box cost breakdowns, and customer churn. Our new dashboard delivers enterprise-grade insights crafted specifically for cloud kitchens:

• KRI Early Warning Radar: Predict subscriptions at churn risk 7 days before expiry.
• Unit Economics Engine: Real profit breakdown per meal box (Food COGS, packaging, and fuel).
• Delivery Cluster Density: Pinpoint high-density delivery routes to optimize rider batches.
• Reusable Dabba Shrinkage: Real-time tracking of unreturned tiffin container capital loss.

Log into your account today to explore your live metrics and optimize kitchen margins.`,
    ctaText: 'Explore Analytics v2.0 Now',
    ctaLink: window.location.origin + '/#/app/analytics',
    footerNote: 'ScaleKitchen OS • Empowering High-Volume Cloud Kitchens & Meal Businesses'
  },
  {
    id: 'renewal_notice',
    name: '⏰ Plan Renewal & Expiry Notice',
    campaignTitle: 'Subscription Renewal Alert',
    subject: '⏰ Action Required: {{businessName}} Subscription Expiring Soon',
    headline: 'Keep Your Kitchen Dispatch & Customer Deliveries Active',
    greeting: 'Dear {{ownerName}},',
    bannerUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80',
    bodyText: `This is a reminder that your ScaleKitchen subscription for {{businessName}} has {{daysLeft}} days remaining (Valid until {{expiryDate}}).

To avoid any interruption to your daily meal production, driver delivery routing, and automated customer billing, please renew your plan.

All your existing customer subscriptions, driver links, and invoice history will remain active seamlessly upon renewal.`,
    ctaText: 'Renew Subscription Instantly',
    ctaLink: window.location.origin + '/#/onboarding',
    footerNote: 'Need help or custom invoice credits? Reply to this email anytime.'
  },
  {
    id: 'special_offer',
    name: '🎁 20% Upgrade Discount Promo',
    campaignTitle: 'Exclusive 20% Off Upgrade Offer',
    subject: '🎁 Exclusive 20% Upgrade Discount for {{businessName}}',
    headline: 'Scale Your Kitchen with 20% Off COSVYN ONE',
    greeting: 'Hello {{ownerName}},',
    bannerUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
    bodyText: `For a limited time, get 20% off when upgrading {{businessName}} to our Semi-Annual or Annual COSVYN ONE tier!

Use Promo Code: KITCHEN20 at checkout.

Unlock unlimited customer meal subscribers, multi-driver route optimization, automated WhatsApp payment receipts, and priority support. Offer valid for the next 48 hours only.`,
    ctaText: 'Claim Your 20% Discount',
    ctaLink: window.location.origin + '/#/onboarding',
    footerNote: 'Valid on semi-annual and annual plans. Taxes apply as per billing.'
  },
  {
    id: 'system_notice',
    name: '📢 Maintenance & System Notice',
    campaignTitle: 'Scheduled Maintenance Notice',
    subject: '📢 ScaleKitchen System Advisory & Kitchen Operations Update',
    headline: 'Scheduled System Update Notice',
    greeting: 'Dear Kitchen Partner,',
    bannerUrl: '',
    bodyText: `We will be performing scheduled performance enhancements on the ScaleKitchen server infrastructure this Sunday between 02:00 AM and 03:00 AM IST.

During this brief 30-minute window, database sync may experience minor latency. Daily meal prep lists and morning delivery route dispatches will be fully ready and available by 04:00 AM as usual.

Thank you for your partnership as we continue improving reliability for your business.`,
    ctaText: 'Go to ScaleKitchen Dashboard',
    ctaLink: window.location.origin + '/#/app/dashboard',
    footerNote: 'For urgent queries, reach out through the in-app Support portal.'
  }
];

export const EmailOutreach: React.FC<EmailOutreachProps> = ({ 
  tenants, 
  currentUserEmail,
  onCampaignLogged 
}) => {
  // Target Audience Filter
  const [targetType, setTargetType] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'INACTIVE' | 'SPECIFIC'>('ALL');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [campaignTitle, setCampaignTitle] = useState(PRESET_EMAIL_TEMPLATES[0].campaignTitle);
  const [subject, setSubject] = useState(PRESET_EMAIL_TEMPLATES[0].subject);
  const [headline, setHeadline] = useState(PRESET_EMAIL_TEMPLATES[0].headline);
  const [greeting, setGreeting] = useState(PRESET_EMAIL_TEMPLATES[0].greeting);
  const [bannerUrl, setBannerUrl] = useState(PRESET_EMAIL_TEMPLATES[0].bannerUrl);
  const [bodyText, setBodyText] = useState(PRESET_EMAIL_TEMPLATES[0].bodyText);
  const [ctaText, setCtaText] = useState(PRESET_EMAIL_TEMPLATES[0].ctaText);
  const [ctaLink, setCtaLink] = useState(PRESET_EMAIL_TEMPLATES[0].ctaLink);
  const [footerNote, setFooterNote] = useState(PRESET_EMAIL_TEMPLATES[0].footerNote);

  // Free delivery feedback states
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);

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

  // Valid emails list
  const validEmailRecipients = useMemo(() => {
    return filteredTenants.filter(t => t.email && t.email.includes('@'));
  }, [filteredTenants]);

  const bccEmailList = useMemo(() => {
    return validEmailRecipients.map(t => t.email.trim());
  }, [validEmailRecipients]);

  // First client sample for live preview
  const sampleClient = filteredTenants[0] || {
    businessName: 'My Kitchen',
    ownerName: 'Chef Rahul',
    email: 'kitchenowner@example.com',
    planName: 'COSVYN ONE',
    planExpiryDate: '2026-11-04',
    daysLeft: 24
  };

  // Rendered subject and body for preview
  const renderedSubject = useMemo(() => {
    return replacePlaceholders(subject, sampleClient, { link: ctaLink });
  }, [subject, sampleClient, ctaLink]);

  const renderedGreeting = useMemo(() => {
    return replacePlaceholders(greeting, sampleClient, { link: ctaLink });
  }, [greeting, sampleClient, ctaLink]);

  const renderedBody = useMemo(() => {
    return replacePlaceholders(bodyText, sampleClient, { link: ctaLink });
  }, [bodyText, sampleClient, ctaLink]);

  // Generate full HTML for email
  const generatedHtmlEmail = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${renderedSubject}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
    <!-- Brand Header -->
    <tr>
      <td style="background-color: #0f172a; padding: 24px 32px; text-align: left;">
        <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">ScaleKitchen</span>
        <span style="font-size: 11px; background-color: #0284c7; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: 700; margin-left: 8px; text-transform: uppercase;">OS</span>
      </td>
    </tr>
    ${bannerUrl ? `
    <!-- Banner Image -->
    <tr>
      <td>
        <img src="${bannerUrl}" alt="Update Banner" style="width: 100%; max-height: 240px; object-fit: cover; display: block;" />
      </td>
    </tr>` : ''}
    <!-- Content Body -->
    <tr>
      <td style="padding: 32px;">
        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px; line-height: 1.3;">
          ${headline}
        </h1>
        <p style="font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 16px;">
          ${renderedGreeting}
        </p>
        <div style="font-size: 14px; line-height: 1.6; color: #475569; white-space: pre-wrap; margin-bottom: 28px;">
${renderedBody}
        </div>
        ${ctaText && ctaLink ? `
        <!-- CTA Button -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
          <tr>
            <td align="center" style="border-radius: 10px; background-color: #0284c7;">
              <a href="${ctaLink}" target="_blank" style="font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 28px; display: inline-block; border-radius: 10px;">
                ${ctaText} &rarr;
              </a>
            </td>
          </tr>
        </table>` : ''}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
          ${footerNote}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }, [renderedSubject, headline, renderedGreeting, renderedBody, bannerUrl, ctaText, ctaLink, footerNote]);

  // Load Preset
  const handleLoadPreset = (preset: typeof PRESET_EMAIL_TEMPLATES[0]) => {
    setCampaignTitle(preset.campaignTitle);
    setSubject(preset.subject);
    setHeadline(preset.headline);
    setGreeting(preset.greeting);
    setBannerUrl(preset.bannerUrl);
    setBodyText(preset.bodyText);
    setCtaText(preset.ctaText);
    setCtaLink(preset.ctaLink);
    setFooterNote(preset.footerNote);
  };

  // Launch Gmail Web with BCC
  const handleLaunchGmailBcc = () => {
    if (bccEmailList.length === 0) {
      alert("No valid recipient email addresses found in current audience selection.");
      return;
    }
    const plainBody = `${headline}\n\n${renderedGreeting}\n\n${renderedBody}\n\n${ctaText ? `${ctaText}: ${ctaLink}\n\n` : ''}${footerNote}`;
    launchGmailWebBcc(bccEmailList, renderedSubject, plainBody);
  };

  // Launch Default Mail Client with BCC
  const handleLaunchMailtoBcc = () => {
    if (bccEmailList.length === 0) {
      alert("No valid recipient email addresses found in current audience selection.");
      return;
    }
    const plainBody = `${headline}\n\n${renderedGreeting}\n\n${renderedBody}\n\n${ctaText ? `${ctaText}: ${ctaLink}\n\n` : ''}${footerNote}`;
    launchMailtoBcc(bccEmailList, renderedSubject, plainBody);
  };

  // Copy formatted Rich Email for Gmail / Outlook compose
  const handleCopyFormattedEmail = async () => {
    const plainBody = `${headline}\n\n${renderedGreeting}\n\n${renderedBody}\n\n${ctaText ? `${ctaText}: ${ctaLink}\n\n` : ''}${footerNote}`;
    const res = await copyRichEmailToClipboard(generatedHtmlEmail, plainBody);
    setCopyFeedback(res.message);
    setTimeout(() => setCopyFeedback(null), 5000);
  };

  // Copy all BCC emails
  const handleCopyBccEmails = async () => {
    if (bccEmailList.length === 0) {
      alert("No valid emails found.");
      return;
    }
    await navigator.clipboard.writeText(bccEmailList.join(', '));
    alert(`Copied ${bccEmailList.length} client emails to clipboard!`);
  };

  // Save campaign log to Firestore
  const handleSaveCampaignLog = async () => {
    if (!campaignTitle.trim()) {
      alert("Please enter a campaign name.");
      return;
    }
    setIsSavingLog(true);
    try {
      await addGlobalItem('admin_messages', {
        title: `[Email] ${campaignTitle.trim()}`,
        content: `Subject: ${subject}\n\n${bodyText}`,
        channel: 'email',
        isExternalCampaign: true,
        targetType: targetType,
        recipientCount: filteredTenants.length,
        validEmailCount: bccEmailList.length,
        actionLink: ctaLink || '',
        bannerUrl: bannerUrl || '',
        sentAt: new Date().toISOString(),
        createdBy: currentUserEmail || 'Admin',
        priority: 'info'
      });
      alert("Email campaign logged into outreach history!");
      if (onCampaignLogged) onCampaignLogged();
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Failed to save log: " + err.message);
    } finally {
      setIsSavingLog(false);
    }
  };

  // Insert token helper
  const insertToken = (token: string) => {
    setBodyText(prev => prev + ` {{${token}}}`);
  };

  return (
    <div className="space-y-8">
      {/* ZERO COST NOTICE BANNER */}
      <div className="bg-gradient-to-r from-violet-950/80 via-slate-900 to-slate-900 border border-violet-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/30">
            <Mail size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base sm:text-lg tracking-tight">Zero-Cost Bulk Email Dispatcher</h3>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                100% Free · No Mailgun / SendGrid Fees
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Launch instant privacy-safe BCC bulk campaigns in Gmail/Outlook, copy rich styled HTML emails, or use free 500 emails/day Gmail relay.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
          <button
            onClick={handleCopyBccEmails}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            title="Copy all recipient emails for BCC"
          >
            <Copy size={14} className="text-violet-400" />
            <span>Copy All Emails</span>
          </button>
          <button
            onClick={() => setSmtpModalOpen(true)}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            title="Learn how to send 500 free emails/day via Gmail SMTP"
          >
            <HelpCircle size={14} className="text-amber-400" />
            <span>Free Gmail Setup</span>
          </button>
        </div>
      </div>

      {/* AUDIENCE SELECTOR & PRESETS */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-7 shadow-2xl">
        {/* Preset Templates */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles size={14} className="text-violet-400" />
              1-Click Ready Email Campaign Presets
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_EMAIL_TEMPLATES.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-violet-950/40 border border-slate-800 hover:border-violet-500/40 text-slate-300 hover:text-violet-300 transition-all flex items-center gap-2 shadow-xs"
              >
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Audience Target Pills */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Select Recipient Audience
            </label>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400 font-medium">
                Audience: <strong className="text-white">{filteredTenants.length}</strong> clients
              </span>
              <span className="text-violet-400 font-bold">
                ({bccEmailList.length} valid email addresses for BCC)
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
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TWO-COLUMN EMAIL WORKBENCH: BUILDER & LIVE VISUAL PREVIEW */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: BUILDER FORM (7 COLS) */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-5">
            
            <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Email Content & Design Builder</span>
              </h3>
              <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800">
                HTML + Plain Text
              </span>
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
                placeholder="e.g. Analytics v2.0 Platform Launch"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:border-violet-500 outline-none transition-all placeholder:text-slate-700"
              />
            </div>

            {/* Email Subject */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Major Update: Advanced Analytics is live for {{businessName}}"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:border-violet-500 outline-none transition-all placeholder:text-slate-700"
              />
            </div>

            {/* Headline & Banner Image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  Headline Title
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  placeholder="e.g. Upgrade Your Kitchen Intelligence"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:border-violet-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-violet-400" />
                  Banner Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={bannerUrl}
                  onChange={e => setBannerUrl(e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs font-mono text-slate-300 focus:border-violet-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Greeting */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Greeting Line
              </label>
              <input
                type="text"
                value={greeting}
                onChange={e => setGreeting(e.target.value)}
                placeholder="Dear {{ownerName}},"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:border-violet-500 outline-none transition-all"
              />
            </div>

            {/* Dynamic Placeholders */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Insert Personalized Placeholders
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['ownerName', 'businessName', 'planName', 'daysLeft', 'expiryDate', 'link'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertToken(v)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-violet-400 font-mono font-bold transition-all shadow-xs"
                  >
                    + &#123;&#123;{v}&#125;&#125;
                  </button>
                ))}
              </div>
            </div>

            {/* Body Text */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Email Body Text
              </label>
              <textarea
                rows={8}
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-sans text-white focus:border-violet-500 outline-none transition-all leading-relaxed resize-y"
                placeholder="Enter email content..."
              />
            </div>

            {/* CTA Button Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  Call to Action (CTA) Button Text
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={e => setCtaText(e.target.value)}
                  placeholder="e.g. Explore Analytics v2.0 Now"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:border-violet-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <LinkIcon size={13} className="text-cyan-400" />
                  CTA Button URL
                </label>
                <input
                  type="url"
                  value={ctaLink}
                  onChange={e => setCtaLink(e.target.value)}
                  placeholder="https://your-saas.com/#/app/analytics"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs font-mono text-cyan-300 focus:border-violet-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Footer Note */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Email Footer Signature Note
              </label>
              <input
                type="text"
                value={footerNote}
                onChange={e => setFooterNote(e.target.value)}
                placeholder="ScaleKitchen OS • Empowering High-Volume Cloud Kitchens"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-300 focus:border-violet-500 outline-none transition-all"
              />
            </div>

            {/* SAVE LOG & DISPATCH BUTTONS */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSaveCampaignLog}
                disabled={isSavingLog}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <ShieldCheck size={15} className="text-violet-400" />
                <span>{isSavingLog ? 'Saving...' : 'Save to History Logs'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyFormattedEmail}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-violet-300 border border-violet-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Copy size={15} />
                <span>Copy Formatted Rich Email</span>
              </button>
            </div>
            {copyFeedback && (
              <p className="text-xs text-emerald-400 text-center font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
                <CheckCircle2 size={14} /> {copyFeedback}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE VISUAL EMAIL CLIENT PREVIEW (5 COLS) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-violet-400" />
                <h4 className="text-sm font-bold text-white tracking-tight">Live Visual Email Preview</h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {sampleClient.email || 'sample@client.com'}
              </span>
            </div>

            {/* EMAIL WINDOW SIMULATOR */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-300 text-slate-800 font-sans">
              
              {/* Email Client Header Bar */}
              <div className="bg-slate-100 p-3 border-b border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span><strong>From:</strong> ScaleKitchen Team &lt;admin@scalekitchen.app&gt;</span>
                  <span className="font-mono text-[10px]">Today</span>
                </div>
                <div className="text-[11px] text-slate-600 truncate">
                  <strong>BCC:</strong> {bccEmailList.length} kitchen clients ({bccEmailList.slice(0, 2).join(', ')}...)
                </div>
                <div className="text-xs font-bold text-slate-900 truncate pt-1">
                  <strong>Subject:</strong> {renderedSubject}
                </div>
              </div>

              {/* Email Content Frame */}
              <div className="p-5 space-y-4 max-h-[550px] overflow-y-auto no-scrollbar">
                
                {/* Brand Banner */}
                <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm tracking-tight">ScaleKitchen</span>
                    <span className="text-[9px] font-bold bg-primary-600 px-1.5 py-0.5 rounded uppercase">OS</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Meal Subscription Platform</span>
                </div>

                {/* Banner Image if entered */}
                {bannerUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <img 
                      src={bannerUrl} 
                      alt="Email Banner" 
                      className="w-full h-36 object-cover"
                      onError={(e) => { (e.target as any).style.display = 'none'; }}
                    />
                  </div>
                )}

                {/* Headline */}
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  {headline}
                </h3>

                {/* Greeting */}
                <p className="text-xs font-bold text-slate-700">
                  {renderedGreeting}
                </p>

                {/* Body Text */}
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {renderedBody}
                </div>

                {/* CTA Button */}
                {ctaText && ctaLink && (
                  <div className="pt-2 text-center">
                    <a
                      href={ctaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-5 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-xs shadow-md shadow-primary-600/30 hover:bg-primary-500"
                    >
                      {ctaText} &rarr;
                    </a>
                  </div>
                )}

                {/* Footer Note */}
                <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center leading-normal">
                  {footerNote}
                </div>
              </div>

            </div>

            {/* FREE DISPATCH ACTIONS BAR */}
            <div className="mt-5 pt-4 border-t border-slate-800 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                1-Click Free Delivery Options
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleLaunchGmailBcc}
                  className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition-all"
                  title="Opens Gmail Compose with all clients in BCC"
                >
                  <Mail size={15} />
                  <span>Open Gmail (BCC All)</span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchMailtoBcc}
                  className="w-full py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  title="Opens default email client (Outlook, Apple Mail) with BCC"
                >
                  <ExternalLink size={15} />
                  <span>Default Mail App</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 text-center pt-1">
                🛡️ BCC automatically protects all your client email addresses so recipients cannot see each other.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* FREE GMAIL RELAY EDUCATIONAL MODAL */}
      {smtpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-violet-400 font-bold text-base">
                <HelpCircle size={20} />
                <span>How to Send 500 Free Emails Daily with Gmail</span>
              </div>
              <button 
                onClick={() => setSmtpModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <p>
                Google offers <strong className="text-white">500 emails per day for free</strong> on standard @gmail.com accounts, and <strong className="text-white">2,000 emails per day</strong> on Google Workspace!
              </p>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="font-bold text-emerald-400 text-xs">Recommended 100% Free Workflow:</div>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-400">
                  <li>Click <strong className="text-white">Open Gmail (BCC All)</strong> above — it automatically fills in all client emails into BCC with zero setup.</li>
                  <li>Click <strong className="text-white">Copy Formatted Rich Email</strong> and press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white">Ctrl+V</kbd> inside Gmail Compose to paste styled images and buttons.</li>
                  <li>Press <strong className="text-white">Send</strong> in Gmail. You pay ₹0.00 / $0.00 for any emails sent!</li>
                </ol>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1 text-[11px] text-slate-400">
                <span className="font-bold text-white">Standard Gmail SMTP Credentials:</span>
                <div>Host: <code className="text-cyan-400 font-mono">smtp.gmail.com</code> | Port: <code className="text-cyan-400 font-mono">587</code></div>
                <div>Requires: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-violet-400 underline">Google 16-Character App Password</a></div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSmtpModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
