import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'scalekitchen-old-rules-audit';

describe('Audit: Verifying OLD Rules Vulnerabilities (firestore.rules.old)', () => {
  let oldTestEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const oldRules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules.old'), 'utf8');
    oldTestEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: oldRules,
        host: '127.0.0.1',
        port: 8080
      }
    });
  });

  afterAll(async () => {
    if (oldTestEnv) {
      await oldTestEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await oldTestEnv.clearFirestore();

    // Seed test data in Admin mode
    await oldTestEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'businesses/biz_a'), { businessName: 'Kitchen Alpha' });
      await setDoc(doc(db, 'businesses/biz_a/customers/cust_1'), { name: 'Customer A', phone: '9999999999' });
      await setDoc(doc(db, 'businesses/biz_a/staff/driver_1'), { name: 'Driver 1', pin: '1234' });
      await setDoc(doc(db, 'businesses/biz_a/invoices/inv_1'), { amount: 5000 });
      await setDoc(doc(db, 'businesses/biz_a/payments/pay_1'), { amount: 5000 });
      await setDoc(doc(db, 'businesses/biz_a/expenses/exp_1'), { amount: 2000 });
      await setDoc(doc(db, 'businesses/biz_a/billing_history/bill_1'), { amount: 999 });
      await setDoc(doc(db, 'driver_auth_lookup/9876543210'), { pin: '1234' });
    });
  });

  it('VULNERABILITY 1: Anonymous users COULD read private customer data under old rules', async () => {
    const db = oldTestEnv.unauthenticatedContext().firestore();
    // This SUCCEEDED on old rules because allow read: if true;
    await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/customers/cust_1')));
  });

  it('VULNERABILITY 2: Anonymous users COULD read staff credentials and PINs under old rules', async () => {
    const db = oldTestEnv.unauthenticatedContext().firestore();
    // This SUCCEEDED on old rules because allow read: if true;
    await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/staff/driver_1')));
  });

  it('VULNERABILITY 3: Anonymous users COULD read and write billing_history under old rules', async () => {
    const db = oldTestEnv.unauthenticatedContext().firestore();
    // This SUCCEEDED on old rules because allow read, write: if true;
    await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/billing_history/bill_1')));
    await assertSucceeds(setDoc(doc(db, 'businesses/biz_a/billing_history/forged_bill'), { amount: 0 }));
  });

  it('VULNERABILITY 4: Anyone COULD read and write driver_auth_lookup under old rules', async () => {
    const db = oldTestEnv.unauthenticatedContext().firestore();
    // This SUCCEEDED on old rules because allow read: if true; allow write: if true;
    await assertSucceeds(getDoc(doc(db, 'driver_auth_lookup/9876543210')));
    await assertSucceeds(setDoc(doc(db, 'driver_auth_lookup/tampered_phone'), { pin: '0000' }));
  });

  it('VULNERABILITY 5: Business B COULD read Business A invoices, payments, and expenses under old rules', async () => {
    const db = oldTestEnv.authenticatedContext('biz_b').firestore();
    // Under old rules, match /invoices/{id} allowed: request.auth != null with NO tenant check!
    await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/invoices/inv_1')));
    await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/payments/pay_1')));
    await assertSucceeds(getDoc(doc(db, 'businesses/biz_a/expenses/exp_1')));
  });

  it('VULNERABILITY 6: Unverified email COULD claim admin privileges under old rules', async () => {
    const db = oldTestEnv.authenticatedContext('spoofed_admin', {
      email: 'memosmy10@gmail.com',
      email_verified: false
    }).firestore();
    // Under old rules, isAdmin() only checked email string without email_verified!
    await assertSucceeds(setDoc(doc(db, 'global_settings/pricing'), { forged: true }));
  });
});
