import React from 'react';
import { HelpCircle, Phone, Mail, BookOpen, MessageCircle, ExternalLink } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';

export const SupportView: React.FC = () => {
  const { branchId, bizId } = useManagerAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <HelpCircle className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branch Operations Support & Helpdesk</h1>
          <p className="text-xs text-slate-500">Quick contacts and emergency assistance for Branch: {branchId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Phone size={16} className="text-indigo-600" />
            <span>Kitchen Owner Escalation</span>
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            For critical supply bottlenecks, driver vehicle issues, or customer dispute escalations, contact your business owner directly.
          </p>
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 font-medium">
            Kitchen ID: <span className="font-mono font-bold">{bizId}</span>
          </div>
        </div>

        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <BookOpen size={16} className="text-indigo-600" />
            <span>ScaleKitchen Operations Guide</span>
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Learn best practices for daily container collection, tiffin batch labeling, delivery routes, and pause management.
          </p>
          <div className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
            <span>ScaleKitchen Manager Documentation v2.4</span>
          </div>
        </div>
      </div>
    </div>
  );
};
