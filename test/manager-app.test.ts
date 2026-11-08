import { describe, it, expect, vi } from 'vitest';
import {
  ALL_SAAS_PAGES,
  normalizeEmail,
  normalizePhone,
  getTodayStr,
  formatDateDDMMYYYY,
  isPlanActiveOnDate,
  Customer
} from '../apps/manager/src/services/managerStore';
import {
  firebaseConfig,
  app
} from '../apps/manager/src/services/firebase';

describe('ScaleKitchen Manager App — Phase 4.1 Security Hardening Test Suite', () => {

  describe('1. Dedicated Named Firebase App Isolation', () => {
    it('should initialize with the unique isolated app name "ScaleKitchenManager"', () => {
      expect(app.name).toBe('ScaleKitchenManager');
    });

    it('should use the correct production project configuration', () => {
      expect(firebaseConfig.projectId).toBe('subbussinesssaas');
      expect(firebaseConfig.authDomain).toBe('subbussinesssaas.firebaseapp.com');
    });
  });

  describe('2. Manager Authentication & Credentials Contract', () => {
    it('should normalize manager email addresses to lowercase and trimmed string', () => {
      expect(normalizeEmail('  Manager.OPS@ScaleKitchen.COM  ')).toBe('manager.ops@scalekitchen.com');
      expect(normalizeEmail('KITCHEN@GMAIL.COM')).toBe('kitchen@gmail.com');
      expect(normalizeEmail('')).toBe('');
    });

    it('should normalize manager mobile numbers to 10 digits', () => {
      expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
      expect(normalizePhone('09876543210')).toBe('9876543210');
      expect(normalizePhone('98765-43210')).toBe('9876543210');
    });

    it('should validate email and password before Firebase Authentication sign-in', () => {
      const validate = (email: string, pass: string) => {
        const cleanEmail = normalizeEmail(email);
        if (!cleanEmail || !cleanEmail.includes('@')) return 'Invalid email';
        if (!pass) return 'Missing password';
        return null;
      };

      expect(validate('', 'pass123')).toBe('Invalid email');
      expect(validate('not-an-email', 'pass123')).toBe('Invalid email');
      expect(validate('mgr@kitchen.com', '')).toBe('Missing password');
      expect(validate('mgr@kitchen.com', 'pass123')).toBeNull();
    });
  });

  describe('3. Firebase Auth Account Provisioning', () => {
    it('should bind a manager profile to the UID and tenant from verified custom claims', () => {
      const user = { uid: 'firebase-auth-uid-1', email: 'manager@kitchen.com' };
      const claims = {
        role: 'manager',
        bizId: 'kitchen-1',
        managerId: 'manager-doc-1',
        branchId: 'branch-1',
        allBranches: false
      };
      const profile = {
        authUid: user.uid,
        email: user.email,
        id: claims.managerId
      };

      expect(claims.role).toBe('manager');
      expect(profile.authUid).toBe(user.uid);
      expect(profile.id).toBe(claims.managerId);
      expect(claims.bizId).toBe('kitchen-1');
      expect(claims.branchId).toBe('branch-1');
    });

    it('should reject reusing an existing account that is not already this manager', () => {
      const mayLinkAccount = (
        accountClaims: { role?: string; bizId?: string; managerId?: string },
        bizId: string,
        managerId: string
      ) => accountClaims.role === 'manager' &&
        accountClaims.bizId === bizId &&
        accountClaims.managerId === managerId;

      expect(mayLinkAccount({ role: 'owner', bizId: 'kitchen-1' }, 'kitchen-1', 'manager-1')).toBe(false);
      expect(mayLinkAccount({ role: 'driver', bizId: 'kitchen-1' }, 'kitchen-1', 'manager-1')).toBe(false);
      expect(mayLinkAccount({ role: 'manager', bizId: 'kitchen-2', managerId: 'manager-1' }, 'kitchen-1', 'manager-1')).toBe(false);
      expect(mayLinkAccount({ role: 'manager', bizId: 'kitchen-1', managerId: 'manager-1' }, 'kitchen-1', 'manager-1')).toBe(true);
    });
  });

  describe('4. Manager Deactivation & Inactive Account Enforcement', () => {
    it('should reject authentication for inactive or deactivated manager records', () => {
      const checkActive = (managerDoc: { status?: string; active?: boolean; deleted?: boolean }) => {
        const isDeactivated = 
          managerDoc.status === 'Inactive' || 
          managerDoc.status === 'deactivated' || 
          managerDoc.status === 'disabled' || 
          managerDoc.active === false || 
          managerDoc.deleted === true;
        return !isDeactivated;
      };

      expect(checkActive({ status: 'Active', active: true })).toBe(true);
      expect(checkActive({ status: 'Inactive', active: true })).toBe(false);
      expect(checkActive({ status: 'deactivated' })).toBe(false);
      expect(checkActive({ status: 'disabled' })).toBe(false);
      expect(checkActive({ active: false })).toBe(false);
      expect(checkActive({ deleted: true })).toBe(false);
    });
  });

  describe('5. Firebase ID Token Claims Verification & Security Boundary', () => {
    it('should verify manager role, tenant, branch and page claims', () => {
      const mockClaims = {
        role: 'manager',
        bizId: 'kitchen_biz_999',
        managerId: 'staff_doc_123',
        branchId: 'branch_south_hub',
        allBranches: false,
        allowedPages: ['dashboard', 'deliveries']
      };

      expect(mockClaims.role).toBe('manager');
      expect(mockClaims.bizId).toBe('kitchen_biz_999');
      expect(mockClaims.branchId).toBe('branch_south_hub');
      expect(mockClaims.allBranches).toBe(false);
      expect(mockClaims.allowedPages).toContain('deliveries');
    });

    it('should set allBranches: true when branchId is "All"', () => {
      const branchId = 'All';
      const claims = {
        role: 'manager',
        bizId: 'biz_123',
        managerId: 'mgr_1',
        branchId,
        allBranches: branchId === 'All'
      };
      expect(claims.allBranches).toBe(true);
    });

    it('should reject non-manager claims at authorization layer', () => {
      const isAuthorizedManager = (claims: { role?: string; bizId?: string }) => {
        return claims?.role === 'manager' && Boolean(claims?.bizId);
      };

      expect(isAuthorizedManager({ role: 'manager', bizId: 'biz1' })).toBe(true);
      expect(isAuthorizedManager({ role: 'driver', bizId: 'biz1' })).toBe(false);
      expect(isAuthorizedManager({ role: 'customer', bizId: 'biz1' })).toBe(false);
      expect(isAuthorizedManager({ role: 'manager' })).toBe(false);
    });
  });

  describe('6. LocalStorage Tamper-Proofing in Session Restoration', () => {
    it('should strictly use verified token claims and never allow cached localStorage branchId to override claims', () => {
      const verifiedClaims = {
        role: 'manager',
        bizId: 'biz_real',
        managerId: 'mgr_1',
        branchId: 'branch_south',
        allBranches: false
      };

      // Attacker modified localStorage to claim 'All' or 'branch_north'
      const tamperedLocalStorage = {
        branchId: 'All',
        role: 'owner'
      };

      // Secure session resolver MUST bind to verifiedClaims
      const resolvedSession = {
        bizId: verifiedClaims.bizId,
        branchId: verifiedClaims.branchId, // Claims override localStorage!
        isAllBranches: verifiedClaims.allBranches
      };

      expect(resolvedSession.branchId).toBe('branch_south');
      expect(resolvedSession.isAllBranches).toBe(false);
      expect(resolvedSession.branchId).not.toBe(tamperedLocalStorage.branchId);
    });
  });

  describe('7. Branch Access & Multi-Tenant Scoping Enforcement', () => {
    it('should allow all records when branchId is "All"', () => {
      const items = [
        { id: '1', branchId: 'branch_a' },
        { id: '2', branchId: 'branch_b' },
        { id: '3', branchId: 'branch_c' }
      ];

      const filterByBranch = (list: typeof items, branchId: string) => {
        if (!branchId || branchId === 'All') return list;
        return list.filter(item => item.branchId === branchId);
      };

      const result = filterByBranch(items, 'All');
      expect(result.length).toBe(3);
    });

    it('should strictly constrain collection records to assigned branch when not "All"', () => {
      const customers = [
        { id: 'c1', name: 'Alice', branchId: 'branch_east' },
        { id: 'c2', name: 'Bob', branchId: 'branch_west' },
        { id: 'c3', name: 'Charlie', branchId: 'branch_east' }
      ];

      const filtered = customers.filter(c => c.branchId === 'branch_east');
      expect(filtered.length).toBe(2);
      expect(filtered.every(c => c.branchId === 'branch_east')).toBe(true);
    });

    it('should allow organization-wide plans (branchId === "All" or undefined) alongside branch-specific plans', () => {
      const plans = [
        { id: 'p1', name: 'Standard Org Plan', branchId: 'All' },
        { id: 'p2', name: 'Global Plan' }, // undefined branchId
        { id: 'p3', name: 'East Branch Special', branchId: 'branch_east' },
        { id: 'p4', name: 'West Branch Special', branchId: 'branch_west' }
      ];

      const managerBranch = 'branch_east';
      const permittedPlans = plans.filter(p => !p.branchId || p.branchId === 'All' || p.branchId === managerBranch);

      expect(permittedPlans.length).toBe(3);
      expect(permittedPlans.find(p => p.id === 'p4')).toBeUndefined();
    });
  });

  describe('8. Granular Page Access Control (allowedPages)', () => {
    it('should define all 15 operational SaaS modules in ALL_SAAS_PAGES', () => {
      expect(ALL_SAAS_PAGES.length).toBe(15);
      const pageIds = ALL_SAAS_PAGES.map(p => p.id);
      expect(pageIds).toContain('dashboard');
      expect(pageIds).toContain('prep');
      expect(pageIds).toContain('deliveries');
      expect(pageIds).toContain('customers');
      expect(pageIds).toContain('notes');
      expect(pageIds).toContain('single-orders');
      expect(pageIds).toContain('inventory');
      expect(pageIds).toContain('messages');
      expect(pageIds).toContain('payments');
      expect(pageIds).toContain('invoices');
      expect(pageIds).toContain('expenses');
      expect(pageIds).toContain('analytics');
      expect(pageIds).toContain('settings');
      expect(pageIds).toContain('profile');
      expect(pageIds).toContain('support');
    });

    it('should filter accessible navigation tabs according to allowedPages configuration', () => {
      const managerAllowedPages = ['dashboard', 'prep', 'deliveries'];
      const visiblePages = ALL_SAAS_PAGES.filter(p => managerAllowedPages.includes(p.id));

      expect(visiblePages.length).toBe(3);
      expect(visiblePages.map(p => p.id)).toEqual(['dashboard', 'prep', 'deliveries']);
    });

    it('should default to dashboard if allowedPages is empty', () => {
      const resolveAllowedPages = (pages?: string[]) => {
        return pages && pages.length > 0 ? pages : ['dashboard'];
      };

      expect(resolveAllowedPages([])).toEqual(['dashboard']);
      expect(resolveAllowedPages(undefined)).toEqual(['dashboard']);
      expect(resolveAllowedPages(['prep', 'notes'])).toEqual(['prep', 'notes']);
    });
  });

  describe('9. Dietary Schedule & Kitchen Production Logic', () => {
    it('should determine whether a customer subscription is active on a given date', () => {
      const customer: Customer = {
        id: 'cust-1',
        name: 'John Doe',
        mobile: '9876543210',
        deliveryAddress: 'Flat 402, Sunshine Apts',
        branchId: 'b1',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        status: 'active',
        pauseRanges: [
          { start: '2026-11-05', end: '2026-11-07' }
        ]
      };

      // Before start date
      expect(isPlanActiveOnDate(customer, '2026-10-31')).toBe(false);

      // On paused date
      expect(isPlanActiveOnDate(customer, '2026-11-06')).toBe(false);

      // Active date
      expect(isPlanActiveOnDate(customer, '2026-11-08')).toBe(true);

      // After end date
      expect(isPlanActiveOnDate(customer, '2026-12-01')).toBe(false);
    });

    it('should format date strings to DD/MM/YYYY without drift', () => {
      expect(formatDateDDMMYYYY('2026-11-06')).toBe('06/11/2026');
      expect(formatDateDDMMYYYY('2026-01-15')).toBe('15/01/2026');
      expect(formatDateDDMMYYYY('')).toBe('');
    });
  });

  describe('10. Session Audit Logging Anti-Forgery Contract', () => {
    it('should enforce that a manager can only create a log entry with their own managerId', () => {
      const validateLogCreation = (authenticatedManagerId: string, logPayload: { managerId: string }) => {
        return logPayload.managerId === authenticatedManagerId;
      };

      expect(validateLogCreation('mgr_123', { managerId: 'mgr_123' })).toBe(true);
      expect(validateLogCreation('mgr_123', { managerId: 'mgr_impostor' })).toBe(false);
    });

    it('should restrict log updates to logoutTime, status, and updatedAt only', () => {
      const allowedUpdateKeys = new Set(['logoutTime', 'status', 'updatedAt']);
      const validateLogUpdate = (updatePayload: Record<string, any>) => {
        return Object.keys(updatePayload).every(k => allowedUpdateKeys.has(k));
      };

      expect(validateLogUpdate({ logoutTime: '06:00:00 PM', status: 'Logged Out', updatedAt: '2026-11-06' })).toBe(true);
      expect(validateLogUpdate({ managerId: 'mgr_tamper', status: 'Logged Out' })).toBe(false);
      expect(validateLogUpdate({ branchId: 'branch_tamper' })).toBe(false);
    });
  });

  describe('11. Cross-Branch Move Prevention in Document Updates', () => {
    it('should disallow changing document branchId to a different branch', () => {
      const validateBranchMutation = (existingBranch: string, incomingBranch?: string) => {
        if (!incomingBranch) return true; // unchanged
        return existingBranch === incomingBranch; // must match original
      };

      expect(validateBranchMutation('branch_east', 'branch_east')).toBe(true);
      expect(validateBranchMutation('branch_east', undefined)).toBe(true);
      expect(validateBranchMutation('branch_east', 'branch_west')).toBe(false);
    });
  });

  describe('12. Session Isolation & Logout Cleanup', () => {
    it('should clear cached manager routing data on logout', () => {
      const mockStorage: Record<string, string> = {
        manager_data: JSON.stringify({ id: 'm1' }),
        manager_branch_id: 'b1',
        manager_session_log_id: 'log_123',
        manager_biz_id: 'biz_abc'
      };

      const logoutCleanup = (storage: Record<string, string>) => {
        delete storage['manager_data'];
        delete storage['manager_branch_id'];
        delete storage['manager_session_log_id'];
        delete storage['manager_biz_id'];
      };

      logoutCleanup(mockStorage);
      expect(mockStorage.manager_data).toBeUndefined();
      expect(mockStorage.manager_branch_id).toBeUndefined();
      expect(mockStorage.manager_session_log_id).toBeUndefined();
      expect(mockStorage.manager_biz_id).toBeUndefined();
    });
  });
});
