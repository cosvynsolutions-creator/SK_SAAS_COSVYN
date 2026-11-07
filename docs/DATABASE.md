# ScaleKitchen Firestore Database Schema (Restructured v2.0)

## Collections Hierarchy

```
/auth_users/{uid}
  ├─ email: string
  ├─ password_hash: string (bcrypt)
  ├─ name: string
  ├─ role: "owner" | "manager" | "admin"
  ├─ businessId: string
  ├─ branchId: string (if manager)
  ├─ status: "active" | "suspended" | "deleted"
  └─ createdAt: timestamp

/driver_auth/{phone}
  ├─ phone: string (10 digits)
  ├─ pin_hash: string (bcrypt)
  ├─ staffId: string
  ├─ businessId: string
  ├─ name: string
  └─ branchId: string

/businesses/{bizId}
  ├─ uid: string (owner UID)
  ├─ name: string
  ├─ email: string
  ├─ phone: string
  ├─ subscription: {
  │    status: "active" | "expired" | "paused",
  │    plan: "free_trial" | "starter" | "pro" | "enterprise",
  │    expiryDate: string (YYYY-MM-DD)
  │ }
  │
  ├─ /staff/{staffId}
  │    ├─ name: string
  │    ├─ phone: string
  │    ├─ role: "driver" | "manager"
  │    ├─ branchId: string
  │    ├─ status: "active" | "inactive" | "on_leave"
  │    └─ currentLocation: { lat: number, lng: number }
  │
  ├─ /customers/{customerId}
  │    ├─ name: string
  │    ├─ phone: string
  │    ├─ address: string
  │    ├─ plan: { planId, name, mealsPerDay, daysPerWeek, status }
  │    ├─ balance: number (in paise)
  │    └─ reusableBoxType: string
  │
  └─ /delivery_logs/{logId}
       ├─ customerId: string
       ├─ staffId: string
       ├─ date: string (YYYY-MM-DD)
       ├─ status: "delivered" | "failed"
       ├─ collectedBoxes: Array<{ id, type }>
       └─ deliveredAt: timestamp

/audit_logs/{logId}
  ├─ timestamp: string (ISO 8601)
  ├─ businessId: string
  ├─ userId: string
  ├─ userRole: string
  ├─ action: string
  ├─ resource: string
  ├─ resourceId: string
  ├─ oldValue: any
  ├─ newValue: any
  ├─ ipAddress: string
  └─ status: "success" | "failed"
```
