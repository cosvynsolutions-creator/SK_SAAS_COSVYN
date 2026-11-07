
import React, { useState } from 'react';
import { MessageSquare, AlertCircle, Lightbulb, Star, Loader2 } from 'lucide-react';
import { useGlobalCollection, updateGlobalItem } from '../../services/dbService';
import { formatDateDDMMYYYY } from '../../services/store';

const AdminFeatureSupport = () => {
  const [activeTab, setActiveTab] = useState<'features' | 'support' | 'reviews'>('features');
  
  // FETCH REAL DATA
  const { data: features, loading: l1 } = useGlobalCollection('global_features');
  const { data: tickets, loading: l2 } = useGlobalCollection('global_tickets');
  const { data: reviews, loading: l3 } = useGlobalCollection('global_reviews');

  const updateFeatureStatus = async (id: string, status: string) => {
    await updateGlobalItem('global_features', id, { status });
  };

  const updateTicketStatus = async (id: string, status: string) => {
    await updateGlobalItem('global_tickets', id, { status });
  };

  if (l1 || l2 || l3) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-6">
      
      {/* Tabs - Scrollable on Mobile */}
      <div className="w-full overflow-x-auto pb-2 no-scrollbar">
        <div className="flex space-x-2 bg-slate-900/50 p-1 rounded-xl border border-slate-800 w-max min-w-full sm:min-w-0 sm:w-fit">
          {[
             { id: 'features', label: 'Feature Requests', icon: Lightbulb },
             { id: 'support', label: 'Support Tickets', icon: AlertCircle },
             { id: 'reviews', label: 'Reviews', icon: Star },
          ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                 activeTab === tab.id 
                   ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20' 
                   : 'text-slate-400 hover:text-white hover:bg-slate-800'
               }`}
             >
               <tab.icon size={16} /> {tab.label}
             </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        
        {/* === FEATURES TAB === */}
        {activeTab === 'features' && features.map((item: any) => (
           <div key={item.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row gap-4 justify-between items-start backdrop-blur-sm">
              <div className="flex-1">
                 <div className="flex flex-wrap items-center gap-3 mb-1">
                    <span className="text-cyan-400 font-bold text-lg">{item.featureName}</span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{item.businessName || 'Unknown User'}</span>
                 </div>
                 <p className="text-slate-400 text-sm mb-2">{item.description}</p>
                 <p className="text-xs text-slate-600">{item.createdAt ? formatDateDDMMYYYY(item.createdAt) : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                 {['Pending', 'Processing', 'Approved', 'Delayed'].map(s => (
                   <button 
                     key={s}
                     onClick={() => updateFeatureStatus(item.id, s)}
                     className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        item.status === s 
                          ? 'bg-slate-800 text-white border-cyan-500' 
                          : 'bg-transparent text-slate-500 border-transparent hover:border-slate-700'
                     }`}
                   >
                     {s}
                   </button>
                 ))}
              </div>
           </div>
        ))}
        {activeTab === 'features' && features.length === 0 && <div className="text-slate-500 text-center p-8">No feature requests yet.</div>}

        {/* === SUPPORT TAB === */}
        {activeTab === 'support' && tickets.map((item: any) => (
           <div key={item.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row gap-4 justify-between items-start backdrop-blur-sm">
              <div className="flex-1">
                 <div className="flex flex-wrap items-center gap-3 mb-1">
                    <span className="text-white font-bold">{item.issueType} Issue</span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{item.businessName || 'Unknown User'}</span>
                 </div>
                 <p className="text-slate-400 text-sm mb-2">{item.description}</p>
              </div>
              <div className="mt-2 md:mt-0">
                 <select 
                   value={item.status}
                   onChange={(e) => updateTicketStatus(item.id, e.target.value)}
                   className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                 >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                 </select>
              </div>
           </div>
        ))}
        {activeTab === 'support' && tickets.length === 0 && <div className="text-slate-500 text-center p-8">No tickets found.</div>}

        {/* === REVIEWS TAB === */}
        {activeTab === 'reviews' && reviews.map((item: any) => (
           <div key={item.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex justify-between mb-2">
                 <div className="flex items-center gap-2">
                    <div className="flex">
                       {[...Array(5)].map((_, i) => (
                          <Star key={i} size={16} className={i < item.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-700"} />
                       ))}
                    </div>
                    <span className="text-slate-400 text-sm font-bold">{item.businessName || 'Unknown User'}</span>
                 </div>
                 <span className="text-xs text-slate-600">{item.createdAt ? formatDateDDMMYYYY(item.createdAt) : ''}</span>
              </div>
              <p className="text-slate-200 italic">"{item.reviewText}"</p>
           </div>
        ))}
        {activeTab === 'reviews' && reviews.length === 0 && <div className="text-slate-500 text-center p-8">No reviews yet.</div>}

      </div>
    </div>
  );
};

export default AdminFeatureSupport;
