import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'scalekitchen-rules-test';

describe('ScaleKitchen Firestore Security Rules Test Suite', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed initial test data using withSecurityRulesDisabled (Admin mode)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      
      // Seed Business A root
      await setDoc(doc(db, 'businesses', 'biz_a'), {
        businessName: 'Kitchen Alpha',
        planName: 'Free Trial',
        planStatus: 'Active',
        planExpiryDate: '2026-12-31'
      });

      // Seed Business B root
      await setDoc(doc(db, 'businesses', 'biz_b'), {
        businessName: 'Kitchen Beta',
        planName: 'Pro Monthly',
        planStatus: 'Active',
        planExpiryDate: '2026-12-31'
      });

      // Seed Business A subcollections
      await setDoc(doc(db, 'businesses/biz_a/staff/driver_1'), {
        name: 'Raju Rider',
        mobile: '9876543210',
        branchId: 'branch_1',
        status: 'Offline',
        pinHash: '$2a$10$hashedpinvalue123456789'
      });

      await setDoc(doc(db, 'businesses/biz_a/customers/cust_1'), {
        name: 'Customer A1',
        mobile: '9111111111',
        branchId: 'branch_1'
      });

      await setDoc(doc(db, 'businesses/biz_a/plans/plan_1'), {
        name: 'Standard Lunch',
        price: 150
      });

      await setDoc(doc(db, 'businesses/biz_a/branches/branch_1'), {
        name: 'Central Hub'
      });

      await setDoc(doc(db, 'businesses/biz_a/invoices/inv_1'), {
        amount: 5000,
        customerName: 'Customer A1'
      });

      await setDoc(doc(db, 'businesses/biz_a/payments/pay_1'), {
        amount: 5000,
        gatewayPaymentId: 'pay_secret_123'
      });

      await setDoc(doc(db, 'businesses/biz_a/expenses/exp_1'), {
        category: 'Groceries',
        amount: 2500
      });

      await setDoc(doc(db, 'businesses/biz_a/inventory/item_1'), {
        item: 'Rice 50kg',
        cost: 1800
      });

      await setDoc(doc(db, 'businesses/biz_a/notes/note_1'), {
        content: 'Confidential strategy note'
      });

      await setDoc(doc(db, 'businesses/biz_a/single_orders/order_1'), {
        amount: 800
      });

      await setDoc(doc(db, 'businesses/biz_a/managers/mgr_1'), {
        name: 'Manager Mike',
        email: 'mike@kitchenalpha.com',
        branchId: 'branch_1',
        authUid: 'mgr_uid_1',
        active: true,
        passwordHash: '$2a$10$hashedpassword123'
      });
      await setDoc(doc(db, 'businesses/biz_a/managers/mgr_2'), {
        name: 'Manager Two',
        email: 'two@kitchenalpha.com',
        branchId: 'branch_2',
        authUid: 'mgr_uid_2',
        active: true
      });
      await setDoc(doc(db, 'businesses/biz_a/managers/mgr_all'), {
        name: 'All Branch Manager',
        email: 'all@kitchenalpha.com',
        branchId: 'All',
        authUid: 'mgr_uid_all',
        active: true
      });

      await setDoc(doc(db, 'businesses/biz_a/driver_manifest/driver_1'), {
        staffId: 'driver_1',
        activeStops: ['cust_1']
      });

      await setDoc(doc(db, 'global_settings/pricing'), {
        tier: 'Public Pricing Config'
      });
    });
  });

  // =========================================================================
  // 1. ANONYMOUS USER ACCESS TESTS
  // =========================================================================
  describe('Anonymous User (Unauthenticated)', () => {
    it('CAN read public pricing in global_settings', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(db, 'global_settings/pricing')));
    });

    it('CANNOT read business profile', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a')));
    });

    it('CANNOT read staff credentials or list', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/staff/driver_1')));
    });

    it('CANNOT read customers or addresses', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/customers/cust_1')));
    });

    it('CANNOT read invoices or financial data', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/invoices/inv_1')));
    });

    it('CANNOT create or write to driver_auth_lookup', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, 'driver_auth_lookup/9876543210'), { pin: '1234' }));
    });

    it('CANNOT create or claim free trial directly', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, 'trial_claims/user_fake'), { claimed: true }));
    });
  });

  // =========================================================================
  // 2. CROSS-TENANT ISOLATION (Business A vs Business B)
  // =========================================================================
  describe('Cross-Tenant Isolation (Owner B accessing Business A)', () => {
    it('Owner B CANNOT read Business A root document', async () => {
      const db = testEnv.authenticatedContext('biz_b').firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a')));
    });

    it('Owner B CANNOT read Business A customers', async () => {
      const db = testEnv.authenticatedContext('biz_b').firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/customers/cust_1')));
    });

    it('Owner B CANNOT read Business A staff or PINs', async () => {
      const db = testEnv.authenticatedContext('biz_b').firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/staff/driver_1')));
    });

    it('Owner B CANNOT read Business A invoices or payments', async () => {
      const db = testEnv.authenticatedContext('biz_b').firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/invoices/inv_1')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/payments/pay_1')));
    });

    it('Owner B CANNOT read Business A inventory, expenses, or notes', async () => {
      const db = testEnv.authenticatedContext('biz_b').firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/expenses/exp_1')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/inventory/item_1')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/notes/note_1')));
    });

    it('Owner B CANNOT write or tamper with Business A delivery logs', async () => {
      const db = testEnv.authenticatedContext('biz_b').firestore();
      await assertFails(setDoc(doc(db, 'businesses/biz_a/delivery_logs/tamper_log'), {
        date: '2026-10-17',
        status: 'Hacked'
      }));
    });
  });

  // =========================================================================
  // 3. OWNER ACCESS & ANTI-TAMPER RULES
  // =========================================================================
  describe('Business Owner (Owner A accessing Business A)', () => {
    it('Owner A CAN read their own business profile and all subcollections', async () => {
      const db = testEnv.authenticatedContext('biz_a').firestore();
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/staff/driver_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/customers/cust_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/invoices/inv_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/payments/pay_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/expenses/exp_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/inventory/item_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/notes/note_1')));
    });

    it('Owner A CAN update general profile fields (businessName, logoUrl, etc.)', async () => {
      const db = testEnv.authenticatedContext('biz_a').firestore();
      await assertSucceeds(updateDoc(doc(db, 'businesses/biz_a'), {
        businessName: 'Updated Alpha Name',
        description: 'New Description'
      }));
    });

    it('Owner A CANNOT tamper with planName, planStatus, planExpiryDate, or lastPaymentId', async () => {
      const db = testEnv.authenticatedContext('biz_a').firestore();
      
      // Attempting to self-grant Enterprise plan
      await assertFails(updateDoc(doc(db, 'businesses/biz_a'), {
        planName: 'Enterprise Unlimited'
      }));

      // Attempting to extend expiry date
      await assertFails(updateDoc(doc(db, 'businesses/biz_a'), {
        planExpiryDate: '2099-12-31'
      }));

      // Attempting to alter planStatus
      await assertFails(updateDoc(doc(db, 'businesses/biz_a'), {
        planStatus: 'Lifetime_Active'
      }));

      // Attempting to forge payment ID
      await assertFails(updateDoc(doc(db, 'businesses/biz_a'), {
        lastPaymentId: 'forged_razorpay_id'
      }));

      // Attempting to reset trialClaimed
      await assertFails(updateDoc(doc(db, 'businesses/biz_a'), {
        trialClaimed: false
      }));
    });
  });

  // =========================================================================
  // 4. DRIVER ROLE (Custom Token Claims)
  // =========================================================================
  describe('Driver Role with Custom Claims', () => {
    const driverContext = () => testEnv.authenticatedContext('driver_uid_1', {
      role: 'driver',
      bizId: 'biz_a',
      staffId: 'driver_1',
      branchId: 'branch_1'
    });

    const foreignDriverContext = () => testEnv.authenticatedContext('driver_uid_2', {
      role: 'driver',
      bizId: 'biz_b',
      staffId: 'driver_2',
      branchId: 'branch_2'
    });

    it('Driver A CAN read business profile, customers, plans, and branches for their own business', async () => {
      const db = driverContext().firestore();
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/customers/cust_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/plans/plan_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/branches/branch_1')));
    });

    it('Driver A CAN read their OWN staff doc', async () => {
      const db = driverContext().firestore();
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/staff/driver_1')));
    });

    it('Driver A CANNOT read another driver staff doc', async () => {
      const db = driverContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/staff/driver_2')));
    });

    it('Driver A CANNOT list the staff collection', async () => {
      const db = driverContext().firestore();
      await assertFails(getDocs(collection(db, 'businesses/biz_a/staff')));
    });

    it('Driver A CANNOT read or write staff_credentials', async () => {
      const db = driverContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/staff_credentials/driver_1')));
      await assertFails(setDoc(doc(db, 'businesses/biz_a/staff_credentials/driver_1'), { pin: '1234' }));
    });

    it('Driver A CANNOT read or write driver_auth_lookup', async () => {
      const db = driverContext().firestore();
      await assertFails(getDoc(doc(db, 'driver_auth_lookup/9876543210')));
      await assertFails(setDoc(doc(db, 'driver_auth_lookup/9876543210'), { pin: '1234' }));
    });

    it('Driver A CANNOT read or write global_features driver_* docs', async () => {
      const db = driverContext().firestore();
      await assertFails(getDoc(doc(db, 'global_features/driver_auth_9876543210')));
      await assertFails(setDoc(doc(db, 'global_features/driver_auth_9876543210'), { pin: '1234' }));
      await assertFails(getDoc(doc(db, 'global_features/driver_manifest_driver_1')));
    });

    it('Driver A CANNOT read customers from Business B', async () => {
      const db = driverContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_b/customers/cust_b1')));
    });

    it('Driver A CANNOT read invoices, payments, expenses, inventory, or notes', async () => {
      const db = driverContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/invoices/inv_1')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/payments/pay_1')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/expenses/exp_1')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/inventory/item_1')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/notes/note_1')));
    });

    it('Driver A CAN update customer ONLY with boxCollections, uncollectedBoxesCount, routeOrder, updatedAt', async () => {
      const db = driverContext().firestore();
      await assertSucceeds(updateDoc(doc(db, 'businesses/biz_a/customers/cust_1'), {
        uncollectedBoxesCount: 2,
        routeOrder: 5,
        updatedAt: '2026-10-17T10:00:00Z'
      }));
    });

    it('Driver A CANNOT update non-whitelisted customer keys (e.g. name, mobile, paymentStatus)', async () => {
      const db = driverContext().firestore();
      await assertFails(updateDoc(doc(db, 'businesses/biz_a/customers/cust_1'), {
        name: 'Hacked Customer'
      }));
      await assertFails(updateDoc(doc(db, 'businesses/biz_a/customers/cust_1'), {
        paymentStatus: 'Paid'
      }));
    });

    it('Driver A CAN update their own staff doc with whitelisted GPS/status keys', async () => {
      const db = driverContext().firestore();
      await assertSucceeds(updateDoc(doc(db, 'businesses/biz_a/staff/driver_1'), {
        status: 'Online',
        currentLat: 12.9716,
        currentLng: 77.5946,
        lastLocationUpdate: '2026-10-17T10:00:00Z',
        lastAttendanceDate: '2026-10-17',
        attendanceMarkedAt: '10:00 AM',
        batteryLevel: 85,
        updatedAt: '2026-10-17T10:00:00Z'
      }));
    });

    it('Driver A CANNOT update non-whitelisted keys on staff doc (e.g. salary, pin, name)', async () => {
      const db = driverContext().firestore();
      await assertFails(updateDoc(doc(db, 'businesses/biz_a/staff/driver_1'), {
        salary: 99999
      }));
      await assertFails(updateDoc(doc(db, 'businesses/biz_a/staff/driver_1'), {
        pin: '9999'
      }));
    });

    it('Driver A CAN create and update delivery_logs for their business', async () => {
      const db = driverContext().firestore();
      await assertSucceeds(setDoc(doc(db, 'businesses/biz_a/delivery_logs/log_101'), {
        date: '2026-10-17',
        customerId: 'cust_1',
        customerName: 'Customer A1',
        branchId: 'branch_1',
        mealTime: 'Lunch',
        status: 'Delivered',
        deliveredAt: '2026-10-17T10:00:00Z',
        deliveryBoyId: 'driver_1',
        staffId: 'driver_1',
        deliveryBoyName: 'Raju Rider',
        reusableBoxEnabled: false,
        boxType: 'Disposable',
        isDay2Plus: false,
        boxStatus: 'Disposable',
        boxNotes: '',
        boxCollectedAt: null,
        currentLat: null,
        currentLng: null,
        updatedAt: '2026-10-17T10:00:00Z'
      }));
    });

    it('Driver A CANNOT write delivery logs to Business B', async () => {
      const db = driverContext().firestore();
      await assertFails(setDoc(doc(db, 'businesses/biz_b/delivery_logs/log_102'), {
        date: '2026-10-17',
        status: 'Delivered'
      }));
    });

    it('Driver A CAN read and write their own driver_manifest, driver_status, and driver_sessions', async () => {
      const db = driverContext().firestore();
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/driver_manifest/driver_1')));
      await assertSucceeds(setDoc(doc(db, 'businesses/biz_a/driver_status/driver_1'), {
        status: 'Online',
        lastUpdate: '2026-10-17'
      }));
      await assertSucceeds(setDoc(doc(db, 'businesses/biz_a/driver_sessions/2026-10-17_driver_1'), {
        sessionId: '2026-10-17_driver_1',
        staffId: 'driver_1',
        deliveryBoyId: 'driver_1',
        status: 'Active',
        date: '2026-10-17',
        startTime: '2026-10-17T08:30:00Z',
        punchInTime: '08:30 AM',
        endTime: null,
        durationMinutes: 0,
        branchId: 'branch_1',
        createdAt: '2026-10-17T08:30:00Z',
        updatedAt: '2026-10-17T08:30:00Z'
      }));
    });

    it('Driver A CANNOT access another driver manifest, status, or session', async () => {
      const db = driverContext().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/driver_manifest/driver_other')));
      await assertFails(setDoc(doc(db, 'businesses/biz_a/driver_status/driver_other'), {
        status: 'Hacked'
      }));
      await assertFails(setDoc(doc(db, 'businesses/biz_a/driver_sessions/2026-10-17_driver_other'), {
        status: 'Hacked'
      }));
    });
  });

  // =========================================================================
  // 5. MANAGER ROLE (Firebase ID Token Claims)
  // =========================================================================
  describe('Manager Role with Firebase Claims & Branch Isolation', () => {
    const managerBranch1Context = () => testEnv.authenticatedContext('mgr_uid_1', {
      role: 'manager',
      bizId: 'biz_a',
      managerId: 'mgr_1',
      branchId: 'branch_1',
      allBranches: false
    });

    const managerBranch2Context = () => testEnv.authenticatedContext('mgr_uid_2', {
      role: 'manager',
      bizId: 'biz_a',
      managerId: 'mgr_2',
      branchId: 'branch_2',
      allBranches: false
    });

    const managerAllBranchesContext = () => testEnv.authenticatedContext('mgr_uid_all', {
      role: 'manager',
      bizId: 'biz_a',
      managerId: 'mgr_all',
      branchId: 'All',
      allBranches: true
    });

    it('Manager Branch 1 CAN read customers, plans, branches, staff, expenses, inventory, notes, and single orders for branch_1', async () => {
      const db = managerBranch1Context().firestore();
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/customers/cust_1'))); // cust_1 has branchId: 'branch_1'
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/plans/plan_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/branches/branch_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/staff/driver_1'))); // driver_1 has branchId: 'branch_1'
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/expenses/exp_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/inventory/item_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/notes/note_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/single_orders/order_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/invoices/inv_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/payments/pay_1')));
    });

    it('Manager Branch 1 CANNOT read or write customers, staff, expenses, inventory, notes belonging to branch_2', async () => {
      // Seed branch 2 document via admin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'businesses/biz_a/customers/cust_branch_2'), {
          name: 'Customer Branch 2',
          branchId: 'branch_2'
        });
        await setDoc(doc(adminDb, 'businesses/biz_a/staff/driver_branch_2'), {
          name: 'Rider Branch 2',
          branchId: 'branch_2'
        });
        await setDoc(doc(adminDb, 'businesses/biz_a/expenses/exp_branch_2'), {
          title: 'Branch 2 Groceries',
          branchId: 'branch_2',
          amount: 500
        });
        await setDoc(doc(adminDb, 'businesses/biz_a/notes/note_branch_2'), {
          content: 'Secret branch 2 memo',
          branchId: 'branch_2'
        });
        await setDoc(doc(adminDb, 'businesses/biz_a/single_orders/order_branch_2'), {
          customerName: 'Guest 2',
          branchId: 'branch_2',
          amount: 250
        });
      });

      const db = managerBranch1Context().firestore();
      // Read access to branch 2 documents MUST FAIL
      await assertFails(getDoc(doc(db, 'businesses/biz_a/customers/cust_branch_2')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/staff/driver_branch_2')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/expenses/exp_branch_2')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/notes/note_branch_2')));
      await assertFails(getDoc(doc(db, 'businesses/biz_a/single_orders/order_branch_2')));

      // Write/tamper access to branch 2 documents MUST FAIL
      await assertFails(updateDoc(doc(db, 'businesses/biz_a/customers/cust_branch_2'), {
        name: 'Hacked Name'
      }));
      await assertFails(deleteDoc(doc(db, 'businesses/biz_a/customers/cust_branch_2')));
    });

    it('Manager Branch 1 CANNOT create a customer or expense assigned to branch_2', async () => {
      const db = managerBranch1Context().firestore();
      await assertFails(setDoc(doc(db, 'businesses/biz_a/customers/cust_new_b2'), {
        name: 'Spoofed Customer',
        branchId: 'branch_2'
      }));
      await assertFails(setDoc(doc(db, 'businesses/biz_a/expenses/exp_new_b2'), {
        title: 'Spoofed Expense',
        branchId: 'branch_2',
        amount: 1000
      }));
    });

    it('Manager Branch 1 CAN create customers, expenses, notes, and single orders assigned to branch_1', async () => {
      const db = managerBranch1Context().firestore();
      await assertSucceeds(setDoc(doc(db, 'businesses/biz_a/customers/cust_new_b1'), {
        name: 'Legitimate Branch 1 Customer',
        branchId: 'branch_1'
      }));
      await assertSucceeds(setDoc(doc(db, 'businesses/biz_a/expenses/exp_new_b1'), {
        title: 'Legitimate Branch 1 Expense',
        branchId: 'branch_1',
        amount: 300
      }));
      await assertSucceeds(setDoc(doc(db, 'businesses/biz_a/notes/note_new_b1'), {
        content: 'Legitimate Branch 1 Note',
        branchId: 'branch_1'
      }));
    });

    it('Manager Branch 1 CANNOT move a customer from branch_1 to branch_2', async () => {
      const db = managerBranch1Context().firestore();
      await assertFails(updateDoc(doc(db, 'businesses/biz_a/customers/cust_1'), {
        branchId: 'branch_2'
      }));
    });

    it('All-Branches Manager CAN access documents across all branches (branch_1 and branch_2)', async () => {
      const db = managerAllBranchesContext().firestore();
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/customers/cust_1')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/customers/cust_branch_2')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/expenses/exp_branch_2')));
    });

    it('Manager CANNOT access other managers in managers collection', async () => {
      const db = managerBranch1Context().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/managers/mgr_2')));
      await assertFails(setDoc(doc(db, 'businesses/biz_a/managers/mgr_new'), { name: 'Fake' }));
    });

    it('Manager CANNOT write or modify invoices or payments (Read-only financial operations)', async () => {
      const db = managerBranch1Context().firestore();
      await assertFails(setDoc(doc(db, 'businesses/biz_a/invoices/inv_fake'), {
        amount: 99999,
        branchId: 'branch_1'
      }));
      await assertFails(updateDoc(doc(db, 'businesses/biz_a/invoices/inv_1'), {
        amount: 0
      }));
      await assertFails(setDoc(doc(db, 'businesses/biz_a/payments/pay_fake'), {
        amount: 99999,
        branchId: 'branch_1'
      }));
    });

    it('Manager CANNOT read billing_history', async () => {
      const db = managerBranch1Context().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_a/billing_history/doc_1')));
    });

    it('Manager CANNOT access Business B data under any circumstance', async () => {
      const db = managerBranch1Context().firestore();
      await assertFails(getDoc(doc(db, 'businesses/biz_b/customers/cust_b1')));
      await assertFails(getDoc(doc(db, 'businesses/biz_b/plans/plan_b1')));
    });

    it('Inactive manager profile blocks access while an old ID token still carries manager claims', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'businesses/biz_a/managers/mgr_1'), { active: false });
      });
      await assertFails(getDoc(doc(managerBranch1Context().firestore(), 'businesses/biz_a/customers/cust_1')));
    });

    it('Deleted manager profile blocks access while an old ID token still carries manager claims', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await deleteDoc(doc(context.firestore(), 'businesses/biz_a/managers/mgr_1'));
      });
      await assertFails(getDoc(doc(managerBranch1Context().firestore(), 'businesses/biz_a/customers/cust_1')));
    });

    it('Manager CAN record their own login/logout logs in manager_logs', async () => {
      const db = managerBranch1Context().firestore();
      await assertSucceeds(setDoc(doc(db, 'businesses/biz_a/manager_logs/mlog_1'), {
        managerId: 'mgr_1',
        branchId: 'branch_1',
        status: 'Active',
        date: '2026-10-17'
      }));
      await assertSucceeds(updateDoc(doc(db, 'businesses/biz_a/manager_logs/mlog_1'), {
        status: 'Logged Out',
        logoutTime: '06:00:00 PM',
        updatedAt: '2026-10-17T18:00:00Z'
      }));
    });

    it('Manager CANNOT forge logs for another manager', async () => {
      const db = managerBranch1Context().firestore();
      await assertFails(setDoc(doc(db, 'businesses/biz_a/manager_logs/mlog_forged'), {
        managerId: 'mgr_impostor',
        branchId: 'branch_1',
        status: 'Active'
      }));
    });
  });

  // =========================================================================
  // 6. SUPER ADMIN ROLE
  // =========================================================================
  describe('Super Admin Access', () => {
    it('Admin with custom claim admin:true has full administrative access', async () => {
      const db = testEnv.authenticatedContext('admin_uid', { admin: true }).firestore();
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a')));
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_b')));
      await assertSucceeds(getDoc(doc(db, 'global_settings/pricing')));
      await assertSucceeds(setDoc(doc(db, 'global_settings/pricing'), { tier: 'Updated Pricing' }));
      await assertSucceeds(getDoc(doc(db, 'trial_claims/user_fake')));
    });

    it('Admin with verified email has full administrative access', async () => {
      const db = testEnv.authenticatedContext('admin_email_uid', {
        email: 'memosmy10@gmail.com',
        email_verified: true
      }).firestore();
      await assertSucceeds(getDoc(doc(db, 'businesses/biz_a')));
    });

    it('Admin with UNVERIFIED email is rejected from admin privileges', async () => {
      const db = testEnv.authenticatedContext('unverified_admin_uid', {
        email: 'memosmy10@gmail.com',
        email_verified: false
      }).firestore();
      await assertFails(setDoc(doc(db, 'global_settings/pricing'), { tier: 'Hacked' }));
    });
  });

  // =========================================================================
  // 7. RESTRICTED & BLOCKED COLLECTIONS
  // =========================================================================
  describe('Restricted Collections & Global Features Lockdown', () => {
    it('driver_auth_lookup is blocked from all client access', async () => {
      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertFails(getDoc(doc(ownerDb, 'driver_auth_lookup/9876543210')));
      await assertFails(setDoc(doc(ownerDb, 'driver_auth_lookup/9876543210'), { pin: '1234' }));
    });

    it('auth_rate_limits is blocked from all client access', async () => {
      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertFails(getDoc(doc(ownerDb, 'auth_rate_limits/driver_9876543210')));
    });

    it('trial_claims client writes are completely blocked', async () => {
      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertFails(setDoc(doc(ownerDb, 'trial_claims/user_biz_a'), { claimed: true }));
    });

    it('global_features denies driver_* documents from client', async () => {
      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertFails(getDoc(doc(ownerDb, 'global_features/driver_manifest_biz_a')));
      await assertFails(setDoc(doc(ownerDb, 'global_features/driver_manifest_biz_a'), { data: 'test' }));
      await assertFails(setDoc(doc(ownerDb, 'global_features/driver_auth_9876543210'), { pin: '1234' }));
    });

    it('global_features permits legitimate user feature requests', async () => {
      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertSucceeds(setDoc(doc(ownerDb, 'global_features/feat_custom_reports'), {
        tenantId: 'biz_a',
        featureName: 'Custom Export Reports',
        description: 'Ability to export CSV'
      }));
    });
  });

  // =========================================================================
  // PHASE 3: PAYMENT ORDERS & BILLING HISTORY SECURITY LOCKDOWN
  // =========================================================================
  describe('Phase 3: Payments & Billing Security Rules', () => {
    it('Owner CANNOT write directly to billing_history (write blocked, only Cloud Functions Admin SDK can write)', async () => {
      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertFails(setDoc(doc(ownerDb, 'businesses/biz_a/billing_history/pay_fake_123'), {
        amount: 999,
        planName: 'COSVYN ONE (Monthly)',
        status: 'Paid'
      }));
    });

    it('Owner CAN read their own billing_history', async () => {
      // Seed billing history via admin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'businesses/biz_a/billing_history/pay_real_123'), {
          amount: 999,
          amountPaise: 99900,
          planName: 'COSVYN ONE (Monthly)',
          status: 'Paid'
        });
      });

      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertSucceeds(getDoc(doc(ownerDb, 'businesses/biz_a/billing_history/pay_real_123')));
    });

    it('Client CANNOT write to orders or processed_payments directly', async () => {
      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertFails(setDoc(doc(ownerDb, 'orders/order_fake_123'), {
        amountPaise: 100,
        bizId: 'biz_a'
      }));
      await assertFails(setDoc(doc(ownerDb, 'processed_payments/pay_fake_123'), {
        status: 'fulfilled',
        bizId: 'biz_a'
      }));
    });

    it('Client CAN read their own order document', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'orders/order_biz_a_123'), {
          bizId: 'biz_a',
          amountPaise: 99900,
          status: 'created'
        });
      });

      const ownerDb = testEnv.authenticatedContext('biz_a').firestore();
      await assertSucceeds(getDoc(doc(ownerDb, 'orders/order_biz_a_123')));

      // Other owner cannot read biz_a order
      const otherDb = testEnv.authenticatedContext('biz_b').firestore();
      await assertFails(getDoc(doc(otherDb, 'orders/order_biz_a_123')));
    });
  });
});
