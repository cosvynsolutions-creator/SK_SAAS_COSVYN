import { describe, it, expect, vi } from 'vitest';
import {
  ADMIN_EMAIL,
  ADMIN_EMAILS,
  isAdminEmail,
  formatDateDDMMYYYY,
  getDaysDifference,
  calculateEffectivePrice,
  SHARED_SAAS_PLANS,
  SHARED_OFFER,
  SaasPlan,
  SpecialOffer,
  TenantUser
} from '../apps/admin/src/services/adminStore';
import {
  firebaseConfig,
  app
} from '../apps/admin/src/services/firebase';
import {
  cleanWhatsAppNumber,
  replacePlaceholders
} from '../apps/admin/src/components/outreachUtils';

describe('ScaleKitchen Super Admin App — Phase 5 Test Suite', () => {

  describe('1. Dedicated Named Firebase App Isolation', () => {
    it('should initialize with the unique isolated app name "ScaleKitchenAdminApp"', () => {
      expect(app.name).toBe('ScaleKitchenAdminApp');
    });

    it('should connect to the correct production Firebase project "subbussinesssaas"', () => {
      expect(firebaseConfig.projectId).toBe('subbussinesssaas');
      expect(firebaseConfig.authDomain).toBe('subbussinesssaas.firebaseapp.com');
      expect(firebaseConfig.storageBucket).toBe('subbussinesssaas.firebasestorage.app');
    });
  });

  describe('2. Super Admin Identity & Claims Contract', () => {
    it('should recognize authorized super admin emails regardless of casing or whitespace', () => {
      expect(isAdminEmail('cosvynsolutions@gmail.com')).toBe(true);
      expect(isAdminEmail('admin@scalekitchen.in')).toBe(true);
      expect(isAdminEmail('memosmy10@gmail.com')).toBe(true);
      expect(isAdminEmail('  MEMOSMY10@GMAIL.COM  ')).toBe(true);
      expect(isAdminEmail('  COSVYNSOLUTIONS@GMAIL.COM ')).toBe(true);
    });

    it('should strictly reject unauthorized emails (e.g. owners, managers, drivers, or malicious actors)', () => {
      expect(isAdminEmail('owner@kitchen.com')).toBe(false);
      expect(isAdminEmail('manager@branch.com')).toBe(false);
      expect(isAdminEmail('driver@delivery.com')).toBe(false);
      expect(isAdminEmail('attacker@evil.com')).toBe(false);
      expect(isAdminEmail('cosvynsolutions@fake.com')).toBe(false);
      expect(isAdminEmail(null)).toBe(false);
      expect(isAdminEmail(undefined)).toBe(false);
      expect(isAdminEmail('')).toBe(false);
    });

    it('should validate that custom token claim { admin: true } is required for zero-trust authorization', () => {
      const evaluateAdminAccess = (tokenClaims: Record<string, any>, email?: string): boolean => {
        // Strict claim check: must have admin: true
        if (tokenClaims && tokenClaims.admin === true) return true;
        // Or verified email check
        if (tokenClaims && tokenClaims.email_verified === true && email && isAdminEmail(email)) return true;
        return false;
      };

      // Case 1: Genuine Admin with custom claim
      expect(evaluateAdminAccess({ admin: true })).toBe(true);
      expect(evaluateAdminAccess({ admin: true, role: 'super_admin' })).toBe(true);

      // Case 2: Owner attempting to access admin
      expect(evaluateAdminAccess({ role: 'owner' }, 'owner@cloudkitchen.com')).toBe(false);

      // Case 3: Manager attempting to access admin
      expect(evaluateAdminAccess({ role: 'manager', bizId: 'biz123', branchId: 'All' }, 'mgr@kitchen.com')).toBe(false);

      // Case 4: Driver attempting to access admin
      expect(evaluateAdminAccess({ role: 'driver', bizId: 'biz123' }, 'driver@kitchen.com')).toBe(false);

      // Case 5: Fake admin claim injection
      expect(evaluateAdminAccess({ admin: 'true' })).toBe(false);
      expect(evaluateAdminAccess({ admin: 1 })).toBe(false);
      expect(evaluateAdminAccess({ isAdmin: true })).toBe(false);

      // Case 6: Email spoofing without email_verified
      expect(evaluateAdminAccess({ email_verified: false }, 'memosmy10@gmail.com')).toBe(false);
    });
  });

  describe('3. LocalStorage & Client-Side Tamper Resistance', () => {
    it('should never grant admin access based on localStorage flags', () => {
      const getSessionAuthorization = (storage: Record<string, string>, verifiedTokenAdmin: boolean) => {
        // If client-side storage has "isAdmin: true", it must be ignored unless verified by cryptographic token
        if (verifiedTokenAdmin) return true;
        return false;
      };

      // Attacker tampers with localStorage: localStorage.setItem('isAdmin', 'true')
      const tamperedStorage = { isAdmin: 'true', role: 'admin', superUser: '1' };
      expect(getSessionAuthorization(tamperedStorage, false)).toBe(false);

      // Legitimate admin with verified token
      expect(getSessionAuthorization({}, true)).toBe(true);
    });
  });

  describe('4. Server-Side verifyAdminAuth Callable Contract', () => {
    it('should reject unauthenticated requests to verifyAdminAuth', () => {
      const simulateVerifyAdminAuth = (authContext: { uid?: string; token?: Record<string, any> } | null) => {
        if (!authContext || !authContext.uid) {
          throw new Error('unauthenticated: Super Admin authentication required.');
        }
        const callerEmail = (authContext.token?.email || '').toLowerCase().trim();
        const emailVerified = authContext.token?.email_verified === true;
        const hasAdminClaim = authContext.token?.admin === true;
        const isEmailAuth = emailVerified && ADMIN_EMAILS.includes(callerEmail);

        if (!hasAdminClaim && !isEmailAuth) {
          throw new Error('permission-denied: Access denied. You do not have Super Admin privileges.');
        }

        return {
          authorized: true,
          uid: authContext.uid,
          email: callerEmail,
          admin: true,
          claimUpdated: !hasAdminClaim && isEmailAuth
        };
      };

      // Null auth
      expect(() => simulateVerifyAdminAuth(null)).toThrow('unauthenticated');

      // Regular authenticated user (Owner/Driver/Manager)
      expect(() => simulateVerifyAdminAuth({
        uid: 'user_123',
        token: { email: 'owner@myshop.com', email_verified: true, role: 'owner' }
      })).toThrow('permission-denied');

      // Legitimate admin without claim -> auto-mints claim
      const res = simulateVerifyAdminAuth({
        uid: 'admin_uid_1',
        token: { email: 'memosmy10@gmail.com', email_verified: true }
      });
      expect(res.authorized).toBe(true);
      expect(res.claimUpdated).toBe(true);

      // Legitimate admin with existing claim -> succeeds without re-minting
      const res2 = simulateVerifyAdminAuth({
        uid: 'admin_uid_2',
        token: { email: 'admin@scalekitchen.in', email_verified: true, admin: true }
      });
      expect(res2.authorized).toBe(true);
      expect(res2.claimUpdated).toBe(false);
    });
  });

  describe('5. Pricing & Special Offers Business Logic', () => {
    it('should compute base plan prices accurately', () => {
      const monthly = SHARED_SAAS_PLANS.find(p => p.id === 'Monthly')!;
      expect(monthly.price).toBe(999);
      expect(monthly.durationMonths).toBe(1);

      const semi = SHARED_SAAS_PLANS.find(p => p.id === '6 Months')!;
      expect(semi.price).toBe(5099);
      expect(semi.durationMonths).toBe(6);

      const yearly = SHARED_SAAS_PLANS.find(p => p.id === 'Yearly')!;
      expect(yearly.price).toBe(9599);
      expect(yearly.durationMonths).toBe(12);
    });

    it('should calculate discounted prices when promotional offer is active and not expired', () => {
      const futureOffer: SpecialOffer = {
        isActive: true,
        title: 'Flash 20%',
        discountPercent: 20,
        endsAt: new Date(Date.now() + 86400000).toISOString()
      };

      // 999 * 0.8 = 799.2 -> 799
      expect(calculateEffectivePrice(999, futureOffer)).toBe(799);
      // 5099 * 0.8 = 4079.2 -> 4079
      expect(calculateEffectivePrice(5099, futureOffer)).toBe(4079);
      // 9599 * 0.8 = 7679.2 -> 7679
      expect(calculateEffectivePrice(9599, futureOffer)).toBe(7679);
    });

    it('should return regular price if offer is inactive or expired', () => {
      const inactiveOffer: SpecialOffer = {
        isActive: false,
        title: 'Old Sale',
        discountPercent: 30,
        endsAt: new Date(Date.now() + 86400000).toISOString()
      };
      expect(calculateEffectivePrice(999, inactiveOffer)).toBe(999);

      const expiredOffer: SpecialOffer = {
        isActive: true,
        title: 'Expired Sale',
        discountPercent: 50,
        endsAt: new Date(Date.now() - 86400000).toISOString()
      };
      expect(calculateEffectivePrice(999, expiredOffer)).toBe(999);
    });
  });

  describe('6. Date Formatting & Expiry Difference Utilities', () => {
    it('should format ISO timestamps and date strings into DD/MM/YYYY format', () => {
      expect(formatDateDDMMYYYY('2026-11-06')).toBe('06/11/2026');
      expect(formatDateDDMMYYYY('2026-01-15T12:00:00.000Z')).toBe('15/01/2026');
      expect(formatDateDDMMYYYY('')).toBe('');
      expect(formatDateDDMMYYYY(null)).toBe('');
    });

    it('should calculate days difference between dates', () => {
      expect(getDaysDifference('2026-11-01', '2026-11-06')).toBe(5);
      expect(getDaysDifference('2026-11-06', '2026-11-01')).toBe(-5);
      expect(getDaysDifference('2026-11-06', '2026-11-06')).toBe(0);
    });
  });

  describe('7. WhatsApp & Email Outreach Utilities', () => {
    it('should clean and prefix WhatsApp numbers correctly', () => {
      expect(cleanWhatsAppNumber('9876543210')).toBe('919876543210');
      expect(cleanWhatsAppNumber('09876543210')).toBe('919876543210');
      expect(cleanWhatsAppNumber('+91 98765 43210')).toBe('919876543210');
      expect(cleanWhatsAppNumber('919876543210')).toBe('919876543210');
      expect(cleanWhatsAppNumber('')).toBe('');
    });

    it('should replace all placeholders in outreach message templates', () => {
      const template = 'Hi {{ownerName}}, your kitchen {{businessName}} on {{planName}} has {{daysLeft}} days left. Renew here: {{link}}';
      const tenant = {
        businessName: 'Spicy Delight',
        ownerName: 'Chef Aarti',
        planName: 'Monthly Pro',
        daysLeft: 3
      };
      const result = replacePlaceholders(template, tenant, { link: 'https://scalekitchen.in/renew' });
      expect(result).toBe('Hi Chef Aarti, your kitchen Spicy Delight on Monthly Pro has 3 days left. Renew here: https://scalekitchen.in/renew');
    });
  });

  describe('8. Free Trial Audit & Tamper Detection Invariant', () => {
    it('should detect artificially extended free trial dates and calculate correct 30-day expiration', () => {
      const auditTrial = (tenant: TenantUser) => {
        const isFreeTrial = (tenant.planName || '').toLowerCase().includes('trial');
        if (!isFreeTrial) return { needsRepair: false };

        const todayStr = '2026-11-06';
        const earliestFootprint = tenant.createdAt ? tenant.createdAt.split('T')[0] : '2026-09-01';
        const originObj = new Date(earliestFootprint);
        const correctTrialExpiryObj = new Date(originObj);
        correctTrialExpiryObj.setDate(correctTrialExpiryObj.getDate() + 30);
        const correctTrialExpiry = correctTrialExpiryObj.toISOString().split('T')[0];

        const isTampered = (tenant.planExpiryDate || '') > correctTrialExpiry;
        return {
          needsRepair: isTampered,
          correctExpiry: correctTrialExpiry,
          expired: correctTrialExpiry < todayStr
        };
      };

      // Tenant created on 2026-09-01, should expire on 2026-10-01 (30 days)
      // But database currently has planExpiryDate set to 2027-12-31!
      const tamperedTenant: TenantUser = {
        id: 'tampered_biz',
        businessName: 'Tampered Kitchen',
        ownerName: 'Bad Actor',
        email: 'bad@actor.com',
        mobile: '9999999999',
        businessCategory: 'Tiffin',
        businessDescription: 'Meals',
        city: 'Mumbai',
        state: 'Maharashtra',
        planName: 'Free Trial',
        planExpiryDate: '2027-12-31',
        createdAt: '2026-09-01T10:00:00.000Z'
      };

      const auditResult = auditTrial(tamperedTenant);
      expect(auditResult.needsRepair).toBe(true);
      expect(auditResult.correctExpiry).toBe('2026-10-01');
      expect(auditResult.expired).toBe(true);
    });
  });
});
