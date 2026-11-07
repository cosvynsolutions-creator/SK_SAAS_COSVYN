// Types
export type SubscriptionPlanType = "Monthly" | "6 Months" | "Yearly";

export interface TenantUser {
  id: string;
  businessName: string;
  ownerName: string;
  mobile: string;
  email: string;
  businessCategory: string;
  businessDescription: string;
  city: string;
  state: string; // Indian State
  currentPlanType?: SubscriptionPlanType;
  planName?: string;
  planStatus?: string;
  planExpiryDate?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  isActive?: boolean;
  consecutiveMonthsSubscribed?: number;
  // Daily login & activity info
  lastLoginAt?: string;
  lastLoginDate?: string;
  loginCount?: number;
  recentLoginDates?: string[];
  firstLoginDate?: string;
  // Business live stats
  branchCount?: number;
  deliveryBoysCount?: number;
  totalUniqueCustomers?: number;
  totalActiveCustomers?: number;
  kitchenRevenue?: number;
  lastStatsSyncAt?: string;
  // Trial audit fields
  trialClaimed?: boolean;
  trialStartDate?: string;
  trialOriginalStartDate?: string;
  trialExpiryDate?: string;
  trialOriginalExpiryDate?: string;
  tamperResetDetected?: boolean;
  originalFootprintDate?: string;
  displayName?: string;
  monthlyFreeUsed?: number;
  purchasedInvoiceCredits?: number;
  logoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planType: SubscriptionPlanType;
  startDate: string;
  endDate: string;
  amountPaid: number;
  transactionId: string;
}

export interface FeatureRequest {
  id: string;
  tenantId: string;
  businessName?: string;
  featureName: string;
  description: string;
  status: "Pending" | "Processing" | "Approved" | "Delayed";
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  businessName?: string;
  issueType: string;
  description: string;
  status: "Open" | "In Progress" | "Resolved";
  createdAt: string;
}

export interface Review {
  id: string;
  tenantId: string;
  businessName?: string;
  rating: number; // 1-5
  reviewText: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface SaasPlan {
  id: string;
  label: string;
  price: number;
  durationMonths: number;
  description: string;
  isBestValue?: boolean;
}

export interface SpecialOffer {
  isActive: boolean;
  title: string;
  discountPercent: number;
  endsAt: string; // ISO Date String
}

// Fallback pricing configuration
export const SHARED_SAAS_PLANS: SaasPlan[] = [
  { 
    id: 'Monthly', 
    label: 'Monthly', 
    price: 999, 
    durationMonths: 1, 
    description: 'Flexible, cancel anytime.' 
  },
  { 
    id: '6 Months', 
    label: '6 Months', 
    price: 5099, 
    durationMonths: 6, 
    description: 'Save ~15% vs monthly.' 
  },
  { 
    id: 'Yearly', 
    label: 'Yearly', 
    price: 9599, 
    durationMonths: 12, 
    description: 'Best Value. Save 20%.',
    isBestValue: true
  }
];

export const SHARED_OFFER: SpecialOffer = {
  isActive: false,
  title: "Flash Sale!",
  discountPercent: 20,
  endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
};

export const calculateEffectivePrice = (price: number, offer: SpecialOffer) => {
  if (!offer || !offer.isActive) return price;
  const now = new Date();
  const end = new Date(offer.endsAt);
  if (now > end) return price; // Offer expired

  return Math.round(price * (1 - offer.discountPercent / 100));
};

// --- CONFIGURATION ---
export const ADMIN_EMAIL = 'cosvynsolutions@gmail.com';
export const ADMIN_EMAILS = [
  'cosvynsolutions@gmail.com',
  'admin@scalekitchen.in',
  'memosmy10@gmail.com'
];

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase().trim());
};

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
  
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return s;
  const d = String(dt.getDate()).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const y = dt.getFullYear();
  return `${d}/${m}/${y}`;
};

export const getDaysDifference = (date1: string, date2: string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};
