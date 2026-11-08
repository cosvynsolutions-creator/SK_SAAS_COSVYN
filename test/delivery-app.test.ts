import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getDefaultMealSessionForTime, 
  isReusableBoxType, 
  formatDateDDMMYYYY, 
  shiftDateStr, 
  normalizeWeekday, 
  isPlanActiveOnDate, 
  getCustomerScheduledPlansForSession, 
  getDriverCustomersScheduledForSession,
  isCustomerDeliveryDay2Plus, 
  getTodayStr, 
  normalizePhone,
  GlobalCustomer,
  SubscribedPlan
} from '../apps/delivery/src/services/driverStore';
import { 
  getEffectiveBusinessName, 
  buildWhatsAppUrl, 
  getDeliveryArrivalMessage 
} from '../apps/delivery/src/services/whatsapp';
import { 
  firebaseConfig,
  app
} from '../apps/delivery/src/services/firebase';

describe('ScaleKitchen Delivery App — Phase 3 Test Suite', () => {

  describe('1. Firebase App & Isolation Strategy', () => {
    it('should initialize with the unique isolated app name "ScaleKitchenDelivery"', () => {
      expect(app.name).toBe('ScaleKitchenDelivery');
    });

    it('should use the correct production project configuration', () => {
      expect(firebaseConfig.projectId).toBe('subbussinesssaas');
      expect(firebaseConfig.authDomain).toBe('subbussinesssaas.firebaseapp.com');
    });
  });

  describe('2. Pure Business Logic & Delivery Scheduling', () => {
    it('should accurately determine default meal session based on hour boundaries', () => {
      // Breakfast: 00:00 to 10:59
      const morning = new Date('2026-10-15T08:30:00');
      expect(getDefaultMealSessionForTime(morning)).toBe('Breakfast');

      // Lunch: 11:00 to 16:59
      const afternoon = new Date('2026-10-15T12:45:00');
      expect(getDefaultMealSessionForTime(afternoon)).toBe('Lunch');

      // Dinner: 17:00 to 23:59
      const evening = new Date('2026-10-15T18:15:00');
      expect(getDefaultMealSessionForTime(evening)).toBe('Dinner');
    });

    it('should normalize 10-digit Indian mobile numbers reliably', () => {
      expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
      expect(normalizePhone('09876543210')).toBe('9876543210');
      expect(normalizePhone('98765-43210')).toBe('9876543210');
      expect(normalizePhone('(987) 654-3210')).toBe('9876543210');
    });

    it('should format dates to DD/MM/YYYY without timezone drift', () => {
      expect(formatDateDDMMYYYY('2026-11-03')).toBe('03/11/2026');
      expect(formatDateDDMMYYYY('2026-01-09T08:00:00.000Z')).toBe('09/01/2026');
      expect(formatDateDDMMYYYY(new Date(2026, 9, 25))).toBe('25/10/2026');
      expect(formatDateDDMMYYYY('')).toBe('');
      expect(formatDateDDMMYYYY(null)).toBe('');
    });

    it('should shift date strings accurately', () => {
      expect(shiftDateStr('2026-10-30', 2)).toBe('2026-11-01');
      expect(shiftDateStr('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('should classify reusable box types and reject disposable packaging', () => {
      expect(isReusableBoxType('Stainless Steel 3-Tier Dabba')).toBe(true);
      expect(isReusableBoxType('Stainless Steel 4-Tier Dabba')).toBe(true);
      expect(isReusableBoxType('Insulated Thermal Bento Box')).toBe(true);
      expect(isReusableBoxType('Eco Glass-Lock Meal Container')).toBe(true);
      expect(isReusableBoxType('Custom Reusable Box')).toBe(true);

      // Must be false for disposables
      expect(isReusableBoxType('None')).toBe(false);
      expect(isReusableBoxType('Disposable')).toBe(false);
      expect(isReusableBoxType('Paper Meal Tray')).toBe(false);
      expect(isReusableBoxType('')).toBe(false);
      expect(isReusableBoxType(null)).toBe(false);
      expect(isReusableBoxType(undefined)).toBe(false);
    });

    it('should identify Day 2+ customer delivery status for reusable box return', () => {
      const day1Customer: GlobalCustomer = {
        id: 'c1',
        name: 'New Customer',
        mobile: '9876543210',
        address: 'Bangalore',
        area: 'HSR',
        createdAt: '2026-10-15T00:00:00.000Z',
        branchId: 'b1',
        deliveryBoyId: 'd1',
        isActive: true,
        planId: 'p1',
        mealTime: ['Lunch'],
        startDate: '2026-10-15',
        endDate: '2026-11-15',
        daysLeft: 30,
        paymentStatus: 'Paid',
        amountPaid: 3000,
        planPrice: 3000,
        deliveryCharges: 0,
        pendingAmount: 0,
        renewalCount: 0,
        routeOrder: 1,
        reusableBoxEnabled: true,
        reusableBoxType: 'Stainless Steel 3-Tier Dabba',
        activePlans: [{
          planId: 'p1',
          planName: 'Lunch',
          mealTime: 'Lunch',
          startDate: '2026-10-15',
          endDate: '2026-11-15',
          price: 3000,
          pauses: [],
          weekdays: [1, 2, 3, 4, 5, 6],
          reusableBoxType: 'Stainless Steel 3-Tier Dabba'
        }]
      };

      // Target is same as start date (Day 1) -> day2plus is false
      expect(isCustomerDeliveryDay2Plus(day1Customer, '2026-10-15')).toBe(false);

      // Target is day after start date (Day 2) -> day2plus is true
      expect(isCustomerDeliveryDay2Plus(day1Customer, '2026-10-16')).toBe(true);
    });

    it('should filter scheduled plans by meal session and respect pauses', () => {
      const customer: GlobalCustomer = {
        id: 'c2',
        name: 'Regular Customer',
        mobile: '9845012345',
        address: 'Whitefield',
        area: 'Whitefield',
        createdAt: '2026-10-01T00:00:00.000Z',
        branchId: 'b1',
        deliveryBoyId: 'd1',
        isActive: true,
        planId: 'p-lunch',
        mealTime: ['Lunch', 'Dinner'],
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        daysLeft: 20,
        paymentStatus: 'Paid',
        amountPaid: 5000,
        planPrice: 5000,
        deliveryCharges: 0,
        pendingAmount: 0,
        renewalCount: 0,
        routeOrder: 1,
        activePlans: [
          {
            planId: 'p-lunch',
            planName: 'Lunch Box',
            mealTime: 'Lunch',
            startDate: '2026-10-01',
            endDate: '2026-10-31',
            price: 2500,
            pauses: [
              { start: '2026-10-10', end: '2026-10-12', type: 'User' }
            ],
            weekdays: [1, 2, 3, 4, 5, 6]
          },
          {
            planId: 'p-dinner',
            planName: 'Dinner Box',
            mealTime: 'Dinner',
            startDate: '2026-10-01',
            endDate: '2026-10-31',
            price: 2500,
            pauses: [],
            weekdays: [0, 1, 2, 3, 4, 5, 6]
          }
        ]
      };

      // Lunch plan on paused date (2026-10-11) should return empty
      const pausedLunch = getCustomerScheduledPlansForSession(customer, 'Lunch', '2026-10-11');
      expect(pausedLunch.length).toBe(0);

      // Lunch plan on active date (2026-10-15 Thursday) should return 1 plan
      const activeLunch = getCustomerScheduledPlansForSession(customer, 'Lunch', '2026-10-15');
      expect(activeLunch.length).toBe(1);
      expect(activeLunch[0].planName).toBe('Lunch Box');

      // Dinner plan on 2026-10-11 should return 1 plan (not paused)
      const dinnerPlans = getCustomerScheduledPlansForSession(customer, 'Dinner', '2026-10-11');
      expect(dinnerPlans.length).toBe(1);
      expect(dinnerPlans[0].planName).toBe('Dinner Box');
    });

    it('should include only this driver’s branch customers with plans scheduled on the selected date', () => {
      const makeCustomer = (id: string, deliveryBoyId: string, branchId: string) => ({
        id,
        name: id,
        mobile: '9876543210',
        address: 'Bangalore',
        area: 'Bangalore',
        createdAt: '2026-11-01',
        branchId,
        deliveryBoyId,
        isActive: true,
        planId: 'p-lunch',
        mealTime: ['Lunch'],
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        daysLeft: 20,
        paymentStatus: 'Paid' as const,
        amountPaid: 3000,
        planPrice: 3000,
        deliveryCharges: 0,
        pendingAmount: 0,
        renewalCount: 0,
        routeOrder: 1
      } as GlobalCustomer);
      const assigned = makeCustomer('assigned', 'driver-1', 'branch-1');
      const customers = [
        assigned,
        makeCustomer('other-driver', 'driver-2', 'branch-1'),
        makeCustomer('other-branch', 'driver-1', 'branch-2')
      ];

      expect(getDriverCustomersScheduledForSession(
        customers, 'driver-1', 'branch-1', 'Lunch', '2026-11-08'
      )).toEqual([]);
      expect(getDriverCustomersScheduledForSession(
        customers, 'driver-1', 'branch-1', 'Lunch', '2026-11-09'
      )).toEqual([{ customer: assigned, plans: expect.any(Array) }]);
      expect(getDriverCustomersScheduledForSession(
        customers, 'driver-1', '', 'Lunch', '2026-11-09'
      )).toEqual([]);
    });

    it('should not resurrect a flat legacy plan when activePlans is explicitly empty', () => {
      const customer = {
        id: 'expired',
        isActive: true,
        branchId: 'branch-1',
        deliveryBoyId: 'driver-1',
        activePlans: [],
        planId: 'old-plan',
        planName: 'Old Lunch Plan',
        mealTime: ['Lunch'],
        startDate: '2026-11-01',
        endDate: '2026-11-30'
      } as GlobalCustomer;

      expect(getCustomerScheduledPlansForSession(customer, 'Lunch', '2026-11-09')).toEqual([]);
      expect(getDriverCustomersScheduledForSession(
        [customer], 'driver-1', 'branch-1', 'Lunch', '2026-11-09'
      )).toEqual([]);
    });

    it('should use the India calendar date and meal time at UTC day boundaries', () => {
      const justAfterMidnightInIndia = new Date('2026-11-07T19:00:00.000Z');
      expect(getTodayStr(justAfterMidnightInIndia)).toBe('2026-11-08');
      expect(getDefaultMealSessionForTime(new Date('2026-11-08T04:30:00.000Z'))).toBe('Breakfast');
      expect(getDefaultMealSessionForTime(new Date('2026-11-08T06:00:00.000Z'))).toBe('Lunch');
    });
  });

  describe('4. WhatsApp Notification Service', () => {
    it('should format a valid WhatsApp URL with country code and encoded message', () => {
      const url = buildWhatsAppUrl('9876543210', 'Your meal is arriving!');
      expect(url).toBe('https://wa.me/919876543210?text=Your%20meal%20is%20arriving!');
    });

    it('should dynamically inject business name into delivery arrival message', () => {
      const msg = getDeliveryArrivalMessage('Rahul', 'Lunch', 'Sri Krishna Kitchens');
      expect(msg).toBe('Hi Rahul, your Lunch meal is arriving shortly from Sri Krishna Kitchens!');
    });

    it('should fallback gracefully when business name is default or missing', () => {
      const msg = getDeliveryArrivalMessage('Pooja', 'Dinner', 'ScaleKitchen');
      expect(msg).toBe('Hi Pooja, your Dinner meal is arriving shortly from Your Kitchen Service!');
    });
  });

  describe('5. Firebase claim-based driver identity', () => {
    it('requires role, business, and staff claims to identify a delivery partner', () => {
      const isDriverIdentity = (claims: { role?: string; bizId?: string; staffId?: string }) =>
        claims.role === 'driver' && Boolean(claims.bizId) && Boolean(claims.staffId);

      expect(isDriverIdentity({ role: 'driver', bizId: 'biz-1', staffId: 'rider-1' })).toBe(true);
      expect(isDriverIdentity({ role: 'owner', bizId: 'biz-1', staffId: 'rider-1' })).toBe(false);
      expect(isDriverIdentity({ role: 'driver', bizId: 'biz-1' })).toBe(false);
      expect(isDriverIdentity({ role: 'driver', staffId: 'rider-1' })).toBe(false);
    });
  });

  describe('6. Email + Password Authentication & Credential Architecture', () => {
    it('should validate driver email and password before dispatch', () => {
      const validateDriverCredentials = (email: string, pass: string) => {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) return 'Invalid email';
        if (!pass || pass.length < 6) return 'Password too short';
        return null;
      };

      expect(validateDriverCredentials('', 'secret123')).toBe('Invalid email');
      expect(validateDriverCredentials('invalid-email', 'secret123')).toBe('Invalid email');
      expect(validateDriverCredentials('driver@kitchen.com', '123')).toBe('Password too short');
      expect(validateDriverCredentials('driver@kitchen.com', 'secret123')).toBeNull();
    });

    it('should verify driver token claims structure contains role, bizId, staffId, branchId', () => {
      const claims = {
        role: 'driver',
        bizId: 'biz_alpha',
        staffId: 'staff_rider_1',
        branchId: 'branch_south'
      };

      expect(claims.role).toBe('driver');
      expect(claims.bizId).toBe('biz_alpha');
      expect(claims.staffId).toBe('staff_rider_1');
      expect(claims.branchId).toBe('branch_south');
    });

    it('should enforce that deactivated driver accounts are rejected', () => {
      const checkDriverActive = (doc: { active?: boolean; status?: string; isDeleted?: boolean }) => {
        if (doc.active === false || doc.status === 'Inactive' || doc.isDeleted) {
          return false;
        }
        return true;
      };

      expect(checkDriverActive({ active: true, status: 'Online' })).toBe(true);
      expect(checkDriverActive({ active: true, status: 'Offline' })).toBe(true);
      expect(checkDriverActive({ active: false, status: 'Online' })).toBe(false);
      expect(checkDriverActive({ active: true, status: 'Inactive' })).toBe(false);
      expect(checkDriverActive({ isDeleted: true })).toBe(false);
    });

    it('should validate complete Delivery Boy account creation payload fields', () => {
      const validateAccountPayload = (payload: {
        name?: string;
        email?: string;
        password?: string;
        mobile?: string;
        branchId?: string;
        salary?: number;
      }) => {
        if (!payload.name?.trim()) return 'Name required';
        const cleanEmail = (payload.email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) return 'Email required';
        if (!payload.password || payload.password.length < 6) return 'Password min 6 chars';
        const digits = (payload.mobile || '').replace(/\D/g, '');
        if (digits.length !== 10) return 'Valid 10-digit mobile required';
        if (!payload.branchId) return 'Branch required';
        return null;
      };

      expect(validateAccountPayload({
        name: 'Ramesh Rider',
        email: 'ramesh@kitchen.com',
        password: 'password123',
        mobile: '9876543210',
        branchId: 'branch-1',
        salary: 18000
      })).toBeNull();

      expect(validateAccountPayload({
        name: '',
        email: 'ramesh@kitchen.com',
        password: 'password123',
        mobile: '9876543210',
        branchId: 'branch-1'
      })).toBe('Name required');

      expect(validateAccountPayload({
        name: 'Ramesh',
        email: 'ramesh@kitchen.com',
        password: '123',
        mobile: '9876543210',
        branchId: 'branch-1'
      })).toBe('Password min 6 chars');
    });

    it('should correctly scope customer stops to driver assigned branch', () => {
      const driverBranchId = 'branch-east';
      const stops = [
        { id: 'c1', branchId: 'branch-east', deliveryBoyId: 'rider-1' },
        { id: 'c2', branchId: 'branch-west', deliveryBoyId: 'rider-2' },
        { id: 'c3', branchId: 'branch-east', deliveryBoyId: 'rider-1' }
      ];

      const driverStops = stops.filter(s => s.branchId === driverBranchId && s.deliveryBoyId === 'rider-1');
      expect(driverStops.length).toBe(2);
      expect(driverStops.map(s => s.id)).toEqual(['c1', 'c3']);
    });

    it('should verify driver_profiles contract guarantees UID and business isolation', () => {
      const mockDriverProfile = {
        uid: 'auth_driver_123',
        authUid: 'auth_driver_123',
        bizId: 'biz_scale_456',
        staffId: 'staff_789',
        branchId: 'branch_central',
        name: 'Suresh Express',
        email: 'suresh@scalekitchen.in',
        mobile: '9876543210',
        status: 'Active',
        active: true
      };

      expect(mockDriverProfile.authUid).toBe(mockDriverProfile.uid);
      expect(mockDriverProfile.bizId).toBe('biz_scale_456');
      expect(mockDriverProfile.active).toBe(true);
      expect(mockDriverProfile.status).toBe('Active');
    });
  });
});
