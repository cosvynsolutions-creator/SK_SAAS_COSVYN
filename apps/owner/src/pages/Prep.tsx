import React, { useState, useMemo } from 'react';
import { 
  ChefHat, Calendar, Sunrise, Sun, Moon, Loader2, 
  Info, Star, Users, Package, CheckCircle2, Clock, ChevronDown, Store
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';
import { 
  GlobalCustomer, GlobalPlan, getTodayStr, isPlanActiveOnDate, 
  shiftDateStr, formatDateDDMMYYYY, getPlanDietOnDate, DietType 
} from '../services/store';
import { VegNonVegBadge, VegNonVegIcon } from '../components/VegNonVegIndicator';

interface SessionData {
  Veg: Record<string, number>;
  'Non-Veg': Record<string, number>;
  totalVeg: number;
  totalNonVeg: number;
  total: number;
}

interface PrepData {
  normalSummary: {
    Breakfast: SessionData;
    Lunch: SessionData;
    Dinner: SessionData;
  };
  starredSummary: {
    Breakfast: SessionData;
    Lunch: SessionData;
    Dinner: SessionData;
  };
  totals: {
    Breakfast: number;
    Lunch: number;
    Dinner: number;
  };
  special: any[];
  totalCustomers: number;
  vegCustomers: number;
  nonVegCustomers: number;
  totalNormalBoxes: number;
  normalVegBoxes: number;
  normalNonVegBoxes: number;
  totalStarredBoxes: number;
  starredVegBoxes: number;
  starredNonVegBoxes: number;
  grandTotal: number;
  grandTotalVeg: number;
  grandTotalNonVeg: number;
}

const emptySession = (): SessionData => ({
  Veg: {},
  'Non-Veg': {},
  totalVeg: 0,
  totalNonVeg: 0,
  total: 0
});

const Prep = () => {
  const { data: customers = [], loading: l1 } = useStreamCollection<GlobalCustomer>('customers');
  const { data: plansArr = [], loading: l2 } = useStreamCollection<GlobalPlan>('plans');
  const { data: singleOrders = [], loading: l3 } = useStreamCollection<any>('single_orders');
  const { data: branches = [], loading: l4 } = useStreamCollection<any>('branches');

  const isLoading = l1 || l2 || l3 || l4;

  const [selectedBranch, setSelectedBranch] = useState('All');

  // Auto-lock branch if single branch is available (e.g. for branch manager)
  React.useEffect(() => {
    if (branches.length === 1 && selectedBranch !== branches[0].id) {
      setSelectedBranch(branches[0].id);
    }
  }, [branches, selectedBranch]);

  const todayStr = getTodayStr();
  const tomorrowStr = shiftDateStr(todayStr, 1);

  const getPrepData = (targetDate: string): PrepData => {
    // Breakdowns
    const normalSummary: { Breakfast: SessionData; Lunch: SessionData; Dinner: SessionData } = { 
      Breakfast: emptySession(), 
      Lunch: emptySession(), 
      Dinner: emptySession() 
    };
    const starredSummary: { Breakfast: SessionData; Lunch: SessionData; Dinner: SessionData } = { 
      Breakfast: emptySession(), 
      Lunch: emptySession(), 
      Dinner: emptySession() 
    };
    const sessionTotals = { Breakfast: 0, Lunch: 0, Dinner: 0 };
    
    const specialRequests: any[] = [];
    const activeCustomerIds = new Set<string>();
    const customerDietMap = new Map<string, { hasVeg: boolean; hasNonVeg: boolean }>();
    
    let totalNormalBoxes = 0;
    let normalVegBoxes = 0;
    let normalNonVegBoxes = 0;

    let totalStarredBoxes = 0;
    let starredVegBoxes = 0;
    let starredNonVegBoxes = 0;

    // 1. Process Subscription Plans
    customers.filter(c => {
      const branchMatch = selectedBranch === 'All' || c.branchId === selectedBranch;
      return branchMatch;
    }).forEach(c => {
      let customerHasMealOnThisDate = false;

      (c.activePlans || []).forEach(ap => {
        const planConfig = plansArr.find(p => p.id === ap.planId);

        if (isPlanActiveOnDate(ap, targetDate, planConfig, c)) {
          const time = (ap.mealTime || 'Lunch') as 'Breakfast' | 'Lunch' | 'Dinner';
          const isStarred = Boolean(ap.isStarred || (c.highlightMark && c.highlightMark !== 'None'));
          const qty = Number(ap.quantity) || 1;
          const diet: DietType = getPlanDietOnDate(planConfig, targetDate, ap);
          
          sessionTotals[time] = (sessionTotals[time] || 0) + qty;
          customerHasMealOnThisDate = true;

          // Track customer diet profile
          if (!customerDietMap.has(c.id)) {
            customerDietMap.set(c.id, { hasVeg: false, hasNonVeg: false });
          }
          const cProfile = customerDietMap.get(c.id)!;
          if (diet === 'Non-Veg') {
            cProfile.hasNonVeg = true;
          } else {
            cProfile.hasVeg = true;
          }

          if (isStarred) {
            totalStarredBoxes += qty;
            if (diet === 'Non-Veg') {
              starredNonVegBoxes += qty;
              starredSummary[time].totalNonVeg += qty;
            } else {
              starredVegBoxes += qty;
              starredSummary[time].totalVeg += qty;
            }
            starredSummary[time].total += qty;
            starredSummary[time][diet][ap.planName] = (starredSummary[time][diet][ap.planName] || 0) + qty;

            specialRequests.push({
              id: `${c.id}-${time}-${ap.planId}`,
              name: c.name,
              time: ap.mealTime,
              note: c.notes || 'Standard Preparation',
              type: 'Subscription',
              tag: c.highlightMark || 'Special',
              plan: ap.planName,
              diet,
              isStarred: true
            });
          } else {
            totalNormalBoxes += qty;
            if (diet === 'Non-Veg') {
              normalNonVegBoxes += qty;
              normalSummary[time].totalNonVeg += qty;
            } else {
              normalVegBoxes += qty;
              normalSummary[time].totalVeg += qty;
            }
            normalSummary[time].total += qty;
            normalSummary[time][diet][ap.planName] = (normalSummary[time][diet][ap.planName] || 0) + qty;
          }
        }
      });

      if (customerHasMealOnThisDate) {
        activeCustomerIds.add(c.id);
      }
    });

    // 2. Process Single Orders
    singleOrders.forEach(o => {
      const branchMatch = selectedBranch === 'All' || o.branchId === selectedBranch;
      if (o.date === targetDate && branchMatch) {
        const time = (o.time || 'Lunch') as 'Breakfast' | 'Lunch' | 'Dinner';
        sessionTotals[time]++;
        
        // Single orders heuristic for veg vs non-veg
        const checkText = `${o.item || ''} ${o.description || ''}`.toLowerCase();
        const isNonVeg = checkText.includes('non-veg') || checkText.includes('chicken') || checkText.includes('mutton') || checkText.includes('fish') || checkText.includes('egg') || checkText.includes('meat');
        const diet: DietType = isNonVeg ? 'Non-Veg' : 'Veg';

        totalStarredBoxes++;
        if (diet === 'Non-Veg') {
          starredNonVegBoxes++;
          starredSummary[time].totalNonVeg++;
        } else {
          starredVegBoxes++;
          starredSummary[time].totalVeg++;
        }
        starredSummary[time].total++;
        starredSummary[time][diet]['Single Orders'] = (starredSummary[time][diet]['Single Orders'] || 0) + 1;
        
        activeCustomerIds.add(o.customerName); 
        if (!customerDietMap.has(o.customerName)) {
          customerDietMap.set(o.customerName, { hasVeg: !isNonVeg, hasNonVeg: isNonVeg });
        }
        
        specialRequests.push({
          id: o.id,
          name: o.customerName,
          time: o.time,
          note: `ORDER: ${o.item}`,
          type: 'Single Order',
          tag: 'Urgent',
          plan: 'Direct Item',
          diet,
          isStarred: true
        });
      }
    });

    // Calculate customer Veg vs Non-Veg split (strictly adds up to activeCustomerIds.size)
    let vegCustomers = 0;
    let nonVegCustomers = 0;
    activeCustomerIds.forEach(id => {
      const p = customerDietMap.get(id);
      if (p?.hasNonVeg) {
        nonVegCustomers++;
      } else {
        vegCustomers++;
      }
    });

    return { 
      normalSummary,
      starredSummary,
      totals: sessionTotals,
      special: specialRequests,
      totalCustomers: activeCustomerIds.size,
      vegCustomers,
      nonVegCustomers,
      totalNormalBoxes,
      normalVegBoxes,
      normalNonVegBoxes,
      totalStarredBoxes,
      starredVegBoxes,
      starredNonVegBoxes,
      grandTotal: totalNormalBoxes + totalStarredBoxes,
      grandTotalVeg: normalVegBoxes + starredVegBoxes,
      grandTotalNonVeg: normalNonVegBoxes + starredNonVegBoxes
    };
  };

  const todayPrep = useMemo(() => getPrepData(todayStr), [customers, plansArr, singleOrders, todayStr, selectedBranch]);
  const tomorrowPrep = useMemo(() => getPrepData(tomorrowStr), [customers, plansArr, singleOrders, tomorrowStr, selectedBranch]);

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-8 pb-20 pt-2 animate-in fade-in duration-500">
      
      {/* Header with Branch Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <ChefHat className="text-primary-600" size={32} /> Kitchen Preparation Hub
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Production summaries for today and tomorrow with bifurcated Veg & Non-Veg box counts.
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Store size={18} />
          </div>
          <select 
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none transition-all cursor-pointer hover:border-slate-300"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.length > 1 && <option value="All">All Branches</option>}
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      {/* Main Production Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <PrepCard 
          title="Daily Prep" 
          dateLabel="Today" 
          dateValue={todayStr} 
          data={todayPrep} 
          themeColor="primary"
        />
        <PrepCard 
          title="Tomorrow's Plan" 
          dateLabel="Tomorrow" 
          dateValue={tomorrowStr} 
          data={tomorrowPrep} 
          themeColor="slate"
        />
      </div>

      {/* Checklist Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
           <Star className="text-amber-500" fill="currentColor" size={24} />
           <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Special Preparation Checklist</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <SpecialList title="Today's Specials" list={todayPrep.special} dateLabel={todayStr} />
           <SpecialList title="Tomorrow's Specials" list={tomorrowPrep.special} dateLabel={tomorrowStr} />
        </div>
      </div>

    </div>
  );
};

interface PrepCardProps {
  title: string;
  dateLabel: string;
  dateValue: string;
  data: PrepData;
  themeColor: 'primary' | 'slate';
}

const PrepCard: React.FC<PrepCardProps> = ({ title, dateLabel, dateValue, data, themeColor }) => {
  const isPrimary = themeColor === 'primary';
  
  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header Row */}
      <div className={`p-7 pb-6 flex justify-between items-start ${isPrimary ? 'bg-primary-50/30' : 'bg-slate-50/50'}`}>
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span className={isPrimary ? 'text-primary-600' : 'text-slate-600'}>
              {isPrimary ? <UtensilsIcon /> : <ClockIcon />}
            </span> 
            {title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{dateLabel}</span>
             <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-slate-100 text-slate-400">{formatDateDDMMYYYY(dateValue)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className={`px-5 py-2.5 rounded-2xl font-black text-lg border shadow-md flex items-center gap-2 ${
            isPrimary ? 'bg-primary-600 text-white border-primary-700' : 'bg-slate-800 text-white border-slate-900'
          }`}>
            <span>{data.grandTotal} Boxes</span>
          </div>
          <div className="text-[11px] font-bold text-slate-500 mt-1.5 flex items-center gap-1.5">
            <span className="text-emerald-700 font-extrabold flex items-center gap-1">
              <VegNonVegIcon diet="Veg" size={10} /> V {data.grandTotalVeg}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-rose-700 font-extrabold flex items-center gap-1">
              <VegNonVegIcon diet="Non-Veg" size={10} /> NV {data.grandTotalNonVeg}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Row matching Screenshot 2 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 px-6 sm:px-8 mb-6">
         {/* ACTIVE CUSTOMERS */}
         <div className="bg-slate-50/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
               <Users size={11}/> Active Customers
            </p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{data.totalCustomers}</p>
            <div className="text-[11px] font-bold mt-1 flex items-center gap-1.5 flex-wrap">
               <span className="text-emerald-700 font-black flex items-center gap-1">
                 <VegNonVegIcon diet="Veg" size={9} /> V {data.vegCustomers}
               </span>
               <span className="text-slate-300 font-normal">|</span>
               <span className="text-rose-700 font-black flex items-center gap-1">
                 <VegNonVegIcon diet="Non-Veg" size={9} /> NV {data.nonVegCustomers}
               </span>
            </div>
         </div>

         {/* NORMAL PLANS */}
         <div className="bg-blue-50/80 p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 shadow-2xs">
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
               <Package size={11}/> Normal Plans
            </p>
            <p className="text-2xl sm:text-3xl font-black text-blue-700">{data.totalNormalBoxes}</p>
            <div className="text-[11px] font-bold mt-1 flex items-center gap-1.5 flex-wrap">
               <span className="text-emerald-700 font-black flex items-center gap-1">
                 <VegNonVegIcon diet="Veg" size={9} /> V {data.normalVegBoxes}
               </span>
               <span className="text-blue-300 font-normal">|</span>
               <span className="text-rose-700 font-black flex items-center gap-1">
                 <VegNonVegIcon diet="Non-Veg" size={9} /> NV {data.normalNonVegBoxes}
               </span>
            </div>
         </div>

         {/* STARRED PLANS */}
         <div className="bg-amber-50/80 p-3.5 sm:p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
               <Star size={11} fill="currentColor"/> Starred Plans
            </p>
            <p className="text-2xl sm:text-3xl font-black text-amber-700">{data.totalStarredBoxes}</p>
            <div className="text-[11px] font-bold mt-1 flex items-center gap-1.5 flex-wrap">
               <span className="text-emerald-700 font-black flex items-center gap-1">
                 <VegNonVegIcon diet="Veg" size={9} /> V {data.starredVegBoxes}
               </span>
               <span className="text-amber-300 font-normal">|</span>
               <span className="text-rose-700 font-black flex items-center gap-1">
                 <VegNonVegIcon diet="Non-Veg" size={9} /> NV {data.starredNonVegBoxes}
               </span>
            </div>
         </div>
      </div>

      {/* Normal Breakdown Row */}
      <div className="px-6 sm:px-8 mb-4">
         <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
               Normal Preparation Summary
            </h4>
            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
               <span className="text-emerald-700 font-black">V {data.normalVegBoxes}</span>
               <span className="text-slate-300">•</span>
               <span className="text-rose-700 font-black">NV {data.normalNonVegBoxes}</span>
            </span>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MealSlot 
              icon={Sunrise} 
              type="Breakfast" 
              sessionData={data.normalSummary.Breakfast} 
              color="text-yellow-500" 
              bg="bg-yellow-50/30 border-yellow-200/60" 
            />
            <MealSlot 
              icon={Sun} 
              type="Lunch" 
              sessionData={data.normalSummary.Lunch} 
              color="text-orange-500" 
              bg="bg-orange-50/30 border-orange-200/60" 
            />
            <MealSlot 
              icon={Moon} 
              type="Dinner" 
              sessionData={data.normalSummary.Dinner} 
              color="text-indigo-500" 
              bg="bg-indigo-50/30 border-indigo-200/60" 
            />
         </div>
      </div>

      {/* Starred Breakdown Row */}
      <div className="px-6 sm:px-8 pb-8">
         <div className="flex items-center justify-between mt-5 mb-3">
            <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2">
               <Star size={12} fill="currentColor" /> Starred Preparation Summary
            </h4>
            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1.5">
               <span className="text-emerald-700 font-black">V {data.starredVegBoxes}</span>
               <span className="text-amber-300">•</span>
               <span className="text-rose-700 font-black">NV {data.starredNonVegBoxes}</span>
            </span>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MealSlot 
              icon={Sunrise} 
              type="Breakfast" 
              sessionData={data.starredSummary.Breakfast} 
              color="text-amber-500" 
              bg="bg-amber-50/40 border-amber-200/80" 
              isStarred
            />
            <MealSlot 
              icon={Sun} 
              type="Lunch" 
              sessionData={data.starredSummary.Lunch} 
              color="text-amber-500" 
              bg="bg-amber-50/40 border-amber-200/80" 
              isStarred
            />
            <MealSlot 
              icon={Moon} 
              type="Dinner" 
              sessionData={data.starredSummary.Dinner} 
              color="text-amber-500" 
              bg="bg-amber-50/40 border-amber-200/80" 
              isStarred
            />
         </div>
      </div>
    </div>
  );
};

interface MealSlotProps {
  icon: any;
  type: string;
  sessionData: SessionData;
  color: string;
  bg: string;
  isStarred?: boolean;
}

/**
 * MealSlot with side-by-side Veg | N-veg bifurcation matching Screenshot 2 yellow wireframe
 */
const MealSlot: React.FC<MealSlotProps> = ({ 
  icon: Icon, 
  type, 
  sessionData, 
  color, 
  bg, 
  isStarred 
}) => {
  const vegEntries = Object.entries(sessionData?.Veg || {});
  const nonVegEntries = Object.entries(sessionData?.['Non-Veg'] || {});
  const totalInSlot = (sessionData?.totalVeg || 0) + (sessionData?.totalNonVeg || 0);

  return (
    <div className={`p-3.5 sm:p-4 rounded-[1.75rem] border flex flex-col justify-between shadow-2xs ${bg}`}>
      {/* Slot Header */}
      <div className="flex justify-between items-center mb-2.5">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 sm:p-2 bg-white rounded-xl shadow-xs ${color}`}>
            <Icon size={15} />
          </div>
          <div>
            <span className="font-black text-[10px] text-slate-500 uppercase tracking-widest block">
              {type}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              <strong className="text-emerald-700">V: {sessionData?.totalVeg || 0}</strong> • <strong className="text-rose-700">NV: {sessionData?.totalNonVeg || 0}</strong>
            </span>
          </div>
        </div>
        <div className={`font-black text-base px-2.5 py-0.5 rounded-xl border ${
          isStarred 
            ? 'bg-amber-100 text-amber-900 border-amber-300' 
            : 'bg-white text-slate-900 border-slate-200'
        }`}>
          {totalInSlot}
        </div>
      </div>

      {/* Bifurcated V | NV Columns matching Screenshot 2 Handwritten Wireframe */}
      <div className="grid grid-cols-2 divide-x divide-slate-200/90 bg-white/80 rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
        {/* VEG (V) COLUMN */}
        <div className="p-2 sm:p-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-emerald-100">
              <span className="flex items-center gap-1 text-[11px] font-black text-emerald-800">
                <VegNonVegIcon diet="Veg" size={11} /> V
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-900">
                {sessionData?.totalVeg || 0}
              </span>
            </div>
            
            <div className="space-y-1 overflow-y-auto max-h-[110px] no-scrollbar pr-0.5">
              {vegEntries.map(([name, qty]) => (
                <div key={name} className="flex justify-between items-center text-[11px] leading-tight hover:bg-emerald-50/50 rounded p-0.5">
                  <span className="text-slate-700 font-semibold truncate pr-1" title={name}>{name}</span>
                  <span className="font-black text-emerald-700 shrink-0">{qty}</span>
                </div>
              ))}
              {vegEntries.length === 0 && (
                <div className="text-[10px] text-slate-300 italic py-2 text-center">0 V</div>
              )}
            </div>
          </div>
        </div>

        {/* NON-VEG (NV) COLUMN */}
        <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-rose-50/20">
          <div>
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-rose-100">
              <span className="flex items-center gap-1 text-[11px] font-black text-rose-800">
                <VegNonVegIcon diet="Non-Veg" size={11} /> NV
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-900">
                {sessionData?.totalNonVeg || 0}
              </span>
            </div>
            
            <div className="space-y-1 overflow-y-auto max-h-[110px] no-scrollbar pr-0.5">
              {nonVegEntries.map(([name, qty]) => (
                <div key={name} className="flex justify-between items-center text-[11px] leading-tight hover:bg-rose-50/50 rounded p-0.5">
                  <span className="text-slate-700 font-semibold truncate pr-1" title={name}>{name}</span>
                  <span className="font-black text-rose-700 shrink-0">{qty}</span>
                </div>
              ))}
              {nonVegEntries.length === 0 && (
                <div className="text-[10px] text-slate-300 italic py-2 text-center">0 NV</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SpecialList = ({ title, list, dateLabel }: any) => (
  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
     <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest">{title}</h3>
           <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {list.length} items
           </span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 font-mono">{formatDateDDMMYYYY(dateLabel)}</span>
     </div>
     <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto no-scrollbar">
        {list.length > 0 ? list.map((item: any) => (
          <div key={item.id} className="group relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border-l-4 border-l-amber-400">
             <div className="flex justify-between items-start mb-2">
                <div>
                   <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                      <VegNonVegBadge diet={item.diet || 'Veg'} size="xs" shortLabel />
                   </div>
                   <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase ${
                        item.time === 'Breakfast' ? 'bg-yellow-50 text-yellow-600' :
                        item.time === 'Lunch' ? 'bg-orange-50 text-orange-600' :
                        'bg-indigo-50 text-indigo-600'
                      }`}>
                        {item.time}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{item.plan}</span>
                   </div>
                </div>
                <div className="flex gap-1 items-center">
                   <Star size={12} className="text-amber-500" fill="currentColor" />
                   <span className={`text-[7px] font-black px-1 rounded-sm uppercase ${
                      item.tag === 'Urgent' ? 'bg-red-500 text-white' : 
                      item.tag === 'Dietary' ? 'bg-emerald-500 text-white' : 
                      'bg-primary-600 text-white'
                   }`}>{item.tag}</span>
                </div>
             </div>
             
             <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                   <Info size={10}/> Chef's Note
                </p>
                <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                   "{item.note}"
                </p>
             </div>

             <div className="mt-3 flex justify-between items-center text-[8px] font-black text-slate-300 uppercase tracking-widest">
                <span className="flex items-center gap-1"><Clock size={8}/> {item.type}</span>
                <CheckCircle2 size={14} className="group-hover:text-emerald-500 transition-colors cursor-pointer" />
             </div>
          </div>
        )) : (
          <div className="text-center py-10">
             <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} className="text-slate-200" />
             </div>
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">All Standard Prep</p>
          </div>
        )}
     </div>
  </div>
);

// Helpers
const UtensilsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
);
const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default Prep;
