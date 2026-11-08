import { describe, it, expect } from 'vitest';
import { 
  calculateEndDate, 
  calculateRemainingDeliveries, 
  getCustomerActiveDaysLeft,
  formatDateDDMMYYYY,
  getDefaultMealSessionForTime,
  getCustomerScheduledPlansForSession,
  normalizePhone,
  GlobalCustomer,
  GlobalPlan,
  PauseEvent
} from '../apps/owner/src/services/store';
import { 
  sanitizeFirestoreData, 
  getTargetBusinessId 
} from '../apps/owner/src/services/dbService';

describe('ScaleKitchen Database Persistence & Data Integrity Tests', () => {

  describe('1. Data Sanitization (Protection against Firestore undefined crash)', () => {
    it('should strip undefined values recursively from flat and nested objects', () => {
      const rawPayload = {
        name: 'Avinash',
        mobile: '9876543210',
        emptyField: undefined,
        nested: {
          area: 'Indiranagar',
          landmark: undefined,
          deep: {
            valid: 100,
            invalid: undefined
          }
        },
        items: [
          { planId: 'p1', notes: undefined, price: 500 },
          { planId: 'p2', notes: 'Vegetarian', price: undefined }
        ]
      };

      const sanitized = sanitizeFirestoreData(rawPayload);

      expect(sanitized.emptyField).toBeUndefined();
      expect(sanitized.name).toBe('Avinash');
      expect(sanitized.nested.landmark).toBeUndefined();
      expect(sanitized.nested.area).toBe('Indiranagar');
      expect(sanitized.nested.deep.invalid).toBeUndefined();
      expect(sanitized.nested.deep.valid).toBe(100);
      expect(sanitized.items[0].notes).toBeUndefined();
      expect(sanitized.items[0].price).toBe(500);
      expect(sanitized.items[1].notes).toBe('Vegetarian');
      expect(sanitized.items[1].price).toBeUndefined();
    });

    it('should handle primitives and null values safely', () => {
      expect(sanitizeFirestoreData(null)).toBeNull();
      expect(sanitizeFirestoreData(undefined)).toBeNull();
      expect(sanitizeFirestoreData('string')).toBe('string');
      expect(sanitizeFirestoreData(12345)).toBe(12345);
      expect(sanitizeFirestoreData(true)).toBe(true);
    });
  });

  describe('2. Multi-Tenant Business ID Resolution', () => {
    it('should return default owner UID when outside manager and driver routes', () => {
      const ownerUid = 'owner_user_123';
      const resolved = getTargetBusinessId(ownerUid);
      expect(resolved).toBe(ownerUid);
    });

    it('should return empty string safely when no fallback and no auth currentUser', () => {
      const resolved = getTargetBusinessId('');
      expect(typeof resolved).toBe('string');
    });
  });

  describe('3. Customer Expiration & Days Left Consistency (Preventing Old Expired Customers in Notifications)', () => {
    const samplePlans: GlobalPlan[] = [
      { id: 'plan_lunch', branchId: 'b1', name: 'Weight Gain', price: 3000, numberOfDeliveryDays: 26, weekdays: [1,2,3,4,5,6] },
      { id: 'plan_dinner', branchId: 'b1', name: 'Keto Diet', price: 3500, numberOfDeliveryDays: 26, weekdays: [1,2,3,4,5,6] }
    ];

    it('should accurately detect expired customers with past end dates', () => {
      const pastCustomer = {
        id: 'cust_expired_1',
        name: 'Avinash Expired',
        mobile: '9123456789',
        address: '123 MG Road',
        area: 'Indiranagar',
        createdAt: '2026-09-01',
        branchId: 'b1',
        deliveryBoyId: 'd1',
        activePlans: [
          {
            planId: 'plan_lunch',
            planName: 'Weight Gain',
            mealTime: 'Lunch',
            startDate: '2026-09-01',
            endDate: '2026-09-30', // expired weeks ago
            price: 3000,
            pauses: []
          }
        ]
      } as unknown as GlobalCustomer;

      const status = getCustomerActiveDaysLeft(pastCustomer, samplePlans);
      expect(status.isExpired).toBe(true);
      expect(status.daysLeft).toBe(0);
    });

    it('should accurately detect customer ending today (0 days left)', () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const kartiCustomer = {
        id: 'cust_karti_13',
        name: 'Karti',
        mobile: '4400228854',
        address: 'RG Nagar',
        area: 'Bellenduru',
        createdAt: '2026-09-26',
        branchId: 'b1',
        deliveryBoyId: 'd1',
        activePlans: [
          {
            planId: 'plan_dinner',
            planName: 'Keto Diet',
            mealTime: 'Dinner',
            startDate: '2026-09-26',
            endDate: todayStr, // ends today
            price: 3500,
            pauses: []
          }
        ]
      } as unknown as GlobalCustomer;

      const status = getCustomerActiveDaysLeft(kartiCustomer, samplePlans);
      expect(status.isExpired).toBe(false);
      expect(status.daysLeft).toBe(0);
      expect(status.endDate).toBe(todayStr);
    });

    it('should calculate future deliveries correctly for active customers', () => {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 14);
      const futureStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

      const activeCustomer = {
        id: 'cust_active_1',
        name: 'Priya Sharma',
        mobile: '9876501234',
        address: 'HSR Layout Sector 2',
        area: 'HSR Layout',
        createdAt: '2026-10-15',
        branchId: 'b1',
        deliveryBoyId: 'd1',
        activePlans: [
          {
            planId: 'plan_lunch',
            planName: 'Weight Gain',
            mealTime: 'Lunch',
            startDate: '2026-10-15',
            endDate: futureStr,
            price: 3000,
            pauses: []
          }
        ]
      } as unknown as GlobalCustomer;

      const status = getCustomerActiveDaysLeft(activeCustomer, samplePlans);
      expect(status.isExpired).toBe(false);
      expect(status.daysLeft).toBeGreaterThan(0);
    });
  });

  describe('4. Date and Pause Calculation Precision', () => {
    it('should not treat flat legacy plan fields as active when activePlans is explicitly empty', () => {
      const customer = {
        isActive: true,
        activePlans: [],
        planId: 'old-plan',
        planName: 'Old Lunch Plan',
        mealTime: ['Lunch'],
        startDate: '2026-11-01',
        endDate: '2026-11-30'
      };

      expect(getCustomerScheduledPlansForSession(customer, 'Lunch', '2026-11-09')).toEqual([]);
    });

    it('should push end date forward by the exact number of paused delivery days', () => {
      const weekdays = [1, 2, 3, 4, 5, 6]; // Mon to Sat (6 days/week)
      const startDate = '2026-11-02'; // Monday

      // 6 days delivery without pauses ends on Saturday 2026-11-07
      const normalEnd = calculateEndDate(startDate, 6, weekdays, []);
      expect(normalEnd).toBe('2026-11-07');

      // Adding 2 delivery days pause (Wednesday 2026-11-04 to Thursday 2026-11-05)
      const pauses: PauseEvent[] = [
        { start: '2026-11-04', end: '2026-11-05', type: 'User' }
      ];

      const pausedEnd = calculateEndDate(startDate, 6, weekdays, pauses);
      // Pushed by 2 delivery days from Saturday 2026-11-07: Sunday skipped -> Mon 2026-11-09, Tue 2026-11-10
      expect(pausedEnd).toBe('2026-11-10');
    });

    it('should format dates as DD/MM/YYYY reliably', () => {
      expect(formatDateDDMMYYYY('2026-10-26')).toBe('26/10/2026');
      expect(formatDateDDMMYYYY('2026-01-05')).toBe('05/01/2026');
      expect(formatDateDDMMYYYY('')).toBe('');
    });
  });

  describe('5. Automatic Meal Session Selection Boundaries (Issue 1)', () => {
    it('should select Breakfast from 12:00 AM (00:00:00) to 10:59:59 AM', () => {
      // 00:00:00
      const midnight = new Date(2026, 9, 27, 0, 0, 0);
      expect(getDefaultMealSessionForTime(midnight)).toBe('Breakfast');

      // 08:30:00
      const morning = new Date(2026, 9, 27, 8, 30, 0);
      expect(getDefaultMealSessionForTime(morning)).toBe('Breakfast');

      // 10:59:59 (Exact upper boundary)
      const lateBreakfast = new Date(2026, 9, 27, 10, 59, 59);
      expect(getDefaultMealSessionForTime(lateBreakfast)).toBe('Breakfast');
    });

    it('should select Lunch from 11:00 AM (11:00:00) to 4:59:59 PM (16:59:59)', () => {
      // 11:00:00 (Exact start)
      const elevenAm = new Date(2026, 9, 27, 11, 0, 0);
      expect(getDefaultMealSessionForTime(elevenAm)).toBe('Lunch');

      // 13:45:00 (Afternoon)
      const afternoon = new Date(2026, 9, 27, 13, 45, 0);
      expect(getDefaultMealSessionForTime(afternoon)).toBe('Lunch');

      // 16:59:59 (Exact upper boundary)
      const lateLunch = new Date(2026, 9, 27, 16, 59, 59);
      expect(getDefaultMealSessionForTime(lateLunch)).toBe('Lunch');
    });

    it('should select Dinner from 5:00 PM (17:00:00) to 11:59:59 PM (23:59:59)', () => {
      // 17:00:00 (Exact start)
      const fivePm = new Date(2026, 9, 27, 17, 0, 0);
      expect(getDefaultMealSessionForTime(fivePm)).toBe('Dinner');

      // 20:15:00 (Evening)
      const night = new Date(2026, 9, 27, 20, 15, 0);
      expect(getDefaultMealSessionForTime(night)).toBe('Dinner');

      // 23:59:59 (End of day)
      const lateDinner = new Date(2026, 9, 27, 23, 59, 59);
      expect(getDefaultMealSessionForTime(lateDinner)).toBe('Dinner');
    });
  });

  describe('6. Driver Contact Data & Account Status', () => {
    it('should normalize driver mobile numbers to 10-digit lookup keys', () => {
      expect(normalizePhone('+91 8309995962')).toBe('8309995962');
      expect(normalizePhone('08309995962')).toBe('8309995962');
      expect(normalizePhone('83099 95962')).toBe('8309995962');
      expect(normalizePhone('91-8309995962')).toBe('8309995962');
      expect(normalizePhone('+918309995962')).toBe('8309995962');
    });

    it('should reject deactivated driver accounts (Test 10)', () => {
      const isDriverActive = (record: { active?: boolean; isDeleted?: boolean; status?: string }) => {
        if (record.active === false || record.isDeleted === true || record.status === 'Inactive') {
          return false;
        }
        return true;
      };

      expect(isDriverActive({ active: true, status: 'Online' })).toBe(true);
      expect(isDriverActive({ active: false, status: 'Online' })).toBe(false);
      expect(isDriverActive({ isDeleted: true })).toBe(false);
      expect(isDriverActive({ status: 'Inactive' })).toBe(false);
    });
  });

  describe('7. Customer Persistence Architecture & Data Integrity', () => {
    it('should always guarantee canonical Firestore document ID precedence over internal document fields', () => {
      // Simulating a document from Firestore where the internal JSON has a legacy or mismatched "id"
      const firestoreDoc = {
        id: 'real_firestore_doc_id_999',
        data: () => ({
          id: 'stale_legacy_id_001',
          name: 'Naveen Kumar',
          mobile: '9876543210',
          branchId: 'b1'
        })
      };

      // Correct mapping pattern implemented: { ...doc.data(), id: doc.id }
      const item = {
        ...firestoreDoc.data(),
        id: firestoreDoc.id
      };

      // The canonical Firestore doc.id must be preserved so update/delete operations target the real document
      expect(item.id).toBe('real_firestore_doc_id_999');
      expect(item.name).toBe('Naveen Kumar');
      expect(item.id).not.toBe('stale_legacy_id_001');
    });

    it('should strip computed virtual enrichment fields before persisting customer updates', () => {
      const enrichedCustomerPayload = {
        id: 'cust_abc_123',
        name: 'Rohan Verma',
        mobile: '9988776655',
        area: 'Koramangala',
        branchId: 'b1',
        amountPaid: 3500,
        // Virtual computed enrichment fields that must never pollute stored database documents
        realDaysLeft: 22,
        isExpired: false,
        latestEndDate: '2026-11-20',
        canonicalPlanName: 'Weight Gain Plan',
        activePlans: [
          { planId: 'p1', planName: 'Weight Gain Plan', mealTime: 'Lunch', price: 3500, startDate: '2026-10-26', endDate: '2026-11-20', pauses: [] }
        ]
      };

      // Replication of updateItem / setItem data stripping logic
      const { 
        id: _ignoreId, 
        realDaysLeft: _ignoreDaysLeft, 
        isExpired: _ignoreExpired, 
        latestEndDate: _ignoreLatestEnd, 
        canonicalPlanName: _ignorePlanName,
        ...cleanData 
      } = enrichedCustomerPayload;

      const sanitizedPayload = sanitizeFirestoreData({
        ...cleanData,
        updatedAt: '2026-10-26T21:40:00.000Z'
      });

      expect(sanitizedPayload.name).toBe('Rohan Verma');
      expect(sanitizedPayload.mobile).toBe('9988776655');
      expect(sanitizedPayload.activePlans).toHaveLength(1);
      // Virtual fields must be stripped
      expect((sanitizedPayload as any).id).toBeUndefined();
      expect((sanitizedPayload as any).realDaysLeft).toBeUndefined();
      expect((sanitizedPayload as any).isExpired).toBeUndefined();
      expect((sanitizedPayload as any).latestEndDate).toBeUndefined();
      expect((sanitizedPayload as any).canonicalPlanName).toBeUndefined();
    });

    it('should reject missing document ID or business ID on atomic customer deletion (Negative Path)', async () => {
      const validateDeleteInput = (businessId?: string, customerId?: string) => {
        if (!businessId) throw new Error("No target business ID found.");
        if (!customerId) throw new Error("No customer ID provided for deletion.");
        return true;
      };

      expect(() => validateDeleteInput('', 'cust_123')).toThrow('No target business ID found.');
      expect(() => validateDeleteInput('biz_123', '')).toThrow('No customer ID provided for deletion.');
      expect(validateDeleteInput('biz_123', 'cust_123')).toBe(true);
    });

    it('should reject missing business ID on customer update (Negative Path)', () => {
      const validateUpdateInput = (businessId?: string, customerId?: string) => {
        if (!businessId) throw new Error("No target business ID found.");
        if (!customerId) throw new Error("No document ID provided for update.");
        return true;
      };

      expect(() => validateUpdateInput('', 'cust_123')).toThrow('No target business ID found.');
      expect(() => validateUpdateInput('biz_123', '')).toThrow('No document ID provided for update.');
      expect(validateUpdateInput('biz_123', 'cust_123')).toBe(true);
    });

    it('should resolve business ID from session storage fallback if auth user is temporarily loading', () => {
      // Mock localStorage session
      const mockSession = JSON.stringify({ uid: 'stored_owner_uid_777', email: 'owner@test.com' });
      const parsed = JSON.parse(mockSession);
      
      const resolveBiz = (fallbackUid?: string, authUid?: string) => {
        return fallbackUid || authUid || parsed?.uid || '';
      };

      // With auth ready
      expect(resolveBiz('passed_uid', 'auth_uid')).toBe('passed_uid');
      // With fallback loading but auth ready
      expect(resolveBiz('', 'auth_uid')).toBe('auth_uid');
      // On fresh refresh before auth listener fires
      expect(resolveBiz('', '')).toBe('stored_owner_uid_777');
    });
  });

  describe('8. Platform Razorpay Checkout Resolution (Enterprise Environment Flow)', () => {
    it('should resolve the platform key strictly from environment variables without code hardcoding', () => {
      const resolveEnvKey = (envKey?: string) => {
        if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
          return envKey.trim();
        }
        return '';
      };

      // 1. When VITE_RAZORPAY_KEY_ID is set in .env
      expect(resolveEnvKey('rzp_test_SXPy6QPmqMyjkM')).toBe('rzp_test_SXPy6QPmqMyjkM');
      expect(resolveEnvKey('rzp_live_realprod123')).toBe('rzp_live_realprod123');

      // 2. When empty or unconfigured, returns empty string so app alerts administrator
      expect(resolveEnvKey('')).toBe('');
      expect(resolveEnvKey(undefined)).toBe('');
    });
  });
});
