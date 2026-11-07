
// Types for the Store
export interface GlobalBranch {
  id: string;
  name: string;
  city: string;
  state: string;
  hubAddress?: string;
  hubLocationLink?: string;
  hubLat?: number;
  hubLng?: number;
}

export type DietType = 'Veg' | 'Non-Veg';
export type PlanDietPreference = 'Veg' | 'Non-Veg' | 'Mixed';

export interface GlobalPlan {
  id: string;
  branchId: string;
  name: string;
  price: number;
  numberOfDeliveryDays: number;
  weekdays: number[];
  description?: string;
  category?: string;
  deliveryTypeLabel?: string;
  dietPreference?: PlanDietPreference;
  dayDietSchedule?: Record<number, DietType>;
}

export interface PauseEvent {
  start: string;
  end: string;
  type: 'User' | 'Branch';
}

export type BoxRecollectionStatus = 
  | 'Collected' 
  | 'Collected Clean' 
  | 'Collected Unclean' 
  | 'Dirty / Unwashed' 
  | 'Damaged / Missing Part' 
  | 'Damaged / Missing Parts' 
  | 'Not Returned' 
  | 'Pending';

export interface BoxCollectionEntry {
  status: BoxRecollectionStatus;
  boxType: string;
  issueNote?: string;
  collectedAt?: string;
  updatedBy?: string;
}

export interface ReusableBoxConfig {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  defaultDeposit: number;
}

export const REUSABLE_BOX_TYPES: ReusableBoxConfig[] = [
  { id: 'None', name: 'None (Disposable / Paper Meal Tray)', shortLabel: 'Disposable', description: 'Single-use biodegradable packaging (no recollection needed)', defaultDeposit: 0 },
  { id: 'Stainless Steel 3-Tier Dabba', name: 'Stainless Steel 3-Tier Dabba', shortLabel: 'Steel 3-Tier', description: 'Classic 3-tier stainless steel tiffin with latch handle', defaultDeposit: 300 },
  { id: 'Stainless Steel 4-Tier Dabba', name: 'Stainless Steel 4-Tier Dabba', shortLabel: 'Steel 4-Tier', description: 'Heavy-gauge 4-tier steel tiffin carrier for full meals', defaultDeposit: 400 },
  { id: 'Insulated Thermal Bento Box', name: 'Insulated Thermal Bento Box', shortLabel: 'Thermal Bento', description: 'Multi-compartment leakproof thermal insulated box', defaultDeposit: 350 },
  { id: 'Eco Glass-Lock Meal Container', name: 'Eco Glass-Lock Meal Container', shortLabel: 'Glass-Lock', description: 'Borosilicate glass box with 4-snap airtight silicone lid', defaultDeposit: 250 },
  { id: 'Microwavable Heavy-Duty PP Box', name: 'Microwavable Heavy-Duty PP Box', shortLabel: 'Heavy PP', description: 'BPA-free reusable dishwasher-safe plastic container', defaultDeposit: 150 },
  { id: 'Custom Reusable Box', name: 'Custom Reusable Box', shortLabel: 'Custom Box', description: 'Custom branded commercial reusable tiffin box', defaultDeposit: 200 }
];

export interface SubscribedPlan {
  planId: string;
  planName: string;
  mealTime: 'Breakfast' | 'Lunch' | 'Dinner';
  startDate: string;
  endDate: string;
  price: number;
  quantity?: number;
  pauses: PauseEvent[];
  isStarred?: boolean; // Track special preparation requirements per plan
  isCustom?: boolean;
  totalDeliveries?: number;
  weekdays?: number[];
  
  // Reusable Box Configuration
  reusableBoxType?: string; // e.g. 'Stainless Steel 3-Tier Dabba' or 'None'
  boxTagOrNumber?: string; // Box identifier or barcode e.g. 'BX-102'
  boxDeposit?: number; // Refundable box deposit if taken

  // Veg & Non-Veg Configuration
  dietPreference?: PlanDietPreference;
  dayDietSchedule?: Record<number, DietType>;
}

export interface GlobalCustomer {
  id: string;
  name: string;
  mobile: string;
  address: string;
  area: string;
  locationLink?: string;
  createdAt: string;
  branchId: string;
  deliveryBoyId: string;
  deliveryBoyName?: string;
  
  // Multi-plan support
  activePlans: SubscribedPlan[];
  pastPlans?: SubscribedPlan[];
  
  // Flattened for quick table access (primary plan)
  planId: string; 
  mealTime: string[]; // ['Breakfast', 'Lunch']
  isActive: boolean;
  startDate: string;
  endDate: string; // Max end date across all plans
  daysLeft: number; // Max days left across all plans
  
  // Financials
  paymentStatus: 'Paid' | 'Pending';
  amountPaid: number;
  planPrice: number; // Total price of all plans
  deliveryCharges: number;
  discount?: number;
  finalPayable?: number;
  pendingAmount: number;
  renewalCount: number;
  
  routeOrder: number;
  updatedAt?: string;

  // Highlight and Notes
  highlightMark?: 'None' | 'VIP' | 'Dietary' | 'Allergy' | 'Urgent';
  notes?: string;
  isStarred?: boolean;
  starredQuery?: string;
  specialNotes?: string;

  // Reusable Box Collection Records (keyed by `${dateStr}_${mealTime}`)
  boxCollections?: Record<string, BoxCollectionEntry>;
  reusableBoxType?: string;
  reusableBoxEnabled?: boolean;
  boxTagOrNumber?: string;
  uncollectedBoxesCount?: number;
}

export interface DeliveryBoyStaff {
  id: string;
  name: string;
  mobile: string;
  branchId?: string;
  role?: string;
  status?: 'Online' | 'Offline' | 'On Delivery';
  lastAttendanceDate?: string;
  attendanceMarkedAt?: string;
  currentLat?: number;
  currentLng?: number;
  lastLocationUpdate?: string;
  batteryLevel?: number;
  updatedAt?: string;
  aadharNumber?: string;
  homeLocation?: string;
  salary?: number;
  dateOfJoining?: string;
  pin?: string; // 4-digit security PIN for driver portal login
}

// Fix: Added missing Expense types used in Expenses.tsx
export interface ExpenseItem {
  name: string;
  quantity: number;
  unit: string;
  amount: number;
}

export interface GlobalExpense {
  id: string;
  branchId: string;
  date: string;
  category: string;
  title: string;
  description?: string;
  vendor?: string;
  paymentStatus: 'Paid' | 'Pending';
  paymentMethod: string;
  amount: number;
  items?: ExpenseItem[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Checks whether a configured box type represents a reusable box container.
 * Returns false for disposable packaging (e.g. 'None', 'Disposable', paper trays, or empty).
 */
export const isReusableBoxType = (boxType?: string | null): boolean => {
  if (!boxType) return false;
  const normalized = boxType.trim().toLowerCase();
  if (
    normalized === 'none' ||
    normalized === 'disposable' ||
    normalized.includes('disposable') ||
    normalized.includes('paper meal tray') ||
    normalized === ''
  ) {
    return false;
  }
  return true;
};


// Fix: Added missing InventoryItem type used in Inventory.tsx
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  costPerUnit: number;
  branchId: string;
  lastUpdated: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- HELPER LOGIC ---

/**
 * Formats any date string (YYYY-MM-DD or ISO timestamp) or Date into DD/MM/YYYY format.
 * E.g. '2026-10-12' -> '12/10/2026'
 * E.g. '2026-09-04T08:00:00.000Z' -> '04/09/2026'
 */
export const formatDateDDMMYYYY = (dateInput?: string | number | Date | null): string => {
  if (!dateInput && dateInput !== 0) return '';
  if (typeof dateInput === 'number') {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '';
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}/${m}/${y}`;
  }
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    const d = String(dateInput.getDate()).padStart(2, '0');
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const y = dateInput.getFullYear();
    return `${d}/${m}/${y}`;
  }
  const s = String(dateInput).trim();
  if (!s) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s.replace(/-/g, '/');
  
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return s;
};

/**
 * Shifts a YYYY-MM-DD date string by deltaDays safely without timezone jumping or UTC distortion.
 */
export const shiftDateStr = (dateStr: string, deltaDays: number): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0); // Noon prevents DST/UTC shifts
  const yStr = dt.getFullYear();
  const mStr = String(dt.getMonth() + 1).padStart(2, '0');
  const dStr = String(dt.getDate()).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
};

export const normalizeWeekday = (w: any): number => {
  if (typeof w === 'number') return w;
  const s = String(w).toLowerCase().trim();
  const map: Record<string, number> = {
    sun: 0, sunday: 0, '0': 0,
    mon: 1, monday: 1, '1': 1,
    tue: 2, tuesday: 2, '2': 2,
    wed: 3, wednesday: 3, '3': 3,
    thu: 4, thursday: 4, '4': 4,
    fri: 5, friday: 5, '5': 5,
    sat: 6, saturday: 6, '6': 6,
  };
  return map[s] !== undefined ? map[s] : (Number(s) || 0);
};

/**
 * Checks if a specific subscribed plan is scheduled to be delivered on targetDateStr.
 * Validates:
 * 1. Customer active status (must not be deactivated)
 * 2. Plan active range (startDate <= targetDateStr <= endDate with customer fallback)
 * 3. Pauses (targetDateStr does NOT fall inside plan or customer pause windows)
 * 4. Delivery weekdays (normalized 0-6 day of week matches plan configuration)
 */
export const isPlanActiveOnDate = (
  ap: SubscribedPlan | any,
  targetDateStr: string,
  planConfig?: any,
  customer?: any
): boolean => {
  if (!ap || !targetDateStr) return false;
  if (customer && customer.isActive === false) return false;

  const cleanTarget = targetDateStr.split('T')[0].trim();

  // 1. Check Date Range (with customer-level fallback if not on plan)
  const cleanStart = (ap.startDate || customer?.startDate || '').split('T')[0].trim();
  const cleanEnd = (ap.endDate || customer?.endDate || '').split('T')[0].trim();

  if (cleanStart && cleanTarget < cleanStart) return false;
  if (cleanEnd && cleanTarget > cleanEnd) return false;

  // 2. Check Pauses across plan and customer
  const allPauses = [
    ...(Array.isArray(ap.pauses) ? ap.pauses : []),
    ...(Array.isArray(customer?.pauses) ? customer.pauses : [])
  ];
  if (allPauses.length > 0) {
    const isPaused = allPauses.some((p: any) => {
      if (!p) return false;
      const ps = (p.start || p.startDate || '').split('T')[0].trim();
      const pe = (p.end || p.endDate || '').split('T')[0].trim();
      return ps && pe && cleanTarget >= ps && cleanTarget <= pe;
    });
    if (isPaused) return false;
  }

  // 3. Check Allowed Weekdays (normalized: 0 = Sun, 1 = Mon, ..., 6 = Sat)
  const rawWeekdays: any[] = planConfig?.weekdays ?? ap.weekdays ?? customer?.weekdays ?? [1, 2, 3, 4, 5, 6];
  const allowedWeekdays = Array.isArray(rawWeekdays) && rawWeekdays.length > 0
    ? rawWeekdays.map(normalizeWeekday)
    : [1, 2, 3, 4, 5, 6];

  const parts = cleanTarget.split('-').map(Number);
  if (parts.length === 3) {
    const targetDay = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0).getDay();
    if (!allowedWeekdays.includes(targetDay)) return false;
  }

  return true;
};

/**
 * Retrieves all active, scheduled plans for a customer on a given date and meal session.
 * Guaranteed to match between Kitchen Prep, Workload Matrix, Route Management, WhatsApp, and Driver Portal.
 */
export const getCustomerScheduledPlansForSession = (
  customer: GlobalCustomer | any,
  mealTime: 'Breakfast' | 'Lunch' | 'Dinner' | 'All' | string,
  targetDateStr: string,
  plansConfig: any[] = []
): SubscribedPlan[] => {
  if (!customer) return [];
  if (customer.isActive === false) return [];

  // If customer has activePlans array, use it; otherwise synthesize from flat customer properties
  const plansList = Array.isArray(customer.activePlans) && customer.activePlans.length > 0 
    ? customer.activePlans 
    : (customer.planId || customer.planName ? [{
        planId: customer.planId,
        planName: customer.planName || 'Standard Meal',
        mealTime: Array.isArray(customer.mealTime) ? customer.mealTime[0] : (customer.mealTime || 'Lunch'),
        startDate: customer.startDate,
        endDate: customer.endDate,
        quantity: 1,
        pauses: customer.pauses || [],
        weekdays: customer.weekdays || [1, 2, 3, 4, 5, 6],
        isStarred: Boolean(customer.isStarred),
        reusableBoxType: customer.reusableBoxType || 'None'
      }] : []);

  return plansList.filter((ap: any) => {
    if (!ap) return false;
    // Meal time filter
    if (mealTime && mealTime !== 'All') {
      const planMeal = ap.mealTime || (Array.isArray(customer.mealTime) ? customer.mealTime[0] : customer.mealTime);
      if (planMeal && planMeal !== mealTime) return false;
    }
    const pConfig = plansConfig.find((p: any) => p.id === ap.planId);
    return isPlanActiveOnDate(ap, targetDateStr, pConfig, customer);
  });
};

/**
 * Resolves whether a plan/subscribedPlan is 'Veg' or 'Non-Veg' on a specific date.
 * Handles:
 * 1. Customer plan specific dayDietSchedule or dietPreference
 * 2. Plan configuration's dayDietSchedule (indexed by day 0=Sun..6=Sat)
 * 3. Plan dietPreference ('Veg' | 'Non-Veg')
 * 4. Backward-compatible name/category keywords ('non-veg', 'chicken', 'fish', 'meat', 'egg' => Non-Veg; else Veg)
 */
export const getPlanDietOnDate = (
  plan: any,
  targetDateStr: string,
  customerPlan?: any
): DietType => {
  const parts = (targetDateStr || '').split('T')[0].split('-').map(Number);
  const dayOfWeek = parts.length === 3 
    ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0).getDay() 
    : new Date().getDay();

  // 1. Customer plan specific schedule override
  if (customerPlan?.dayDietSchedule && customerPlan.dayDietSchedule[dayOfWeek]) {
    return customerPlan.dayDietSchedule[dayOfWeek];
  }
  if (customerPlan?.dietPreference === 'Veg' || customerPlan?.dietPreference === 'Non-Veg') {
    return customerPlan.dietPreference;
  }

  // 2. Plan configuration's dayDietSchedule
  if (plan?.dayDietSchedule && plan.dayDietSchedule[dayOfWeek]) {
    return plan.dayDietSchedule[dayOfWeek];
  }

  // 3. Plan dietPreference
  if (plan?.dietPreference === 'Veg') return 'Veg';
  if (plan?.dietPreference === 'Non-Veg') return 'Non-Veg';

  // 4. Smart keyword inference for existing/legacy plans
  const checkText = `${plan?.name || ''} ${plan?.description || ''} ${customerPlan?.planName || ''}`.toLowerCase();
  if (
    checkText.includes('non-veg') ||
    checkText.includes('non veg') ||
    checkText.includes('n-veg') ||
    checkText.includes('chicken') ||
    checkText.includes('mutton') ||
    checkText.includes('fish') ||
    checkText.includes('egg') ||
    checkText.includes('meat') ||
    checkText.includes('seafood')
  ) {
    return 'Non-Veg';
  }

  return 'Veg';
};

/**
 * Returns a human-friendly summary of a plan's Veg/Non-Veg schedule
 */
export const getPlanDietSummaryLabel = (
  dayDietSchedule?: Record<number, DietType>,
  weekdays: number[] = [1, 2, 3, 4, 5, 6]
): { label: string; type: PlanDietPreference; vegDays: string[]; nonVegDays: string[] } => {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const safeWeekdays = Array.isArray(weekdays) && weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5, 6];
  const activeDays = safeWeekdays.map(normalizeWeekday);
  
  if (!dayDietSchedule || activeDays.length === 0) {
    return { label: 'Pure Veg', type: 'Veg', vegDays: [], nonVegDays: [] };
  }

  const vegDays: string[] = [];
  const nonVegDays: string[] = [];

  activeDays.forEach(d => {
    const diet = dayDietSchedule[d] || 'Veg';
    if (diet === 'Non-Veg') {
      nonVegDays.push(DAY_NAMES[d]);
    } else {
      vegDays.push(DAY_NAMES[d]);
    }
  });

  if (nonVegDays.length === 0) {
    return { label: 'Pure Veg', type: 'Veg', vegDays, nonVegDays };
  }
  if (vegDays.length === 0) {
    return { label: 'All Non-Veg', type: 'Non-Veg', vegDays, nonVegDays };
  }

  return {
    label: `Veg (${vegDays.join(', ')}) • Non-Veg (${nonVegDays.join(', ')})`,
    type: 'Mixed',
    vegDays,
    nonVegDays
  };
};

export const calculateEndDate = (startDateStr: string, totalDeliveryDays: number, allowedWeekdays: number[] | any[], pauses: PauseEvent[] = []): string => {
  if (!startDateStr || totalDeliveryDays <= 0 || !allowedWeekdays || allowedWeekdays.length === 0) return startDateStr;
  
  const normalizedAllowed = allowedWeekdays.map(normalizeWeekday);
  const cleanStart = startDateStr.split('T')[0].trim();
  const [y, m, d] = cleanStart.split('-').map(Number);
  let currentDate = new Date(y, m - 1, d, 12, 0, 0); // Noon prevents any DST/midnight issues
  let deliveriesCounted = 0;
  
  const isPaused = (dateStr: string) => {
    return pauses.some((p: any) => {
      if (!p) return false;
      const ps = (p.start || p.startDate || '').split('T')[0].trim();
      const pe = (p.end || p.endDate || '').split('T')[0].trim();
      return ps && pe && dateStr >= ps && dateStr <= pe;
    });
  };

  let safetyLoop = 0; 
  while (deliveriesCounted < totalDeliveryDays && safetyLoop < 1500) {
    const dStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const dayOfWeek = currentDate.getDay();
    
    if (normalizedAllowed.includes(dayOfWeek) && !isPaused(dStr)) {
      deliveriesCounted++;
    }
    
    if (deliveriesCounted < totalDeliveryDays) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    safetyLoop++;
  }
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
};

export const calculateRemainingDeliveries = (endDateStr: string, allowedWeekdays: number[] | any[], pauses: PauseEvent[] = []): number => {
  if (!endDateStr || !allowedWeekdays || allowedWeekdays.length === 0) return 0;
  
  const normalizedAllowed = allowedWeekdays.map(normalizeWeekday);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  
  const cleanEnd = endDateStr.split('T')[0].trim();
  const [ey, em, ed] = cleanEnd.split('-').map(Number);
  const end = new Date(ey, em - 1, ed, 12, 0, 0);
  
  if (today > end) return 0;
  
  let count = 0;
  let current = new Date(today);
  current.setDate(current.getDate() + 1); // Count remaining deliveries starting from tomorrow
  
  const isPaused = (dateStr: string) => {
    return pauses.some(p => p && dateStr >= p.start && dateStr <= p.end);
  };

  let safetyLoop = 0;
  while (current <= end && safetyLoop < 1000) {
    const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (allowedWeekdays.includes(current.getDay()) && !isPaused(dStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
    safetyLoop++;
  }
  return count;
};

export const countDeliveryDays = (startStr: string, endStr: string, allowedWeekdays: number[]): number => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  if (start > end) return 0;
  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    if (allowedWeekdays.includes(current.getDay())) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Calculates which delivery day number (1-based index) today is for a customer's specific plan.
 * - Returns 1: First delivery day (New box issued, NO previous box to recollect)
 * - Returns >= 2: 2nd day or later (Previous day's reusable box MUST be recollected)
 * - Returns 0: Not an active delivery day today (paused or off-day)
 */
export const getPlanDeliveryDayNumber = (
  planOrStart: SubscribedPlan | string,
  targetDateStr: string,
  allowedWeekdays?: number[],
  pauses?: PauseEvent[]
): number => {
  let startDateStr = '';
  let weekdays = allowedWeekdays || [1, 2, 3, 4, 5, 6];
  let pauseEvents = pauses || [];

  if (typeof planOrStart === 'object' && planOrStart !== null) {
    startDateStr = planOrStart.startDate || '';
    weekdays = planOrStart.weekdays || weekdays;
    pauseEvents = planOrStart.pauses || pauseEvents;
  } else if (typeof planOrStart === 'string') {
    startDateStr = planOrStart;
  }

  if (!startDateStr || !targetDateStr) return 0;
  if (targetDateStr < startDateStr) return 0;

  const isPaused = (dStr: string) => {
    return (pauseEvents || []).some(p => dStr >= p.start && dStr <= p.end);
  };

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const target = new Date(ty, tm - 1, td);

  let deliveryDayCount = 0;
  let current = new Date(start);
  let safetyLoop = 0;

  while (current <= target && safetyLoop < 1000) {
    const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    const dayOfWeek = current.getDay();

    if (weekdays.includes(dayOfWeek) && !isPaused(dStr)) {
      deliveryDayCount++;
      if (dStr === targetDateStr) {
        return deliveryDayCount;
      }
    } else if (dStr === targetDateStr) {
      // Target date itself is not a scheduled delivery day
      return 0;
    }

    current.setDate(current.getDate() + 1);
    safetyLoop++;
  }

  return deliveryDayCount;
};

export const isCustomerDeliveryDay2Plus = (customer: GlobalCustomer, targetDateStr: string): boolean => {
  if (!customer) return false;
  // Check any active plan with reusable box
  const plans = (customer.activePlans || []).filter(p => p.reusableBoxType && p.reusableBoxType !== 'None');
  if (plans.length > 0) {
    return plans.some(p => {
      const dayNum = getPlanDeliveryDayNumber(p, targetDateStr);
      return dayNum >= 2;
    });
  }
  // Check if customer has general reusable box enabled
  if (customer.reusableBoxEnabled || (customer.reusableBoxType && customer.reusableBoxType !== 'None')) {
    const start = customer.startDate || '';
    if (!start) return false;
    return targetDateStr > start;
  }
  return false;
};

/**
 * Calculates how many reusable boxes are currently with the customer (uncollected).
 * Supports manual override if owner has updated `customer.uncollectedBoxesCount`.
 */
export const getCustomerUncollectedBoxesCount = (customer: GlobalCustomer): number => {
  if (!customer) return 0;
  if (typeof customer.uncollectedBoxesCount === 'number') {
    return Math.max(0, customer.uncollectedBoxesCount);
  }
  const health = getCustomerBoxHealth(customer);
  // Default estimate: unreturned count + (if day 2+ and has reusable box, 1 box is currently at customer)
  const hasReusablePlan = (customer.activePlans || []).some(p => p.reusableBoxType && p.reusableBoxType !== 'None') || Boolean(customer.reusableBoxEnabled);
  if (!hasReusablePlan) return 0;
  
  if (health.unreturned > 0) return health.unreturned;
  // If active customer on reusable box, they at least hold 1 container from previous delivery
  return customer.isActive ? 1 : 0;
};

export const getCustomerBoxHealth = (customer: GlobalCustomer, deliveryLogs?: any[]) => {
  const collectionMap = new Map<string, any>();

  // 1. From customer's embedded boxCollections
  Object.entries(customer?.boxCollections || {}).forEach(([key, val]: [string, any]) => {
    const rawStatus = (val?.status || '').toString().trim();
    collectionMap.set(key, {
      key,
      date: val?.date || key.split('_')[0] || '',
      mealTime: val?.mealTime || key.split('_')[1] || 'Lunch',
      status: rawStatus,
      notes: val?.notes || val?.issueNote || '',
      boxTagOrNumber: val?.boxTagOrNumber || '',
      boxType: val?.boxType || ''
    });
  });

  // 2. Merge from deliveryLogs (recorded by delivery boys in real-time)
  if (Array.isArray(deliveryLogs) && customer?.id) {
    deliveryLogs.forEach((log: any) => {
      if (log.customerId === customer.id && log.boxStatus && log.boxStatus !== 'None' && log.boxStatus !== 'Pending') {
        const logKey = `${log.date}_${log.mealTime || 'Lunch'}`;
        if (!collectionMap.has(logKey)) {
          collectionMap.set(logKey, {
            key: logKey,
            date: log.date,
            mealTime: log.mealTime || 'Lunch',
            status: log.boxStatus,
            notes: log.boxNotes || '',
            boxTagOrNumber: '',
            boxType: log.boxType || ''
          });
        }
      }
    });
  }

  const collections = Array.from(collectionMap.values());

  const clean = collections.filter(c => 
    c.status === 'Collected' || 
    c.status === 'Collected Clean' || 
    c.status === 'returned_clean'
  ).length;

  const unclean = collections.filter(c => 
    c.status === 'Dirty / Unwashed' || 
    c.status === 'Collected Unclean' || 
    c.status === 'unclean'
  ).length;

  const damaged = collections.filter(c => 
    c.status === 'Damaged / Missing Parts' || 
    c.status === 'Damaged / Missing Part' || 
    c.status === 'damaged' || 
    c.status === 'missing_part'
  ).length;

  const notReturned = collections.filter(c => 
    c.status === 'Not Returned' || 
    c.status === 'not_returned'
  ).length;

  const damagedOrDirty = unclean + damaged;
  // If owner adjusted customer.uncollectedBoxesCount, respect that as current pending unreturned count
  const unreturned = typeof customer?.uncollectedBoxesCount === 'number'
    ? Math.max(0, customer.uncollectedBoxesCount)
    : notReturned;

  const totalCollected = clean;
  const totalExpected = Math.max(collections.length, totalCollected + damagedOrDirty + unreturned);

  return { 
    clean, 
    unclean, 
    damaged, 
    notReturned, 
    damagedOrDirty,
    unreturned,
    totalCollected,
    totalExpected,
    totalRecorded: collections.length,
    history: collections
  };
};

export const isDeliveryDay = (date: Date, allowedWeekdays: number[]): boolean => {
  if (!allowedWeekdays) return false;
  return allowedWeekdays.includes(date.getDay());
}

export const getDaysDifference = (date1: string, date2: string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

export const getTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry"
];

export interface BranchManager {
  id: string;
  name: string;
  mobile: string;
  aadharNumber?: string;
  location?: string;
  salary: number;
  dateOfJoining: string;
  homeLocation?: string;
  branchId: string; // Specific branch id or 'All'
  allowedPages: string[]; // Page keys e.g. ['dashboard', 'customers', ...]
  email: string;
  password: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagerLogEntry {
  id: string;
  managerId: string;
  managerName: string;
  managerEmail: string;
  branchId: string;
  branchName: string;
  date: string; // YYYY-MM-DD
  loginTime: string;
  logoutTime?: string | null;
  status: 'Active' | 'Logged Out';
  createdAt: string;
}

export interface SaasPagePermission {
  id: string;
  label: string;
  description: string;
  path: string;
  category: 'Operations' | 'Finance' | 'Management';
}

export const ALL_SAAS_PAGES: SaasPagePermission[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Overview metrics, urgent tasks & daily summaries', path: '/app/dashboard', category: 'Operations' },
  { id: 'prep', label: 'Kitchen Prep', description: 'Real-time kitchen production counts & meal prep batches', path: '/app/prep', category: 'Operations' },
  { id: 'deliveries', label: 'Deliveries & Fleet', description: 'Live dispatch, driver routing & container tracking', path: '/app/deliveries', category: 'Operations' },
  { id: 'customers', label: 'Customers & Subscriptions', description: 'Active customer list, renewals, meal preferences & pauses', path: '/app/customers', category: 'Operations' },
  { id: 'notes', label: 'Customer Notes', description: 'Dietary requirements, allergies & customer special instructions', path: '/app/notes', category: 'Operations' },
  { id: 'single-orders', label: 'Single Orders', description: 'On-demand meals, guest orders & catering bookings', path: '/app/single-orders', category: 'Operations' },
  { id: 'inventory', label: 'Inventory & Stock', description: 'Raw materials, reorder levels & supplier stock', path: '/app/inventory', category: 'Operations' },
  { id: 'messages', label: 'Broadcast & Messages', description: 'WhatsApp notifications, updates & announcement broadcasts', path: '/app/messages', category: 'Operations' },
  { id: 'payments', label: 'Payments', description: 'Payment records, pending collections & transaction logs', path: '/app/payments', category: 'Finance' },
  { id: 'invoices', label: 'GST Invoices', description: 'Generate GST-compliant tax invoices & billing records', path: '/app/invoices', category: 'Finance' },
  { id: 'expenses', label: 'Expenses', description: 'Daily grocery, operational costs & kitchen overheads', path: '/app/expenses', category: 'Finance' },
  { id: 'analytics', label: 'Analytics & Reports', description: 'Revenue graphs, customer retention & business profitability', path: '/app/analytics', category: 'Management' },
  { id: 'settings', label: 'Settings & Config', description: 'Branches, subscription tiers, staff & box configurations', path: '/app/settings', category: 'Management' },
  { id: 'profile', label: 'Business Profile', description: 'Company details, brand identity & SaaS billing plan', path: '/app/profile', category: 'Management' },
  { id: 'support', label: 'Help & Support', description: 'Customer tickets, feature requests & system feedback', path: '/app/support', category: 'Management' },
];

export const normalizePhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-10);
};

export const normalizeEmail = (email: string): string => {
  return (email || '').trim().toLowerCase();
};

export interface BusinessProfile {
  ownerName: string;
  email: string;
  mobile: string; 
  businessName: string;
  logoUrl?: string;
  description: string;
  category: string;
  country: string;
  state: string;
  city: string;
  isProfileComplete: boolean;
  planName: string;
  planExpiryDate: string; 
  planStatus: 'Active' | 'Expired' | 'Inactive';
  trialClaimed?: boolean;
  trialStartDate?: string;
  trialExpiryDate?: string;
  trialOriginalExpiryDate?: string;
}

export const INITIAL_BUSINESS_PROFILE: BusinessProfile = {
  ownerName: "", email: "", mobile: "", businessName: "", logoUrl: "", description: "",
  category: "Cloud Kitchen", country: "India", state: "", city: "",
  isProfileComplete: false, planName: "None", planExpiryDate: new Date().toISOString().split('T')[0],
  planStatus: 'Inactive', trialClaimed: false
};

/**
 * Encodes driver access parameters into an obfuscated, URL-safe secure token.
 * SECURITY (Phase 1): Tokens NEVER contain PIN or phone credentials.
 * Contains only business ID and staff ID for routing. Drivers must authenticate with their PIN.
 */
export const encodeDriverToken = (
  bizId: string, 
  boyId?: string, 
  mobile?: string,
  _pin?: string,
  name?: string
): string => {
  if (!bizId) return '';
  try {
    const payload = {
      b: bizId,
      s: boyId || '',
      m: mobile ? mobile.replace(/\D/g, '').slice(-10) : '',
      n: name || '',
      t: Date.now()
    };
    const json = JSON.stringify(payload);
    return btoa(encodeURIComponent(json))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return '';
  }
};

/**
 * Decodes a secure driver token into connection parameters.
 * SECURITY: Never extracts or yields a PIN from tokens. PIN is verified separately.
 */
export const decodeDriverToken = (token: string): { 
  bizId: string; 
  boyId?: string; 
  mobile?: string;
  pin?: string;
  name?: string;
} | null => {
  if (!token) return null;
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = decodeURIComponent(atob(base64));
    const parsed = JSON.parse(json);
    if (parsed && parsed.b) {
      return {
        bizId: parsed.b,
        boyId: parsed.s || undefined,
        mobile: parsed.m || undefined,
        pin: undefined,
        name: parsed.n || undefined
      };
    }
  } catch (e) {
    console.warn("Could not decode driver token:", e);
  }
  return null;
};

/**
 * UNIFIED CANONICAL CALCULATOR FOR CUSTOMER PLAN EXPIRATION & DAYS LEFT.
 * Used by Customer List, Notifications, Delivery Dashboard, and WhatsApp alerts
 * to guarantee 100% zero-discrepancy data consistency across the entire SaaS.
 */
export const getCustomerActiveDaysLeft = (
  c: any,
  plansConfig: any[] = []
): { daysLeft: number; isExpired: boolean; endDate: string; activePlanName: string } => {
  if (!c) return { daysLeft: 0, isExpired: true, endDate: '', activePlanName: 'No Plan' };
  
  const today = getTodayStr(); // Format: 'YYYY-MM-DD'
  const activePlans = Array.isArray(c.activePlans) ? c.activePlans : [];

  if (activePlans.length > 0) {
    // 1. Find overall maximum endDate across all active plans
    const latestEnd = activePlans.reduce((max: string, p: any) => {
      const e = (p.endDate || '').split('T')[0];
      return e > max ? e : max;
    }, '');

    // 2. If the latest end date is strictly in the past, customer is 100% EXPIRED
    if (latestEnd && today > latestEnd) {
      return {
        daysLeft: 0,
        isExpired: true,
        endDate: latestEnd,
        activePlanName: activePlans[0]?.planName || c.planName || 'Meal Plan'
      };
    }

    // 3. Compute remaining deliveries across all active plans that haven't ended yet
    let maxDeliveriesLeft = 0;
    let primaryPlanName = '';

    for (const p of activePlans) {
      const pEnd = (p.endDate || '').split('T')[0];
      if (pEnd && today > pEnd) continue; // Skip already expired individual plans

      const pConfig = plansConfig.find((pl: any) => pl.id === p.planId);
      const weekdays = pConfig?.weekdays || p.weekdays || [1, 2, 3, 4, 5, 6];
      const deliveries = calculateRemainingDeliveries(p.endDate, weekdays, p.pauses || []);
      
      if (deliveries >= maxDeliveriesLeft) {
        maxDeliveriesLeft = deliveries;
        primaryPlanName = p.planName || primaryPlanName;
      }
    }

    return {
      daysLeft: maxDeliveriesLeft,
      isExpired: false,
      endDate: latestEnd,
      activePlanName: primaryPlanName || activePlans[0]?.planName || c.planName || 'Meal Plan'
    };
  }

  // Fallback for single flat plan on customer document
  const custEnd = (c.endDate || '').split('T')[0];
  if (!custEnd || today > custEnd) {
    return {
      daysLeft: 0,
      isExpired: true,
      endDate: custEnd || '',
      activePlanName: c.planName || 'Meal Plan'
    };
  }

  const pConfig = plansConfig.find((pl: any) => pl.id === c.planId);
  const weekdays = pConfig?.weekdays || c.weekdays || [1, 2, 3, 4, 5, 6];
  const deliveries = calculateRemainingDeliveries(c.endDate, weekdays, c.pauses || []);

  return {
    daysLeft: deliveries,
    isExpired: false,
    endDate: custEnd,
    activePlanName: c.planName || 'Meal Plan'
  };
};

/**
 * Automatically determines the active meal session based on local time or specified Date.
 * Boundaries:
 * - Breakfast: 12:00 AM to 10:59:59 AM (00:00:00 - 10:59:59)
 * - Lunch: 11:00 AM to 4:59:59 PM (11:00:00 - 16:59:59)
 * - Dinner: 5:00 PM to 11:59:59 PM (17:00:00 - 23:59:59)
 */
export type MealSession = 'Breakfast' | 'Lunch' | 'Dinner';

export const getDefaultMealSessionForTime = (dateInput?: Date | string | number): MealSession => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const hours = d.getHours();
  if (hours < 11) {
    return 'Breakfast';
  }
  if (hours < 17) {
    return 'Lunch';
  }
  return 'Dinner';
};

