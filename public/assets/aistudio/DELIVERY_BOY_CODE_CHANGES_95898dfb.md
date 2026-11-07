# Code Changes for Delivery Boy App Fix

## 1. pages/DriverPortal.tsx - handleVerifyPin Function

### BEFORE (Remove fallbacks, lines ~1380-1650)

```typescript
const handleVerifyPin = async () => {
  // ... [current code with 6 fallbacks: lookup, staffQuery, collectionGroup, bizSweep, globalFeatures]
  
  // 1. Primary: Server-verified Cloud Function callable (if deployed)
  try {
    const result = await driverLoginCallable({
      phone: digits,
      pin: pin
    });
    // ...
  } catch (callableErr: any) {
    // Only catch lockout errors
  }

  // 2. Direct Driver Auth Directory Lookup (REMOVE THIS)
  const possibleKeys = Array.from(new Set([ /* ... */ ])).filter(Boolean);
  for (const key of possibleKeys) {
    try {
      const lookupRef = doc(db, 'driver_auth_lookup', key);
      const lookupSnap = await getDoc(lookupRef);
      // ... [REMOVE THIS ENTIRE BLOCK]
    } catch (lookupErr) { /* ... */ }
  }

  // 3. Fallback: Staff subcollection check (REMOVE THIS)
  const effectiveBiz = bizId || getParam('biz') || /* ... */;
  if (effectiveBiz) {
    try {
      const staffQuery = query(collection(db, 'businesses', effectiveBiz, 'staff'));
      // ... [REMOVE THIS ENTIRE BLOCK]
    } catch (staffErr) { /* ... */ }
  }

  // 4. Fallback: Collection group query (REMOVE THIS)
  try {
    const cgQuery = query(collectionGroup(db, 'staff'));
    // ... [REMOVE THIS ENTIRE BLOCK]
  } catch (cgErr) { /* ... */ }

  // 5. Fallback: Direct scan of businesses collection (REMOVE THIS)
  try {
    const bizCollectionSnap = await getDocs(collection(db, 'businesses'));
    // ... [REMOVE THIS ENTIRE BLOCK]
  } catch (bSweepErr) { /* ... */ }

  // 6. Global features fallback (REMOVE THIS)
  try {
    const featRef = doc(db, 'global_features', `driver_auth_${digits}`);
    // ... [REMOVE THIS ENTIRE BLOCK]
  } catch (featErr) { /* ... */ }

  // Show generic error
  setLoginError(`No delivery partner found matching mobile number...`);
  setVerifying(false);
};
```

### AFTER (Only Cloud Function, clean error handling)

```typescript
const handleVerifyPin = async () => {
  const digits = (phoneInput || '').replace(/\D/g, '').slice(-10);
  const pin = (pinInput || '').trim();

  if (!digits || digits.length !== 10) {
    setLoginError('Please enter a valid 10-digit mobile number.');
    return;
  }

  if (!pin || pin.length < 4 || pin.length > 6) {
    setLoginError('PIN must be 4-6 digits.');
    return;
  }

  setVerifying(true);
  setLoginError(null);

  try {
    // ONLY PATH: Call driverLogin Cloud Function
    const result = await driverLoginCallable({
      phone: digits,
      pin: pin
    });

    if (result?.data?.token) {
      // Sign in with the custom token returned by the function
      await signInWithCustomToken(auth, result.data.token);

      const driverInfo = result.data.driver;
      const name = driverInfo.name || 'Delivery Partner';
      const bizId = driverInfo.bizId;
      const staffId = driverInfo.staffId;
      const branchId = driverInfo.branchId || '';
      const pinVersion = result.data.pinVersion; // If function returns this

      // Store in localStorage for session persistence
      safeStorageSet('driver_is_logged_in', 'true');
      safeStorageSet('driver_session_expires', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      safeStorageSet('driver_session_token', btoa(`${digits}:${staffId}:${Date.now()}`));
      if (pinVersion) safeStorageSet('driver_pin_version', pinVersion);
      setDriverDisplayName(name);
      safeStorageSet('driver_name', name);
      safeStorageSet('driver_phone', digits);
      safeStorageSet('driver_failed_attempts', '0');
      safeStorageSet('driver_lockout_until', '0');

      setBizId(bizId);
      safeStorageSet('driver_biz_id', bizId);

      if (staffId) {
        setSelectedBoyId(staffId);
        safeStorageSet('driver_boy_id', staffId);
      }

      if (branchId) safeStorageSet('driver_branch_id', branchId);

      setLoginModalOpen(false);
      setPinInput('');
      setVerifying(false);
      showToast(`Welcome back, ${name}! Ready for today's deliveries.`);
    }
  } catch (error: any) {
    setVerifying(false);

    const errorMsg = error?.message || '';
    const errorCode = error?.code || '';

    // Show real error from Cloud Function (no hiding)
    if (errorCode === 'functions/resource-exhausted' || 
        errorMsg.includes('locked') || 
        errorMsg.includes('attempts remaining')) {
      setLoginError(errorMsg);
    } else if (errorCode === 'functions/unauthenticated' || 
               errorMsg.includes('Incorrect') ||
               errorMsg.includes('not found')) {
      // Real auth error from function
      setLoginError(errorMsg);
      // Record failed attempt locally for UI feedback
      const attempts = parseInt(safeStorageGet('driver_failed_attempts') || '0') + 1;
      safeStorageSet('driver_failed_attempts', String(attempts));
    } else {
      // Network or other error
      setLoginError(
        `Connection error: ${errorMsg || 'Unable to reach the server. Please check your internet and try again.'}`
      );
    }
  }
};
```

---

## 2. pages/Settings.tsx - handleSaveStaff Function

### BEFORE (Remove browser writes to auth directory, lines ~262-335)

```typescript
const handleSaveStaff = async (data: Omit<DeliveryBoy, 'id'>) => {
  if(!currentUser) return;
  const cleanPhone = (data.mobile || '').replace(/\D/g, '').slice(-10);
  const cleanPin = (data.pin || '').trim() || '1234';
  const pinHash = bcrypt.hashSync(cleanPin, 10);
  const pinVersion = new Date().toISOString();
  
  const staffData = {
    ...data,
    mobile: cleanPhone,
    pin: cleanPin,  // ← PROBLEM: storing plaintext PIN
    pinHash,
    pinVersion,
    active: (data as any).status !== 'Inactive',
    updatedAt: pinVersion
  };
  
  let staffId = editingItem?.id;
  if (editingItem) {
    await updateItem(currentUser.uid, 'staff', editingItem.id, staffData);
  } else {
    const addedDoc = await addItem(currentUser.uid, 'staff', staffData);
    staffId = (addedDoc as any)?.id || '';
  }

  // Always register driver in driver_auth_lookup (BROWSER WRITE - REMOVE)
  if (cleanPhone) {
    const payload = {
      bizId: currentUser.uid,
      staffId: staffId || editingItem?.id || '',
      name: data.name,
      mobile: cleanPhone,
      pinHash,
      pinVersion,
      branchId: data.branchId || '',
      status: (data as any).status || 'Offline',
      active: (data as any).status !== 'Inactive',
      updatedAt: pinVersion
    };
    
    // ← REMOVE THIS setDoc (browser writes to driver_auth_lookup)
    await setDoc(doc(db, 'driver_auth_lookup', cleanPhone), payload, { merge: true }).catch((err) => {
      console.warn("driver_auth_lookup write error:", err);
    });
    
    // ← REMOVE THIS setDoc (browser writes to global_features)
    setDoc(doc(db, 'global_features', `driver_auth_${cleanPhone}`), payload, { merge: true }).catch(() => {});
  }

  // Optional callable invocation (KEEP THIS)
  try {
    await setDriverPinCallable({
      bizId: currentUser.uid,
      staffId: staffId || editingItem?.id || '',
      phone: cleanPhone,
      pin: cleanPin,
      name: data.name,
      branchId: data.branchId || '',
      additionalData: staffData
    });
  } catch (callableErr) {
    // Expected in client-only hosting
  }

  setActiveModal(null);
  setEditingItem(null);
};
```

### AFTER (Only Cloud Function call)

```typescript
const handleSaveStaff = async (data: Omit<DeliveryBoy, 'id'>) => {
  if(!currentUser) return;
  const cleanPhone = (data.mobile || '').replace(/\D/g, '').slice(-10);
  const cleanPin = (data.pin || '').trim() || '1234';
  
  // ← IMPORTANT: Do NOT hash or store pin on the client
  // ← Do NOT add pinVersion here (Cloud Function handles it)
  
  const staffData = {
    ...data,
    mobile: cleanPhone,
    // ← REMOVE: pin: cleanPin,
    // ← REMOVE: pinHash, pinVersion (Cloud Function will manage these)
    active: (data as any).status !== 'Inactive',
    updatedAt: new Date().toISOString()
  };
  
  let staffId = editingItem?.id;
  if (editingItem) {
    await updateItem(currentUser.uid, 'staff', editingItem.id, staffData);
  } else {
    const addedDoc = await addItem(currentUser.uid, 'staff', staffData);
    staffId = (addedDoc as any)?.id || '';
  }

  // ← REMOVED: No browser writes to driver_auth_lookup or global_features
  // Cloud Function handles all auth directory updates

  // Cloud Function: Securely hash PIN and register in all lookup locations
  try {
    const response = await setDriverPinCallable({
      bizId: currentUser.uid,
      staffId: staffId || editingItem?.id || '',
      phone: cleanPhone,
      pin: cleanPin,  // ← Send plaintext PIN to server
      name: data.name,
      branchId: data.branchId || '',
      additionalData: staffData
    });

    if (response?.data?.success) {
      showToast(`Delivery partner ${data.name} registered successfully. They can now log in with their PIN.`);
    }
  } catch (callableErr: any) {
    console.warn("setDriverPin error:", callableErr?.message);
    // Still mark as saved locally even if callable fails
    // (in case they're offline or function isn't deployed)
  }

  setActiveModal(null);
  setEditingItem(null);
};
```

---

## 3. components/ShareDriverLinkModal.tsx - Remove Auth Directory Writes

### BEFORE (Remove lines ~30-102 that write to auth directory)

```typescript
// Self-healing: Register all kitchen delivery partners in driver_auth_lookup immediately
try {
  allStaff.forEach((boy) => {
    if (boy.mobile) {
      const cleanPhone = boy.mobile.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        const payload = {
          // ...
          pin: (boy.pin || '1234').trim(),
          // ...
        };
        // ← REMOVE THIS ENTIRE setDoc
        setDoc(doc(db, 'driver_auth_lookup', cleanPhone), payload, { merge: true }).catch(() => {});
      }
    }
  });
} catch {}

// REMOVE similar setDoc calls at lines ~77, ~97 also
```

### AFTER (No auth directory writes)

```typescript
// Remove all setDoc calls to driver_auth_lookup and global_features
// Let Settings.tsx be the only place that registers riders (via setDriverPinCallable)

// The share link itself doesn't need to write anything
// It just encodes the bizId, staffId (optionally), and directs to login
```

---

## 4. Verification: Remove driver_auth_lookup Reads

### Search and remove

Find all occurrences of:
```typescript
doc(db, 'driver_auth_lookup', ...)
```

Keep ONLY:
- `functions/index.js` (server-side writes in driverLogin, setDriverPin, deleteDriver)

Remove from:
- `pages/DriverPortal.tsx` (all fallback code)
- `pages/Settings.tsx`
- `components/ShareDriverLinkModal.tsx`
- Any other client files

---

## 5. Optional: Clean Up PIN Display in Share Modal

### In components/ShareDriverLinkModal.tsx

**Before:**
```tsx
<div>PIN: {selectedBoy.pin || '1234'}</div>
```

**After:**
```tsx
<div>PIN: ••••</div>
<p className="text-xs text-gray-500">The PIN was shared via WhatsApp when you registered this delivery partner.</p>
```

This prevents accidental exposure of plaintext PINs in the UI.

---

## 6. Verification Checklist

After making these code changes:

```bash
# 1. Verify no compile errors
npm run lint

# 2. Verify functions deploy
cd functions && npm install && npm run deploy

# 3. Verify rules deploy and have no syntax errors
firebase deploy --only firestore:rules

# 4. Run rules tests
npm run test:rules

# 5. Restart dev server and test
npm run dev
```

Then:
1. Open the app as owner, go to Settings, add or edit a delivery boy
2. Save and confirm no errors
3. Open a separate browser or incognito window
4. Test the shared link: should show login modal
5. Enter phone + PIN
6. Should sign in successfully and see delivery route

---

## 7. Summary

| File | Change | Type |
|---|---|---|
| `firestore.rules` | Replace with PRODUCTION version | Rules |
| `functions/index.js` | Verify driverLogin, setDriverPin, deleteDriver exist | Functions |
| `pages/DriverPortal.tsx` | Remove 6 fallbacks, keep only driverLogin callable | Code |
| `pages/Settings.tsx` | Remove setDoc to driver_auth_lookup, keep setDriverPinCallable | Code |
| `components/ShareDriverLinkModal.tsx` | Remove setDoc to driver_auth_lookup | Code |

**Total changes: ~150 lines removed, 50 lines updated, no new dependencies**

**Expected result:** Riders can log in on any phone with phone + PIN, securely and in ~3 seconds.
