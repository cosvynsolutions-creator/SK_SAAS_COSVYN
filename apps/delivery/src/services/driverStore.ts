/**
 * ScaleKitchen Delivery Application — Dedicated Domain Types & Pure Business Helpers
 *
 * Source Provenance:
 * Extracted from root `/services/store.ts` for full self-contained operation
 * within the independent `apps/delivery` workspace.
 *
 * All functions are 100% pure and deterministic, mirroring root implementation.
 */

export type MealSession = 'Breakfast' | 'Lunch' | 'Dinner';

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

export interface PauseEvent {
  start: string;
  end: string;
  type: 'User' | 'Branch';
}

export type DietType = 'Veg' | 'Non-Veg';
export type PlanDietPreference = 'Veg' | 'Non-Veg' | 'Mixed';

export interface SubscribedPlan {
  planId: string;
  planName: string;
  mealTime: 'Breakfast' | 'Lunch' | 'Dinner';
  startDate: string;
  endDate: string;
  price: number;
  quantity?: number;
  pauses: PauseEvent[];
  isStarred?: boolean;
  isCustom?: boolean;
  totalDeliveries?: number;
  weekdays?: number[];
  reusableBoxType?: string;
  boxTagOrNumber?: string;
  boxDeposit?: number;
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
  deliveryBoyPhone?: string;
  deliveryBoyMobile?: string;
  
  activePlans: SubscribedPlan[];
  pastPlans?: SubscribedPlan[];
  
  planId: string; 
  planName?: string;
  mealTime: string[];
  isActive: boolean;
  startDate: string;
  endDate: string;
  daysLeft: number;
  
  paymentStatus: 'Paid' | 'Pending';
  amountPaid: number;
  planPrice: number;
  deliveryCharges: number;
  discount?: number;
  finalPayable?: number;
  pendingAmount: number;
  renewalCount: number;
  
  routeOrder: number;
  updatedAt?: string;

  highlightMark?: 'None' | 'VIP' | 'Dietary' | 'Allergy' | 'Urgent';
  notes?: string;
  isStarred?: boolean;
  starredQuery?: string;
  specialNotes?: string;

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
  status?: 'Online' | 'Offline' | 'On Delivery' | 'Active' | 'Inactive';
  active?: boolean;
  isDeleted?: boolean;
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
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0);
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
 */
export const getCustomerScheduledPlansForSession = (
  customer: GlobalCustomer | any,
  mealTime: 'Breakfast' | 'Lunch' | 'Dinner' | 'All' | string,
  targetDateStr: string,
  plansConfig: any[] = []
): SubscribedPlan[] => {
  if (!customer) return [];
  if (customer.isActive === false) return [];

  const plansList = Array.isArray(customer.activePlans)
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
    if (mealTime && mealTime !== 'All') {
      const planMeal = ap.mealTime || (Array.isArray(customer.mealTime) ? customer.mealTime[0] : customer.mealTime);
      if (planMeal && planMeal !== mealTime) return false;
    }
    const pConfig = plansConfig.find((p: any) => p.id === ap.planId);
    return isPlanActiveOnDate(ap, targetDateStr, pConfig, customer);
  });
};

export const getDriverCustomersScheduledForSession = (
  customers: GlobalCustomer[],
  staffId: string,
  branchId: string,
  mealTime: MealSession,
  targetDateStr: string,
  plansConfig: any[] = []
): Array<{ customer: GlobalCustomer; plans: SubscribedPlan[] }> => {
  if (!staffId || !branchId || !targetDateStr) return [];

  return customers.flatMap(customer => {
    if (
      customer.isActive === false ||
      String(customer.deliveryBoyId || '') !== staffId ||
      String(customer.branchId || '') !== branchId
    ) {
      return [];
    }

    const scheduledPlans = getCustomerScheduledPlansForSession(
      customer,
      mealTime,
      targetDateStr,
      plansConfig
    );
    return scheduledPlans.length > 0 ? [{ customer, plans: scheduledPlans }] : [];
  });
};

/**
 * Resolves whether a plan/subscribedPlan is 'Veg' or 'Non-Veg' on a specific date.
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

export const getPlanDeliveryDayNumber = (
  plan: SubscribedPlan, 
  targetDateStr: string, 
  planConfig?: any
): number => {
  if (!plan || !targetDateStr) return 0;
  const startDateStr = plan.startDate;
  if (!startDateStr || targetDateStr < startDateStr) return 0;

  const weekdays = planConfig?.weekdays || plan.weekdays || [1, 2, 3, 4, 5, 6];
  const pauses = plan.pauses || [];

  const isPaused = (dateStr: string) => {
    return pauses.some(p => p && dateStr >= p.start && dateStr <= p.end);
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
      return 0;
    }

    current.setDate(current.getDate() + 1);
    safetyLoop++;
  }

  return deliveryDayCount;
};

export const isCustomerDeliveryDay2Plus = (customer: GlobalCustomer, targetDateStr: string): boolean => {
  if (!customer) return false;
  const plans = (customer.activePlans || []).filter(p => p.reusableBoxType && p.reusableBoxType !== 'None');
  if (plans.length > 0) {
    return plans.some(p => {
      const dayNum = getPlanDeliveryDayNumber(p, targetDateStr);
      return dayNum >= 2;
    });
  }
  if (customer.reusableBoxEnabled || (customer.reusableBoxType && customer.reusableBoxType !== 'None')) {
    const start = customer.startDate || '';
    if (!start) return false;
    return targetDateStr > start;
  }
  return false;
};

export const getTodayStr = (now: Date = new Date()): string => {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find(datePart => datePart.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const normalizePhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-10);
};

/**
 * Automatically determines the active meal session based on local time or specified Date.
 * Boundaries:
 * - Breakfast: 12:00 AM to 10:59:59 AM (00:00:00 - 10:59:59)
 * - Lunch: 11:00 AM to 4:59:59 PM (11:00:00 - 16:59:59)
 * - Dinner: 5:00 PM to 11:59:59 PM (17:00:00 - 23:59:59)
 */
export const getDefaultMealSessionForTime = (dateInput?: Date | string | number): MealSession => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const hours = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(d));
  if (hours < 11) {
    return 'Breakfast';
  }
  if (hours < 17) {
    return 'Lunch';
  }
  return 'Dinner';
};
