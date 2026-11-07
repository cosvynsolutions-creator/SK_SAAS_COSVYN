import { db } from '../../../apps/owner/src/services/firebase';
import { 
  CustomerData, 
  StaffData, 
  OwnerDashboardData, 
  ManagerDashboardData, 
  DriverRouteSummary, 
  DriverDeliveryStop,
  AuthUser 
} from '../../../packages/types/src';

export const getFirestoreInstance = () => db;

// In-Memory store seeded with initial demo and production fallback state
interface MockStoreState {
  users: Map<string, AuthUser & { password_hash?: string }>;
  driverAuth: Map<string, { phone: string; pin_hash: string; staffId: string; businessId: string; name: string; branchId: string }>;
  businesses: Map<string, any>;
  customers: Map<string, CustomerData[]>;
  staff: Map<string, StaffData[]>;
  deliveries: Map<string, DriverDeliveryStop[]>;
}

// Initial state
const state: MockStoreState = {
  users: new Map([
    ['admin_1', {
      uid: 'admin_1',
      email: 'memosmy10@gmail.com',
      name: 'Super Admin',
      role: 'admin',
      businessId: 'global',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      // bcrypt hash for "admin123"
      password_hash: '$2a$12$e8iV7oYcM5uUZZtB8aKk7.sM8Xj80D9Fq2ZJcE4.q9uRzV7gT1V3G'
    }],
    ['owner_1', {
      uid: 'owner_1',
      email: 'owner@kitchen.com',
      name: 'Spice Delight Kitchens',
      role: 'owner',
      businessId: 'biz_spicedelight',
      phone: '9876543210',
      status: 'active',
      createdAt: '2024-02-15T00:00:00Z',
      // bcrypt hash for "password123"
      password_hash: '$2a$12$wKz0bBqmCsh5.u/5U2zGVuZcZ6E/aRkeJbV6.JzK7F24a9dKjC4XG'
    }],
    ['manager_1', {
      uid: 'manager_1',
      email: 'manager@spicedelight.com',
      name: 'Downtown Hub Manager',
      role: 'manager',
      businessId: 'biz_spicedelight',
      branchId: 'branch_downtown',
      phone: '9876543211',
      status: 'active',
      createdAt: '2024-03-01T00:00:00Z',
      password_hash: '$2a$12$wKz0bBqmCsh5.u/5U2zGVuZcZ6E/aRkeJbV6.JzK7F24a9dKjC4XG'
    }]
  ]),
  driverAuth: new Map([
    ['7702667567', {
      phone: '7702667567',
      // bcrypt hash for '1234'
      pin_hash: '$2a$10$eE61H2a9Vl/4F3oYFqC10ugjKj/6x2RkU9lM6b/J71xXlWqI0q08S',
      staffId: 'staff_suresh',
      businessId: 'biz_spicedelight',
      name: 'Suresh Kumar',
      branchId: 'branch_downtown'
    }],
    ['9876543210', {
      phone: '9876543210',
      pin_hash: '$2a$10$eE61H2a9Vl/4F3oYFqC10ugjKj/6x2RkU9lM6b/J71xXlWqI0q08S',
      staffId: 'staff_ramesh',
      businessId: 'biz_spicedelight',
      name: 'Ramesh Patel',
      branchId: 'branch_downtown'
    }]
  ]),
  businesses: new Map([
    ['biz_spicedelight', {
      id: 'biz_spicedelight',
      uid: 'owner_1',
      name: 'Spice Delight Kitchens',
      email: 'owner@kitchen.com',
      phone: '9876543210',
      address: '42 MG Road, Indiranagar',
      city: 'Bangalore',
      subscription: {
        status: 'active',
        plan: 'pro',
        startDate: '2024-01-01',
        expiryDate: '2026-12-31',
        features: { mealsPerDay: 500, staff: 20, branches: 5 }
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z'
    }]
  ]),
  customers: new Map([
    ['biz_spicedelight', [
      {
        id: 'cust_1',
        businessId: 'biz_spicedelight',
        branchId: 'branch_downtown',
        name: 'Rajesh Sharma',
        phone: '9845012345',
        email: 'rajesh@example.com',
        address: 'Flat 402, Green Towers, Indiranagar, Bangalore',
        latitude: 12.9784,
        longitude: 77.6408,
        plan: {
          planId: 'plan_gold',
          name: 'Gold 5-Day Meal Plan',
          mealsPerDay: 2,
          daysPerWeek: 5,
          startDate: '2024-10-01',
          endDate: '2024-12-31',
          status: 'active'
        },
        balance: 240000, // Rs. 2,400
        reusableBoxType: 'Stainless Steel 3-Tier Dabba',
        notes: 'Ring doorbell twice. Vegetarian only.',
        createdAt: '2024-10-01T00:00:00Z',
        updatedAt: '2024-10-01T00:00:00Z'
      },
      {
        id: 'cust_2',
        businessId: 'biz_spicedelight',
        branchId: 'branch_downtown',
        name: 'Priya Narang',
        phone: '9845098765',
        email: 'priya@example.com',
        address: 'Villa 12, Palm Meadows, Whitefield, Bangalore',
        latitude: 12.9698,
        longitude: 77.7500,
        plan: {
          planId: 'plan_keto',
          name: 'Keto Lunch Box',
          mealsPerDay: 1,
          daysPerWeek: 6,
          startDate: '2024-10-15',
          endDate: '2024-11-15',
          status: 'active'
        },
        balance: 180000,
        reusableBoxType: 'Eco Glass-Lock Meal Container',
        notes: 'Leave at security gate with flat number written.',
        createdAt: '2024-10-15T00:00:00Z',
        updatedAt: '2024-10-15T00:00:00Z'
      }
    ]]
  ]),
  staff: new Map([
    ['biz_spicedelight', [
      {
        id: 'staff_suresh',
        businessId: 'biz_spicedelight',
        branchId: 'branch_downtown',
        name: 'Suresh Kumar',
        phone: '7702667567',
        role: 'driver',
        status: 'active',
        joinDate: '2024-03-01',
        isShiftActive: true,
        batteryLevel: 88,
        currentLocation: { lat: 12.9716, lng: 77.5946 },
        createdAt: '2024-03-01T00:00:00Z',
        updatedAt: '2024-10-27T00:00:00Z'
      },
      {
        id: 'staff_ramesh',
        businessId: 'biz_spicedelight',
        branchId: 'branch_downtown',
        name: 'Ramesh Patel',
        phone: '9876543210',
        role: 'driver',
        status: 'active',
        joinDate: '2024-04-10',
        isShiftActive: false,
        batteryLevel: 95,
        currentLocation: { lat: 12.9750, lng: 77.6000 },
        createdAt: '2024-04-10T00:00:00Z',
        updatedAt: '2024-10-27T00:00:00Z'
      }
    ]]
  ]),
  deliveries: new Map([
    ['staff_suresh', [
      {
        id: 'del_101',
        customerId: 'cust_1',
        customerName: 'Rajesh Sharma',
        phone: '9845012345',
        address: 'Flat 402, Green Towers, Indiranagar',
        latitude: 12.9784,
        longitude: 77.6408,
        sequence: 1,
        status: 'delivered',
        mealsToday: [
          {
            mealId: 'meal_1',
            session: 'lunch',
            plan: 'Gold 5-Day Meal Plan',
            status: 'delivered',
            containers: [{ id: 'box_st_1', type: 'Stainless Steel 3-Tier Dabba', isReusable: true }]
          }
        ],
        collectedBoxes: [{ id: 'prev_box_1', type: 'Stainless Steel 3-Tier Dabba', isReusable: true }],
        notes: 'Delivered at door',
        completedAt: new Date().toISOString()
      },
      {
        id: 'del_102',
        customerId: 'cust_2',
        customerName: 'Priya Narang',
        phone: '9845098765',
        address: 'Villa 12, Palm Meadows, Whitefield',
        latitude: 12.9698,
        longitude: 77.7500,
        sequence: 2,
        status: 'not_visited',
        mealsToday: [
          {
            mealId: 'meal_2',
            session: 'lunch',
            plan: 'Keto Lunch Box',
            status: 'pending',
            containers: [{ id: 'box_gl_1', type: 'Eco Glass-Lock Meal Container', isReusable: true }]
          }
        ],
        collectedBoxes: [],
        notes: 'Leave at security gate'
      }
    ]]
  ])
};

export const dbService = {
  // Auth users
  findUserByEmail: async (email: string) => {
    const normalized = email.trim().toLowerCase();
    for (const user of state.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  },

  findUserById: async (uid: string) => {
    return state.users.get(uid) || null;
  },

  createUser: async (userData: AuthUser & { password_hash?: string }) => {
    state.users.set(userData.uid, userData);
    return userData;
  },

  // Driver Auth
  findDriverByPhone: async (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    return state.driverAuth.get(cleanPhone) || null;
  },

  setDriverPinRecord: async (record: {
    phone: string;
    pin_hash: string;
    staffId: string;
    businessId: string;
    name: string;
    branchId: string;
  }) => {
    const cleanPhone = record.phone.replace(/\D/g, '').slice(-10);
    state.driverAuth.set(cleanPhone, record);
    return record;
  },

  // Business
  getBusinessById: async (businessId: string) => {
    return state.businesses.get(businessId) || null;
  },

  createBusiness: async (bizData: any) => {
    state.businesses.set(bizData.id, bizData);
    return bizData;
  },

  getAllBusinesses: async () => {
    return Array.from(state.businesses.values());
  },

  updateBusiness: async (businessId: string, updates: any) => {
    const existing = state.businesses.get(businessId);
    if (!existing) return null;
    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    state.businesses.set(businessId, merged);
    return merged;
  },

  // Staff
  getStaff: async (businessId: string, branchId?: string) => {
    const list = state.staff.get(businessId) || [];
    if (branchId && branchId !== 'All') {
      return list.filter(s => s.branchId === branchId);
    }
    return list;
  },

  saveStaff: async (businessId: string, staffData: StaffData) => {
    const list = state.staff.get(businessId) || [];
    const index = list.findIndex(s => s.id === staffData.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...staffData, updatedAt: new Date().toISOString() };
    } else {
      list.push(staffData);
    }
    state.staff.set(businessId, list);
    return staffData;
  },

  deleteStaff: async (businessId: string, staffId: string) => {
    const list = state.staff.get(businessId) || [];
    const filtered = list.filter(s => s.id !== staffId);
    state.staff.set(businessId, filtered);
    return true;
  },

  // Customers
  getCustomers: async (businessId: string, branchId?: string) => {
    const list = state.customers.get(businessId) || [];
    if (branchId && branchId !== 'All') {
      return list.filter(c => c.branchId === branchId);
    }
    return list;
  },

  saveCustomer: async (businessId: string, customerData: CustomerData) => {
    const list = state.customers.get(businessId) || [];
    const index = list.findIndex(c => c.id === customerData.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...customerData, updatedAt: new Date().toISOString() };
    } else {
      list.push(customerData);
    }
    state.customers.set(businessId, list);
    return customerData;
  },

  // Driver route & delivery
  getDriverRoute: async (driverId: string, date?: string): Promise<DriverRouteSummary> => {
    const deliveries = state.deliveries.get(driverId) || [];
    const completed = deliveries.filter(d => d.status === 'delivered').length;
    return {
      driverId,
      date: date || new Date().toISOString().split('T')[0],
      totalStops: deliveries.length,
      completedStops: completed,
      mealSessions: {
        breakfast: { count: 0, completed: 0 },
        lunch: { count: deliveries.length, completed },
        dinner: { count: 0, completed: 0 }
      },
      deliveries
    };
  },

  updateDeliveryStatus: async (
    driverId: string,
    deliveryId: string,
    status: DriverDeliveryStop['status'],
    details?: Partial<DriverDeliveryStop>
  ) => {
    const deliveries = state.deliveries.get(driverId) || [];
    const target = deliveries.find(d => d.id === deliveryId);
    if (!target) return null;

    target.status = status;
    target.completedAt = new Date().toISOString();
    if (details?.collectedBoxes) {
      target.collectedBoxes = [...(target.collectedBoxes || []), ...details.collectedBoxes];
    }
    if (details?.notes) {
      target.notes = details.notes;
    }
    return target;
  },

  updateDriverStatus: async (
    businessId: string,
    staffId: string,
    statusUpdate: { status?: string; latitude?: number; longitude?: number; batteryLevel?: number; isShiftActive?: boolean }
  ) => {
    const list = state.staff.get(businessId) || [];
    const staff = list.find(s => s.id === staffId);
    if (staff) {
      if (statusUpdate.batteryLevel !== undefined) staff.batteryLevel = statusUpdate.batteryLevel;
      if (statusUpdate.isShiftActive !== undefined) staff.isShiftActive = statusUpdate.isShiftActive;
      if (statusUpdate.latitude && statusUpdate.longitude) {
        staff.currentLocation = { lat: statusUpdate.latitude, lng: statusUpdate.longitude };
      }
      staff.lastLocationUpdate = new Date().toISOString();
    }
    return staff;
  },

  // Dashboard Aggregates
  getOwnerDashboard: async (businessId: string): Promise<OwnerDashboardData> => {
    const biz = state.businesses.get(businessId) || { name: 'Kitchen Business', subscription: { status: 'active', plan: 'pro', expiryDate: '2026-12-31' } };
    const custs = state.customers.get(businessId) || [];
    const staff = state.staff.get(businessId) || [];
    const drivers = staff.filter(s => s.role === 'driver');
    const activeDrivers = drivers.filter(d => d.isShiftActive);

    return {
      businessName: biz.name,
      subscriptionStatus: biz.subscription?.status || 'active',
      planName: biz.subscription?.plan || 'Pro',
      planExpiryDate: biz.subscription?.expiryDate || '2026-12-31',
      activeBranches: 2,
      totalCustomers: custs.length,
      activeSubscribers: custs.filter(c => c.plan?.status === 'active').length,
      todayDeliveries: {
        scheduled: custs.length,
        completed: 1,
        failed: 0,
        pending: Math.max(0, custs.length - 1)
      },
      revenue: {
        today: 4500,
        thisMonth: 135000,
        thisYear: 1620000
      },
      staff: {
        drivers: drivers.length,
        active: activeDrivers.length,
        onLeave: drivers.length - activeDrivers.length
      }
    };
  },

  getManagerDashboard: async (businessId: string, branchId: string): Promise<ManagerDashboardData> => {
    const staff = (state.staff.get(businessId) || []).filter(s => !branchId || branchId === 'All' || s.branchId === branchId);
    return {
      branchName: branchId || 'Downtown Hub',
      branchId: branchId || 'branch_1',
      staff,
      todayStats: {
        totalDeliveries: 15,
        completed: 10,
        failed: 1
      }
    };
  }
};
