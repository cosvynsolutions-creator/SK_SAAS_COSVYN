# ScaleKitchen Delivery Partner

The Delivery Partner app is a separate phone-first web app. Each rider signs in
with an email and password managed by the kitchen owner. Firebase Auth and the
custom claims `{ role: 'driver', bizId, staffId, branchId }` determine the
account and route; the app does not use a phone/PIN login or URL identity.

## Required Firebase setup

The frontend build does not deploy Firebase services. The Functions page must
show `driverLogin`, `createDeliveryBoyAccount`, and
`updateDeliveryBoyAccount` in the `us-central1` region before rider sign-in or
owner credential changes can work.

From the repository root, after installing the Firebase CLI and signing in to
the correct Google account:

```powershell
firebase deploy --only functions --project subbussinesssaas
firebase deploy --only firestore:rules --project subbussinesssaas
firebase functions:list --project subbussinesssaas
```

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

- **Functions page is empty / login shows `functions/internal`:** deploy
  Functions using the commands above. Then check Firebase Console → Functions
  → Logs, or run:
  ```powershell
  firebase functions:log --only driverLogin --project subbussinesssaas
  ```
- **Owner save times out or shows `functions/unavailable`:** verify
  `createDeliveryBoyAccount` / `updateDeliveryBoyAccount` are deployed in
  `us-central1`; then inspect their Functions logs. The dialog intentionally
  stays open when the server does not confirm the save.
- **Invalid credential / Auth 400:** confirm Email/Password is enabled, the
  owner saved a password for this rider, and the production host is an
  authorized domain. Firebase Auth passwords cannot be recovered from
  Firestore; the owner must set a new one.
- **`Cannot load route` or `permission-denied`:** check the browser console for
  the failing Firestore listener and deploy the repository's `firestore.rules`.
  Confirm the rider's staff record, active profile, branch assignment, and
  custom claims agree.
- **CORS error in browser console:** confirm `driverLogin` is deployed to
  `us-central1`. A missing/unavailable callable cannot be fixed by changing
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
`us-central1`. Firestore uses persistent local cache when available; pending
writes synchronize after connectivity returns.
