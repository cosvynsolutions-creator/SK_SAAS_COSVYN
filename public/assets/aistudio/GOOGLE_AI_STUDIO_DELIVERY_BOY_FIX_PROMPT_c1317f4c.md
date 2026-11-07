# Fix Delivery Boy App: Secure Rider Login on Independent Phones

## The Problem

Delivery boy links work when the kitchen owner opens them on their own phone (where they are already signed in to Firebase), but **fail silently on riders' independent phones** with the error:
> "No delivery partner found matching mobile number 'XXXXXXXXXX'. Please verify that this mobile number is registered in your kitchen settings."

This is a critical issue because riders cannot log in on their own phones using the shared link—they can only access the app if they use the owner's Firebase login credentials, which defeats the security model.

## Root Cause

There are three bugs stacked together:

1. **Firestore rules don't match the code architecture:** The code tries to authenticate riders via a `driverLogin` Cloud Function that returns a custom Firebase token with claims `{ role: 'driver', bizId, staffId }`. But the published firestore.rules file has no rule for drivers; it only allows `request.auth.uid == userId`. A rider's custom token uid is `driver_{bizId}_{staffId}`, which never equals the business ID, so Firestore denies all reads.

2. **Browser fallbacks hide the real error:** When the first login attempt fails, the app tries 6 fallbacks that read Firestore directly (staff query, collection-group scan, etc.). These also fail because the rider's token doesn't have permission. The error message "No delivery partner found" suggests the number isn't registered, when really it's a permissions error.

3. **The rider directory may not be populated:** The `driver_auth_lookup` collection that stores hashed PINs is supposed to be written by the Cloud Function `setDriverPin` (server-side, secure). But in the current code, Settings.tsx tries to write it from the browser. Your published rules block this (`allow create, update: if true;` is a placeholder and not actually deployed as a rule). So the directory is empty.

## The Solution Architecture

### 1. Authentication Flow (What Should Happen)

```
RIDER'S PHONE (Independent device, not logged in)
    ↓
Rider enters phone number + 4-digit PIN
    ↓
Client calls driverLogin(phone, pin) Cloud Function
    ↓ [FUNCTION: Verify PIN against driver_auth_lookup, hash with bcrypt]
    ↓ [FUNCTION: Generate Firebase custom token with role='driver', bizId, staffId claims]
    ↓ [FUNCTION: Return token to client]
    ↓
Client: signInWithCustomToken(token)
    ↓ [Firebase creates authenticated session with custom claims]
    ↓
Firestore Rules check: isTenantDriver(bizId) = role is 'driver' AND bizId matches
    ↓ [PASS: Rules grant read/write access]
    ↓
Rider can now read: businesses/{bizId}/staff, customers, delivery_logs, etc.
Rider can write: delivery_logs, customers.boxCollections, driver_status, driver_manifest
```

### 2. Core Changes Needed

#### A. Firestore Rules (CRITICAL)

**Replace your current `firestore.rules` with the attached `firestore.rules.PRODUCTION`.**

Key changes:
- Add `isTenantDriver(bizId)` helper that checks custom token claims
- Allow drivers to read business data when `role == 'driver'` and `bizId` matches
- Allow drivers to write ONLY delivery-related fields (delivery_logs, location updates, box collections)
- Secure `driver_auth_lookup`: drivers can GET their own record, but LIST is forbidden (prevents enumeration)
- Block all client writes to `driver_auth_lookup`, `global_features`, orders, payments (Cloud Functions only)

#### B. Cloud Functions (MUST BE DEPLOYED)

Verify these functions exist and are deployed in Firebase:

1. **`driverLogin(phone, pin)`**
   - Takes 10-digit phone + 4-6 digit PIN
   - Looks up rider in `driver_auth_lookup` collection
   - Verifies PIN against `pinHash` (bcrypt)
   - **Returns custom Firebase token** with `{ role: 'driver', bizId, staffId, branchId }` claims
   - Enforces rate limiting: 5 failed attempts → 15 min lockout
   - **MUST be in your functions/index.js already—check that it compiles and deploys**

2. **`setDriverPin(bizId, staffId, phone, pin, name, branchId)`**
   - Owner calls this when creating/updating a rider
   - Hashes PIN with bcrypt (NEVER stores plaintext)
   - Writes to THREE places (for redundancy):
     - `/businesses/{bizId}/staff/{staffId}` (staff record)
     - `/driver_auth_lookup/{phone}` (lookup directory)
     - `/global_features/driver_auth_{phone}` (fallback lookup)
   - Uses Admin SDK so it bypasses rules
   - **MUST be in functions/index.js—verify it's there and deployed**

3. **`deleteDriver(bizId, staffId, phone)`**
   - Removes rider and cleans up all three locations above
   - **MUST be in functions/index.js—verify**

#### C. Client Code (pages/DriverPortal.tsx, pages/Settings.tsx)

**BEFORE deploying functions & rules, make these changes:**

1. **In pages/DriverPortal.tsx (handleVerifyPin function, ~line 1380):**
   - Remove the 6 fallback paths (lookupRef, staffQuery, collectionGroup, bizCollection scan, global_features)
   - Keep ONLY the driverLogin callable
   - If driverLogin fails, show the actual error message from the callable (don't hide it)
   - After successful login, call `signInWithCustomToken(auth, token)` to establish the session

2. **In pages/Settings.tsx (handleSaveStaff function, ~line 262):**
   - Remove this line: `await setDoc(doc(db, 'driver_auth_lookup', cleanPhone), payload, ...)`
   - Remove this line: `setDoc(doc(db, 'global_features', `driver_auth_${cleanPhone}`), ...)`
   - KEEP the call to `setDriverPinCallable(...)` 
   - These Cloud Function calls now handle all the writes securely server-side

3. **In components/ShareDriverLinkModal.tsx (~line 30, 77, 97):**
   - Remove all `setDoc` calls to `driver_auth_lookup` and `global_features`
   - Let the owner's admin panel (Settings) be the only place riders are registered

4. **Remove the fallback checks for `driver_auth_lookup`:**
   - Search for `driver_auth_lookup` in the entire codebase
   - Remove every client-side `getDoc` or `getDocs` that reads from it
   - This forces the app to use only the driverLogin callable, which is server-verified

#### D. Remove Plaintext PIN Storage

1. **In pages/Settings.tsx, staff form:**
   - The `pin` field is displayed in the UI when sharing a link
   - Change the Share modal to NOT show the PIN in plaintext
   - Instead, display only: "PIN: ••••" and let the owner share it via WhatsApp separately

2. **Remove `pin: cleanPin` from staff documents:**
   - Only `pinHash` should be stored
   - The owner doesn't need the plaintext PIN—they set it once, it's hashed, and riders use it to log in

### 3. Testing Checklist

Before going live:

1. **Deploy Cloud Functions:**
   ```bash
   cd functions
   firebase deploy --only functions
   ```
   Check the Firebase Console → Functions to confirm:
   - `driverLogin` is deployed
   - `setDriverPin` is deployed
   - `deleteDriver` is deployed

2. **Test the driverLogin function in Firebase Console:**
   - Go to Functions → driverLogin → Testing tab
   - Call with: `{ phone: "7702667567", pin: "1234" }`
   - Should return `{ token: "...", driver: { name, bizId, staffId, ... } }`

3. **Deploy the new Firestore rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```
   Verify in Firestore → Rules tab that the new rules are live

4. **Test rider login on a different browser/incognito:**
   - Use the shared link with `?auth=...&biz=...`
   - Or manually enter phone + PIN
   - Should successfully log in and see the delivery route

5. **Run the rules tests (verify no breakage):**
   ```bash
   npm run test:rules
   ```
   All tests should pass

### 4. Security Properties After Fix

✅ **Riders log in with phone + PIN only** (no owner credentials needed)
✅ **PINs are hashed with bcrypt** (not plaintext)
✅ **Firestore rules enforce tenant isolation** (rider can only access their business)
✅ **Rider can read their delivery route** (staff, customers, delivery_logs)
✅ **Rider can only write delivery updates** (not names, amounts, or customer data)
✅ **Driver auth lookup is protected** (GET only, no LIST to prevent enumeration)
✅ **Rate limiting prevents brute force** (5 failures → 15 min lockout)
✅ **Rider directory is server-managed** (only Cloud Functions can write)

### 5. Files to Change

| File | What to Do |
|---|---|
| `firestore.rules` | Replace with the attached `firestore.rules.PRODUCTION` |
| `functions/index.js` | Verify `driverLogin`, `setDriverPin`, `deleteDriver` are present and correct |
| `pages/DriverPortal.tsx` | Remove 6 fallback login methods, keep only driverLogin callable |
| `pages/Settings.tsx` | Remove `setDoc` to `driver_auth_lookup` and `global_features`, keep `setDriverPinCallable` |
| `components/ShareDriverLinkModal.tsx` | Remove `setDoc` writes to `driver_auth_lookup` |
| `services/firebase.ts` | No changes needed (driverLoginCallable already defined correctly) |

### 6. Rollout Plan

1. **Today:**
   - Update code in pages/DriverPortal.tsx, Settings.tsx, ShareDriverLinkModal.tsx (changes 2-4 above)
   - Deploy to staging/preview first
   - Run tests: `npm run test:rules`

2. **Verify functions are deployed:**
   - Run one test call to driverLogin in the Firebase Console
   - Confirm Cloud Functions logs show no errors

3. **Deploy new Firestore rules:**
   - `firebase deploy --only firestore:rules`
   - Wait 30 seconds for propagation

4. **Test on a real delivery boy's phone:**
   - Share a new link with a rider
   - Have them open it on their phone (not the owner's phone)
   - Enter their phone number + PIN
   - Should log in and see their route

5. **Monitor:**
   - Check Firebase Firestore → Rules tab for the new rules
   - Check Functions logs for any driverLogin errors
   - Ask riders for feedback

### 7. Expected Behavior After Fix

**Scenario: Owner shares delivery link with Suresh (7702667567, PIN 1234)**

Owner (in Settings) → Edit Staff → Suresh → PIN = 1234 → Save
↓ Calls setDriverPinCallable (server-side)
↓ Cloud Function hashes PIN, writes to driver_auth_lookup[7702667567], staff[sureshId], global_features/driver_auth_7702667567

Owner → Click "Share Link" → Copy WhatsApp link
↓ Link is: `https://scalekitchen.vercel.app/#/driver?biz=sFStrek0FtU5BI9...`
↓ (No PIN in URL—rider enters it manually)

Suresh opens link on his phone
↓ He sees login modal (he's not authenticated yet)
↓ Enters phone: 7702667567, PIN: 1234
↓ Clicks "Verify & Access Route"
↓ App calls driverLogin(7702667567, 1234)
↓ Cloud Function: looks up driver_auth_lookup[7702667567], verifies PIN with bcrypt
↓ Function returns custom token
↓ App calls signInWithCustomToken(token)
↓ Firestore rules check: isTenantDriver(bizId) ✓ PASS
↓ Suresh sees his delivery route, customers, boxes to collect
↓ He can update delivery status and collect boxes
✅ Success

---

## Summary

The delivery boy app is well-architected but has three bugs:
1. Rules don't match the custom token model
2. Browser code tries to do what Cloud Functions should do
3. Fallback code hides real errors

Fix them in this order:
1. Update code (remove browser writes, keep callable only)
2. Deploy Cloud Functions (driverLogin, setDriverPin, deleteDriver)
3. Deploy new rules (isTenantDriver helper + proper role checks)
4. Test with a real rider on their phone

After these changes, any rider with the link will be able to log in on any phone with their credentials, securely and without seeing the owner's data.
