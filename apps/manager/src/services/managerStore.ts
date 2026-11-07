/**
 * ScaleKitchen Manager Application — Store Types & Pure Helpers
 *
 * Isolated pure types and utilities for manager operations, without runtime
 * coupling to root application stores or owner authentication states.
 */

export interface GlobalBranch {
  id: string;
  name: string;
  city?: string;
  state?: string;
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

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  deliveryAddress: string;
  flatNumber?: string;
  buildingName?: string;
  branchId: string;
  planId?: string;
  dietPreference?: PlanDietPreference;
  active?: boolean;
  status?: string;
  startDate?: string;
  endDate?: string;
  alternatePhone?: string;
  locationLink?: string;
  notes?: string;
  assignedDriverId?: string;
  currentBoxId?: string;
  boxDepositAmount?: number;
  pauseRanges?: Array<{ start: string; end: string; type?: string }>;
  [key: string]: any;
}

export interface BranchManager {
  id: string;
  name: string;
  mobile: string;
  email: string;
  password?: string;
  branchId: string; // Specific branch id or 'All'
  allowedPages: string[]; // Page keys e.g. ['dashboard', 'customers', ...]
  status?: string;
  active?: boolean;
  aadharNumber?: string;
  location?: string;
  salary?: number;
  dateOfJoining?: string;
  homeLocation?: string;
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
  { id: 'dashboard', label: 'Dashboard', description: 'Overview metrics, urgent tasks & daily summaries', path: '/dashboard', category: 'Operations' },
  { id: 'prep', label: 'Kitchen Prep', description: 'Real-time kitchen production counts & meal prep batches', path: '/prep', category: 'Operations' },
  { id: 'deliveries', label: 'Deliveries & Fleet', description: 'Live dispatch, driver routing & container tracking', path: '/deliveries', category: 'Operations' },
  { id: 'customers', label: 'Customers & Subscriptions', description: 'Active customer list, renewals, meal preferences & pauses', path: '/customers', category: 'Operations' },
  { id: 'notes', label: 'Customer Notes', description: 'Dietary requirements, allergies & customer special instructions', path: '/notes', category: 'Operations' },
  { id: 'single-orders', label: 'Single Orders', description: 'On-demand meals, guest orders & catering bookings', path: '/single-orders', category: 'Operations' },
  { id: 'inventory', label: 'Inventory & Stock', description: 'Raw materials, reorder levels & supplier stock', path: '/inventory', category: 'Operations' },
  { id: 'messages', label: 'Broadcast & Messages', description: 'WhatsApp notifications, updates & announcement broadcasts', path: '/messages', category: 'Operations' },
  { id: 'payments', label: 'Payments', description: 'Payment records, pending collections & transaction logs', path: '/payments', category: 'Finance' },
  { id: 'invoices', label: 'GST Invoices', description: 'Generate GST-compliant tax invoices & billing records', path: '/invoices', category: 'Finance' },
  { id: 'expenses', label: 'Expenses', description: 'Daily grocery, operational costs & kitchen overheads', path: '/expenses', category: 'Finance' },
  { id: 'analytics', label: 'Analytics & Reports', description: 'Revenue graphs, customer retention & business profitability', path: '/analytics', category: 'Management' },
  { id: 'settings', label: 'Settings & Config', description: 'Branches, subscription tiers, staff & box configurations', path: '/settings', category: 'Management' },
  { id: 'profile', label: 'Business Profile', description: 'Company details, brand identity & branch information', path: '/profile', category: 'Management' },
  { id: 'support', label: 'Help & Support', description: 'Branch support queries, documentation & ticket tracking', path: '/support', category: 'Management' },
];

export const normalizePhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-10);
};

export const normalizeEmail = (email: string): string => {
  return (email || '').trim().toLowerCase();
};

export const getTodayStr = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateDDMMYYYY = (isoDateStr?: string): string => {
  if (!isoDateStr) return '';
  try {
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(isoDateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return isoDateStr;
  }
};

export const isPlanActiveOnDate = (customer: Customer, targetDateStr: string): boolean => {
  if (!customer.startDate) return false;
  if (customer.status && customer.status.toLowerCase() !== 'active') return false;
  
  if (targetDateStr < customer.startDate) return false;
  if (customer.endDate && targetDateStr > customer.endDate) return false;

  // Check customer pauses
  if (Array.isArray(customer.pauseRanges)) {
    for (const p of customer.pauseRanges) {
      if (p.start && p.end && targetDateStr >= p.start && targetDateStr <= p.end) {
        return false;
      }
    }
  }

  return true;
};
