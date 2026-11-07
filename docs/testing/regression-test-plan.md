# ScaleKitchen — Regression Test Plan & Verification Matrix

## 1. Test Automation Matrix
The regression testing suite verifies that no operational capability is broken during monorepo restructuring.

| Test Category | Test File / Command | Target Component | Success Criteria |
| :--- | :--- | :--- | :--- |
| **Unit & Integrity** | `npm test` (`vitest run`) | `test/persistence-and-integrity.test.ts`, `test/delivery-app.test.ts` | 43/43 tests pass (persistence, delivery auth, legacy tokens, meal sessions, boxes). |
| **Delivery App Tests**| `vitest run test/delivery-app.test.ts` | `apps/delivery` services & helpers | 19/19 tests pass (token decoding, session boundaries, box logic, demo safety). |
| **Delivery Lint** | `npm run lint:delivery` | `apps/delivery` | 0 TypeScript errors. |
| **Delivery Build**| `npm run build:delivery` | `apps/delivery/dist` | Clean Vite bundle in under 7 seconds. |
| **Landing Lint** | `npm run lint:landing` | `apps/landing` | 0 TypeScript errors. |
| **Landing Build** | `npm run build:landing` | `apps/landing/dist` | Clean Vite bundle in under 6 seconds. |
| **Security Rules** | `npm run test:rules` | `test/firestore-rules.test.ts` | Rules unit tests pass against local emulator. |
| **Type Check** | `npm run lint` (`tsc`) | Root & workspace packages | 0 TypeScript compilation errors. |
| **Functions Syntax**| `node --check functions/index.js`| Backend Cloud Functions | Clean AST compilation without syntax errors. |
| **Production Build**| `npm run build` (`vite build`)| Production SPA bundle | Build completes without unhandled errors. |

## 2. Key Manual & Integration Test Cases

### A. Kitchen Owner Portal
1. **Login & Session:**
   - Sign in with verified owner email/password.
   - Verify `scalekitchen_auth_session` is cached in `localStorage`.
   - Verify `businesses/{bizId}/login_logs/{date}` records last login timestamp.
2. **Customer Subscription Management:**
   - Add new customer with initial plan and payment.
   - Verify atomic batch creation in `customers` and `payments` subcollections.
   - Verify live statistics (`kitchenRevenue`, `totalActiveCustomers`) update instantly.
3. **Delivery Route Optimization:**
   - Open Deliveries page, select Breakfast/Lunch/Dinner session.
   - Verify stop order sequencing and map links.

### B. Delivery Boy (Rider) Web App
1. **Authentication:**
   - Open `/driver` or `/#/driver`.
   - Submit 10-digit mobile number + 4-digit PIN.
   - Verify `driverLogin` callable returns custom token.
   - Verify custom token signs into Firebase with claims `{ role: 'driver', bizId, staffId, branchId }`.
2. **Field Execution:**
   - Tap 'Start Shift / Punch In' and verify driver status transitions to `Online`.
   - Check turn-by-turn map navigation links.
   - Update reusable dabba condition (`Collected Clean`, `Dirty / Unwashed`, `Damaged`, `Not Returned`).
   - Mark stop as `Delivered` and confirm delivery log persists in Firestore.

### C. Branch Manager Portal
1. **Branch Scoping:**
   - Sign in via `/manager` with branch manager email and password.
   - Verify `manager_branch_id` is applied to customer and delivery tables.
   - Confirm manager cannot view financial data or records outside assigned branch.

### D. Super Admin Console
1. **Access Control:**
   - Attempt access with non-admin email; confirm redirection to `/admin/login`.
   - Access with authorized admin email; verify tenant overview loads live data.
