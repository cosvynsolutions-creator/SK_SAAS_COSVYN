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
- **Strict Multi-Tenancy:** Authentication issues a verified Firebase Custom Token with claims:
  - `role`: `'manager'`
  - `bizId`: Target Kitchen Business Document ID
  - `managerId`: Manager Staff Document ID
  - `branchId`: Assigned branch ID or `'All'`
- **Branch Scoping:** When `branchId !== 'All'`, all operational hooks (`useStreamCollection`) and UI views automatically constrain queries to the manager's assigned branch.
- **Granular Permissions:** Granted modules are controlled via `allowedPages` (e.g. `['dashboard', 'prep', 'deliveries', 'customers']`). Unassigned modules render an explicit `Permission Restricted` card.

## Available Workspace Scripts
```bash
# Run local dev server on port 3003
npm run dev:manager

# Build production bundle to apps/manager/dist
npm run build:manager

# Typecheck and lint manager codebase
npm run lint:manager
```
