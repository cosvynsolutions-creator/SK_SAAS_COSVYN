import React from 'react';
import { Settings as SettingsIcon, MapPin, Clock, ShieldCheck, Building2 } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection } from '../services/dbService';

export const SettingsView: React.FC = () => {
  const { branchId, bizId } = useManagerAuth();
  const { data: branches } = useStreamCollection<any>('branches');

  const currentBranch = branches.find(b => b.id === branchId || b.name === branchId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branch Configuration & Operations</h1>
          <p className="text-xs text-slate-500">Settings and operational parameters for Branch: {branchId}</p>
        </div>
      </div>

      <div className="glass-card bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Building2 size={16} className="text-indigo-600" />
            <span>Branch Details</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Assigned kitchen hub location</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Branch Identifier</span>
            <div className="font-bold text-slate-900 font-mono text-sm">{branchId}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Branch Name</span>
            <div className="font-bold text-slate-900 text-sm">
              {currentBranch?.name || (branchId === 'All' ? 'All Organization Branches' : 'Main Branch')}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Hub Address</span>
            <div className="font-medium text-slate-700">
              {currentBranch?.hubAddress || 'Local Kitchen Hub Address configured by Owner'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">City / State</span>
            <div className="font-medium text-slate-700">
              {currentBranch?.city ? `${currentBranch.city}, ${currentBranch.state || ''}` : 'Primary Operational City'}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Branch configuration changes are controlled by the Kitchen Business Owner.</span>
        </div>
      </div>
    </div>
  );
};
