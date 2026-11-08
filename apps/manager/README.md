# @scalekitchen/manager

ScaleKitchen Branch Manager Operational Portal — Independent frontend application extracted in Phase 4 of the ScaleKitchen Monorepo Migration.

## Overview
- **Application:** ScaleKitchen Branch Manager Portal
- **Workspace:** `apps/manager/`
- **Default Port:** `3003`
- **Build Output:** `dist/`
- **Deployment Platform:** Vercel (Independent preview & production)
- **Firebase App Instance:** `ScaleKitchenManager` (Dedicated named instance)

## Architecture & Tenancy Security
- **Firebase Authentication:** The owner configures the manager's email and password in Owner Settings. A trusted `setManagerPassword` Cloud Function creates or updates the Firebase Authentication account and assigns claims; the manager signs in with Firebase email/password authentication.
- **Strict Multi-Tenancy:** The manager app accepts identity only from the verified Firebase ID token claims:
  - `role`: `'manager'`
  - `bizId`: Target Kitchen Business Document ID
  - `managerId`: Manager profile document ID
  - `branchId`: Assigned branch ID or `'All'`
- **Profile Verification:** After sign-in or session restore, the app verifies the manager profile UID, email, active status, and branch assignment against Firebase Auth and verified claims.
- **Branch Scoping:** When `branchId !== 'All'`, operational hooks (`useStreamCollection`) and UI views constrain queries to the manager's assigned branch; Firestore rules enforce tenant and branch access.
- **Granular Permissions:** Granted modules are controlled via `allowedPages` (e.g. `['dashboard', 'prep', 'deliveries', 'customers']`). Unassigned modules render an explicit `Permission Restricted` card.
- **No custom-token sign-in:** The Manager app signs in with Firebase email/password; it does not need the Service Account Token Creator role. The retained `managerLogin` endpoint is disabled and only returns a migration error. Deploying account-provisioning Functions still requires Cloud Build's build service account to have its required build permissions; that is separate from Manager sign-in.
- **Existing manager migration:** Edit and save each existing manager in Owner Settings. If the profile has no linked Firebase Auth UID, set a new password so `setManagerPassword` can create the Firebase Authentication account and securely link it to the existing profile.

## Available Workspace Scripts
```bash
# Run local dev server on port 3003
npm run dev:manager

# Build production bundle to apps/manager/dist
npm run build:manager

# Typecheck and lint manager codebase
npm run lint:manager
```
