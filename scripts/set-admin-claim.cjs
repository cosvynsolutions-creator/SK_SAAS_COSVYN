/**
 * ScaleKitchen Super Admin Custom Claim Provisioning Script
 * 
 * Sets { admin: true } custom user claim on specified Firebase user(s).
 * 
 * Usage:
 *   node scripts/set-admin-claim.cjs <userEmail_or_userUid>
 * Example:
 *   node scripts/set-admin-claim.cjs memosmy10@gmail.com
 */

const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'subbussinesssaas'
  });
}

const auth = admin.auth();

async function setAdminClaim(identifier) {
  if (!identifier) {
    console.error("Usage: node scripts/set-admin-claim.cjs <email_or_uid>");
    process.exit(1);
  }

  try {
    let userRecord;
    if (identifier.includes('@')) {
      console.log(`Looking up user by email: ${identifier}...`);
      userRecord = await auth.getUserByEmail(identifier.trim().toLowerCase());
    } else {
      console.log(`Looking up user by UID: ${identifier}...`);
      userRecord = await auth.getUser(identifier.trim());
    }

    console.log(`Found user: ${userRecord.email || userRecord.uid} (UID: ${userRecord.uid})`);
    const currentClaims = userRecord.customClaims || {};
    console.log("Current custom claims:", currentClaims);

    await auth.setCustomUserClaims(userRecord.uid, {
      ...currentClaims,
      admin: true
    });

    console.log(`SUCCESS: Custom claim { admin: true } granted to ${userRecord.email || userRecord.uid}.`);
    console.log("Note: The user must sign out and sign in again (or call getIdToken(true)) to refresh their token.");
  } catch (err) {
    console.error("Failed to set admin claim:", err.message || err);
    process.exit(1);
  }
}

const target = process.argv[2] || 'memosmy10@gmail.com';
setAdminClaim(target);
