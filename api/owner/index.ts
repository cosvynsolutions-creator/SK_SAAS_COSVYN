import { Router, Request, Response } from 'express';
import { dbService } from '../../services/db-service/src/firestore';
import { hashPin } from '../../services/auth-service/src/password';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { logAuditEvent } from '../../services/audit-service/src/logger';
import { createRazorpayOrder } from '../../services/payment-service/src/razorpay';
import { StaffData, CustomerData } from '../../packages/types/src';

export const ownerRouter = Router();

// Apply auth & role requirements to all /api/owner endpoints
ownerRouter.use(authenticateToken);
ownerRouter.use(requireRoles(['owner', 'admin']));

// GET /api/owner/dashboard
ownerRouter.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const dashboard = await dbService.getOwnerDashboard(businessId);
  res.status(200).json({
    success: true,
    dashboard,
  });
});

// GET /api/owner/customers
ownerRouter.get('/customers', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const branchId = req.query.branchId as string;
  const searchText = ((req.query.searchText as string) || '').toLowerCase();

  let customers = await dbService.getCustomers(businessId, branchId);
  if (searchText) {
    customers = customers.filter(
      c => c.name.toLowerCase().includes(searchText) || c.phone.includes(searchText)
    );
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const start = (page - 1) * limit;
  const paginated = customers.slice(start, start + limit);

  res.status(200).json({
    success: true,
    customers: paginated,
    pagination: {
      total: customers.length,
      page,
      pages: Math.ceil(customers.length / limit) || 1,
    },
  });
});

// POST /api/owner/customers
ownerRouter.post('/customers', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const data = req.body;

  const id = data.id || `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const customer: CustomerData = {
    id,
    businessId,
    branchId: data.branchId || 'branch_downtown',
    name: data.name,
    phone: data.phone,
    email: data.email || '',
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    plan: data.plan || {
      planId: 'plan_standard',
      name: 'Standard Meal Plan',
      mealsPerDay: 1,
      daysPerWeek: 5,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'active',
    },
    balance: data.balance || 0,
    reusableBoxType: data.reusableBoxType || 'None',
    notes: data.notes || '',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const saved = await dbService.saveCustomer(businessId, customer);

  await logAuditEvent({
    businessId,
    userId: req.user?.uid || 'unknown',
    userRole: req.user?.role || 'owner',
    action: data.id ? 'customer_update' : 'customer_create',
    resource: 'customer',
    resourceId: id,
    newValue: customer,
    ipAddress: req.ip,
  });

  res.status(200).json({
    success: true,
    customer: saved,
  });
});

// GET /api/owner/staff
ownerRouter.get('/staff', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const branchId = req.query.branchId as string;
  const staff = await dbService.getStaff(businessId, branchId);
  res.status(200).json({
    success: true,
    staff,
  });
});

// POST /api/owner/staff
ownerRouter.post('/staff', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const { id, name, phone, pin, branchId, status, notes } = req.body;

  if (!name || !phone) {
    res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'Name and phone are required',
    });
    return;
  }

  const staffId = id || `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let pin_hash: string | undefined;

  if (pin) {
    pin_hash = await hashPin(pin);
    // Write driver auth lookup for phone login
    await dbService.setDriverPinRecord({
      phone,
      pin_hash,
      staffId,
      businessId,
      name,
      branchId: branchId || 'branch_downtown',
    });
  }

  const staffMember: StaffData = {
    id: staffId,
    businessId,
    branchId: branchId || 'branch_downtown',
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
    userRole: req.user?.role || 'owner',
    action: id ? 'staff_update' : 'staff_create',
    resource: 'staff',
    resourceId: staffId,
    newValue: { name, phone, branchId, status },
    ipAddress: req.ip,
  });

  res.status(id ? 200 : 201).json({
    success: true,
    staff: saved,
    message: 'Delivery staff saved successfully. Driver can now log in via mobile with PIN.',
  });
});

// DELETE /api/owner/staff/:id
ownerRouter.delete('/staff/:id', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const staffId = String(req.params.id);

  await dbService.deleteStaff(businessId, staffId);

  await logAuditEvent({
    businessId,
    userId: req.user?.uid || 'unknown',
    userRole: req.user?.role || 'owner',
    action: 'staff_delete',
    resource: 'staff',
    resourceId: staffId,
    ipAddress: req.ip,
  });

  res.status(200).json({
    success: true,
    message: 'Delivery boy removed successfully',
  });
});

// GET /api/owner/deliveries
ownerRouter.get('/deliveries', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const customers = await dbService.getCustomers(businessId);
  const deliveries = customers.map((c, i) => ({
    id: `del_${c.id}`,
    customerId: c.id,
    customerName: c.name,
    address: c.address,
    plan: c.plan.name,
    status: i % 2 === 0 ? 'Delivered' : 'Pending',
    expectedDate: new Date().toISOString().split('T')[0],
    reusableBoxType: c.reusableBoxType,
  }));

  res.status(200).json({
    success: true,
    deliveries,
  });
});

// GET /api/owner/billing
ownerRouter.get('/billing', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const business = await dbService.getBusinessById(businessId);

  res.status(200).json({
    success: true,
    billing: {
      subscription: business?.subscription || {
        status: 'active',
        plan: 'pro',
        expiryDate: '2026-12-31',
      },
      history: [
        {
          id: 'inv_101',
          date: '2024-10-01',
          plan: 'ScaleKitchen Pro Plan',
          amount: 2499,
          status: 'Paid',
          downloadUrl: '#',
        },
      ],
    },
  });
});

// POST /api/owner/billing/upgrade
ownerRouter.post('/billing/upgrade', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.user?.businessId || 'biz_spicedelight';
  const { planId, durationMonths } = req.body;

  const order = await createRazorpayOrder({
    planId: planId || 'pro',
    durationMonths: durationMonths || 1,
    businessId,
  });

  res.status(200).json({
    success: true,
    order,
  });
});

// GET /api/owner/plans
ownerRouter.get('/plans', async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    plans: [
      { id: 'plan_gold', name: 'Gold 5-Day Meal Plan', price: 2999, numberOfDeliveryDays: 20 },
      { id: 'plan_keto', name: 'Keto Lunch Box', price: 3499, numberOfDeliveryDays: 24 },
      { id: 'plan_daily', name: 'Daily Tiffin Standard', price: 2499, numberOfDeliveryDays: 22 },
    ],
  });
});

// GET /api/owner/invoices
ownerRouter.get('/invoices', async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    invoices: [
      { id: 'inv_2026_01', date: '2026-10-01', customerName: 'Rajesh Sharma', amount: 2999, status: 'Paid' },
      { id: 'inv_2026_02', date: '2026-10-15', customerName: 'Priya Narang', amount: 3499, status: 'Paid' },
    ],
  });
});
