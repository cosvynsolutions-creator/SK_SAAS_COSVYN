# ScaleKitchen Delivery Partner

The Delivery Partner app gives each rider access to their assigned branch route,
delivery status, reusable-box recollection, attendance, and location sharing.

## Sign in

Delivery partners sign in with the email address and password configured by
their kitchen owner in Owner Portal → Settings → Delivery Partners. The app
authenticates with Firebase and accepts identity only from Firebase custom
claims: `{ role: 'driver', bizId, staffId, branchId }`. Route information is
loaded for that authenticated staff account; URL parameters and browser storage
are not used as identity.

Forgot your password? Ask your kitchen owner to reset it. Authentication is
available only with the owner-provided email and password.

## Features

- Live assigned route, meal plan, and customer delivery details
- Delivery completion and reusable-box condition/recollection
- Punch in/out attendance and location updates during an active shift
- Offline Firestore persistence, with pending writes syncing when connectivity
  returns
- Installable PWA for adding the app to a phone's home screen

## Development

- `npm run dev --workspace=@scalekitchen/delivery`
- `npm run lint --workspace=@scalekitchen/delivery`
- `npm run build --workspace=@scalekitchen/delivery`

The delivery app uses the dedicated `ScaleKitchenDelivery` Firebase app instance.
Configure Firebase Auth email/password sign-in and deploy the required Firestore
rules and Cloud Functions before testing with real accounts.
