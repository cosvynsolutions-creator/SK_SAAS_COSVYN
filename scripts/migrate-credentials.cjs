/**
 * One-time Migration Script for ScaleKitchen Credentials
 * 
 * Hashes existing plaintext driver PINs and manager passwords in Firestore
 * into new `pinHash` and `passwordHash` fields WITHOUT deleting the original fields,
 * ensuring zero disruption and safe rollback capability.
 * 
 * Usage:
 *   node scripts/migrate-credentials.cjs
 */

const admin = require('./functions/node_modules/firebase-admin');
const bcrypt = require('./functions/node_modules/bcryptjs');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'subbussinesssaas'
  });
}

const db = admin.firestore();

async function runMigration() {
  console.log('--- ScaleKitchen Credential Migration Starting ---');
  let migratedStaff = 0;
  let migratedManagers = 0;
  let migratedGlobalDrivers = 0;

  try {
    // 1. Iterate businesses
    console.log('Querying businesses collection...');
    const businessesSnap = await db.collection('businesses').get();
    console.log(`Found ${businessesSnap.docs.length} business accounts.`);

    for (const bDoc of businessesSnap.docs) {
      const bizId = bDoc.id;

      // Staff PINs
      const staffSnap = await db.collection('businesses').doc(bizId).collection('staff').get();
      for (const sDoc of staffSnap.docs) {
        const data = sDoc.data();
        if (data.pin && !data.pinHash) {
          const pinHash = bcrypt.hashSync(String(data.pin).trim(), 10);
          await sDoc.ref.update({ 
            pinHash,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          migratedStaff++;
          console.log(`  [Staff Migrated] Biz: ${bizId}, Staff: ${sDoc.id} (${data.name || 'Driver'})`);
        }
      }

      // Manager Passwords
      const managersSnap = await db.collection('businesses').doc(bizId).collection('managers').get();
      for (const mDoc of managersSnap.docs) {
        const data = mDoc.data();
        if (data.password && !data.passwordHash) {
          const passwordHash = bcrypt.hashSync(String(data.password), 10);
          await mDoc.ref.update({ 
            passwordHash,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          migratedManagers++;
          console.log(`  [Manager Migrated] Biz: ${bizId}, Manager: ${mDoc.id} (${data.email})`);
        }
      }
    }

    // 2. Global directory
    console.log('Scanning global_features driver_auth records...');
    const globalSnap = await db.collection('global_features').get();
    for (const gDoc of globalSnap.docs) {
      if (gDoc.id.startsWith('driver_auth_')) {
        const data = gDoc.data();
        if (data.pin && !data.pinHash) {
          const pinHash = bcrypt.hashSync(String(data.pin).trim(), 10);
          await gDoc.ref.update({ 
            pinHash,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          migratedGlobalDrivers++;
          console.log(`  [Global Driver Auth Migrated] ${gDoc.id}`);
        }
      }
    }

    console.log('\n--- Migration Completed Successfully ---');
    console.log(`Total Staff PINs hashed: ${migratedStaff}`);
    console.log(`Total Manager Passwords hashed: ${migratedManagers}`);
    console.log(`Total Global Driver records hashed: ${migratedGlobalDrivers}`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration().then(() => {
  console.log('Done.');
  process.exit(0);
});
