<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9d08b35e-dbb2-4138-8d71-868d4a1a9a0a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Delivery Partner App

Delivery partners sign in to [apps/delivery](./apps/delivery/README.md) using the
email address and password configured by the kitchen owner in Owner Portal >
Settings > Delivery Partners. Firebase custom claims
`{ role: 'driver', bizId, staffId, branchId }` are the only source of rider
identity. The app loads only that rider's route; it does not support URL/local
storage identity, PIN login, or a demo route.

If a rider forgets their password, the kitchen owner must reset it in the Owner
Portal. The app is designed for phone use and supports adding it to the home
screen as a PWA. Rider passwords are managed by Firebase Authentication, not
stored as readable Firestore fields. Legacy PIN data can be removed from Owner
Portal > Settings > Delivery Staff after deploying the updated Functions.

The Firebase Functions page must contain the delivery account/login functions
in `asia-south1` (Mumbai), matching this project's Firestore database region; a Vercel frontend build does not deploy Functions. Enable
Firebase Authentication email/password sign-in, authorize the rider
production hostname, and deploy both services from the repository root:

```powershell
firebase deploy --only functions --project subbussinesssaas
firebase deploy --only firestore:rules --project subbussinesssaas
```

Use the complete [`firestore.rules`](./firestore.rules) file in this repository
as the rules source of truth. See the [Delivery Partner setup and
troubleshooting guide](./apps/delivery/README.md) for deployment checks and
where to find detailed logs.

### Delivery partner manual verification

Use a real delivery account and a phone browser:

1. Sign in with the owner's email/password and verify the assigned rider and
   branch route load. Confirm an owner or manager account is rejected.
2. Punch in and verify attendance/status updates only after the save succeeds.
3. Deliver an order and verify its delivery log identifies the rider by
   `staffId` and `deliveryBoyId`.
4. Record a reusable-box condition and verify the delivery log and customer
   collection balance update.
5. Go offline, record a delivery, then restore connectivity and confirm the
   write syncs. Verify an unsuccessful write shows an error and retry action.
6. Deactivate the rider from Owner Portal and confirm the rider is signed out
   or blocked from restoring the session.
7. Use the browser's Add to Home Screen flow and verify the standalone app icon.
