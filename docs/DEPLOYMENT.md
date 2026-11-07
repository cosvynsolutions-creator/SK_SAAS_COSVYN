# ScaleKitchen Deployment & DevOps Guide

## Environments

| Environment | Frontend URL | API Endpoint | Database Target |
| :--- | :--- | :--- | :--- |
| **Development** | `http://localhost:3000` | `http://localhost:3000/api` | Local / Dev Firestore |
| **Staging** | `https://staging.scalekitchen.vercel.app` | `https://staging.scalekitchen.vercel.app/api` | Staging Firebase project |
| **Production** | `https://scalekitchen.vercel.app` | `https://scalekitchen.vercel.app/api` | Production Firebase project |

---

## Deployment Steps

### 1. Vercel Deployment
The repository includes a root `vercel.json` configured for full-stack API functions and Vite static builds.
```bash
# Production Build & Deploy
npm run build
vercel --prod
```

### 2. Environment Variables Required
- `JWT_SECRET`: 256-bit secret string for access token signature
- `REFRESH_SECRET`: 256-bit secret string for refresh tokens
- `RAZORPAY_KEY_ID`: Razorpay Public Key ID
- `RAZORPAY_KEY_SECRET`: Razorpay Secret Key
- `RAZORPAY_WEBHOOK_SECRET`: Razorpay Webhook HMAC secret
- `NODE_ENV`: `production`

---

## CI/CD Pipeline
1. **Lint & Type Check**: `npm run lint` (`tsc --noEmit`)
2. **Unit Tests**: `npm run test`
3. **Build**: `npm run build`
4. **Deploy**: Push to Vercel and apply Firestore security rules
