import { AuthUser, JWTPayload, AuthTokens } from './auth';
import { Business, CustomerData, StaffData } from './business';
import { DriverRouteSummary, DriverDeliveryStop } from './driver';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  attemptsRemaining?: number;
}

export interface OwnerDashboardData {
  businessName: string;
  subscriptionStatus: string;
  planName: string;
  planExpiryDate: string;
  activeBranches: number;
  totalCustomers: number;
  activeSubscribers: number;
  todayDeliveries: {
    scheduled: number;
    completed: number;
    failed: number;
    pending: number;
  };
  revenue: {
    today: number;
    thisMonth: number;
    thisYear: number;
  };
  staff: {
    drivers: number;
    active: number;
    onLeave: number;
  };
}

export interface ManagerDashboardData {
  branchName: string;
  branchId: string;
  staff: StaffData[];
  todayStats: {
    totalDeliveries: number;
    completed: number;
    failed: number;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  businessId: string;
  userId: string;
  userRole: string;
  action: string;
  target?: string;
  resource?: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed';
}

export interface Pagination {
  total: number;
  page: number;
  pages: number;
}
