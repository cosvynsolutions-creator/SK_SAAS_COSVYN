import { apiClient } from './client';
import { 
  LoginResponse, 
  DriverRouteSummary, 
  OwnerDashboardData, 
  ManagerDashboardData, 
  CustomerData, 
  StaffData, 
  AuditLogEntry, 
  ApiResponse 
} from '../../types/src';

export const api = {
  auth: {
    login: (credentials: { email: string; password: string; role?: string }) =>
      apiClient<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
        requiresAuth: false,
      }),
    signup: (data: {
      email: string;
      password: string;
      businessName: string;
      ownerName: string;
      phone: string;
      city?: string;
    }) =>
      apiClient<LoginResponse>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
        requiresAuth: false,
      }),
    refresh: (refreshToken: string) =>
      apiClient<{ success: boolean; accessToken: string; expiresIn: number }>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        requiresAuth: false,
      }),
    logout: () =>
      apiClient<ApiResponse>('/api/auth/logout', {
        method: 'POST',
      }),
    verify: () =>
      apiClient<{ success: boolean; user: any }>('/api/auth/verify', {
        method: 'GET',
      }),
  },

  driver: {
    login: (data: { phone: string; pin: string; businessId?: string }) =>
      apiClient<LoginResponse>('/api/driver/login', {
        method: 'POST',
        body: JSON.stringify(data),
        requiresAuth: false,
      }),
    getRoute: (date?: string) => {
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      return apiClient<{ success: boolean; route: DriverRouteSummary }>(`/api/driver/route${q}`, {
        method: 'GET',
      });
    },
    markDelivered: (delivery: {
      deliveryId: string;
      customerId: string;
      mealId?: string;
      status: 'delivered' | 'failed' | 'customer_not_home' | 'refused';
      collectedBoxes?: Array<{ id: string; type: string }>;
      latitude?: number;
      longitude?: number;
      timestamp?: string;
      notes?: string;
    }) =>
      apiClient<ApiResponse>('/api/driver/deliver', {
        method: 'POST',
        body: JSON.stringify(delivery),
      }),
    updateStatus: (status: {
      status: string;
      latitude?: number;
      longitude?: number;
      batteryLevel?: number;
      isShiftActive?: boolean;
    }) =>
      apiClient<ApiResponse>('/api/driver/status', {
        method: 'POST',
        body: JSON.stringify(status),
      }),
    getBoxes: () =>
      apiClient<{ success: boolean; boxes: any[] }>('/api/driver/boxes', {
        method: 'GET',
      }),
  },

  owner: {
    getDashboard: () =>
      apiClient<{ success: boolean; dashboard: OwnerDashboardData }>('/api/owner/dashboard', {
        method: 'GET',
      }),
    getCustomers: (params?: { page?: number; limit?: number; status?: string; searchText?: string; branchId?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return apiClient<{ success: boolean; customers: CustomerData[]; pagination: any }>(
        `/api/owner/customers${query ? `?${query}` : ''}`,
        { method: 'GET' }
      );
    },
    saveCustomer: (customer: Partial<CustomerData>) =>
      apiClient<{ success: boolean; customer: CustomerData }>('/api/owner/customers', {
        method: 'POST',
        body: JSON.stringify(customer),
      }),
    getStaff: () =>
      apiClient<{ success: boolean; staff: StaffData[] }>('/api/owner/staff', {
        method: 'GET',
      }),
    saveStaff: (staffData: Partial<StaffData> & { pin?: string }) =>
      apiClient<{ success: boolean; staff: StaffData; message?: string }>('/api/owner/staff', {
        method: 'POST',
        body: JSON.stringify(staffData),
      }),
    deleteStaff: (staffId: string) =>
      apiClient<ApiResponse>(`/api/owner/staff/${staffId}`, {
        method: 'DELETE',
      }),
    getDeliveries: (date?: string) =>
      apiClient<{ success: boolean; deliveries: any[] }>(`/api/owner/deliveries${date ? `?date=${date}` : ''}`, {
        method: 'GET',
      }),
    getBilling: () =>
      apiClient<{ success: boolean; billing: any }>('/api/owner/billing', {
        method: 'GET',
      }),
    upgradePlan: (planId: string, durationMonths = 1) =>
      apiClient<{ success: boolean; order: any }>('/api/owner/billing/upgrade', {
        method: 'POST',
        body: JSON.stringify({ planId, durationMonths }),
      }),
    getPlans: () =>
      apiClient<{ success: boolean; plans: any[] }>('/api/owner/plans', {
        method: 'GET',
      }),
    getInvoices: () =>
      apiClient<{ success: boolean; invoices: any[] }>('/api/owner/invoices', {
        method: 'GET',
      }),
  },

  manager: {
    getDashboard: () =>
      apiClient<{ success: boolean; dashboard: ManagerDashboardData }>('/api/manager/dashboard', {
        method: 'GET',
      }),
    getStaff: () =>
      apiClient<{ success: boolean; staff: StaffData[] }>('/api/manager/staff', {
        method: 'GET',
      }),
    saveStaff: (staffData: Partial<StaffData> & { pin?: string }) =>
      apiClient<{ success: boolean; staff: StaffData }>('/api/manager/staff', {
        method: 'POST',
        body: JSON.stringify(staffData),
      }),
    getAnalytics: () =>
      apiClient<{ success: boolean; analytics: any }>('/api/manager/analytics', {
        method: 'GET',
      }),
  },

  admin: {
    getUsers: (params?: { page?: number; limit?: number; status?: string; searchText?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return apiClient<{ success: boolean; users: any[]; pagination: any }>(
        `/api/admin/users${query ? `?${query}` : ''}`,
        { method: 'GET' }
      );
    },
    getSubscriptions: () =>
      apiClient<{ success: boolean; subscriptions: any[] }>('/api/admin/subscriptions', {
        method: 'GET',
      }),
    updateSubscription: (businessId: string, updates: any) =>
      apiClient<ApiResponse>('/api/admin/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ businessId, updates }),
      }),
    getAnalytics: () =>
      apiClient<{ success: boolean; analytics: any }>('/api/admin/analytics', {
        method: 'GET',
      }),
    getAuditLogs: (params?: { page?: number; businessId?: string; action?: string; days?: number }) => {
      const query = new URLSearchParams(params as any).toString();
      return apiClient<{ success: boolean; logs: AuditLogEntry[]; pagination: any }>(
        `/api/admin/audit${query ? `?${query}` : ''}`,
        { method: 'GET' }
      );
    },
  },
};
