import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Activity, Loader2, 
  ChevronDown, Calendar, Store, PieChart as PieIcon, BarChart3, Utensils, Package,
  ShieldAlert, AlertTriangle, CheckCircle2, MapPin, ArrowUpRight, ArrowDownRight,
  Sparkles, RefreshCw, Layers, Award, Clock, Printer, Download, Info
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';
import { GlassmorphicDonutChart } from '../components/GlassmorphicDonutChart';
import { getCustomerBoxHealth, getCustomerUncollectedBoxesCount, getDaysDifference } from '../services/store';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Analytics = () => {
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: expenses = [], loading: l2 } = useStreamCollection<any>('expenses');
  const { data: branches = [], loading: l3 } = useStreamCollection<any>('branches');
  const { data: payments = [], loading: l4 } = useStreamCollection<any>('payments');

  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [activeKriDetail, setActiveKriDetail] = useState<'churn' | 'pause' | 'box' | 'receivables' | null>(null);

  const isLoading = l1 || l2 || l3 || l4;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Dynamic Options for Filters
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const current = new Date().getFullYear().toString();
    years.add(current);
    customers.forEach(c => { if(c.createdAt) years.add(new Date(c.createdAt).getFullYear().toString()); });
    expenses.forEach(e => { if(e.date) years.add(new Date(e.date).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [customers, expenses]);

  // --- CORE FILTER LOGIC ---
  const filteredData = useMemo(() => {
    const fCust = customers.filter(c => {
      const date = new Date(c.createdAt || c.startDate || todayStr);
      const matchesBranch = selectedBranch === 'All' || c.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || date.getFullYear().toString() === selectedYear;
      const matchesMonth = selectedMonth === 'All' || date.getMonth().toString() === selectedMonth;
      return matchesBranch && matchesYear && matchesMonth;
    });

    const fExp = expenses.filter(e => {
      const date = new Date(e.date || todayStr);
      const matchesBranch = selectedBranch === 'All' || e.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || date.getFullYear().toString() === selectedYear;
      const matchesMonth = selectedMonth === 'All' || date.getMonth().toString() === selectedMonth;
      return matchesBranch && matchesYear && matchesMonth;
    });

    return { fCust, fExp };
  }, [customers, expenses, selectedBranch, selectedYear, selectedMonth, todayStr]);

  // --- COMPREHENSIVE FINANCIAL & SUBSCRIPTION KPIS ---
  const kpis = useMemo(() => {
    const revenue = filteredData.fCust.reduce((acc, c) => acc + (Number(c.planPrice) || 0) + (Number(c.deliveryCharges) || 0), 0);
    const expense = filteredData.fExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const profit = revenue - expense;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Filter Food Expenses specifically for COGS % (Cost of Goods Sold)
    const foodExpense = filteredData.fExp
      .filter(e => (e.category || '').toLowerCase().includes('food') || (e.category || '').toLowerCase().includes('grocery'))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const foodCostPercentage = revenue > 0 ? (foodExpense / revenue) * 100 : 0;

    // Active customer base
    const activeCustomers = filteredData.fCust.filter(c => c.isActive);
    const activeCount = activeCustomers.length;

    // Monthly Recurring Revenue (MRR) projection
    const mrr = activeCustomers.reduce((acc, c) => acc + (Number(c.planPrice) || 0), 0);

    // Average Revenue Per User (ARPU)
    const arpu = activeCount > 0 ? revenue / activeCount : 0;

    // Renewal Rate (%)
    const renewedCount = filteredData.fCust.filter(c => (Number(c.renewalCount) || 0) > 0).length;
    const renewalRate = filteredData.fCust.length > 0 ? (renewedCount / filteredData.fCust.length) * 100 : 0;

    return { 
      revenue, 
      expense, 
      profit, 
      profitMargin,
      foodExpense,
      foodCostPercentage,
      active: activeCount, 
      mrr,
      arpu,
      renewalRate,
      totalCustomers: filteredData.fCust.length
    };
  }, [filteredData]);

  // --- KRI (KEY RISK INDICATORS) RADAR ---
  const kris = useMemo(() => {
    // 1. Churn Risk: Customers finishing within 7 days who haven't renewed
    const expiringIn7Days = filteredData.fCust.filter(c => {
      if (!c.isActive) return false;
      const daysLeft = c.daysLeft !== undefined && c.daysLeft !== null
        ? Number(c.daysLeft)
        : (c.endDate ? getDaysDifference(todayStr, c.endDate) : 99);
      return daysLeft <= 7 && daysLeft >= 0;
    });
    const churnRiskRevenue = expiringIn7Days.reduce((acc, c) => acc + (Number(c.planPrice) || 0), 0);

    // 2. High Pause Ratio (Frozen Cashflow Risk)
    const pausedToday = filteredData.fCust.filter(c => {
      if (!c.isActive) return false;
      return (c.activePlans || []).some((p: any) => 
        (p.pauses || []).some((pause: any) => todayStr >= pause.start && todayStr <= pause.end)
      );
    });
    const pauseRatio = kpis.active > 0 ? (pausedToday.length / kpis.active) * 100 : 0;

    // 3. Reusable Box Shrinkage Risk (Capital loss on uncollected or damaged dabbas)
    let uncollectedCount = 0;
    let damagedCount = 0;
    filteredData.fCust.forEach(c => {
      const health = getCustomerBoxHealth(c);
      damagedCount += health.damaged;
      uncollectedCount += getCustomerUncollectedBoxesCount(c);
    });
    // Approx replacement cost ₹200 per steel/meal container
    const boxShrinkageValue = (uncollectedCount + damagedCount) * 200;

    // 4. Overdue Receivables Aging (Customers receiving food on credit)
    const overdueCustomers = filteredData.fCust.filter(c => c.paymentStatus === 'Pending' && (Number(c.pendingAmount) || 0) > 0);
    const totalOverdueReceivables = overdueCustomers.reduce((acc, c) => acc + (Number(c.pendingAmount) || 0), 0);

    return {
      expiringCount: expiringIn7Days.length,
      expiringRevenue: churnRiskRevenue,
      expiringList: expiringIn7Days,
      pausedCount: pausedToday.length,
      pauseRatio,
      pausedList: pausedToday,
      uncollectedCount,
      damagedCount,
      boxShrinkageValue,
      overdueCount: overdueCustomers.length,
      overdueTotal: totalOverdueReceivables,
      overdueList: overdueCustomers
    };
  }, [filteredData.fCust, kpis.active, todayStr]);

  // --- UNIT ECONOMICS PER MEAL BOX ---
  const unitEconomics = useMemo(() => {
    // Estimate total deliveries based on active plans
    let estimatedMealsCount = 0;
    filteredData.fCust.forEach(c => {
      (c.activePlans || []).forEach((p: any) => {
        // Average 24 delivery days per month per subscribed plan
        estimatedMealsCount += 24;
      });
    });
    if (estimatedMealsCount === 0) estimatedMealsCount = Math.max(1, kpis.active * 24);

    const packagingExpense = filteredData.fExp
      .filter(e => (e.category || '').toLowerCase().includes('packag'))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    const deliveryExpense = filteredData.fExp
      .filter(e => (e.category || '').toLowerCase().includes('transport') || (e.category || '').toLowerCase().includes('fuel') || (e.category || '').toLowerCase().includes('salar'))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    const revenuePerBox = Math.round(kpis.revenue / estimatedMealsCount);
    const foodCostPerBox = Math.round(kpis.foodExpense / estimatedMealsCount);
    const packagingCostPerBox = Math.round(packagingExpense / estimatedMealsCount);
    const deliveryCostPerBox = Math.round(deliveryExpense / estimatedMealsCount);
    const otherCostPerBox = Math.round((kpis.expense - kpis.foodExpense - packagingExpense - deliveryExpense) / estimatedMealsCount);
    const profitPerBox = Math.round(kpis.profit / estimatedMealsCount);

    return {
      totalMeals: estimatedMealsCount,
      revenuePerBox,
      foodCostPerBox,
      packagingCostPerBox,
      deliveryCostPerBox,
      otherCostPerBox,
      profitPerBox,
      netMargin: revenuePerBox > 0 ? ((profitPerBox / revenuePerBox) * 100).toFixed(1) : '0'
    };
  }, [filteredData, kpis]);

  // --- GEOGRAPHICAL CLUSTER & DELIVERY DENSITY INTELLIGENCE ---
  const areaDensityData = useMemo(() => {
    const areaMap: Record<string, { count: number; revenue: number }> = {};

    filteredData.fCust.forEach(c => {
      const areaName = (c.area || 'Direct Kitchen Hub').trim();
      if (!areaMap[areaName]) areaMap[areaName] = { count: 0, revenue: 0 };
      areaMap[areaName].count++;
      areaMap[areaName].revenue += (Number(c.planPrice) || 0) + (Number(c.deliveryCharges) || 0);
    });

    const list = Object.entries(areaMap)
      .map(([area, data]) => ({
        area,
        customers: data.count,
        revenue: data.revenue,
        densityRating: data.count >= 8 ? 'High Density' : data.count >= 4 ? 'Moderate' : 'Emerging'
      }))
      .sort((a, b) => b.customers - a.customers)
      .slice(0, 7);

    return list;
  }, [filteredData.fCust]);

  // --- ADAPTIVE MAIN TREND GRAPH ---
  const trendData = useMemo(() => {
    if (selectedYear === 'All') {
      return yearOptions.map(y => {
        const rev = customers.filter(c => new Date(c.createdAt || c.startDate || todayStr).getFullYear().toString() === y)
          .reduce((a, b) => a + (Number(b.planPrice) || 0) + (Number(b.deliveryCharges) || 0), 0);
        const exp = expenses.filter(e => new Date(e.date || todayStr).getFullYear().toString() === y)
          .reduce((a, b) => a + (Number(b.amount) || 0), 0);
        return { name: y, Revenue: rev, Expense: exp, Profit: rev - exp };
      }).sort((a, b) => a.name.localeCompare(b.name));
    }

    if (selectedMonth === 'All') {
      return MONTHS.map((m, i) => {
        const rev = customers.filter(c => {
          const d = new Date(c.createdAt || c.startDate || todayStr);
          return d.getFullYear().toString() === selectedYear && d.getMonth() === i;
        }).reduce((a, b) => a + (Number(b.planPrice) || 0) + (Number(b.deliveryCharges) || 0), 0);

        const exp = expenses.filter(e => {
          const d = new Date(e.date || todayStr);
          return d.getFullYear().toString() === selectedYear && d.getMonth() === i;
        }).reduce((a, b) => a + (Number(b.amount) || 0), 0);

        return { name: m, Revenue: rev, Expense: exp, Profit: rev - exp };
      });
    }

    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((w, idx) => {
      const rev = kpis.revenue / 4;
      const exp = kpis.expense / 4;
      return { name: w, Revenue: Math.round(rev), Expense: Math.round(exp), Profit: Math.round(rev - exp) };
    });
  }, [selectedYear, selectedMonth, customers, expenses, yearOptions, kpis, todayStr]);

  // --- SECONDARY BREAKDOWNS ---
  const expenseBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.fExp.forEach(e => {
      const cat = e.category || 'Others';
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData.fExp]);

  const customerGrowth = useMemo(() => {
    const monthsData = MONTHS.map((m, i) => {
      const count = customers.filter(c => {
        const d = new Date(c.createdAt || c.startDate || todayStr);
        const yMatches = selectedYear === 'All' || d.getFullYear().toString() === selectedYear;
        return yMatches && d.getMonth() === i;
      }).length;
      return { name: m, Signups: count };
    });
    return monthsData;
  }, [customers, selectedYear, todayStr]);

  const revenueByPlan = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.fCust.forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        const planName = ap.planName || 'Standard Meal';
        map[planName] = (map[planName] || 0) + (Number(ap.price) || 0);
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData.fCust]);

  const mealTimeBreakdown = useMemo(() => {
    const slots = [
      { name: 'Breakfast', total: 0 },
      { name: 'Lunch', total: 0 },
      { name: 'Dinner', total: 0 }
    ];
    
    const uniquePlans = new Set<string>();

    filteredData.fCust.forEach(c => {
      (c.activePlans || []).forEach((ap: any) => {
        const slot: any = slots.find(d => d.name === ap.mealTime);
        if (slot) {
          slot[ap.planName] = (slot[ap.planName] || 0) + 1;
          slot.total++;
          uniquePlans.add(ap.planName);
        }
      });
    });

    return {
      data: slots,
      plans: Array.from(uniquePlans)
    };
  }, [filteredData.fCust]);

  const reusableBoxHealthData = useMemo(() => {
    let clean = 0;
    let unclean = 0;
    let damaged = 0;
    let withCustomer = 0;

    customers.forEach(c => {
      const health = getCustomerBoxHealth(c);
      clean += health.clean;
      unclean += health.unclean;
      damaged += health.damaged;
      withCustomer += getCustomerUncollectedBoxesCount(c);
    });

    const list = [
      { name: 'Clean Returned', value: clean, color: '#10b981' },
      { name: 'Unclean / Washing Due', value: unclean, color: '#f59e0b' },
      { name: 'Damaged / Missing', value: damaged, color: '#f43f5e' },
      { name: 'With Customers (Uncollected)', value: withCustomer, color: '#6366f1' },
    ];
    
    const activeData = list.filter(d => d.value > 0);
    if (activeData.length === 0) {
      return [{ name: 'Containers Active', value: customers.filter(c => c.reusableBoxEnabled).length || 1, color: '#3b82f6' }];
    }
    return activeData;
  }, [customers]);

  const handlePrintSummary = () => {
    window.print();
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary-600" size={48} /></div>;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 font-display tracking-tight flex items-center gap-2">
               Kitchen Analytics & Intelligence
            </h1>
            <span className="bg-primary-500/10 text-primary-700 border border-primary-500/20 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={11} /> v2.0
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Unit economics, operational margins, KRI risk radar & delivery cluster optimization
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Branch Filter */}
          <div className="relative flex-1 sm:flex-none sm:w-40">
            <select 
              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer appearance-none" 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="All">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Store className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          {/* Year Filter */}
          <div className="relative flex-1 sm:flex-none sm:w-32">
            <select 
              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer appearance-none" 
              value={selectedYear} 
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedMonth('All'); }}
            >
              <option value="All">All Years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          {/* Month Filter */}
          <div className="relative flex-1 sm:flex-none sm:w-32">
            <select 
              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer appearance-none disabled:opacity-50" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={selectedYear === 'All'}
            >
              <option value="All">All Months</option>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          {/* Print/Export Button */}
          <button 
            onClick={handlePrintSummary}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-xs shrink-0"
            title="Print Analytics Dossier"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* 2. Top Primary Financial & Retention KPI Ribbon (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">Total Revenue</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><DollarSign size={14} /></span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-black text-slate-900 font-display">₹{Math.round(kpis.revenue).toLocaleString()}</h3>
            <span className="text-[10px] text-slate-400 font-medium">Billed subscriptions</span>
          </div>
        </div>

        {/* Card 2: Operating Expense */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">Total Expense</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><TrendingDown size={14} /></span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-black text-slate-900 font-display">₹{Math.round(kpis.expense).toLocaleString()}</h3>
            <span className="text-[10px] text-slate-400 font-medium">Grocery, staff, fuel</span>
          </div>
        </div>

        {/* Card 3: Net Operating Profit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">Net Profit</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><TrendingUp size={14} /></span>
          </div>
          <div className="mt-2">
            <h3 className={`text-xl font-black font-display ${kpis.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ₹{Math.round(kpis.profit).toLocaleString()}
            </h3>
            <span className={`text-[10px] font-bold ${kpis.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {kpis.profitMargin.toFixed(1)}% Net Margin
            </span>
          </div>
        </div>

        {/* Card 4: Food Cost % (COGS) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">Food Cost (COGS)</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Utensils size={14} /></span>
          </div>
          <div className="mt-2">
            <h3 className={`text-xl font-black font-display ${kpis.foodCostPercentage <= 38 ? 'text-slate-900' : 'text-amber-600'}`}>
              {kpis.foodCostPercentage.toFixed(1)}%
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">
              {kpis.foodCostPercentage <= 38 ? 'Healthy (<38%)' : 'High cost alert'}
            </span>
          </div>
        </div>

        {/* Card 5: Active Subscriptions & MRR */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">Active Subscribers</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Users size={14} /></span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-black text-slate-900 font-display">{kpis.active}</h3>
            <span className="text-[10px] text-indigo-600 font-bold">MRR: ₹{Math.round(kpis.mrr).toLocaleString()}</span>
          </div>
        </div>

        {/* Card 6: Renewal Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">Renewal Rate</span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600"><RefreshCw size={14} /></span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-black text-slate-900 font-display">{kpis.renewalRate.toFixed(0)}%</h3>
            <span className="text-[10px] text-slate-400 font-medium">ARPU: ₹{Math.round(kpis.arpu).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 3. KRI (Key Risk Indicators) Early Warning Radar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display tracking-tight flex items-center gap-2">
                  Operational KRI Radar (Key Risk Indicators)
                </h3>
                <p className="text-xs text-slate-400">Early warnings to prevent churn, container loss & cashflow leakage</p>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase bg-white/10 text-slate-300 px-3 py-1 rounded-full border border-white/10">
              Live Monitor • Updated Today
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* KRI 1: Immediate Churn Risk */}
            <div 
              onClick={() => setActiveKriDetail(activeKriDetail === 'churn' ? null : 'churn')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                kris.expiringCount > 0 
                  ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-400' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Churn Risk (≤7 Days)
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                  {kris.expiringCount} Plans
                </span>
              </div>
              <p className="text-xl font-black font-display text-white mt-2">
                ₹{kris.expiringRevenue.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Revenue at immediate risk without renewal
              </p>
            </div>

            {/* KRI 2: High Pause Ratio */}
            <div 
              onClick={() => setActiveKriDetail(activeKriDetail === 'pause' ? null : 'pause')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                kris.pauseRatio > 15 
                  ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Clock size={14} /> Active Pause Ratio
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {kris.pausedCount} Paused
                </span>
              </div>
              <p className="text-xl font-black font-display text-white mt-2">
                {kris.pauseRatio.toFixed(1)}%
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {kris.pauseRatio > 15 ? 'High ratio: cashflow hold alert' : 'Healthy pause accumulation (<15%)'}
              </p>
            </div>

            {/* KRI 3: Dabba Shrinkage Risk */}
            <div 
              onClick={() => setActiveKriDetail(activeKriDetail === 'box' ? null : 'box')}
              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Package size={14} /> Dabba Shrinkage Risk
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  {kris.uncollectedCount + kris.damagedCount} Boxes
                </span>
              </div>
              <p className="text-xl font-black font-display text-white mt-2">
                ₹{kris.boxShrinkageValue.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Replacement value for unrecovered boxes
              </p>
            </div>

            {/* KRI 4: Outstanding Receivables */}
            <div 
              onClick={() => setActiveKriDetail(activeKriDetail === 'receivables' ? null : 'receivables')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                kris.overdueTotal > 0 
                  ? 'bg-orange-500/10 border-orange-500/30 hover:border-orange-400' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                  <DollarSign size={14} /> Overdue Receivables
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                  {kris.overdueCount} Accounts
                </span>
              </div>
              <p className="text-xl font-black font-display text-white mt-2">
                ₹{kris.overdueTotal.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Food delivered with pending payment
              </p>
            </div>
          </div>

          {/* Expandable KRI Action Tray */}
          {activeKriDetail && (
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  {activeKriDetail === 'churn' && `High-Priority Renewal Targets (${kris.expiringCount} Customers)`}
                  {activeKriDetail === 'pause' && `Currently Paused Subscriptions (${kris.pausedCount} Customers)`}
                  {activeKriDetail === 'box' && `Container Shrinkage Audit (${kris.uncollectedCount} Uncollected • ${kris.damagedCount} Damaged)`}
                  {activeKriDetail === 'receivables' && `Outstanding Payment Collections (${kris.overdueCount} Accounts)`}
                </h4>
                <button 
                  onClick={() => setActiveKriDetail(null)} 
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close Tray ✕
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                {activeKriDetail === 'churn' && kris.expiringList.slice(0, 8).map((c: any) => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="font-bold text-white">{c.name}</span>
                      <span className="text-slate-400 text-[11px] ml-2 font-mono">{c.mobile}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-rose-400 font-bold">Expires in {c.daysLeft}d</span>
                      <span className="text-slate-300 font-mono">₹{c.planPrice}</span>
                    </div>
                  </div>
                ))}

                {activeKriDetail === 'receivables' && kris.overdueList.slice(0, 8).map((c: any) => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="font-bold text-white">{c.name}</span>
                      <span className="text-slate-400 text-[11px] ml-2 font-mono">{c.mobile}</span>
                    </div>
                    <span className="text-amber-400 font-mono font-bold">Due: ₹{c.pendingAmount}</span>
                  </div>
                ))}

                {(activeKriDetail === 'pause' || activeKriDetail === 'box') && (
                  <p className="text-xs text-slate-400 py-2">
                    Review detailed records in Customers & Deliveries manager to dispatch prompt alerts and collection tasks.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Unit Economics per Meal Box + Delivery Density Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Unit Economics Breakdown Card */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-xs">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">
                    Unit Economics per Meal Box
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Based on ~{unitEconomics.totalMeals.toLocaleString()} estimated meal boxes dispatched
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {unitEconomics.netMargin}% Net Margin
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-5">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-bold text-slate-600">Net Profit Per Meal Box</span>
                <span className="text-2xl font-black font-display text-emerald-600">
                  ₹{unitEconomics.profitPerBox}
                  <span className="text-xs font-normal text-slate-400 ml-1">/ box</span>
                </span>
              </div>
              
              {/* Stacked Cost Visualizer Bar */}
              <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                <div 
                  style={{ width: `${Math.min(100, (unitEconomics.foodCostPerBox / (unitEconomics.revenuePerBox || 1)) * 100)}%` }} 
                  className="bg-amber-500 h-full" 
                  title={`Food: ₹${unitEconomics.foodCostPerBox}`}
                />
                <div 
                  style={{ width: `${Math.min(100, (unitEconomics.packagingCostPerBox / (unitEconomics.revenuePerBox || 1)) * 100)}%` }} 
                  className="bg-purple-500 h-full" 
                  title={`Packaging: ₹${unitEconomics.packagingCostPerBox}`}
                />
                <div 
                  style={{ width: `${Math.min(100, (unitEconomics.deliveryCostPerBox / (unitEconomics.revenuePerBox || 1)) * 100)}%` }} 
                  className="bg-blue-500 h-full" 
                  title={`Delivery: ₹${unitEconomics.deliveryCostPerBox}`}
                />
                <div 
                  style={{ width: `${Math.max(0, 100 - ((unitEconomics.foodCostPerBox + unitEconomics.packagingCostPerBox + unitEconomics.deliveryCostPerBox) / (unitEconomics.revenuePerBox || 1)) * 100)}%` }} 
                  className="bg-emerald-500 h-full" 
                  title={`Net Profit: ₹${unitEconomics.profitPerBox}`}
                />
              </div>

              <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Food (COGS)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Packaging</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Delivery</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Net Margin</span>
              </div>
            </div>

            {/* Micro Breakdown Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Selling Price</p>
                <p className="text-base font-black text-slate-900 mt-0.5">₹{unitEconomics.revenuePerBox}</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Food Raw Material</p>
                <p className="text-base font-black text-amber-600 mt-0.5">₹{unitEconomics.foodCostPerBox}</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Packaging Box</p>
                <p className="text-base font-black text-purple-600 mt-0.5">₹{unitEconomics.packagingCostPerBox}</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Delivery & Fuel</p>
                <p className="text-base font-black text-blue-600 mt-0.5">₹{unitEconomics.deliveryCostPerBox}</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-medium mt-4">
            💡 Tip: Reducing ingredient over-portioning by 5% raises profit per box by ~₹4–₹6.
          </p>
        </div>

        {/* Delivery Area Cluster Density Card */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-xs">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">
                    Delivery Cluster Density
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Route density ranking to optimize fleet and driver fuel
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                Top Hubs
              </span>
            </div>

            <div className="space-y-2.5">
              {areaDensityData.map((item, index) => (
                <div key={index} className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.area}</p>
                      <p className="text-[10px] text-slate-400">₹{item.revenue.toLocaleString()} revenue</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-slate-800 font-mono">{item.customers} active</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      item.densityRating === 'High Density' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : item.densityRating === 'Moderate'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.densityRating}
                    </span>
                  </div>
                </div>
              ))}

              {areaDensityData.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  No area records populated yet. Customer delivery addresses will populate this density map.
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-medium mt-3">
            🎯 Marketing in "High Density" areas reduces per-drop fuel and time costs.
          </p>
        </div>

      </div>

      {/* 5. Main Adaptive Trend Chart */}
      <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass flex flex-col h-[420px]">
        <div className="flex items-center gap-3 mb-6">
           <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl border border-primary-100/60 shadow-xs"><Activity size={18}/></div>
           <div>
              <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Performance Trends</h3>
              <p className="text-xs text-slate-400 font-medium">
                {selectedYear === 'All' ? 'Yearly Progression' : selectedMonth === 'All' ? `Monthly Breakdown (${selectedYear})` : `Weekly Distribution (${MONTHS[parseInt(selectedMonth)]} ${selectedYear})`}
              </p>
           </div>
        </div>
        <div className="flex-1">
           <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                 <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/></linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0.01}/></linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                 <Tooltip 
                   content={({ active, payload, label }) => {
                     if (active && payload && payload.length) {
                       return (
                         <div className="bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs space-y-1">
                           <p className="font-bold text-slate-800 font-display mb-1">{label}</p>
                           {payload.map((item: any, idx: number) => (
                             <div key={idx} className="flex justify-between items-center gap-4">
                               <div className="flex items-center gap-1.5">
                                 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                 <span className="text-slate-500 font-medium">{item.name}</span>
                               </div>
                               <span className="font-bold font-mono text-slate-900">₹{Number(item.value).toLocaleString()}</span>
                             </div>
                           ))}
                         </div>
                       );
                     }
                     return null;
                   }}
                 />
                 <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569' }} />
                 <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={3} fill="url(#colorRev)" />
                 <Area type="monotone" dataKey="Expense" stroke="#f43f5e" strokeWidth={3} fill="url(#colorExp)" />
                 <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2.5} fill="transparent" strokeDasharray="4 4" />
              </AreaChart>
           </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Secondary Operational Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Expense Breakdown */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass flex flex-col min-h-[410px]">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/60 shadow-xs"><PieIcon size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Expense Breakdown</h3>
                <p className="text-xs text-slate-400 font-medium">Spending categorized by operational type</p>
              </div>
           </div>
           <div className="flex-1">
              <GlassmorphicDonutChart 
                data={expenseBreakdown}
                centerLabel="Total Expense"
                height={260}
                isCurrency={true}
              />
           </div>
        </div>

        {/* Customer Growth */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass flex flex-col min-h-[410px]">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/60 shadow-xs"><BarChart3 size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Customer Growth</h3>
                <p className="text-xs text-slate-400 font-medium">Monthly customer onboarding volume</p>
              </div>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={customerGrowth}>
                    <defs>
                      <linearGradient id="signupBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.5}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} allowDecimals={false} />
                    <Tooltip 
                      cursor={{fill: 'rgba(241, 245, 249, 0.6)', radius: 8}} 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-glass-lg text-xs">
                              <p className="font-bold text-slate-800 font-display mb-0.5">{label}</p>
                              <p className="text-indigo-600 font-bold font-mono">{payload[0].value} customers</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="Signups" fill="url(#signupBarGrad)" radius={[6, 6, 2, 2]} barSize={22} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Revenue by Plan */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass flex flex-col min-h-[410px]">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/60 shadow-xs"><DollarSign size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Revenue by Plan</h3>
                <p className="text-xs text-slate-400 font-medium">Monetary contribution by subscription plan</p>
              </div>
           </div>
           <div className="flex-1">
              <GlassmorphicDonutChart 
                data={revenueByPlan}
                centerLabel="Plan Revenue"
                height={260}
                isCurrency={true}
              />
           </div>
        </div>

        {/* Reusable Box Recovery Health */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass flex flex-col min-h-[410px]">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100/60 shadow-xs"><Package size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Reusable Box Health</h3>
                <p className="text-xs text-slate-400 font-medium">Recovery condition, cleanliness & customer retention</p>
              </div>
           </div>
           <div className="flex-1">
              <GlassmorphicDonutChart 
                data={reusableBoxHealthData}
                centerLabel="Containers"
                height={260}
                isCurrency={false}
              />
           </div>
        </div>

        {/* Meal Time Breakdown */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass flex flex-col h-[380px] lg:col-span-2">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100/60 shadow-xs"><Utensils size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Meal Schedule Volume</h3>
                <p className="text-xs text-slate-400 font-medium">Breakfast, Lunch & Dinner distribution across active tiers</p>
              </div>
           </div>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={mealTimeBreakdown.data} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#475569', fontWeight: 600, fontSize: 12}} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                    <Tooltip 
                      cursor={{fill: 'rgba(241, 245, 249, 0.6)', radius: 8}} 
                      contentStyle={{ borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 10px 25px -4px rgba(15, 23, 42, 0.08)' }} 
                    />
                    <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingBottom: '16px', fontSize: '11px', fontWeight: 600 }} />
                    {mealTimeBreakdown.plans.map((planName, index) => (
                      <Bar 
                        key={planName} 
                        dataKey={planName} 
                        stackId="a" 
                        fill={COLORS[index % COLORS.length]} 
                        barSize={48}
                        radius={index === mealTimeBreakdown.plans.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="mt-2 text-center">
              <p className="text-[11px] font-medium text-slate-400">Total active subscriptions queued by meal dispatch window</p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default Analytics;
