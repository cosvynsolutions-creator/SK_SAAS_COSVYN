
const admin = require("firebase-admin");
const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Initialize Firebase Admin SDK
admin.initializeApp();
setGlobalOptions({ region: "asia-south1" });

// Define Secrets from Firebase Secret Manager (Phase 3)
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Scheduled job to run every day at midnight (Cloud Functions v2 / Node 20).
 * Checks all 'Active' businesses and updates their status to 'Expired'
 * if their planExpiryDate has passed using the server date logic (YYYY-MM-DD).
 */
exports.checkSubscriptionExpiry = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (event) => {
    const db = admin.firestore();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD server date logic

    console.log(`[Cron v2] Running subscription expiry check for server date: ${todayStr}`);

    try {
      const snapshot = await db.collection("businesses")
        .where("planStatus", "==", "Active")
        .get();

      if (snapshot.empty) {
        console.log("[Cron v2] No active subscriptions found to check.");
        return;
      }

      const batch = db.batch();
      let expiredCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.planExpiryDate && data.planExpiryDate < todayStr) {
          const docRef = db.collection("businesses").doc(doc.id);
          batch.update(docRef, {
            planStatus: "Expired",
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          });
          expiredCount++;
        }
      });

      if (expiredCount > 0) {
        await batch.commit();
        console.log(`[Cron v2] Successfully marked ${expiredCount} subscriptions as Expired.`);
      } else {
        console.log("[Cron v2] No subscriptions expired today.");
      }
    } catch (error) {
      console.error("[Cron v2] Error in checkSubscriptionExpiry:", error);
    }
  }
);

/**
 * Scheduled job to backup the Firestore database to Cloud Storage (v2 / Node 20).
 *
 * RETENTION POLICY NOTE:
 * Configure Object Lifecycle Management on your Cloud Storage backup bucket:
 * E.g., retain daily backups for 30 days and automatically delete older backups:
 * ```bash
 * cat <<EOF > lifecycle.json
 * {
 *   "rule": [
 *     {
 *       "action": {"type": "Delete"},
 *       "condition": {"age": 30}
 *     }
 *   ]
 * }
 * EOF
 * gsutil lifecycle set lifecycle.json gs://YOUR_PROJECT_ID.appspot.com
 * ```
 *
 * HOW TO TEST A RESTORE:
 * 1. Identify the backup URI prefix in Cloud Storage, e.g.:
 *    gs://YOUR_PROJECT_ID.appspot.com/backups/2026-10-18T00:00:00.000Z/
 * 2. To test restoring without affecting production, restore to a staging database or test project:
 *    gcloud firestore import gs://YOUR_PROJECT_ID.appspot.com/backups/2026-10-18T00:00:00.000Z/ --project=YOUR_STAGING_PROJECT_ID
 * 3. Or to restore specific collections in a sandbox:
 *    gcloud firestore import gs://YOUR_PROJECT_ID.appspot.com/backups/.../ --collection-ids='businesses','plans'
 */
exports.scheduledFirestoreExport = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (event) => {
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId;
    const databaseName = client.databasePath(projectId, '(default)');
    const bucketName = `gs://${projectId}.appspot.com`;
    const timestamp = new Date().toISOString();

    console.log(`[Backup v2] Starting backup for project ${projectId} to ${bucketName}/backups/${timestamp}`);

    try {
      const [response] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: `${bucketName}/backups/${timestamp}`,
        collectionIds: [] // Exports all collections
      });
      console.log(`[Backup v2] Export operation initiated: ${response.name}`);
      return response;
    } catch (err) {
      console.error('[Backup v2] Export operation failed:', err);
      throw err;
    }
  }
);


/**
 * ============================================================================
 * PHASE 1 & 2: SERVER-VERIFIED DRIVER & MANAGER AUTHENTICATION (Cloud Functions v2)
 * ============================================================================
 */

/**
 * driverLogin
 * Verifies driver email + password, enforces lockout (5 failures -> 15 min lock),
 * and issues a Firebase Custom Token with claims: { role: 'driver', bizId, staffId, branchId }
 */
exports.driverLogin = onCall({ cors: true, region: 'asia-south1' }, async (request) => {
  const { email, password, bizId: reqBizId } = request.data || {};

  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanPassword = password ? String(password) : '';

  const db = admin.firestore();
  const now = Date.now();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new HttpsError('invalid-argument', 'Valid driver email is required.');
  }
  if (!cleanPassword) {
    throw new HttpsError('invalid-argument', 'Password is required.');
  }

  {
    const safeEmailKey = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const rateLimitRef = db.collection('auth_rate_limits').doc(`driver_email_${safeEmailKey}`);
    const rateLimitSnap = await rateLimitRef.get();
    const rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : { attempts: 0, lockedUntil: null };

    // Check lockout
    if (rateLimitData.lockedUntil && Number(rateLimitData.lockedUntil) > now) {
      const remainingMinutes = Math.max(1, Math.ceil((Number(rateLimitData.lockedUntil) - now) / 60000));
      throw new HttpsError(
        'resource-exhausted',
        `Account temporarily locked due to 5 consecutive failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`
      );
    }

    const recordFailedAttempt = async () => {
      const attempts = (rateLimitData.attempts || 0) + 1;
      const isLocked = attempts >= 5;
      const lockedUntil = isLocked ? now + (15 * 60 * 1000) : null;

      await rateLimitRef.set({
        attempts: isLocked ? 0 : attempts,
        lockedUntil,
        lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        email: cleanEmail
      }, { merge: true });

      if (isLocked) {
        throw new HttpsError(
          'resource-exhausted',
          'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
        );
      }
      const remaining = 5 - attempts;
      throw new HttpsError(
        'unauthenticated',
        `Invalid email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout)`
      );
    };

    let driverDoc = null;
    let resolvedBizId = reqBizId ? String(reqBizId).trim() : '';

    // Step A: Check driver_auth_lookup_email/{cleanEmail}
    const emailLookupRef = db.collection('driver_auth_lookup_email').doc(cleanEmail);
    const emailLookupSnap = await emailLookupRef.get();
    if (emailLookupSnap.exists) {
      driverDoc = emailLookupSnap.data();
      if (!resolvedBizId && driverDoc.bizId) {
        resolvedBizId = driverDoc.bizId;
      }
    } else {
      // Staff email lookup documents are provisioned with the driver's account.
      if (resolvedBizId) {
        const staffSnap = await db.collection('businesses')
          .doc(resolvedBizId)
          .collection('staff')
          .where('email', '==', cleanEmail)
          .limit(1)
          .get();
        if (!staffSnap.empty) {
          const docSnap = staffSnap.docs[0];
          driverDoc = { id: docSnap.id, staffId: docSnap.id, ...docSnap.data() };
        }
      }
    }

    if (!driverDoc || !resolvedBizId) {
      await recordFailedAttempt();
    }

    const targetStaffId = driverDoc ? (driverDoc.staffId || driverDoc.id || '') : '';
    let passwordHash = driverDoc ? driverDoc.passwordHash : null;
    if (!passwordHash && resolvedBizId && targetStaffId) {
      try {
        const credSnap = await db.collection('businesses').doc(resolvedBizId).collection('staff_credentials').doc(targetStaffId).get();
        if (credSnap.exists) {
          passwordHash = credSnap.data().passwordHash;
        }
      } catch (error) {
        console.error('[driverLogin] Could not load delivery credentials:', error);
        throw new HttpsError('internal', 'Unable to verify delivery credentials. Please try again.');
      }
    }

    // Verify Password with bcrypt against passwordHash
    let isMatch = false;
    if (passwordHash) {
      try {
        isMatch = bcrypt.compareSync(cleanPassword, passwordHash);
      } catch (bcryptErr) {
        console.error('[driverLogin] bcrypt compare error:', bcryptErr);
        isMatch = false;
      }
    }

    if (!isMatch) {
      await recordFailedAttempt();
    }

    // Enforce active / status validation
    if (driverDoc.active === false || driverDoc.status === 'Inactive' || driverDoc.isDeleted) {
      throw new HttpsError('permission-denied', 'This delivery partner account has been deactivated. Please contact your kitchen manager.');
    }

    // Verify subscription status of business
    const bizSnap = await db.collection('businesses').doc(resolvedBizId).get();
    if (!bizSnap.exists) {
      throw new HttpsError('not-found', 'Associated kitchen was not found.');
    }
    const bizData = bizSnap.data();
    if (bizData.planStatus === 'Expired') {
      throw new HttpsError('permission-denied', 'Kitchen subscription has expired. Please contact the kitchen owner.');
    }

    // Clear rate limit
    await rateLimitRef.set({
      attempts: 0,
      lockedUntil: null,
      lastSuccessAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const staffId = driverDoc.staffId || driverDoc.id || 'driver-1';
    const branchId = driverDoc.branchId || '';
    const name = driverDoc.name || 'Delivery Partner';

    const uid = driverDoc.authUid || `driver_${resolvedBizId}_${staffId}`;
    const claims = {
      role: 'driver',
      bizId: resolvedBizId,
      staffId,
      branchId
    };

    let customToken;
    try {
      customToken = await admin.auth().createCustomToken(uid, claims);
    } catch (tokenErr) {
      console.error('[driverLogin] createCustomToken error:', tokenErr);
      throw new HttpsError('internal', 'Failed to generate authentication token. Please try again.');
    }

    return {
      token: customToken,
      driver: {
        name,
        bizId: resolvedBizId,
        staffId,
        branchId,
        email: cleanEmail,
        mobile: driverDoc.mobile || ''
      }
    };
  }

});

/**
 * managerLogin
 * Verifies manager email + passwordHash only, enforces lockout (5 failures -> 15 min lock),
 * and issues a Firebase Custom Token with claims: { role: 'manager', bizId, managerId, branchId }
 */
exports.managerLogin = onCall({ cors: true }, async (request) => {
  const { email, password, bizId } = request.data || {};

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new HttpsError('invalid-argument', 'A valid manager email is required.');
  }

  const cleanPassword = String(password || '');
  if (!cleanPassword) {
    throw new HttpsError('invalid-argument', 'Password is required.');
  }

  const db = admin.firestore();
  const now = Date.now();
  const safeEmailKey = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const rateLimitRef = db.collection('auth_rate_limits').doc(`manager_${safeEmailKey}`);
  const rateLimitSnap = await rateLimitRef.get();
  const rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : { attempts: 0, lockedUntil: null };

  if (rateLimitData.lockedUntil && Number(rateLimitData.lockedUntil) > now) {
    const remainingMinutes = Math.max(1, Math.ceil((Number(rateLimitData.lockedUntil) - now) / 60000));
    throw new HttpsError(
      'resource-exhausted',
      `Account temporarily locked due to 5 consecutive failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`
    );
  }

  let managerDoc = null;
  let resolvedBizId = '';

  const recordFailedAttempt = async () => {
    const attempts = (rateLimitData.attempts || 0) + 1;
    const isLocked = attempts >= 5;
    const lockedUntil = isLocked ? now + (15 * 60 * 1000) : null;

    await rateLimitRef.set({
      attempts: isLocked ? 0 : attempts,
      lockedUntil,
      lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      email: cleanEmail
    }, { merge: true });

    if (isLocked) {
      throw new HttpsError(
        'resource-exhausted',
        'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
      );
    }
    const remaining = 5 - attempts;
    throw new HttpsError(
      'unauthenticated',
      `Invalid email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout)`
    );
  };

  // 1. Strict business resolution: if bizId is supplied, search strictly within that business.
  // Never fall back to another business's collectionGroup.
  if (bizId && String(bizId).trim()) {
    const targetBiz = String(bizId).trim();
    const managersSnap = await db.collection('businesses')
      .doc(targetBiz)
      .collection('managers')
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (!managersSnap.empty) {
      const docSnap = managersSnap.docs[0];
      managerDoc = { id: docSnap.id, ...docSnap.data() };
      resolvedBizId = targetBiz;
    } else {
      // Invalid business ID or manager not in that business -> record failure & reject
      await recordFailedAttempt();
    }
  } else {
    // 2. Fallback when bizId is omitted: Search across collectionGroup('managers')
    const groupSnap = await db.collectionGroup('managers')
      .where('email', '==', cleanEmail)
      .limit(2) // Detect ambiguity across different businesses
      .get();

    if (groupSnap.empty) {
      await recordFailedAttempt();
    } else if (groupSnap.size > 1) {
      throw new HttpsError(
        'failed-precondition',
        'Multiple kitchen accounts found for this email. Please specify your Kitchen / Business ID to sign in.'
      );
    } else {
      const docSnap = groupSnap.docs[0];
      managerDoc = { id: docSnap.id, ...docSnap.data() };
      if (docSnap.ref.parent && docSnap.ref.parent.parent) {
        resolvedBizId = docSnap.ref.parent.parent.id;
      } else {
        await recordFailedAttempt();
      }
    }
  }

  if (!managerDoc || !resolvedBizId) {
    await recordFailedAttempt();
  }

  // Check Manager Deactivation / Inactive status
  const isDeactivated = 
    managerDoc.status === 'Inactive' || 
    managerDoc.status === 'deactivated' || 
    managerDoc.status === 'disabled' || 
    managerDoc.active === false || 
    managerDoc.deleted === true || 
    managerDoc.isDeleted === true;

  if (isDeactivated) {
    throw new HttpsError(
      'permission-denied',
      'This manager account has been deactivated. Please contact your kitchen owner.'
    );
  }

  // Verify Password with passwordHash ONLY (no plaintext fallback)
  let isMatch = false;
  if (managerDoc.passwordHash) {
    try {
      isMatch = bcrypt.compareSync(cleanPassword, managerDoc.passwordHash);
    } catch (bcryptErr) {
      console.error('[managerLogin] bcrypt error:', bcryptErr);
      isMatch = false;
    }
  }

  if (!isMatch) {
    await recordFailedAttempt();
  }

  // Reset rate limits on success
  await rateLimitRef.set({
    attempts: 0,
    lockedUntil: null,
    lastSuccessAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const managerId = managerDoc.id;
  const branchId = managerDoc.branchId || 'All';
  const name = managerDoc.name || 'Branch Manager';
  const allowedPages = managerDoc.allowedPages || ['dashboard'];

  const uid = `manager_${resolvedBizId}_${managerId}`;
  const claims = {
    role: 'manager',
    bizId: resolvedBizId,
    managerId,
    branchId,
    allBranches: branchId === 'All'
  };

  let customToken;
  try {
    customToken = await admin.auth().createCustomToken(uid, claims);
  } catch (tokenErr) {
    console.error('[managerLogin] createCustomToken error:', tokenErr);
    throw new HttpsError('internal', 'Failed to generate manager token. Please try again.');
  }

  return {
    token: customToken,
    manager: {
      id: managerId,
      name,
      email: cleanEmail,
      branchId,
      allowedPages,
      bizId: resolvedBizId
    }
  };
});

/**
 * Legacy export retained to avoid breaking older clients. PIN-based driver
 * authentication is retired; credentials must be managed with email/password.
 */
exports.setDriverPin = onCall({ cors: true, region: 'asia-south1' }, async () => {
  throw new HttpsError(
    'failed-precondition',
    'PIN-based delivery login is retired. Configure an email and password for this delivery partner.'
  );
});

/**
 * Helper to check owner, manager, or admin permission for managing staff
 */
function verifyStaffManagementAuth(request, bizId, branchId) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const callerClaims = request.auth.token || {};
  const isOwner = callerUid === bizId;
  const isManager = callerClaims.role === 'manager' && 
                    callerClaims.bizId === bizId && 
                    (callerClaims.allBranches === true || !branchId || callerClaims.branchId === branchId);
  const isAdmin = callerClaims.admin === true || 
                  callerClaims.email === 'memosmy10@gmail.com' || 
                  ['cosvynsolutions@gmail.com', 'admin@scalekitchen.in'].includes(callerClaims.email);

  if (!isOwner && !isManager && !isAdmin) {
    throw new HttpsError('permission-denied', 'Only kitchen owners or authorized branch managers can manage delivery partner accounts.');
  }

  return { callerUid, callerClaims, isOwner, isManager, isAdmin };
}

/**
 * createDeliveryBoyAccount
 * Creates a Delivery Boy account with native Firebase Auth (email/password),
 * assigns custom claims { role: 'driver', bizId, branchId, staffId },
 * creates businesses/{bizId}/staff/{staffId} record (no plaintext pin or password),
 * creates driver_profiles/{authUid} for client profile access,
 * and records hashed password in server-only staff_credentials collection.
 */
exports.createDeliveryBoyAccount = onCall({ cors: true, region: 'asia-south1' }, async (request) => {
  const { 
    bizId, 
    email, 
    password, 
    name, 
    branchId, 
    mobile, 
    dateOfJoining,
    joiningDate, 
    salary, 
    aadharNumber, 
    homeLocation, 
    vehicleNumber, 
    status,
    additionalData 
  } = request.data || {};

  if (!bizId) {
    throw new HttpsError('invalid-argument', 'Business ID is required.');
  }

  verifyStaffManagementAuth(request, bizId, branchId);

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }

  const cleanPassword = String(password || '');
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const cleanName = String(name || '').trim();
  if (!cleanName) {
    throw new HttpsError('invalid-argument', 'Delivery partner full name is required.');
  }

  const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  const cleanStatus = status === 'Inactive' ? 'Inactive' : (status || 'Active');
  const isActive = cleanStatus !== 'Inactive';
  const targetBranch = String(branchId || '').trim();
  const db = admin.firestore();

  // Check if email already belongs to another business
  const existingLookup = await db.collection('driver_auth_lookup_email').doc(cleanEmail).get();
  if (existingLookup.exists) {
    const existingData = existingLookup.data();
    if (existingData.bizId && existingData.bizId !== bizId) {
      throw new HttpsError('already-exists', 'This email is already registered with another kitchen.');
    }
  }

  let userRecord;
  let targetStaffId = db.collection('businesses').doc(bizId).collection('staff').doc().id;
  let isExistingDriver = false;
  try {
    userRecord = await admin.auth().getUserByEmail(cleanEmail);
    const claims = userRecord.customClaims || {};
    const managerSnap = await db.collectionGroup('managers')
      .where('email', '==', cleanEmail).limit(1).get();
    const isKnownOwnerOrManager = userRecord.uid === bizId ||
      claims.role === 'owner' ||
      claims.role === 'manager' ||
      !managerSnap.empty;
    isExistingDriver = claims.role === 'driver' && claims.bizId === bizId && Boolean(claims.staffId);

    if (isKnownOwnerOrManager || !isExistingDriver) {
      throw new HttpsError(
        'already-exists',
        'This email already belongs to an account. Use a new email address or edit the existing delivery partner.'
      );
    }

    targetStaffId = String(claims.staffId);
    await admin.auth().updateUser(userRecord.uid, {
      password: cleanPassword,
      displayName: cleanName,
      disabled: !isActive
    });
  } catch (err) {
    if (err instanceof HttpsError) {
      throw err;
    }
    if (err.code === 'auth/user-not-found') {
      userRecord = await admin.auth().createUser({
        email: cleanEmail,
        password: cleanPassword,
        displayName: cleanName,
        disabled: !isActive
      });
    } else {
      console.error('[createDeliveryBoyAccount] Auth create error:', err);
      throw new HttpsError('internal', `Failed to configure delivery partner credentials: ${err.message}`);
    }
  }

  const authUid = userRecord.uid;

  await admin.auth().setCustomUserClaims(authUid, {
    role: 'driver',
    bizId,
    branchId: targetBranch,
    staffId: targetStaffId
  });

  const nowIso = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(cleanPassword, 10);

  const batch = db.batch();

  // 1. Staff subcollection document (clean data, NO plaintext password or pin, NO passwordHash)
  const staffRef = db.collection('businesses').doc(bizId).collection('staff').doc(targetStaffId);
  const staffPayload = {
    ...(additionalData || {}),
    id: targetStaffId,
    name: cleanName,
    email: cleanEmail,
    role: 'driver',
    branchId: targetBranch,
    mobile: cleanMobile,
    dateOfJoining: dateOfJoining || joiningDate || nowIso.split('T')[0],
    salary: Number(salary) || 0,
    aadharNumber: String(aadharNumber || '').trim(),
    homeLocation: String(homeLocation || '').trim(),
    vehicleNumber: String(vehicleNumber || '').trim(),
    authUid,
    active: isActive,
    status: cleanStatus,
    updatedAt: nowIso,
    createdAt: nowIso,
    password: admin.firestore.FieldValue.delete(),
    pin: admin.firestore.FieldValue.delete(),
    passwordHash: admin.firestore.FieldValue.delete(),
    pinHash: admin.firestore.FieldValue.delete(),
    pinVersion: admin.firestore.FieldValue.delete()
  };
  batch.set(staffRef, staffPayload, { merge: true });

  // 2. Server-side private credentials subcollection (accessible ONLY by Cloud Functions)
  const credsRef = db.collection('businesses').doc(bizId).collection('staff_credentials').doc(targetStaffId);
  batch.set(credsRef, {
    staffId: targetStaffId,
    authUid,
    email: cleanEmail,
    passwordHash,
    pin: admin.firestore.FieldValue.delete(),
    pinHash: admin.firestore.FieldValue.delete(),
    pinVersion: admin.firestore.FieldValue.delete(),
    updatedAt: nowIso
  }, { merge: true });

  // 3. Authenticated driver profile (read rule: request.auth.uid == driverUid)
  const profileRef = db.collection('driver_profiles').doc(authUid);
  batch.set(profileRef, {
    uid: authUid,
    authUid,
    bizId,
    staffId: targetStaffId,
    branchId: targetBranch,
    name: cleanName,
    email: cleanEmail,
    mobile: cleanMobile,
    status: cleanStatus,
    active: isActive,
    updatedAt: nowIso
  }, { merge: true });

  // 4. Server-only email lookup index (read rule: false)
  const lookupRef = db.collection('driver_auth_lookup_email').doc(cleanEmail);
  batch.set(lookupRef, {
    authUid,
    bizId,
    staffId: targetStaffId,
    name: cleanName,
    email: cleanEmail,
    role: 'driver',
    branchId: targetBranch,
    active: isActive,
    status: cleanStatus,
    updatedAt: nowIso
  }, { merge: true });

  await batch.commit();

  return { success: true, staffId: targetStaffId, authUid };
});

/**
 * updateDeliveryBoyAccount
 * Updates a delivery partner's profile and credentials.
 */
exports.updateDeliveryBoyAccount = onCall({ cors: true, region: 'asia-south1' }, async (request) => {
  const { 
    bizId, 
    staffId,
    email, 
    password, 
    name, 
    branchId, 
    mobile, 
    dateOfJoining,
    joiningDate, 
    salary, 
    aadharNumber, 
    homeLocation, 
    vehicleNumber, 
    status,
    additionalData 
  } = request.data || {};

  if (!bizId || !staffId) {
    throw new HttpsError('invalid-argument', 'Business ID and Staff ID are required.');
  }

  verifyStaffManagementAuth(request, bizId, branchId);

  const db = admin.firestore();
  const staffRef = db.collection('businesses').doc(bizId).collection('staff').doc(staffId);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists) {
    throw new HttpsError('not-found', 'Delivery partner record not found.');
  }

  const existingStaff = staffSnap.data();
  const cleanEmail = email ? String(email).trim().toLowerCase() : (existingStaff.email || '');
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new HttpsError('invalid-argument', 'A valid delivery partner email address is required.');
  }
  const cleanName = name ? String(name).trim() : (existingStaff.name || 'Delivery Partner');
  const cleanMobile = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : (existingStaff.mobile || '');
  const targetBranch = branchId !== undefined ? String(branchId).trim() : (existingStaff.branchId || '');
  const cleanStatus = status !== undefined ? status : (existingStaff.status || 'Active');
  const isActive = cleanStatus !== 'Inactive';
  const nowIso = new Date().toISOString();
  const cleanPassword = password ? String(password) : '';

  if (cleanPassword && cleanPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const emailLookupRef = db.collection('driver_auth_lookup_email').doc(cleanEmail);
  const emailLookupSnap = await emailLookupRef.get();
  if (emailLookupSnap.exists) {
    const lookupData = emailLookupSnap.data();
    if (lookupData.bizId !== bizId || lookupData.staffId !== staffId) {
      throw new HttpsError('already-exists', 'This email is already assigned to another delivery partner.');
    }
  }

  const managerSnap = await db.collectionGroup('managers')
    .where('email', '==', cleanEmail).limit(1).get();
  if (!managerSnap.empty) {
    throw new HttpsError('already-exists', 'This email belongs to an owner or manager account and cannot be used for a delivery partner.');
  }

  let authUid = existingStaff.authUid || '';
  let authUser;
  let createdAuthUser = false;
  if (authUid) {
    try {
      authUser = await admin.auth().getUser(authUid);
    } catch (error) {
      console.error('[updateDeliveryBoyAccount] Could not load linked Auth user:', error);
      throw new HttpsError('failed-precondition', 'The linked Firebase Auth account could not be found. Remove the stale account link or contact support.');
    }
  } else {
    try {
      authUser = await admin.auth().getUserByEmail(cleanEmail);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        console.error('[updateDeliveryBoyAccount] Could not look up Auth user by email:', error);
        throw new HttpsError('internal', 'Could not verify this email with Firebase Authentication. Check the Cloud Functions logs.');
      }

      if (!cleanPassword) {
        throw new HttpsError('failed-precondition', 'This legacy delivery profile has no Firebase login yet. Enter a new password to create its login.');
      }

      try {
        authUser = await admin.auth().createUser({
          email: cleanEmail,
          password: cleanPassword,
          displayName: cleanName,
          disabled: !isActive
        });
        createdAuthUser = true;
      } catch (createError) {
        console.error('[updateDeliveryBoyAccount] Could not create Auth user:', createError);
        throw new HttpsError('internal', `Could not create the delivery login (${createError.code || 'auth/error'}). Check Cloud Functions logs.`);
      }
    }
  }

  const authClaims = authUser.customClaims || {};
  const authIsOwnerOrManager = authUser.uid === bizId ||
    authClaims.role === 'owner' ||
    authClaims.role === 'manager';
  const authIsThisDriver = authClaims.role === 'driver' &&
    authClaims.bizId === bizId &&
    authClaims.staffId === staffId;
  const claimsConflict = Boolean(authClaims.role && !authIsThisDriver);
  const unlinkedExistingUser = !existingStaff.authUid && !createdAuthUser && !authIsThisDriver;
  if (authIsOwnerOrManager || authClaims.admin === true || claimsConflict || unlinkedExistingUser) {
    throw new HttpsError('already-exists', 'This email belongs to another Firebase account and cannot be reassigned to this delivery partner.');
  }
  authUid = authUser.uid;

  const authUpdate = {
    displayName: cleanName,
    disabled: !isActive
  };
  if (cleanEmail !== authUser.email) authUpdate.email = cleanEmail;
  if (cleanPassword) authUpdate.password = cleanPassword;

  try {
    await admin.auth().updateUser(authUid, authUpdate);
    await admin.auth().setCustomUserClaims(authUid, {
      role: 'driver',
      bizId,
      branchId: targetBranch,
      staffId
    });
    if (cleanPassword) await admin.auth().revokeRefreshTokens(authUid);
  } catch (authError) {
    console.error('[updateDeliveryBoyAccount] Firebase Auth update failed:', authError);
    throw new HttpsError('internal', `Could not update the delivery login (${authError.code || 'auth/error'}). Check Cloud Functions logs.`);
  }

  // Handle old email lookup cleanup if email changed
  if (existingStaff.email && cleanEmail && existingStaff.email !== cleanEmail) {
    const oldLookupRef = db.collection('driver_auth_lookup_email').doc(existingStaff.email);
    const oldLookupSnap = await oldLookupRef.get();
    if (oldLookupSnap.exists) {
      const oldLookup = oldLookupSnap.data();
      if (oldLookup.bizId === bizId && oldLookup.staffId === staffId) {
        await oldLookupRef.delete();
      }
    }
  }

  const batch = db.batch();

  // 1. Staff Document
  const updatedStaffPayload = {
    ...(additionalData || {}),
    name: cleanName,
    email: cleanEmail,
    role: 'driver',
    branchId: targetBranch,
    mobile: cleanMobile,
    dateOfJoining: dateOfJoining || joiningDate || existingStaff.dateOfJoining || nowIso.split('T')[0],
    salary: salary !== undefined ? Number(salary) : (existingStaff.salary || 0),
    aadharNumber: aadharNumber !== undefined ? String(aadharNumber).trim() : (existingStaff.aadharNumber || ''),
    homeLocation: homeLocation !== undefined ? String(homeLocation).trim() : (existingStaff.homeLocation || ''),
    vehicleNumber: vehicleNumber !== undefined ? String(vehicleNumber).trim() : (existingStaff.vehicleNumber || ''),
    authUid: authUid || existingStaff.authUid || '',
    active: isActive,
    status: cleanStatus,
    updatedAt: nowIso,
    password: admin.firestore.FieldValue.delete(),
    pin: admin.firestore.FieldValue.delete(),
    passwordHash: admin.firestore.FieldValue.delete(),
    pinHash: admin.firestore.FieldValue.delete(),
    pinVersion: admin.firestore.FieldValue.delete()
  };
  batch.set(staffRef, updatedStaffPayload, { merge: true });

  // 2. Server credentials update if password changed
  if (cleanPassword) {
    const credsRef = db.collection('businesses').doc(bizId).collection('staff_credentials').doc(staffId);
    batch.set(credsRef, {
      staffId,
      authUid,
      email: cleanEmail,
      passwordHash: bcrypt.hashSync(cleanPassword, 10),
      pin: admin.firestore.FieldValue.delete(),
      pinHash: admin.firestore.FieldValue.delete(),
      pinVersion: admin.firestore.FieldValue.delete(),
      updatedAt: nowIso
    }, { merge: true });
  } else {
    const credsRef = db.collection('businesses').doc(bizId).collection('staff_credentials').doc(staffId);
    batch.set(credsRef, {
      pin: admin.firestore.FieldValue.delete(),
      pinHash: admin.firestore.FieldValue.delete(),
      pinVersion: admin.firestore.FieldValue.delete(),
      updatedAt: nowIso
    }, { merge: true });
  }

  // 3. Driver Profile
  if (authUid) {
    const profileRef = db.collection('driver_profiles').doc(authUid);
    batch.set(profileRef, {
      uid: authUid,
      authUid,
      bizId,
      staffId,
      branchId: targetBranch,
      name: cleanName,
      email: cleanEmail,
      mobile: cleanMobile,
      status: cleanStatus,
      active: isActive,
      updatedAt: nowIso
    }, { merge: true });
  }

  // 4. Server-only Email Lookup
  if (cleanEmail) {
    const lookupRef = db.collection('driver_auth_lookup_email').doc(cleanEmail);
    batch.set(lookupRef, {
      authUid: authUid || '',
      bizId,
      staffId,
      name: cleanName,
      email: cleanEmail,
      role: 'driver',
      branchId: targetBranch,
      active: isActive,
      status: cleanStatus,
      updatedAt: nowIso
    }, { merge: true });
  }

  await batch.commit();

  return { success: true, staffId, authUid };
});

/**
 * resetDeliveryBoyPassword
 * Resets the password of a delivery partner in Firebase Auth and updates staff_credentials.
 */
exports.resetDeliveryBoyPassword = onCall({ cors: true, region: 'asia-south1' }, async (request) => {
  const { bizId, staffId, newPassword } = request.data || {};

  if (!bizId || !staffId) {
    throw new HttpsError('invalid-argument', 'Business ID and Staff ID are required.');
  }

  verifyStaffManagementAuth(request, bizId);

  const cleanPassword = String(newPassword || '');
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const db = admin.firestore();
  const staffRef = db.collection('businesses').doc(bizId).collection('staff').doc(staffId);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists) {
    throw new HttpsError('not-found', 'Delivery partner record not found.');
  }

  const staffData = staffSnap.data();
  let authUid = staffData.authUid;

  if (!authUid && staffData.email) {
    try {
      const userRec = await admin.auth().getUserByEmail(staffData.email);
      authUid = userRec.uid;
      await staffRef.update({ authUid });
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        throw new HttpsError('not-found', 'Delivery partner Firebase account not found.');
      }
      console.error('[resetDeliveryBoyPassword] Could not resolve delivery partner Auth account:', error);
      throw new HttpsError('internal', 'Unable to resolve the delivery partner account. Please try again.');
    }
  }

  if (!authUid) {
    throw new HttpsError('failed-precondition', 'Delivery partner is not linked to a Firebase Auth account.');
  }

  await admin.auth().updateUser(authUid, { password: cleanPassword });
  await admin.auth().revokeRefreshTokens(authUid);

  // Update server-side staff_credentials
  const passwordHash = bcrypt.hashSync(cleanPassword, 10);
  await db.collection('businesses').doc(bizId).collection('staff_credentials').doc(staffId).set({
    staffId,
    authUid: authUid || '',
    email: staffData.email || '',
    passwordHash,
    pin: admin.firestore.FieldValue.delete(),
    pinHash: admin.firestore.FieldValue.delete(),
    pinVersion: admin.firestore.FieldValue.delete(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return { success: true };
});

/**
 * deactivateDeliveryBoyAccount
 * Deactivates a delivery partner account: sets status to Inactive and disables Auth user.
 */
exports.deactivateDeliveryBoyAccount = onCall({ cors: true, region: 'asia-south1' }, async (request) => {
  const { bizId, staffId } = request.data || {};

  if (!bizId || !staffId) {
    throw new HttpsError('invalid-argument', 'Business ID and Staff ID are required.');
  }

  verifyStaffManagementAuth(request, bizId);

  const db = admin.firestore();
  const staffRef = db.collection('businesses').doc(bizId).collection('staff').doc(staffId);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists) {
    throw new HttpsError('not-found', 'Delivery partner record not found.');
  }

  const staffData = staffSnap.data();
  const authUid = staffData.authUid;
  const nowIso = new Date().toISOString();

  if (authUid) {
    await admin.auth().updateUser(authUid, { disabled: true });
    await admin.auth().revokeRefreshTokens(authUid);
    await db.collection('driver_profiles').doc(authUid).set({
      active: false,
      status: 'Inactive',
      updatedAt: nowIso
    }, { merge: true });
  }

  await staffRef.update({
    active: false,
    status: 'Inactive',
    updatedAt: nowIso
  });

  if (staffData.email) {
    await db.collection('driver_auth_lookup_email').doc(staffData.email).set({
      active: false,
      status: 'Inactive',
      updatedAt: nowIso
    }, { merge: true });
  }

  return { success: true };
});

/**
 * reactivateDeliveryBoyAccount
 * Reactivates a delivery partner account: sets status to Active and enables Auth user.
 */
exports.reactivateDeliveryBoyAccount = onCall({ cors: true, region: 'asia-south1' }, async (request) => {
  const { bizId, staffId } = request.data || {};

  if (!bizId || !staffId) {
    throw new HttpsError('invalid-argument', 'Business ID and Staff ID are required.');
  }

  verifyStaffManagementAuth(request, bizId);

  const db = admin.firestore();
  const staffRef = db.collection('businesses').doc(bizId).collection('staff').doc(staffId);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists) {
    throw new HttpsError('not-found', 'Delivery partner record not found.');
  }

  const staffData = staffSnap.data();
  const authUid = staffData.authUid;
  const nowIso = new Date().toISOString();

  if (!authUid) {
    throw new HttpsError('failed-precondition', 'Delivery partner is not linked to a Firebase Auth account.');
  }

  await admin.auth().updateUser(authUid, { disabled: false });
  await db.collection('driver_profiles').doc(authUid).set({
    active: true,
    status: 'Active',
    updatedAt: nowIso
  }, { merge: true });

  await staffRef.update({
    active: true,
    status: 'Active',
    updatedAt: nowIso
  });

  if (staffData.email) {
    await db.collection('driver_auth_lookup_email').doc(staffData.email).set({
      active: true,
      status: 'Active',
      updatedAt: nowIso
    }, { merge: true });
  }

  return { success: true };
});

/**
 * setDriverPassword (backwards compatibility wrapper)
 */
exports.setDriverPassword = onCall({ cors: true, region: 'asia-south1' }, async (request) => {
  const { staffId } = request.data || {};
  if (staffId) {
    return exports.updateDeliveryBoyAccount(request);
  }
  return exports.createDeliveryBoyAccount(request);
});

/**
 * setManagerPassword
 * Callable function used by business owner when creating or updating a manager password.
 * Securely hashes the password and writes ONLY passwordHash to Firestore.
 */
exports.setManagerPassword = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required to set manager password.');
  }

  const { bizId, managerId, password, managerData } = request.data || {};

  const callerUid = request.auth.uid;
  const isOwner = callerUid === bizId;
  const isAdmin = request.auth.token && (request.auth.token.admin === true || request.auth.token.email === 'memosmy10@gmail.com');

  if (!isOwner && !isAdmin) {
    throw new HttpsError('permission-denied', 'Only the kitchen owner can set manager passwords.');
  }

  const cleanPassword = String(password || '');
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const db = admin.firestore();
  const passwordHash = bcrypt.hashSync(cleanPassword, 10);
  const targetManagerId = managerId || db.collection('businesses').doc(bizId).collection('managers').doc().id;
  const nowIso = new Date().toISOString();

  const managerRef = db.collection('businesses').doc(bizId).collection('managers').doc(targetManagerId);

  const payload = {
    ...(managerData || {}),
    passwordHash,
    updatedAt: nowIso
  };
  // Ensure plaintext password is never written
  delete payload.password;

  await managerRef.set(payload, { merge: true });

  return { success: true, managerId: targetManagerId };
});

/**
 * migratePlaintextCredentials
 * Admin or Owner callable that removes legacy driver PIN credentials and migrates
 * manager plaintext passwords to passwordHash.
 */
exports.migratePlaintextCredentials = onCall({ cors: true, region: 'asia-south1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const callerEmail = (request.auth.token && request.auth.token.email ? request.auth.token.email.toLowerCase().trim() : '');
  const isSuperAdminEmail = ['cosvynsolutions@gmail.com', 'admin@scalekitchen.in', 'memosmy10@gmail.com'].includes(callerEmail) && 
                            request.auth.token && request.auth.token.email_verified === true;
  const isAdmin = (request.auth.token && request.auth.token.admin === true) || isSuperAdminEmail;

  const db = admin.firestore();
  let migratedStaffCount = 0;
  let migratedManagersCount = 0;

  // If not admin, only allow migrating caller's own business
  const businessIds = [];
  if (isAdmin) {
    const businessesSnap = await db.collection('businesses').get();
    businessesSnap.docs.forEach(d => businessIds.push(d.id));
  } else {
    businessIds.push(callerUid);
  }

  for (const bizId of businessIds) {
    // 1. Staff
    const staffSnap = await db.collection('businesses').doc(bizId).collection('staff').get();
    for (const sDoc of staffSnap.docs) {
      const data = sDoc.data();
      const cleanPhone = String(data.mobile || '').replace(/\D/g, '').slice(-10);
      const nowIso = new Date().toISOString();
      const hadLegacyPin = Boolean(data.pin || data.pinHash || data.pinVersion);
      if (hadLegacyPin) {
        await sDoc.ref.update({
          pin: admin.firestore.FieldValue.delete(),
          pinHash: admin.firestore.FieldValue.delete(),
          pinVersion: admin.firestore.FieldValue.delete(),
          updatedAt: nowIso
        });
        migratedStaffCount++;
      }

      const credentialsRef = db.collection('businesses').doc(bizId).collection('staff_credentials').doc(sDoc.id);
      const credentialsSnap = await credentialsRef.get();
      if (credentialsSnap.exists && ['pin', 'pinHash', 'pinVersion'].some(key => key in credentialsSnap.data())) {
        await credentialsRef.set({
          pin: admin.firestore.FieldValue.delete(),
          pinHash: admin.firestore.FieldValue.delete(),
          pinVersion: admin.firestore.FieldValue.delete(),
          updatedAt: nowIso
        }, { merge: true });
      }

      if (cleanPhone.length === 10) {
        const lookupRef = db.collection('driver_auth_lookup').doc(cleanPhone);
        const lookupSnap = await lookupRef.get();
        if (lookupSnap.exists) {
          const lookupData = lookupSnap.data();
          if (lookupData.bizId === bizId && lookupData.staffId === sDoc.id) {
            await lookupRef.delete();
          }
        }
      }
    }

    // 2. Managers
    const managersSnap = await db.collection('businesses').doc(bizId).collection('managers').get();
    for (const mDoc of managersSnap.docs) {
      const data = mDoc.data();
      if (data.password) {
        const passwordHash = bcrypt.hashSync(String(data.password), 10);
        await mDoc.ref.update({
          passwordHash,
          password: admin.firestore.FieldValue.delete(),
          updatedAt: new Date().toISOString()
        });
        migratedManagersCount++;
      }
    }
  }

  return {
    success: true,
    migratedStaffCount,
    migratedManagersCount,
    migratedGlobalDriversCount: 0
  };
});

/**
 * purgeLegacyDriverDocs
 * Admin-only callable that deletes all global_features documents whose ID starts with "driver_auth_" or "driver_manifest_"
 */
exports.purgeLegacyDriverDocs = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Admin authentication required.');
  }

  const callerEmail = (request.auth.token && request.auth.token.email ? request.auth.token.email.toLowerCase().trim() : '');
  const isSuperAdminEmail = ['cosvynsolutions@gmail.com', 'admin@scalekitchen.in', 'memosmy10@gmail.com'].includes(callerEmail) && 
                            request.auth.token && request.auth.token.email_verified === true;
  const isAdmin = (request.auth.token && request.auth.token.admin === true) || isSuperAdminEmail;

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Only designated system admins can purge legacy driver docs.');
  }

  const db = admin.firestore();
  let deletedCount = 0;

  const globalSnap = await db.collection('global_features').get();
  const batch = db.batch();
  let batchOps = 0;

  for (const docSnap of globalSnap.docs) {
    const id = docSnap.id;
    if (id.startsWith('driver_auth_') || id.startsWith('driver_manifest_')) {
      batch.delete(docSnap.ref);
      batchOps++;
      deletedCount++;

      if (batchOps >= 400) {
        await batch.commit();
        batchOps = 0;
      }
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  return {
    success: true,
    deletedCount
  };
});

/**
 * migrateDriverManifests (Phase 2)
 * Admin-only callable that non-destructively copies legacy shared global_features driver data
 * into per-tenant subcollections (businesses/{bizId}/driver_manifest/{staffId}, etc.)
 */
exports.migrateDriverManifests = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  const callerEmail = (request.auth?.token?.email || '').toLowerCase();
  const isAdminUser = request.auth?.token?.admin === true || 
    (request.auth?.token?.email_verified === true && [
      'cosvynsolutions@gmail.com',
      'admin@scalekitchen.in',
      'memosmy10@gmail.com'
    ].includes(callerEmail));

  if (!callerUid || !isAdminUser) {
    throw new HttpsError('permission-denied', 'Only Super Admins can execute Phase 2 data migration.');
  }

  const db = admin.firestore();
  let copiedManifests = 0;
  let copiedStatuses = 0;
  let copiedLogs = 0;

  const globalSnap = await db.collection('global_features').get();
  for (const gDoc of globalSnap.docs) {
    const docId = gDoc.id;
    const data = gDoc.data();

    // 1. Manifest
    if (docId.startsWith('driver_manifest_')) {
      const bizId = docId.replace('driver_manifest_', '');
      if (bizId) {
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'object' && value !== null) {
            const staffId = value.staffId || value.boyId || value.id || key;
            await db.collection('businesses').doc(bizId)
              .collection('driver_manifest').doc(staffId)
              .set({
                ...value,
                bizId,
                staffId,
                migratedFromGlobal: true,
                migratedAt: admin.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            copiedManifests++;
          }
        }
      }
    }

    // 2. Status
    if (docId.startsWith('driver_status_')) {
      const parts = docId.replace('driver_status_', '').split('_');
      const bizId = parts[0];
      const staffId = parts.slice(1).join('_');
      if (bizId && staffId) {
        await db.collection('businesses').doc(bizId)
          .collection('driver_status').doc(staffId)
          .set({
            ...data,
            bizId,
            staffId,
            migratedFromGlobal: true,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        copiedStatuses++;
      }
    }

    // 3. Logs
    if (docId.startsWith('driver_logs_')) {
      const parts = docId.replace('driver_logs_', '').split('_');
      const bizId = parts[0];
      const date = parts.slice(1).join('_');
      if (bizId) {
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'object' && value !== null) {
            const logId = value.id || `${date}_${key}`;
            await db.collection('businesses').doc(bizId)
              .collection('delivery_logs').doc(logId)
              .set({
                ...value,
                bizId,
                date: value.date || date,
                migratedFromGlobal: true,
                migratedAt: admin.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            copiedLogs++;
          }
        }
      }
    }
  }

  return {
    success: true,
    copiedManifests,
    copiedStatuses,
    copiedLogs
  };
});

/**
 * claimFreeTrial (Phase 2)
 * Server-authoritative activation of the 14-day free trial.
 * Prevents client-side manipulation of plan fields or trial_claims documents.
 */
exports.claimFreeTrial = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to claim free trial.');
  }

  const { bizId, mobile, email } = request.data || {};
  const targetBizId = bizId || callerUid;

  if (targetBizId !== callerUid && !request.auth?.token?.admin) {
    throw new HttpsError('permission-denied', 'You can only claim free trial for your own business account.');
  }

  const db = admin.firestore();
  const bizRef = db.collection('businesses').doc(targetBizId);
  const bizSnap = await bizRef.get();

  if (!bizSnap.exists) {
    throw new HttpsError('not-found', 'Business profile not found.');
  }

  const bizData = bizSnap.data();
  if (bizData.trialClaimed === true || bizData.planStatus === 'Active') {
    throw new HttpsError('already-exists', 'Free trial has already been claimed for this business account.');
  }

  const normPhone = String(mobile || bizData.mobile || '').replace(/\D/g, '').slice(-10);
  const normEmail = String(email || bizData.email || request.auth?.token?.email || '').trim().toLowerCase();

  // Check trial_claims documents
  const checks = [
    db.collection('trial_claims').doc(`user_${targetBizId}`).get()
  ];
  if (normPhone && normPhone.length === 10) {
    checks.push(db.collection('trial_claims').doc(`phone_${normPhone}`).get());
  }
  if (normEmail && normEmail.includes('@')) {
    checks.push(db.collection('trial_claims').doc(`email_${normEmail}`).get());
  }

  const results = await Promise.all(checks);
  for (const snap of results) {
    if (snap.exists) {
      throw new HttpsError(
        'already-exists',
        'Free trial has already been claimed using this account, phone number, or email address.'
      );
    }
  }

  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 14);
  const expiryIso = expiryDate.toISOString().split('T')[0];

  const claimRecord = {
    userId: targetBizId,
    email: normEmail,
    mobile: normPhone,
    claimedAt: now.toISOString(),
    expiryDate: expiryIso,
    durationDays: 14
  };

  const batch = db.batch();
  batch.set(db.collection('trial_claims').doc(`user_${targetBizId}`), claimRecord);
  if (normPhone && normPhone.length === 10) {
    batch.set(db.collection('trial_claims').doc(`phone_${normPhone}`), claimRecord);
  }
  if (normEmail && normEmail.includes('@')) {
    batch.set(db.collection('trial_claims').doc(`email_${normEmail}`), claimRecord);
  }

  batch.update(bizRef, {
    planName: 'Free Trial',
    planStatus: 'Active',
    planExpiryDate: expiryIso,
    trialClaimed: true,
    trialStartDate: now.toISOString(),
    trialDurationDays: 14,
    updatedAt: now.toISOString()
  });

  await batch.commit();

  return {
    success: true,
    planName: 'Free Trial',
    planStatus: 'Active',
    planExpiryDate: expiryIso
  };
});

/**
 * deleteDriver (Phase 2 & 3)
 * Server-authoritative driver deletion that removes credentials, lookup, and status records.
 */
exports.deleteDriver = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  const { bizId, staffId, phone } = request.data || {};

  if (!callerUid || (callerUid !== bizId && !request.auth?.token?.admin)) {
    throw new HttpsError('permission-denied', 'Only the business owner or admin can delete drivers.');
  }

  const db = admin.firestore();
  let cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  let cleanEmail = '';
  let authUid = '';

  // Retrieve staff info before deletion
  if (bizId && staffId) {
    try {
      const sSnap = await db.collection('businesses').doc(bizId).collection('staff').doc(staffId).get();
      if (sSnap.exists) {
        const sData = sSnap.data();
        if (!cleanPhone && sData.mobile) {
          cleanPhone = String(sData.mobile).replace(/\D/g, '').slice(-10);
        }
        if (sData.email) {
          cleanEmail = String(sData.email).trim().toLowerCase();
        }
        if (sData.authUid) {
          authUid = sData.authUid;
        }
      }
    } catch (e) {}
  }

  // 1. Delete Firebase Auth User & Driver Profile
  if (authUid) {
    await admin.auth().deleteUser(authUid).catch(() => {});
    await db.collection('driver_profiles').doc(authUid).delete().catch(() => {});
  } else if (cleanEmail) {
    try {
      const u = await admin.auth().getUserByEmail(cleanEmail);
      if (u) {
        await admin.auth().deleteUser(u.uid).catch(() => {});
        await db.collection('driver_profiles').doc(u.uid).delete().catch(() => {});
      }
    } catch (e) {}
  }

  // 2. Delete Email lookup
  if (cleanEmail) {
    await db.collection('driver_auth_lookup_email').doc(cleanEmail).delete().catch(() => {});
  }

  // 3. Delete Phone lookup (legacy)
  if (cleanPhone) {
    await db.collection('driver_auth_lookup').doc(cleanPhone).delete().catch(() => {});
    await db.collection('global_features').doc(`driver_auth_${cleanPhone}`).delete().catch(() => {});
  }

  // 4. Delete tenant-scoped records
  if (bizId && staffId) {
    await db.collection('businesses').doc(bizId).collection('staff').doc(staffId).delete().catch(() => {});
    await db.collection('businesses').doc(bizId).collection('staff_credentials').doc(staffId).delete().catch(() => {});
    await db.collection('businesses').doc(bizId).collection('driver_manifest').doc(staffId).delete().catch(() => {});
    await db.collection('businesses').doc(bizId).collection('driver_status').doc(staffId).delete().catch(() => {});
  }

  return { success: true };
});

/**
 * ============================================================================
 * PHASE 3: SERVER-SIDE PAYMENTS, WEBHOOK IDEMPOTENCY & GEMINI AI SECRETS
 * ============================================================================
 */

// Authoritative Server-Side Plan Definitions (Prices strictly in integer paise)
const SERVER_SAAS_PLANS = {
  'monthly': { id: 'Monthly', label: 'Monthly', pricePaise: 99900, durationMonths: 1, type: 'subscription' },
  '6 months': { id: '6 Months', label: '6 Months', pricePaise: 509900, durationMonths: 6, type: 'subscription' },
  '6months': { id: '6 Months', label: '6 Months', pricePaise: 509900, durationMonths: 6, type: 'subscription' },
  'yearly': { id: 'Yearly', label: 'Yearly', pricePaise: 959900, durationMonths: 12, type: 'subscription' },
  // Invoice Recharge Packs
  'mini': { id: 'mini', label: 'Mini Invoice Pack', pricePaise: 1000, count: 1, type: 'invoice_recharge' },
  'saver': { id: 'saver', label: 'Saver Invoice Pack', pricePaise: 1500, count: 2, type: 'invoice_recharge' },
  'value': { id: 'value', label: 'Value Invoice Pack', pricePaise: 2500, count: 5, type: 'invoice_recharge' },
  'smart': { id: 'smart', label: 'Smart Invoice Pack', pricePaise: 4000, count: 10, type: 'invoice_recharge' },
  'pro': { id: 'pro', label: 'Pro Saver Invoice Pack', pricePaise: 6000, count: 20, type: 'invoice_recharge' },
  'ultimate': { id: 'ultimate', label: 'Ultimate Invoice Pack', pricePaise: 10000, count: 50, type: 'invoice_recharge' }
};

/**
 * Computes authoritative plan details and discounts on the server.
 * NEVER trusts client-submitted prices.
 */
async function getServerPlanDetails(planId) {
  const normalized = String(planId || '').trim().toLowerCase();
  if (normalized === 'freetrial' || normalized === 'free trial') {
    throw new HttpsError('invalid-argument', 'Free trial does not require Razorpay order. Use claimFreeTrial instead.');
  }

  const db = admin.firestore();
  let basePlan = null;
  let offer = null;

  // 1. Check real-time dynamic plans in global_settings/saas_config
  try {
    const configSnap = await db.collection('global_settings').doc('saas_config').get();
    if (configSnap.exists) {
      const configData = configSnap.data();
      const dbPlans = configData.plans || [];
      offer = configData.offer;

      const matched = dbPlans.find(p => 
        String(p.id).toLowerCase() === normalized ||
        (p.label && p.label.toLowerCase() === normalized) ||
        (p.durationMonths && `${p.durationMonths} months` === normalized)
      );

      if (matched) {
        basePlan = {
          id: matched.id,
          label: matched.label,
          pricePaise: Math.round(Number(matched.price) * 100),
          durationMonths: Number(matched.durationMonths) || 1,
          type: 'subscription'
        };
      }
    }
  } catch (e) {
    console.warn('[Razorpay] saas_config fetch notice:', e.message);
  }

  // 2. Fallback to static server list if not in dynamic config
  if (!basePlan) {
    basePlan = SERVER_SAAS_PLANS[normalized];
  }

  if (!basePlan) {
    throw new HttpsError('not-found', `Unknown plan: '${planId}'.`);
  }

  let pricePaise = basePlan.pricePaise;
  let appliedDiscountPercent = 0;

  // Apply offer discount if active
  if (offer && offer.isActive && offer.discountPercent > 0 && basePlan.type === 'subscription') {
    const endsAt = offer.endsAt ? new Date(offer.endsAt) : null;
    if (!endsAt || new Date() < endsAt) {
      appliedDiscountPercent = Math.min(100, Math.max(0, Number(offer.discountPercent)));
      const discountAmountPaise = Math.round((pricePaise * appliedDiscountPercent) / 100);
      pricePaise = Math.max(100, pricePaise - discountAmountPaise);
    }
  }

  return {
    ...basePlan,
    finalPricePaise: pricePaise,
    discountPercent: appliedDiscountPercent
  };
}

/**
 * Server-authoritative payment fulfillment logic.
 * Enforces strict idempotency via unique paymentId documents in `processed_payments`.
 * Only this function writes planName, planStatus, planExpiryDate, lastPaymentId and billing_history.
 */
async function fulfillPayment(paymentId, orderId, bizIdHint, paymentAmountPaiseHint) {
  const db = admin.firestore();
  const processedRef = db.collection('processed_payments').doc(paymentId);

  // 1. Idempotency Check: prevent replay attacks from extending plans twice
  const processedSnap = await processedRef.get();
  if (processedSnap.exists && processedSnap.data().status === 'fulfilled') {
    console.log(`[Fulfillment] Payment ${paymentId} already fulfilled. Skipping.`);
    return {
      success: true,
      alreadyProcessed: true,
      planExpiryDate: processedSnap.data().planExpiryDate || null
    };
  }

  // 2. Fetch order document
  let order = null;
  if (orderId) {
    const orderSnap = await db.collection('orders').doc(orderId).get();
    if (orderSnap.exists) {
      order = orderSnap.data();
    }
  }

  const targetBizId = order?.bizId || bizIdHint;
  if (!targetBizId) {
    throw new HttpsError('not-found', 'Could not identify target business account for this payment.');
  }

  const planType = order?.type || 'subscription';
  const durationMonths = order?.durationMonths || 1;
  const planLabel = order?.planLabel || order?.planId || 'Monthly';
  const amountPaise = order?.amountPaise || paymentAmountPaiseHint || 0;
  const amountRupees = amountPaise > 0 ? (amountPaise / 100) : 0;

  // 3. Fetch current business data
  const bizRef = db.collection('businesses').doc(targetBizId);
  const bizSnap = await bizRef.get();
  if (!bizSnap.exists) {
    throw new HttpsError('not-found', `Business profile '${targetBizId}' not found.`);
  }
  const bizData = bizSnap.data();

  const todayStr = new Date().toISOString().split('T')[0];
  let newExpiryDate = null;
  const batch = db.batch();

  if (planType === 'subscription') {
    // Server computes expiry: extend from current expiry if valid and future, else from today
    let baseDate = new Date();
    if (bizData.planExpiryDate && bizData.planExpiryDate >= todayStr) {
      baseDate = new Date(bizData.planExpiryDate);
    }
    baseDate.setMonth(baseDate.getMonth() + durationMonths);
    newExpiryDate = baseDate.toISOString().split('T')[0];

    // Strictly server-written fields
    batch.update(bizRef, {
      planName: `COSVYN ONE (${planLabel})`,
      planStatus: 'Active',
      planExpiryDate: newExpiryDate,
      lastPaymentId: paymentId,
      updatedAt: new Date().toISOString()
    });

    // Record to billing_history subcollection with integer paise
    const historyRef = bizRef.collection('billing_history').doc(paymentId);
    batch.set(historyRef, {
      amount: amountRupees,    // Legacy Rupee amount for backward compatibility
      amountPaise: amountPaise, // NEW integer paise
      currency: 'INR',
      date: new Date().toISOString(),
      planName: `COSVYN ONE (${planLabel})`,
      paymentId: paymentId,
      orderId: orderId || null,
      expiryDate: newExpiryDate,
      type: 'Subscription',
      status: 'Paid'
    });
  } else if (planType === 'invoice_recharge') {
    const creditsToAdd = order?.invoiceCredits || 1;
    const currentCredits = Number(bizData.purchasedInvoiceCredits) || 0;
    const newCredits = currentCredits + creditsToAdd;

    batch.update(bizRef, {
      purchasedInvoiceCredits: newCredits,
      lastPaymentId: paymentId,
      updatedAt: new Date().toISOString()
    });

    const historyRef = bizRef.collection('billing_history').doc(paymentId);
    batch.set(historyRef, {
      amount: amountRupees,
      amountPaise: amountPaise,
      currency: 'INR',
      date: new Date().toISOString(),
      planName: `Invoice Recharge (${planLabel})`,
      paymentId: paymentId,
      orderId: orderId || null,
      type: 'Invoice Recharge',
      status: 'Paid'
    });
  }

  // Mark payment as fulfilled to guarantee idempotency
  batch.set(processedRef, {
    paymentId,
    orderId: orderId || null,
    bizId: targetBizId,
    amountPaise: amountPaise,
    status: 'fulfilled',
    planExpiryDate: newExpiryDate,
    fulfilledAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (orderId) {
    batch.update(db.collection('orders').doc(orderId), {
      status: 'paid',
      paymentId: paymentId,
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  await batch.commit();

  console.log(`[Fulfillment] Payment ${paymentId} successfully fulfilled for ${targetBizId}. New Expiry: ${newExpiryDate}`);

  return {
    success: true,
    planExpiryDate: newExpiryDate,
    planStatus: 'Active'
  };
}

/**
 * createRazorpayOrder (Phase 3)
 * Callable that reads the price strictly from the server-side plan list,
 * creates the order via the Razorpay API using secrets from Secret Manager,
 * and returns order_id.
 */
exports.createRazorpayOrder = onCall({
  cors: true,
  secrets: [razorpayKeySecret, razorpayKeyId]
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to create payment orders.');
  }

  const { planId } = request.data || {};
  if (!planId) {
    throw new HttpsError('invalid-argument', 'planId is required.');
  }

  // Server calculates price from authoritative server list (NEVER from client)
  const plan = await getServerPlanDetails(planId);
  const pricePaise = plan.finalPricePaise;

  // Retrieve secrets from Secret Manager or environment
  let keySecret = '';
  try { keySecret = razorpayKeySecret.value(); } catch (e) { keySecret = process.env.RAZORPAY_KEY_SECRET || ''; }
  let keyId = '';
  try { keyId = razorpayKeyId.value(); } catch (e) { keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_SXPy6QPmqMyjkM'; }

  if (!keySecret) keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId) keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_SXPy6QPmqMyjkM';

  const receipt = `rcpt_${callerUid.slice(0, 8)}_${Date.now()}`;
  let orderId = '';

  if (keySecret && keyId && !keyId.includes('placeholder')) {
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const resp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: pricePaise,
        currency: 'INR',
        receipt: receipt,
        notes: {
          bizId: callerUid,
          planId: plan.id,
          planLabel: plan.label,
          durationMonths: String(plan.durationMonths || 0),
          type: plan.type
        }
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[Razorpay Order Error]:', resp.status, errText);
      throw new HttpsError('internal', `Failed to create Razorpay order: ${resp.statusText}`);
    }

    const orderData = await resp.json();
    orderId = orderData.id;
  } else {
    console.warn('[Razorpay] Using test simulated order (set RAZORPAY_KEY_SECRET in Secret Manager for live/test API)');
    orderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  // Persist unfulfilled order in Firestore
  const db = admin.firestore();
  await db.collection('orders').doc(orderId).set({
    orderId: orderId,
    bizId: callerUid,
    planId: plan.id,
    planLabel: plan.label,
    amountPaise: pricePaise, // Stored as integer paise in all NEW records
    amount: pricePaise / 100, // Legacy rupee field
    currency: 'INR',
    durationMonths: plan.durationMonths || 0,
    invoiceCredits: plan.count || 0,
    type: plan.type,
    status: 'created',
    receipt: receipt,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    orderId,
    amount: pricePaise,
    currency: 'INR',
    keyId: keyId || 'rzp_test_SXPy6QPmqMyjkM',
    planName: plan.label
  };
});

/**
 * verifyRazorpayPayment (Phase 3)
 * Callable that verifies razorpay_signature using RAZORPAY_KEY_SECRET,
 * and updates planName, planStatus, planExpiryDate, lastPaymentId and billing_history.
 */
exports.verifyRazorpayPayment = onCall({
  cors: true,
  secrets: [razorpayKeySecret]
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to verify payments.');
  }

  const { orderId, paymentId, signature } = request.data || {};
  if (!paymentId) {
    throw new HttpsError('invalid-argument', 'paymentId is required.');
  }

  let keySecret = '';
  try { keySecret = razorpayKeySecret.value(); } catch (e) { keySecret = process.env.RAZORPAY_KEY_SECRET || ''; }
  if (!keySecret) keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  // Verify HMAC SHA256 signature if orderId & signature are provided
  if (signature && orderId && keySecret) {
    const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    if (expected !== signature) {
      throw new HttpsError('invalid-argument', 'Invalid Razorpay payment signature.');
    }
  } else if (!keySecret && signature) {
    console.warn('[Razorpay] No secret configured, skipping signature verification in test fallback.');
  }

  // Fulfill idempotently on the server
  const result = await fulfillPayment(paymentId, orderId, callerUid, null);
  return result;
});

/**
 * razorpayWebhook (Phase 3)
 * HTTPS function that verifies X-Razorpay-Signature using RAZORPAY_WEBHOOK_SECRET
 * and handles payment.captured idempotently (unique paymentId document).
 */
exports.razorpayWebhook = onRequest({
  secrets: [razorpayWebhookSecret, razorpayKeySecret]
}, async (req, res) => {
  let webhookSecret = '';
  try { webhookSecret = razorpayWebhookSecret.value(); } catch (e) { webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || ''; }
  if (!webhookSecret) webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

  if (webhookSecret && signature) {
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (signature !== expected) {
      console.error('[Razorpay Webhook] Invalid X-Razorpay-Signature.');
      return res.status(400).send('Invalid signature');
    }
  } else if (webhookSecret && !signature) {
    return res.status(400).send('Missing X-Razorpay-Signature header');
  }

  const eventData = req.body || {};
  const event = eventData.event;

  if (event === 'payment.captured') {
    const payment = eventData.payload?.payment?.entity;
    if (payment) {
      const paymentId = payment.id;
      const orderId = payment.order_id;
      const amountPaise = payment.amount;
      const bizId = payment.notes?.bizId;

      try {
        await fulfillPayment(paymentId, orderId, bizId, amountPaise);
        return res.status(200).json({ status: 'ok', paymentId });
      } catch (err) {
        console.error('[Razorpay Webhook] Fulfillment error:', err);
        return res.status(500).json({ error: err.message });
      }
    }
  }

  return res.status(200).json({ status: 'ignored', event });
});

/**
 * geminiGenerate (Phase 3)
 * Server-side callable for Gemini AI with user authentication and rate limiting.
 * Requires auth and keeps GEMINI_API_KEY secure in Secret Manager.
 */
exports.geminiGenerate = onCall({
  cors: true,
  secrets: [geminiApiKey]
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Authentication required to use AI features.');
  }

  const db = admin.firestore();
  const now = Date.now();
  const rateLimitRef = db.collection('gemini_rate_limits').doc(callerUid);

  // Rate limiting: max 15 requests per 60 seconds
  const rateLimitSnap = await rateLimitRef.get();
  let rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : { count: 0, windowStart: now };
  
  if (now - (rateLimitData.windowStart || 0) > 60000) {
    rateLimitData = { count: 1, windowStart: now };
  } else {
    if (rateLimitData.count >= 15) {
      throw new HttpsError('resource-exhausted', 'AI generation rate limit exceeded (max 15/min). Please try again in a minute.');
    }
    rateLimitData.count = (rateLimitData.count || 0) + 1;
  }
  await rateLimitRef.set(rateLimitData);

  let apiKey = '';
  try { apiKey = geminiApiKey.value(); } catch (e) { apiKey = process.env.GEMINI_API_KEY || ''; }
  if (!apiKey) apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret is not configured on the server.');
  }

  const { action, data, customerQuery } = request.data || {};

  let prompt = '';
  let model = 'gemini-2.5-flash';

  if (action === 'business_insights') {
    model = 'gemini-2.5-pro';
    const activeData = Array.isArray(data) ? data.filter(d => (d.value || 0) > 0 || (d.secondaryValue || 0) > 0) : [];
    if (activeData.length === 0) {
      return { text: "Gathering data to provide your first AI insight..." };
    }
    prompt = `Analyze the following monthly revenue (value) vs expenses (secondaryValue) data for a meal subscription business.\nData: ${JSON.stringify(activeData)}\n\nProvide a concise 3-bullet point summary of the financial health and 1 strategic recommendation for the kitchen owner. Keep it professional, encouraging, and brief. Use Lakhs/Rupees context.`;
  } else if (action === 'support_reply') {
    model = 'gemini-2.5-flash';
    prompt = `You are a helpful customer support agent for 'ScaleKitchen', a SaaS platform for tiffin services.\nDraft a polite, empathetic, and concise reply to the following kitchen owner query: "${customerQuery || ''}"`;
  } else {
    throw new HttpsError('invalid-argument', 'Invalid AI action. Must be business_insights or support_reply.');
  }

  // Server-side call to Gemini API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('[Gemini Server Error]:', resp.status, err);
    throw new HttpsError('internal', `Gemini API call failed with status ${resp.status}`);
  }

  const resJson = await resp.json();
  const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  return { text };
});

/**
 * verifyAdminAuth
 * Server-authoritative Super Admin verification callable.
 * Inspects user context, confirms admin custom claims or verified admin email,
 * and mints the { admin: true } claim if missing.
 */
exports.verifyAdminAuth = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Super Admin authentication required.');
  }

  const callerUid = request.auth.uid;
  const callerEmail = (request.auth.token && request.auth.token.email ? request.auth.token.email.toLowerCase().trim() : '');
  const emailVerified = request.auth.token && request.auth.token.email_verified === true;
  const hasAdminClaim = request.auth.token && request.auth.token.admin === true;

  const AUTHORIZED_ADMIN_EMAILS = [
    'cosvynsolutions@gmail.com',
    'admin@scalekitchen.in',
    'memosmy10@gmail.com'
  ];

  const isEmailAuthorized = emailVerified && AUTHORIZED_ADMIN_EMAILS.includes(callerEmail);

  if (!hasAdminClaim && !isEmailAuthorized) {
    throw new HttpsError('permission-denied', 'Access denied. You do not have Super Admin privileges.');
  }

  // If authorized by verified email but claim is missing, mint it using Admin SDK
  let claimUpdated = false;
  if (!hasAdminClaim && isEmailAuthorized) {
    try {
      const user = await admin.auth().getUser(callerUid);
      const existingClaims = user.customClaims || {};
      await admin.auth().setCustomUserClaims(callerUid, {
        ...existingClaims,
        admin: true
      });
      claimUpdated = true;
      console.log(`[AdminAuth] Successfully granted { admin: true } claim to ${callerEmail} (UID: ${callerUid})`);
    } catch (err) {
      console.error("[AdminAuth] Failed to set admin custom claim:", err);
    }
  }

  return {
    authorized: true,
    uid: callerUid,
    email: callerEmail,
    admin: true,
    claimUpdated
  };
});
