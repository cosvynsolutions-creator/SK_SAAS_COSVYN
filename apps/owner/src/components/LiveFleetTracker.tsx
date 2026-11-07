import React, { useState, useMemo, useEffect } from 'react';
import { 
  Truck, Navigation, MapPin, Phone, MessageSquare, 
  ExternalLink, CheckCircle2, Clock, AlertTriangle, 
  Package, RotateCcw, Share2, Sparkles, Activity, ShieldCheck,
  Sunrise, Sun, Moon, Calendar
} from 'lucide-react';
import { DeliveryBoyStaff, GlobalCustomer } from '../services/store';

interface LiveFleetTrackerProps {
  staff: DeliveryBoyStaff[];
  customers: GlobalCustomer[];
  deliveryLogs: any[];
  plans?: any[];
  branches?: any[];
  selectedBranch?: string;
  activeMealTab?: 'Breakfast' | 'Lunch' | 'Dinner' | 'All';
  todayStr: string;
  onShareLink?: (boy: any) => void;
}

export const LiveFleetTracker: React.FC<LiveFleetTrackerProps> = ({
  staff,
  customers,
  deliveryLogs,
  plans = [],
  branches = [],
  selectedBranch = 'All',
  activeMealTab = 'Lunch',
  todayStr,
  onShareLink,
}) => {
  const dayOfWeek = new Date().getDay();

  // Selected session tab within Live Fleet view (synced with activeMealTab)
  const [selectedSession, setSelectedSession] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'All'>(
    activeMealTab === 'All' ? 'Lunch' : activeMealTab
  );

  useEffect(() => {
    if (activeMealTab && activeMealTab !== 'All') {
      setSelectedSession(activeMealTab);
    }
  }, [activeMealTab]);

  // Filter staff by selected branch
  const branchFilteredStaff = useMemo(() => {
    if (!selectedBranch || selectedBranch === 'All') return staff;
    const branchObj = branches.find(b => b.id === selectedBranch);
    const branchName = branchObj?.name;
    return staff.filter(s => s.branchId === selectedBranch || (branchName && s.branchId === branchName));
  }, [staff, selectedBranch, branches]);

  // Compute real-time stats for each rider based on TODAY's scheduled drops for this branch and session
  const riderMetrics = useMemo(() => {
    return branchFilteredStaff.map(boy => {
      // Find active customers assigned to this boy within the selected branch
      const boyAssignedCustomers = customers.filter(c => {
        if (c.isActive === false) return false;

        // 1. If a specific branch is selected in Deliveries page:
        if (selectedBranch !== 'All') {
          const branchObj = branches.find(b => b.id === selectedBranch);
          const branchName = branchObj?.name;
          const matchesSelectedBranch = c.branchId === selectedBranch || (branchName && c.branchId === branchName);
          if (!matchesSelectedBranch) return false;
        }

        // 2. Rider's branch matching (if boy has a branch assigned):
        if (boy.branchId) {
          const boyBranchObj = branches.find(b => b.id === boy.branchId);
          const boyBranchName = boyBranchObj?.name;
          const matchesBoyBranch = !c.branchId || c.branchId === boy.branchId || (boyBranchName && c.branchId === boyBranchName);
          if (!matchesBoyBranch) return false;
        }

        // 3. Strict assignment:
        if (c.deliveryBoyId) {
          return c.deliveryBoyId === boy.id || c.deliveryBoyId === boy.name;
        }

        // If c.deliveryBoyId is empty, fallback to exact deliveryBoyName
        if (c.deliveryBoyName && boy.name) {
          return c.deliveryBoyName.trim().toLowerCase() === boy.name.trim().toLowerCase();
        }

        return false;
      });

      // Filter customers that actually have scheduled meals TODAY for the selected session
      const todayActiveCustomers: { customer: GlobalCustomer; mealBoxesCount: number }[] = [];
      let totalMealBoxesToday = 0;

      boyAssignedCustomers.forEach(c => {
        let customerBoxesInSession = 0;

        (c.activePlans || []).forEach((ap: any) => {
          // If viewing a specific meal session (Breakfast/Lunch/Dinner), only count plans for that session
          if (selectedSession !== 'All' && ap.mealTime !== selectedSession) return;

          const planConfig = plans.find((p: any) => p.id === ap.planId);
          const weekdays = planConfig?.weekdays || ap.weekdays || [1, 2, 3, 4, 5, 6];
          const isPaused = ap.pauses?.some((p: any) => todayStr >= p.start && todayStr <= p.end);
          const isValidDay = weekdays.includes(dayOfWeek);
          const isWithinRange = todayStr >= ap.startDate && (!ap.endDate || todayStr <= ap.endDate);

          if (isWithinRange && isValidDay && !isPaused) {
            const qty = Number(ap.quantity) || 1;
            customerBoxesInSession += qty;
            totalMealBoxesToday += qty;
          }
        });

        if (customerBoxesInSession > 0) {
          todayActiveCustomers.push({ customer: c, mealBoxesCount: customerBoxesInSession });
        }
      });

      const totalStops = todayActiveCustomers.length;

      // Find today's logs by this boy for the current meal session
      const boyLogsToday = deliveryLogs.filter(l => {
        const isBoyLog = l.deliveryBoyId === boy.id || l.deliveryBoyName === boy.name;
        const isToday = l.date === todayStr;
        const matchesMeal = selectedSession === 'All' || l.mealTime === selectedSession;
        return isToday && isBoyLog && matchesMeal;
      });

      // Count delivered stops and delivered boxes in this session
      let deliveredStops = 0;
      let deliveredBoxes = 0;

      todayActiveCustomers.forEach(item => {
        const isStopDelivered = boyLogsToday.some(l => 
          l.customerId === item.customer.id && 
          l.status === 'Delivered'
        );
        if (isStopDelivered) {
          deliveredStops++;
          deliveredBoxes += item.mealBoxesCount;
        }
      });

      const completionRate = totalStops > 0 ? Math.round((deliveredStops / totalStops) * 100) : 0;

      // Reusable boxes recollection for this boy today
      const boxesCollected = boyLogsToday.filter(l => 
        l.boxStatus === 'Collected' || l.boxStatus === 'Collected Clean'
      ).length;

      const boxIssues = boyLogsToday.filter(l => 
        l.boxStatus === 'Dirty / Unwashed' || 
        l.boxStatus === 'Damaged / Missing Parts' || 
        l.boxStatus === 'Not Returned'
      ).length;

      const isOnline = boy.status === 'Online' && boy.lastAttendanceDate === todayStr;

      // Location freshness
      let lastActiveText = 'No location reported';
      if (boy.lastLocationUpdate) {
        const diffMs = Date.now() - new Date(boy.lastLocationUpdate).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) lastActiveText = 'Live just now';
        else if (mins < 60) lastActiveText = `${mins}m ago`;
        else lastActiveText = `${Math.floor(mins / 60)}h ago`;
      }

      return {
        ...boy,
        totalStops,
        totalMealBoxesToday,
        deliveredStops,
        deliveredBoxes,
        completionRate,
        boxesCollected,
        boxIssues,
        isOnline,
        lastActiveText,
        hasGps: typeof boy.currentLat === 'number' && typeof boy.currentLng === 'number'
      };
    });
  }, [branchFilteredStaff, customers, deliveryLogs, plans, todayStr, dayOfWeek, selectedBranch, selectedSession, branches]);

  // Today's live logs feed
  const recentFeed = useMemo(() => {
    return [...deliveryLogs]
      .filter(l => l.date === todayStr)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 8);
  }, [deliveryLogs, todayStr]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Session Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="text-primary-600" size={24} />
            Live Rider Fleet & GPS Dispatch Tracker
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Real-time coordinates, assigned stops & boxes for <strong className="text-slate-800">{selectedSession === 'All' ? 'All Day' : selectedSession}</strong>
            {selectedBranch !== 'All' ? ` • ${branches.find(b => b.id === selectedBranch)?.name || selectedBranch}` : ' • All Branches'}
          </p>
        </div>

        {/* Meal Session Toggle */}
        <div className="glass-panel p-1 rounded-xl flex gap-1 shadow-xs border border-slate-200/80 bg-white/90">
          {[
            { id: 'Breakfast', label: 'Breakfast', icon: Sunrise, color: 'text-orange-600' },
            { id: 'Lunch', label: 'Lunch', icon: Sun, color: 'text-blue-600' },
            { id: 'Dinner', label: 'Dinner', icon: Moon, color: 'text-purple-600' },
            { id: 'All', label: 'All Day', icon: Calendar, color: 'text-slate-700' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedSession(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedSession === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <tab.icon size={13} className={selectedSession === tab.id ? 'text-amber-400' : tab.color} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Rider Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {riderMetrics.map(rider => (
          <div 
            key={rider.id}
            className="glass-card rounded-2xl border border-white/80 p-5 shadow-glass flex flex-col justify-between hover:shadow-glass-hover transition-all space-y-4"
          >
            {/* Top row: Name & Online Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs ${
                  rider.isOnline ? 'bg-emerald-600' : 'bg-slate-700'
                }`}>
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-bold font-display text-slate-900 text-base flex items-center gap-2">
                    {rider.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <Phone size={12} /> {rider.mobile || 'No contact'}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {rider.isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Offline
                  </span>
                )}
              </div>
            </div>

            {/* Live GPS Card */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Navigation size={13} className={rider.isOnline ? 'text-emerald-600 animate-spin-slow' : 'text-slate-400'} />
                  GPS Status:
                </span>
                <span className="font-semibold text-slate-700">{rider.lastActiveText}</span>
              </div>

              {rider.hasGps ? (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="font-mono text-[11px] text-slate-500">
                    {rider.currentLat?.toFixed(4)}, {rider.currentLng?.toFixed(4)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${rider.currentLat},${rider.currentLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    <MapPin size={12} />
                    <span>View on Map</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200/60">
                  {rider.isOnline ? 'Acquiring GPS fix...' : 'Awaiting punch in from driver app'}
                </div>
              )}
            </div>

            {/* Delivery Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Route ({selectedSession})</span>
                <span className="font-bold text-slate-900">
                  {rider.totalStops > 0 ? (
                    <>
                      <span className="text-primary-600 font-extrabold">{rider.deliveredStops}</span>
                      <span className="text-slate-500 font-normal"> / {rider.totalStops} Stops</span>
                      <span className="text-[11px] text-slate-600 font-bold ml-1.5">({rider.deliveredBoxes} / {rider.totalMealBoxesToday} Boxes)</span>
                      <span className="ml-1 text-emerald-600 font-bold">({rider.completionRate}%)</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-medium text-[11px] bg-slate-100 px-2 py-0.5 rounded-full">
                      0 Drops Scheduled ({selectedSession})
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-primary-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${rider.completionRate}%` }}
                />
              </div>
            </div>

            {/* Reusable Boxes Info */}
            <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Package size={13} className="text-amber-500" />
                Boxes Recollected:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{rider.boxesCollected}</span>
                {rider.boxIssues > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">
                    {rider.boxIssues} Issues
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/60">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Portal Active</span>
              </span>
              <a
                href={`tel:${rider.mobile}`}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title="Call Rider"
              >
                <Phone size={15} />
              </a>
            </div>

          </div>
        ))}

        {riderMetrics.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 glass-card rounded-2xl border border-white/80">
            <Truck size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700 text-sm">No Delivery Partners Found</h3>
            <p className="text-xs text-slate-400 mt-0.5">Add staff members in Settings to track routes.</p>
          </div>
        )}
      </div>

      {/* Real-time Delivery Activity Stream */}
      <div className="glass-card rounded-2xl border border-white/80 p-5 shadow-glass space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold font-display text-sm text-slate-900 flex items-center gap-2">
            <Clock size={16} className="text-primary-600" />
            Live Delivery & Box Stream (Today)
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Updates in real-time</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {recentFeed.map((log: any, idx: number) => {
            const timeStr = log.deliveredAt || log.boxCollectedAt || log.updatedAt;
            const formattedTime = timeStr ? new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';

            return (
              <div key={log.id || idx} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    log.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {log.status === 'Delivered' ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                  </div>
                  <div className="truncate">
                    <p className="font-semibold text-slate-800 truncate">
                      {log.deliveryBoyName || 'Rider'} ➔ {log.customerName}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{log.mealTime}</span>
                      {log.boxStatus && log.boxStatus !== 'None' && (
                        <>
                          <span>•</span>
                          <span className={`font-semibold ${
                            log.boxStatus === 'Collected' || log.boxStatus === 'Collected Clean' 
                              ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            Box: {log.boxStatus}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {formattedTime}
                </span>
              </div>
            );
          })}

          {recentFeed.length === 0 && (
            <div className="py-6 text-center text-slate-400 italic">
              No delivery events logged yet today. Riders can mark stops as Delivered from their app.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
