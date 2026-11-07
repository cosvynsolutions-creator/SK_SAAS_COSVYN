export interface BusinessSubscription {
  status: 'active' | 'expired' | 'paused';
  plan: 'free_trial' | 'starter' | 'pro' | 'enterprise';
  startDate: string;
  expiryDate: string;
  lastPaymentId?: string;
  features?: {
    mealsPerDay: number;
    staff: number;
    branches: number;
  };
}

export interface Business {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  gstNumber?: string;
  subscription: BusinessSubscription;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPlan {
  planId: string;
  name: string;
  mealsPerDay: number;
  daysPerWeek: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'paused' | 'cancelled';
  dietPreference?: 'Veg' | 'Non-Veg' | 'Mixed';
  dayDietSchedule?: Record<number, 'Veg' | 'Non-Veg'>;
}

export interface CustomerData {
  id: string;
  businessId: string;
  branchId?: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  plan: CustomerPlan;
  balance: number; // in paise
  reusableBoxType?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffData {
  id: string;
  businessId: string;
  branchId?: string;
  name: string;
  phone: string;
  pin_hash?: string;
  role: 'driver' | 'manager' | 'kitchen';
  status: 'active' | 'inactive' | 'on_leave';
  joinDate: string;
  lastLocationUpdate?: string;
  currentLocation?: { lat: number; lng: number };
  isShiftActive?: boolean;
  batteryLevel?: number;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
}

export interface PlanConfig {
  id: string;
  businessId?: string;
  branchId?: string;
  name: string;
  price: number; // in rupees
  numberOfDeliveryDays: number;
  weekdays: number[];
  isActive: boolean;
  dietPreference?: 'Veg' | 'Non-Veg' | 'Mixed';
  dayDietSchedule?: Record<number, 'Veg' | 'Non-Veg'>;
  dietarySchedule?: Record<number, 'Veg' | 'Non-Veg'>;
  dietaryType?: 'Veg' | 'Non-Veg' | 'Mixed';
}

