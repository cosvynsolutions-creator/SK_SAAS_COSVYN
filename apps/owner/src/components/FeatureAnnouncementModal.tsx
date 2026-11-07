import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, X, ArrowRight, ShieldAlert, BarChart3, TrendingUp, 
  Package, DollarSign, Target, CheckCircle2, Zap, Rocket, Bell
} from 'lucide-react';
import { useGlobalCollection } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface FeatureAnnouncementModalProps {
  businessData?: any;
}

export const FeatureAnnouncementModal: React.FC<FeatureAnnouncementModalProps> = ({ businessData }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { data: messages = [], loading } = useGlobalCollection('admin_messages');
  const [activePopup, setActivePopup] = useState<any | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Default initial feature release for Analytics v2 & Risk Intelligence
  const defaultAnalyticsRelease = {
    id: 'release_analytics_kri_v2',
    title: 'New: Advanced Analytics, KPIs & Risk Intelligence! 🚀',
    content: 'We have upgraded your Analytics dashboard with real-time Unit Economics, predictive 7-Day Churn Risk radar, Food Cost (COGS) tracking, and Delivery Area density insights to help you scale kitchen margins.',
    featureTag: 'Analytics v2.0',
    priority: 'info',
    actionText: 'Explore Analytics Now',
    actionUrl: '/app/analytics',
    isFeaturePopup: true,
    sentAt: '2026-10-11T00:00:00.000Z',
    highlights: [
      {
        icon: 'ShieldAlert',
        title: 'KRI Early Warning Radar',
        desc: 'Instant alerts for subscriptions expiring in ≤7 days, overdue collections, and frozen cashflow.'
      },
      {
        icon: 'DollarSign',
        title: 'Unit Economics per Meal Box',
        desc: 'Real profit breakdown per meal: Food COGS, Packaging, Delivery fuel, and net margins.'
      },
      {
        icon: 'Target',
        title: 'Delivery Area Cluster Density',
        desc: 'See customer concentrations across delivery hubs to optimize rider routes and drop times.'
      },
      {
        icon: 'Package',
        title: 'Reusable Dabba Shrinkage Risk',
        desc: 'Track uncollected and damaged container capital loss in real-time.'
      }
    ]
  };

  useEffect(() => {
    if (loading || !currentUser) return;

    // 1. Look for admin-published feature announcements
    const featurePopups = messages.filter((m: any) => {
      if (!m.isFeaturePopup) return false;
      // Check target audience
      if (m.targetType === 'SPECIFIC' && Array.isArray(m.recipientIds)) {
        return m.recipientIds.includes(currentUser.uid);
      }
      return true;
    });

    // Sort newest first
    const sorted = [...featurePopups].sort((a: any, b: any) => 
      new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime()
    );

    // Pick latest or fallback to defaultAnalyticsRelease
    const targetRelease = sorted.length > 0 ? sorted[0] : defaultAnalyticsRelease;

    // Check if this business owner has already seen/dismissed this announcement
    const seenKey = `scalekitchen_seen_feature_${targetRelease.id}`;
    const hasSeen = localStorage.getItem(seenKey);

    if (!hasSeen) {
      // Small timeout for smooth entrance after page mount
      const timer = setTimeout(() => {
        setActivePopup(targetRelease);
        setIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [messages, loading, currentUser]);

  const markAsSeen = (releaseId: string) => {
    localStorage.setItem(`scalekitchen_seen_feature_${releaseId}`, 'true');
    if (currentUser?.uid) {
      // Save read receipt non-blocking
      setDoc(doc(db, 'businesses', currentUser.uid, 'read_messages', releaseId), {
        readAt: new Date().toISOString(),
        type: 'feature_popup'
      }, { merge: true }).catch(() => {});
    }
  };

  const handleExplore = () => {
    if (!activePopup) return;
    markAsSeen(activePopup.id);
    setIsOpen(false);
    navigate(activePopup.actionUrl || '/app/analytics');
  };

  const handleDismiss = () => {
    if (!activePopup) return;
    markAsSeen(activePopup.id);
    setIsOpen(false);
  };

  if (!isOpen || !activePopup) return null;

  const highlights = Array.isArray(activePopup.highlights) && activePopup.highlights.length > 0
    ? activePopup.highlights
    : defaultAnalyticsRelease.highlights;

  const renderIcon = (name?: string) => {
    switch (name) {
      case 'ShieldAlert': return <ShieldAlert size={18} className="text-rose-500" />;
      case 'DollarSign': return <DollarSign size={18} className="text-emerald-500" />;
      case 'Target': return <Target size={18} className="text-indigo-500" />;
      case 'Package': return <Package size={18} className="text-amber-500" />;
      case 'TrendingUp': return <TrendingUp size={18} className="text-blue-500" />;
      default: return <Sparkles size={18} className="text-primary-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header Banner */}
        <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-7 text-white overflow-hidden shrink-0">
          {/* Ambient orbs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none -ml-10 -mb-10" />

          {/* Close button */}
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
            aria-label="Close feature popup"
          >
            <X size={18} />
          </button>

          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 border border-primary-400/30 text-xs font-bold uppercase tracking-wider">
              <Rocket size={13} className="text-primary-400" />
              <span>{activePopup.featureTag || 'Platform Update'}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white leading-tight">
              {activePopup.title}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-lg">
              {activePopup.content}
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
            What's New for Your Kitchen
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {highlights.map((h: any, idx: number) => (
              <div 
                key={idx} 
                className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-start gap-3 hover:border-primary-200 transition-colors"
              >
                <div className="p-2 bg-slate-50 rounded-xl shrink-0 border border-slate-100">
                  {renderIcon(h.icon)}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{h.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button 
            onClick={handleDismiss}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all text-center"
          >
            Close / Maybe Later
          </button>

          <button 
            onClick={handleExplore}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-primary-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 group"
          >
            <span>{activePopup.actionText || 'Try It Out Now'}</span>
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
