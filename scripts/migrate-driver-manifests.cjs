/**
 * ScaleKitchen Non-Destructive Manifest & Status Migration Script (Phase 2)
 * 
 * Copies legacy shared documents from `global_features` into per-tenant,
 * per-driver subcollections:
 *   - global_features/driver_manifest_{bizId} -> businesses/{bizId}/driver_manifest/{staffId}
 *   - global_features/driver_status_{bizId}_{driverId} -> businesses/{bizId}/driver_status/{staffId}
 *   - global_features/driver_logs_{bizId}_{date} -> businesses/{bizId}/delivery_logs/{logId}
 * 
 * ABSOLUTE SAFETY RULE: COPIES ONLY, NEVER DELETES.
 */

const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'subbussinesssaas'
  });
}

const db = admin.firestore();

async function runDriverDataMigration() {
  console.log("=== ScaleKitchen Phase 2 Driver Data Migration Starting ===");
  let copiedManifests = 0;
  let copiedStatuses = 0;
  let copiedLogs = 0;

  try {
    const globalSnap = await db.collection('global_features').get();
    console.log(`Inspecting ${globalSnap.docs.length} documents in global_features...`);

    for (const gDoc of globalSnap.docs) {
      const docId = gDoc.id;
      const data = gDoc.data();

      // 1. Migrate driver_manifest_{bizId}
      if (docId.startsWith('driver_manifest_')) {
        const bizId = docId.replace('driver_manifest_', '');
        if (bizId) {
          // If manifest data contains individual driver maps or manifests:
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

      // 2. Migrate driver_status_{bizId}_{staffId}
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

      // 3. Migrate driver_logs_{bizId}_{date}
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

    console.log("=== Migration Summary ===");
    console.log(`Copied Manifests: ${copiedManifests}`);
    console.log(`Copied Driver Statuses: ${copiedStatuses}`);
    console.log(`Copied Delivery Logs: ${copiedLogs}`);
    console.log("Original global_features documents were preserved untouched (non-destructive).");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

runDriverDataMigration();
