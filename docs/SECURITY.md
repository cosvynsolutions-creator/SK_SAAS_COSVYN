# ScaleKitchen Security Architecture Specification

## 1. Authentication & Token Architecture

### Token Specification (JWT)
- **Algorithm**: HMAC-SHA256 (`HS256`)
- **AccessToken Lifetime**:
  - Owner / Manager / Admin: `15 minutes` (900 seconds)
  - Driver App: `24 hours` (86400 seconds)
- **RefreshToken Lifetime**: `7 days` (stored via HttpOnly cookie or secure storage)

### Token Claims Structure
```json
{
  "uid": "user_12345",
  "email": "owner@kitchen.com",
  "role": "owner",
  "businessId": "biz_spicedelight",
  "branchId": "branch_downtown",
  "staffId": "staff_suresh",
  "iat": 1700000000,
  "exp": 1700000900
}
```

---

## 2. Role-Based Access Control (RBAC) Matrix

| Resource Path | Owner | Manager | Driver | Admin | Public |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/auth/login` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `/api/auth/signup` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/api/driver/*` | ❌ | ❌ | ✅ Own Only | ✅ | ❌ |
| `/api/owner/*` | ✅ Own Biz | ❌ | ❌ | ✅ All | ❌ |
| `/api/manager/*` | ✅ Own Biz | ✅ Own Branch | ❌ | ✅ All | ❌ |
| `/api/admin/*` | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| `/api/webhooks/*`| ❌ | ❌ | ❌ | ❌ | ✅ Signed |

---

## 3. Password & PIN Security Standards

- **Owner Passwords**: Hashed with `bcrypt` (work factor: `12`).
- **Driver PINs**: 4-digit numeric PINs hashed with `bcrypt` (work factor: `10`).
- **Brute-Force Protection**: 5 consecutive failed attempts trigger an automatic 15-minute lockout on the phone/email and IP.
- **Tenant Isolation**: Middleware verifies that `req.user.businessId` matches the requested resource. Cross-tenant access returns `403 Forbidden`.
