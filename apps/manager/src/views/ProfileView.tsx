import React from 'react';
import { User, Shield, Key, Mail, Phone, MapPin, CheckCircle2, Lock } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { ALL_SAAS_PAGES } from '../services/managerStore';

export const ProfileView: React.FC = () => {
  const { loggedInManager, branchId, allowedPages, bizId, claims } = useManagerAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <User className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branch Manager Profile</h1>
          <p className="text-xs text-slate-500">Account credentials, assigned scope, and active permissions</p>
        </div>
      </div>

      <div className="glass-card bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-2xl flex items-center justify-center">
            {loggedInManager?.name?.charAt(0) || 'M'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{loggedInManager?.name || 'Branch Manager'}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1"><Mail size={12} /> {loggedInManager?.email}</span>
              {loggedInManager?.mobile && (
                <span className="flex items-center gap-1"><Phone size={12} /> {loggedInManager.mobile}</span>
              )}
              <span className="flex items-center gap-1 font-semibold text-indigo-600">
                <MapPin size={12} /> Branch: {branchId}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Kitchen ID</span>
            <div className="font-mono font-bold text-slate-900 truncate">{bizId}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Verified Role</span>
            <div className="font-bold text-emerald-700 flex items-center gap-1">
              <Shield size={12} /> {claims?.role || 'manager'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Assigned Scope</span>
            <div className="font-bold text-slate-900">{branchId === 'All' ? 'All Branches' : `Branch ${branchId}`}</div>
          </div>
        </div>

        {/* Granted Module Permissions */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
            Granted Module Permissions ({allowedPages.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {ALL_SAAS_PAGES.map(page => {
              const isAllowed = allowedPages.includes(page.id);
              return (
                <div
                  key={page.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    isAllowed
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isAllowed ? (
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    ) : (
                      <Lock size={13} className="text-slate-400" />
                    )}
                    <span>{page.label}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold">
                    {isAllowed ? 'Allowed' : 'Restricted'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
