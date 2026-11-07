# @scalekitchen/delivery

Independent Delivery Partner (Rider) web application for ScaleKitchen.

## Overview
This application provides the mobile portal used by delivery riders for daily meal dispatches:
- 10-digit mobile number + 4-digit PIN authentication verified via `driverLogin` Firebase Cloud Function.
- Firebase Custom Token authentication with claims: `{ role: 'driver', bizId, staffId, branchId }`.
- Isolated named Firebase App instance (`ScaleKitchenDelivery`) preventing session collision with owner/manager portals on the same origin.
- Reusable tiffin box collection, hygiene/damage condition logging, and customer container balance tracking.
- Shift punch-in/punch-out attendance and throttled live GPS location updates.
- Optimized delivery sequence with turn-by-turn navigation and WhatsApp customer notifications.
- Isolated demo route preview that strictly blocks writes to production Firestore.

## Workspace Scripts
- `npm run dev --workspace=@scalekitchen/delivery` (runs on dedicated port 3002)
- `npm run build --workspace=@scalekitchen/delivery` (builds to `dist`)
- `npm run lint --workspace=@scalekitchen/delivery` (runs `tsc --noEmit`)

## Independent Deployment
Configured for independent deployment via `vercel.json` with root directory set to `apps/delivery`.
