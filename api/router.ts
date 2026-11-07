import { Router } from 'express';
import { authRouter } from './auth';
import { driverRouter } from './driver';
import { ownerRouter } from './owner';
import { managerRouter } from './manager';
import { adminRouter } from './admin';
import { webhooksRouter } from './webhooks/razorpay';

export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    architecture: 'ScaleKitchen REST API (Restructured v2)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    layers: ['auth', 'driver', 'owner', 'manager', 'admin', 'webhooks'],
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/driver', driverRouter);
apiRouter.use('/owner', ownerRouter);
apiRouter.use('/manager', managerRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/webhooks', webhooksRouter);
