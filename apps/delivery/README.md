# ScaleKitchen Delivery Partner

The Delivery Partner app is a separate phone-first web app. Each rider signs in
with an email and password managed by the kitchen owner. Firebase Auth and the
custom claims `{ role: 'driver', bizId, staffId, branchId }` determine the
account and route; the app does not use a phone/PIN login or URL identity.

## Delivery login and route incident: causes and fixes

The production failures were caused by backend configuration and route-selection
logic, not just by the rider's password:

1. **Login fallback and Owner Portal account saves returned
   `functions/internal`.** The `driverLogin` fallback searched the `staff`
   collection group by email, and account creation/update checked the
   `managers` collection group by email. Firestore had no collection-group
   email indexes, so those server queries failed with `FAILED_PRECONDITION`.
   The required `staff.email` and `managers.email` indexes are now defined in
   [`firestore.indexes.json`](../../firestore.indexes.json) and must be
   deployed with `firebase deploy --only firestore:indexes`.
2. **Editing a delivery partner could still fail after indexing was fixed.**
   The Admin Firestore SDK exposes `DocumentSnapshot.exists` as a boolean
   property. The update function mistakenly called it as `exists()`, causing
   `TypeError: oldLookupSnap.exists is not a function` when cleaning up an old
   email lookup. This is corrected in the deployed Mumbai function.
3. **Old US-region Functions remained after the first Mumbai deployment.**
   Firebase offered to delete the old `us-central1` copies; answering No kept
   both regions deployed. The old US Functions were subsequently deleted.
   The verified production inventory on 2026-11-08 lists all 22 Functions in
   `asia-south1`, including `driverLogin`, account-management callables, and
   `scheduledFirestoreExport`; no `us-central1` Functions were listed.
4. **The route could show a stop on a date with no scheduled delivery.** When
   no active plan matched the selected date, the Delivery app used to
   manufacture a fallback “Standard Meal” from the customer's meal label.
   A legacy per-driver manifest could also replace the live customer query.
   Both behaviors have been removed. The route now uses the live customer
   collection only and requires a customer to match the signed-in rider's
   `deliveryBoyId`, the rider's claimed `branchId`, and a plan active for the
   selected meal and date. Plan date range, weekdays, customer/plan pauses,
   and inactive-customer status are respected. An explicitly empty
   `activePlans` list means there is no active subscription; old flat plan
   fields do not revive one.
5. **Date/session selection could vary with device timezone.** The app now
   calculates the current date and meal session in `Asia/Kolkata`, and refreshes
   the date at midnight. Delivery logs are applied only for the current India
   date and matching rider, staff, and branch. Thus an ordinary Mon–Sat plan
   has no Sunday stop; if a customer has a Sunday stop, inspect that customer's
   saved plan weekdays and active plan dates in Owner Portal.

The rider identity is verified from Firebase custom claims. If the claims have
no branch assignment, the app signs out rather than loading an unscoped route.
The customer listener itself is constrained by both the claimed branch and
staff ID; the matching composite query index is also deployed from
`firestore.indexes.json`.

### Verify the live setup

From the repository root, confirm the deployed Functions inventory and ensure
each listed function is in `asia-south1`:

```powershell
firebase functions:list --project subbussinesssaas
```

In the Owner Portal, inspect the affected customer's branch, assigned delivery
partner, active plans, start/end dates, meal session, weekday selection, and
pause ranges. On a real phone, sign in as that rider and confirm a stop appears
only when all those values schedule a delivery for today's India date. Punch-in
and box collection are separate actions; they do not themselves create a meal
delivery stop.

## Required Firebase setup

The frontend build does not deploy Firebase services. The Functions page must
show `driverLogin`, `createDeliveryBoyAccount`, and
`updateDeliveryBoyAccount` in the `asia-south1` (Mumbai) region before rider sign-in or
owner credential changes can work.

From the repository root, after installing the Firebase CLI and signing in to
the correct Google account, deploy the collection-group indexes before the
Functions that query them:

```powershell
firebase deploy --only firestore:indexes --project subbussinesssaas
firebase deploy --only functions --project subbussinesssaas
firebase deploy --only firestore:rules --project subbussinesssaas
firebase functions:list --project subbussinesssaas
```

All Functions are configured for `asia-south1`. During a future region
migration, keep old functions until their callers are updated and tested, then
delete the old regional copies. If Razorpay webhooks are configured, update
their URL to
`https://asia-south1-subbussinesssaas.cloudfunctions.net/razorpayWebhook`.

Cloud Functions deployment requires the project to meet Firebase's billing and
API prerequisites. Do not replace Firestore rules with permissive test rules:
[`firestore.rules`](../../firestore.rules) is the repository's complete rules
file and should be deployed as a whole.

In Firebase Console:

1. Enable **Authentication → Sign-in method → Email/Password**.
2. Add the rider app's production hostname under **Authentication → Settings →
   Authorized domains**. Do not add a URL path.
3. Ensure the production app uses the same Firebase project shown above.
4. If the Vercel deployment redirects to a Vercel SSO page, make the rider
   production deployment publicly accessible. A protected preview deployment
   cannot serve its manifest to a phone browser.

## Create or migrate a rider login

In Owner Portal → Settings → Delivery Staff, create the partner with an email
and password, or edit the legacy staff record and enter a new password. A
legacy PIN-only Firestore staff record is not itself a Firebase login. Saving
the edited record calls a Cloud Function that creates/updates the Firebase Auth
user, assigns driver claims, and writes the staff/profile records. The dialog
closes only after that operation succeeds; otherwise it stays open and shows
the Firebase error code.

Passwords are stored by Firebase Authentication, not as readable Firestore
fields. Server-only `staff_credentials` may contain a password hash for the
legacy callable fallback, but must never contain a plaintext password or PIN.
After deploying Functions, use **Clean legacy PINs** on the Owner Portal
Delivery Staff section to remove old PIN fields, hashes, and lookup records for
that kitchen. That operation does not change email/password accounts.

## Troubleshooting and logs

- **Login shows `functions/internal`:** deploy the rider functions using the
  command above. Check that the callables are listed in `asia-south1`. Then
  check Firebase Console → Functions → Logs, or run:
  ```powershell
  firebase functions:log --only driverLogin --project subbussinesssaas
  ```
- **Owner save times out or shows `functions/unavailable`:** verify
  `createDeliveryBoyAccount` / `updateDeliveryBoyAccount` are deployed in
  `asia-south1`; then inspect their Functions logs. The dialog intentionally
  stays open when the server does not confirm the save.
- **Owner save or fallback login shows a Firestore `FAILED_PRECONDITION`:**
  deploy `firestore.indexes.json` with the command above and wait for the
  `staff` and `managers` collection-group email indexes to finish building.
- **Invalid credential / Auth 400:** confirm Email/Password is enabled, the
  owner saved a password for this rider, and the production host is an
  authorized domain. Firebase Auth passwords cannot be recovered from
  Firestore; the owner must set a new one.
- **`Cannot load route` or `permission-denied`:** check the browser console for
  the failing Firestore listener and deploy the repository's `firestore.rules`.
  Confirm the rider's staff record, active profile, branch assignment, and
  custom claims agree.
- **CORS error in browser console:** confirm `driverLogin` is deployed to
  `asia-south1`. A missing/unavailable callable cannot be fixed by changing
  rider credentials. If only the manifest request redirects to Vercel SSO,
  make the Vercel production deployment public.
- **Detailed client logs:** connect Android Chrome to desktop Chrome using
  `chrome://inspect`, or use Safari's Develop menu for iPhone. Look for
  `Delivery partner sign-in failed`, `Cannot load route`, `Could not punch in`,
  `Could not update delivery status`, `Could not save box status`, and
  `GPS location sync failed`. Record the error code and timestamp; never share
  passwords or ID tokens.

## Local development and validation

- `npm run dev --workspace=@scalekitchen/delivery`
- `npm run lint --workspace=@scalekitchen/delivery`
- `npm run build --workspace=@scalekitchen/delivery`

The app uses the `ScaleKitchenDelivery` Firebase app instance and Functions in
`asia-south1`, the same region as the production Firestore database. Firestore uses persistent local cache when available; pending
writes synchronize after connectivity returns.
