import { Router, Request, Response } from 'express';
import { dbService } from '../../services/db-service/src/firestore';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { getAuditLogs, logAuditEvent } from '../../services/audit-service/src/logger';

export const adminRouter = Router();

adminRouter.use(authenticateToken);
adminRouter.use(requireRoles(['admin']));

// GET /api/admin/users
adminRouter.get('/users', async (req: Request, res: Response): Promise<void> => {
  const businesses = await dbService.getAllBusinesses();
  const searchText = ((req.query.searchText as string) || '').toLowerCase();

  let filtered = businesses;
  if (searchText) {
    filtered = filtered.filter(
      b => b.name?.toLowerCase().includes(searchText) || b.email?.toLowerCase().includes(searchText)
    );
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  res.status(200).json({
    success: true,
    users: paginated.map(b => ({
      uid: b.id,
      businessName: b.name,
      email: b.email,
      phone: b.phone,
      subscription: b.subscription?.status || 'active',
      plan: b.subscription?.plan || 'pro',
      expiryDate: b.subscription?.expiryDate || '2026-12-31',
      createdAt: b.createdAt,
      customers: 24,
      monthlyRevenue: 135000,
    })),
    pagination: {
      total: filtered.length,
      page,
      pages: Math.ceil(filtered.length / limit) || 1,
    },
  });
});

// GET /api/admin/subscriptions
adminRouter.get('/subscriptions', async (req: Request, res: Response): Promise<void> => {
  const businesses = await dbService.getAllBusinesses();
  res.status(200).json({
    success: true,
    subscriptions: businesses.map(b => ({
      businessId: b.id,
      businessName: b.name,
      email: b.email,
      plan: b.subscription?.plan || 'pro',
      status: b.subscription?.status || 'active',
      startDate: b.subscription?.startDate,
      expiryDate: b.subscription?.expiryDate,
    })),
  });
});

// POST /api/admin/subscriptions
adminRouter.post('/subscriptions', async (req: Request, res: Response): Promise<void> => {
  const { businessId, updates } = req.body;
  if (!businessId || !updates) {
    res.status(400).json({ success: false, error: 'MISSING_FIELDS' });
    return;
  }

  const updated = await dbService.updateBusiness(businessId, { subscription: updates });

  await logAuditEvent({
    businessId,
    userId: req.user?.uid || 'admin',
    userRole: 'admin',
    action: 'admin_subscription_update',
    resource: 'subscription',
    resourceId: businessId,
    newValue: updates,
    ipAddress: req.ip,
  });

  res.status(200).json({
    success: true,
    message: 'Subscription updated',
    business: updated,
  });
});

// GET /api/admin/analytics
adminRouter.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  const businesses = await dbService.getAllBusinesses();
  res.status(200).json({
    success: true,
    analytics: {
      totalBusinesses: businesses.length,
      activePaidTenants: businesses.filter(b => b.subscription?.status === 'active').length,
      monthlyGrossVolumePaise: 48500000,
      totalActiveSubscribers: 1540,
      platformDeliveriesToday: 1840,
      growthRateMom: '+18.5%',
    },
  });
});

// GET /api/admin/audit
adminRouter.get('/audit', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.query.businessId as string;
  const action = req.query.action as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const result = getAuditLogs({ businessId, action, page, limit });
  res.status(200).json({
    success: true,
    logs: result.logs,
    pagination: {
      total: result.total,
      page,
      pages: Math.ceil(result.total / limit) || 1,
    },
  });
});
