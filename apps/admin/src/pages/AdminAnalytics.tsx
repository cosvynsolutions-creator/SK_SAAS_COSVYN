
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { MapPin, Building2, Loader2 } from 'lucide-react';
import { useAdminTenants, useAdminBillingHistory } from '../services/adminDbService';

const AdminAnalytics = () => {
  const { tenants, loading: l1 } = useAdminTenants();
  const { history, loading: l2 } = useAdminBillingHistory();

  const loading = l1 || l2;

  // --- Data Calculations ---

  // User Growth (Total Signups) - Chronological
  const monthlyGrowth = useMemo(() => {
     if (tenants.length === 0) return [];
     
     const growthMap: Record<string, { label: string, sort: number, count: number }> = {};
     
     tenants.forEach(t => {
        // Use createdAt for signup date. Fallback to updatedAt if missing.
        const dateStr = t.createdAt || t.updatedAt || new Date().toISOString(); 
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return;
        
        // Key by YYYY-MM to separate years
        const key = `${date.getFullYear()}-${date.getMonth()}`; 
        const label = date.toLocaleString('default', { month: 'short', year: '2-digit' }); // e.g. "Oct 24"
        const sort = date.getTime(); // Use timestamp for sorting

        if (!growthMap[key]) {
            growthMap[key] = { label, sort, count: 0 };
        }
        growthMap[key].count++;
     });

     // Convert to array and sort by time
     return Object.values(growthMap)
        .sort((a, b) => a.sort - b.sort)
        .map(d => ({ name: d.label, Signups: d.count }));
  }, [tenants]);

  // ACTIVE Paid Subscriptions by Plan
  const planDistribution = useMemo(() => {
    const activeTenants = tenants.filter(t => t.planStatus === 'Active');
    
    return [
      { name: 'Monthly', value: activeTenants.filter(t => t.planName?.toLowerCase().includes('monthly')).length, color: '#3b82f6' },
      { name: '6 Months', value: activeTenants.filter(t => t.planName?.toLowerCase().includes('6 months')).length, color: '#8b5cf6' },
      { name: 'Yearly', value: activeTenants.filter(t => t.planName?.toLowerCase().includes('yearly')).length, color: '#06b6d4' },
    ].filter(d => d.value > 0);
  }, [tenants]);

  const totalActivePaid = planDistribution.reduce((acc, curr) => acc + curr.value, 0);

  // Top Cities Logic
  const topCities = useMemo(() => {
    const cityMap: Record<string, number> = {};
    tenants.forEach(tenant => {
        if(tenant.city) {
           const city = tenant.city.trim();
           if(city) cityMap[city] = (cityMap[city] || 0) + 1;
        }
    });
    return Object.entries(cityMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tenants]);

  // State Logic
  const topStates = useMemo(() => {
    const stateMap: Record<string, number> = {};
    tenants.forEach(tenant => {
        if(tenant.state) {
           const state = tenant.state.trim();
           if(state) stateMap[state] = (stateMap[state] || 0) + 1;
        }
    });
    return Object.entries(stateMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tenants]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
          <div className="text-sm font-medium text-slate-400">Real-time Database Metrics</div>
       </div>

       {/* GEO ANALYTICS SECTION */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Top States */}
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                <MapPin className="text-cyan-500" size={20} /> Geographic Distribution (By State)
             </h3>
             {topStates.length > 0 ? (
                <div className="space-y-4">
                   {topStates.map((st, idx) => (
                      <div key={idx} className="relative">
                         <div className="flex justify-between mb-1 text-sm text-slate-300">
                            <span>{st.name}</span>
                            <span>{st.count} Users</span>
                         </div>
                         <div className="w-full bg-slate-800 rounded-full h-2">
                            <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${(st.count / tenants.length) * 100}%` }}></div>
                         </div>
                      </div>
                   ))}
                </div>
             ) : (
                <div className="h-64 flex items-center justify-center text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                   No location data yet.
                </div>
             )}
          </div>

          {/* Top Cities */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                <Building2 className="text-violet-500" size={20} /> Top Cities
             </h3>
             <div className="space-y-4">
                {topCities.map((city, idx) => (
                   <div key={idx} className="flex items-center justify-between p-3 bg-slate-950/30 border border-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                         <div className={`w-2 h-8 rounded-full ${
                            idx === 0 ? 'bg-yellow-500' : 
                            idx === 1 ? 'bg-slate-400' : 
                            idx === 2 ? 'bg-amber-700' : 'bg-slate-700'
                         }`} />
                         <span className="text-slate-200 font-bold">{city.name}</span>
                      </div>
                      <span className="text-sm font-medium bg-slate-800 text-slate-300 px-2 py-1 rounded-lg">
                         {city.count}
                      </span>
                   </div>
                ))}
                {topCities.length === 0 && <div className="text-slate-500 text-center py-4">No city data available.</div>}
             </div>
          </div>

       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Signups Growth */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-white font-bold mb-6">User Growth (Total Signups)</h3>
             <div className="h-72">
                {monthlyGrowth.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyGrowth}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                         <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} allowDecimals={false} />
                         <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                           cursor={{fill: '#1e293b'}}
                         />
                         <Legend />
                         <Bar dataKey="Signups" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                   </ResponsiveContainer>
                ) : (
                   <div className="flex items-center justify-center h-full text-slate-500">No signups recorded yet.</div>
                )}
             </div>
          </div>

          {/* Active Paid Plans */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-white font-bold mb-6">Active Paid Subscriptions</h3>
             <div className="h-72 relative">
                {planDistribution.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                         <Pie 
                           data={planDistribution} 
                           innerRadius={60} 
                           outerRadius={100} 
                           paddingAngle={5} 
                           dataKey="value"
                         >
                            {planDistribution.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                         </Pie>
                         <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                         <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                   </ResponsiveContainer>
                ) : (
                   <div className="flex items-center justify-center h-full text-slate-500">No active paid plans found.</div>
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                   <div className="text-3xl font-bold text-white">{totalActivePaid}</div>
                   <div className="text-xs text-slate-500 uppercase font-bold">Total Active</div>
                </div>
             </div>
          </div>

       </div>
    </div>
  );
};

export default AdminAnalytics;
