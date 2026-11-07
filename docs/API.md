# ScaleKitchen REST API Specification (v2.0 Restructured)

## Base URL
- Production: `https://api.scalekitchen.vercel.app` (or same origin `/api`)
- Development: `http://localhost:3000/api`

---

## 1. Authentication Endpoints

### POST `/api/auth/login`
Logs in a Kitchen Owner or Manager using email and password.

- **Request Body:**
```json
{
  "email": "owner@kitchen.com",
  "password": "securePassword123",
  "role": "owner"
}
```

- **Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "uid": "owner_1",
    "email": "owner@kitchen.com",
    "name": "Spice Delight Kitchens",
    "role": "owner",
    "businessId": "biz_spicedelight"
  },
  "tokens": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

---

### POST `/api/auth/signup`
Registers a new subscription meal kitchen business owner.

- **Request Body:**
```json
{
  "email": "newowner@kitchen.com",
  "password": "securePassword123",
  "businessName": "Fresh Bites Tiffin",
  "ownerName": "Rohan Gupta",
  "phone": "9876543210",
  "city": "Bangalore"
}
```

- **Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "uid": "user_123",
    "email": "newowner@kitchen.com",
    "name": "Rohan Gupta",
    "role": "owner",
    "businessId": "biz_456"
  },
  "tokens": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

---

### POST `/api/auth/refresh`
Refreshes an expired access token using the HttpOnly or payload refresh token.

- **Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

- **Response (200 OK):**
```json
{
  "success": true,
  "accessToken": "eyJhbGc...",
  "expiresIn": 900
}
```

---

### POST `/api/auth/logout`
Revokes active session tokens and logs audit logout event.

---

## 2. Driver Endpoints

### POST `/api/driver/login`
Authenticates a Delivery Boy via 10-digit phone number and bcrypt-hashed 4-digit PIN.

- **Request Body:**
```json
{
  "phone": "7702667567",
  "pin": "1234"
}
```

- **Response (200 OK):**
```json
{
  "success": true,
  "driver": {
    "uid": "driver_biz_spicedelight_staff_suresh",
    "name": "Suresh Kumar",
    "phone": "7702667567",
    "businessId": "biz_spicedelight",
    "staffId": "staff_suresh",
    "branchId": "branch_downtown",
    "status": "Active"
  },
  "tokens": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 86400
  }
}
```

---

### GET `/api/driver/route`
Retrieves the driver's daily stop manifest, orders, customer coordinates, and container types.

- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200 OK):** Returns `DriverRouteSummary` with stops, contact numbers, and meal info.

---

### POST `/api/driver/deliver`
Marks a specific delivery as delivered or failed, logging GPS coordinates and collected reusable boxes.

- **Request Body:**
```json
{
  "deliveryId": "del_101",
  "status": "delivered",
  "collectedBoxes": [
    { "id": "box_st_1", "type": "Stainless Steel 3-Tier Dabba" }
  ],
  "latitude": 12.9784,
  "longitude": 77.6408,
  "notes": "Delivered to security"
}
```

---

### POST `/api/driver/status`
Pushes live GPS tracking, shift state (active/break/off), and battery level.

---

## 3. Owner Endpoints

- `GET /api/owner/dashboard`: Aggregated kitchen metrics (active customers, scheduled vs completed deliveries, revenue).
- `GET /api/owner/customers`: Filtered, paginated customer subscriber directory.
- `POST /api/owner/customers`: Create or update subscriber profile and active plan.
- `GET /api/owner/staff`: List all delivery riders and managers.
- `POST /api/owner/staff`: Register delivery boy with auto bcrypt-hashed PIN.
- `DELETE /api/owner/staff/:id`: Remove/deactivate staff rider.
- `GET /api/owner/billing`: Subscription tier and payment status.
- `POST /api/owner/billing/upgrade`: Generates Razorpay checkout order.
- `GET /api/owner/plans`: Global meal plans catalog.
- `GET /api/owner/invoices`: Customer and billing receipts.

---

## 4. Manager Endpoints (Branch Scoped)

- `GET /api/manager/dashboard`: Branch-specific fleet and delivery metrics.
- `GET /api/manager/staff`: Branch-assigned drivers only.
- `POST /api/manager/staff`: Create or update staff strictly bound to the manager's branch.
- `GET /api/manager/analytics`: Branch speed, box return rate, on-time delivery KPIs.

---

## 5. Super Admin Endpoints

- `GET /api/admin/users`: Global directory of all subscribed kitchen businesses.
- `GET /api/admin/subscriptions`: Multi-tenant subscription oversight.
- `POST /api/admin/subscriptions`: Extend, renew, or override plan quotas.
- `GET /api/admin/analytics`: Platform GMV, MRR, growth, and total meal dispatches.
- `GET /api/admin/audit`: Central immutable security audit log trail.

---

## 6. Webhooks

- `POST /api/webhooks/razorpay`: Verifies HMAC SHA-256 webhook signature and updates business subscription status idempotently.
