import { Router, Request, Response } from 'express';
import { dbService } from '../../services/db-service/src/firestore';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { logAuditEvent } from '../../services/audit-service/src/logger';
import { hashPin } from '../../services/auth-service/src/password';
import { StaffData } from '../../packages/types/src';

export const managerRouter = Router();

managerRouter.use(authenticateToken);
managerRouter.use(requireRoles(['manager', 'owner', 'admin']));

// GET /api/manager/dashboard
managerRouter.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const branchId = req.user?.branchId || (req.query.branchId as string) || 'branch_downtown';

  const dashboard = await dbService.getManagerDashboard(businessId, branchId);
  res.status(200).json({
    success: true,
    dashboard,
  });
});

// GET /api/manager/staff
managerRouter.get('/staff', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const branchId = req.user?.branchId || 'branch_downtown';

  const staff = await dbService.getStaff(businessId, branchId);
  res.status(200).json({
    success: true,
    staff,
  });
});

// POST /api/manager/staff
managerRouter.post('/staff', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const branchId = req.user?.branchId || 'branch_downtown';
  const { id, name, phone, pin, status, notes } = req.body;

  if (!name || !phone) {
    res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'Name and phone are required' });
    return;
  }

  const staffId = id || `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let pin_hash: string | undefined;

  if (pin) {
    pin_hash = await hashPin(pin);
    await dbService.setDriverPinRecord({
      phone,
      pin_hash,
      staffId,
      businessId,
      name,
      branchId,
    });
  }

  const staffMember: StaffData = {
    id: staffId,
    businessId,
    branchId, // Enforced to manager's branch
    name,
    phone,
    pin_hash,
    role: 'driver',
    status: status || 'active',
    joinDate: new Date().toISOString().split('T')[0],
    notes,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.uid,
    updatedAt: new Date().toISOString(),
  };

  const saved = await dbService.saveStaff(businessId, staffMember);

  await logAuditEvent({
    businessId,
    userId: req.user?.uid || 'unknown',
    userRole: 'manager',
    action: id ? 'manager_staff_update' : 'manager_staff_create',
    resource: 'staff',
    resourceId: staffId,
    newValue: { name, phone, branchId },
    ipAddress: req.ip,
  });

  res.status(id ? 200 : 201).json({
    success: true,
    staff: saved,
  });
});

// GET /api/manager/analytics
managerRouter.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  const branchId = req.user?.branchId || 'branch_downtown';
  res.status(200).json({
    success: true,
    analytics: {
      branchId,
      onTimeDeliveryRate: '98.4%',
      reusableBoxRecoveryRate: '94.2%',
      averageDeliveryDurationMin: 18,
      dailyTrend: [
        { day: 'Mon', delivered: 42, recollected: 40 },
        { day: 'Tue', delivered: 45, recollected: 44 },
        { day: 'Wed', delivered: 48, recollected: 46 },
        { day: 'Thu', delivered: 46, recollected: 45 },
        { day: 'Fri', delivered: 50, recollected: 47 },
      ],
    },
  });
});
