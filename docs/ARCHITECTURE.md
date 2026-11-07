# ScaleKitchen Architecture & Monorepo Technical Specification (Consolidated v3.0)

## 1. High-Level System Architecture

ScaleKitchen by COSVYN is a production-grade multi-tenant SaaS platform architected for recurring meal subscription businesses, tiffin centers, corporate meal prep operations, and diet-catering enterprises.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 5 USER PERSONAS                                        │
├─────────────────┬─────────────────┬──────────────────┬────────────────┬────────────────┤
│     PUBLIC      │      OWNER      │     MANAGER      │     DRIVER     │     ADMIN      │
│  (Landing Page) │  (Kitchen HQ)   │ (Branch Control) │(Rider PWA App) │ (Super Portal) │
└────────┬────────┴────────┬────────┴────────┬─────────┴───────┬────────┴────────┬───────┘
         │                 │                 │                 │                 │
┌────────▼─────────────────▼─────────────────▼─────────────────▼─────────────────▼───────┐
│                        INDEPENDENT FRONTEND WORKSPACES (apps/*)                        │
├─────────────────┬─────────────────┬──────────────────┬────────────────┬────────────────┤
│  apps/landing   │   apps/owner    │   apps/manager   │ apps/delivery  │   apps/admin   │
│   Port: 3000    │   Port: 3001    │   Port: 3003     │   Port: 3002   │   Port: 3004   │
│ (React + Vite)  │ (React + Vite)  │  (React + Vite)  │ (React + Vite) │ (React + Vite) │
└────────┬────────┴────────┬────────┴────────┬─────────┴───────┬────────┴────────┬───────┘
         │                 │                 │                 │                 │
         └─────────────────┴────────┬────────┴─────────────────┴─────────────────┘
                                    │ HTTPS API & Firebase Auth
┌───────────────────────────────────▼────────────────────────────────────────────────────┐
│                    SHARED MONOREPO PACKAGES (packages/*)                               │
├──────────────────────────────┬───────────────────────────────┬─────────────────────────┤
│ packages/types               │ packages/utils                │ packages/ui             │
│ (Canonical TypeScript types) │ (Domain math, dates, format)  │ (Design primitives)     │
└──────────────────────────────┴───────────────────────────────┴─────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────────────────────┐
│                       FULL-STACK BACKEND LAYER (server.ts & api/*)                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  /api/auth/*     /api/owner/*     /api/manager/*     /api/driver/*     /api/admin/*    │
│                                                                                        │
│  Backend Microservices:                                                                │
│  ├─ services/auth-service       [JWT issue/verify, bcrypt password/PIN checks]        │
│  ├─ services/audit-service      [Immutable security audit logging]                     │
│  ├─ services/db-service         [Server-side Firestore persistence abstraction]       │
│  └─ services/payment-service    [Razorpay order creation, verification, webhooks]     │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────────────────────┐
│               FIREBASE-FIRST DATA PERSISTENCE & SECURITY (firestore.rules)             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Firestore Collections:                                                                │
│  ├─ businesses/{bizId}/customers/{custId}       [Subscriber meal plans & pause log]    │
│  ├─ businesses/{bizId}/staff/{staffId}           [Sanitized driver & manager profiles]  │
│  ├─ businesses/{bizId}/staff_credentials/{id}    [Private bcrypt hashes - no client r/w]│
│  ├─ businesses/{bizId}/driver_manifest/{id}      [Optimized stop manifests & GPS logs]  │
│  ├─ businesses/{bizId}/delivery_logs/{logId}     [Deliveries & reusable dabba returns]  │
│  ├─ driver_profiles/{driverUid}                  [Isolated driver profiles]             │
│  └─ audit_logs/{logId}                           [System-wide immutable trail]          │
│                                                                                        │
│  Cloud Functions v2 (functions/index.js):                                              │
│  ├─ createDeliveryBoyAccount / updateDeliveryBoyAccount / resetDeliveryBoyPassword     │
│  ├─ driverLogin / managerLogin callable handlers                                       │
│  └─ checkSubscriptionExpiry daily cron trigger                                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Directory Layout & Monorepo Topology

```text
ScaleKitchen Repository
│
├── apps/
│   ├── owner/                    # Kitchen Owner HQ Dashboard (Authoritative source)
│   │   └── src/
│   │       ├── components/
│   │       ├── contexts/
│   │       ├── layouts/
│   │       ├── pages/
│   │       ├── services/
│   │       ├── App.tsx
│   │       └── main.tsx
│   ├── admin/                    # Super Admin Governance Portal
│   │   └── src/
│   ├── manager/                  # Branch Manager Operational Hub
│   │   └── src/
│   ├── delivery/                 # Delivery Rider Mobile PWA App
│   │   └── src/
│   └── landing/                  # Public Marketing & Legal Application
│       └── src/
│
├── functions/                    # Firebase Cloud Functions v2 backend
│   ├── index.js
│   └── package.json
│
├── packages/                     # Monorepo shared packages
│   ├── types/                    # @scalekitchen/types
│   ├── utils/                    # @scalekitchen/utils
│   ├── ui/                       # @scalekitchen/ui
│   └── api-client/               # @scalekitchen/api-client
│
├── services/                     # Backend microservices for server.ts / api router
│   ├── audit-service/
│   ├── auth-service/
│   ├── db-service/
│   └── payment-service/
│
├── api/                          # Express API route controllers & middlewares
│   ├── auth/
│   ├── admin/
│   ├── driver/
│   ├── manager/
│   ├── owner/
│   ├── middleware/
│   └── webhooks/
│
├── docs/                         # Production system documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   ├── MASTER_ARCHITECTURE_REPORT.md
│   ├── SECURITY.md
│   └── testing/
│
├── scripts/                      # Operational & migration scripts
│   ├── patch-firestore.cjs
│   ├── migrate-credentials.cjs
│   └── set-admin-claim.cjs
│
├── test/                         # Comprehensive Vitest test suites
├── firestore.rules               # Production Firestore security rules
├── server.ts                     # Full-stack Node.js Express + Vite dev server
└── package.json                  # Root monorepo workspace configuration
```

## 3. Authoritative Source of Truth Guarantee

- **Single Owner Source:** `apps/owner/src/` is the sole authoritative implementation of the Owner SaaS application. The root entry point (`index.tsx`) imports and mounts `apps/owner/src/App.tsx` directly.
- **Single Delivery Source:** `apps/delivery/src/` is the sole authoritative implementation of the Delivery Rider portal.
- **Single Manager Source:** `apps/manager/src/` is the sole authoritative implementation of the Branch Manager portal.
- **Single Admin Source:** `apps/admin/src/` is the sole authoritative implementation of the Super Admin portal.
- **Single Landing Source:** `apps/landing/src/` is the sole authoritative implementation of the public marketing website.

No duplicate page, component, context, or layout trees exist in the root directory. All future development, bug fixes, and feature additions must target the respective application in `apps/<app_name>/src/`.
