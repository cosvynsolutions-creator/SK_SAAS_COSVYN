import { Router, Request, Response } from 'express';
import { dbService } from '../../services/db-service/src/firestore';
import { comparePin } from '../../services/auth-service/src/password';
import { generateTokens } from '../../services/auth-service/src/jwt';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { recordFailedAttempt, clearFailedAttempts, checkRateLimit } from '../middleware/rateLimit';
import { logAuditEvent } from '../../services/audit-service/src/logger';

export const driverRouter = Router();

// POST /api/driver/login
driverRouter.post(
  '/login',
  checkRateLimit((req) => `driver_${req.body.phone || req.ip}`),
  async (req: Request, res: Response): Promise<void> => {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Mobile number and PIN are required',
      });
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const driverRecord = await dbService.findDriverByPhone(cleanPhone);

    if (!driverRecord || !driverRecord.pin_hash) {
      const { locked, attemptsRemaining } = recordFailedAttempt(`driver_${cleanPhone}`);
      await logAuditEvent({
        businessId: 'unknown',
        userId: cleanPhone,
        userRole: 'driver',
        action: 'driver_login_failed_not_found',
        status: 'failed',
        ipAddress: req.ip,
      });

      res.status(401).json({
        success: false,
        error: 'INVALID_PIN',
        message: 'Mobile number or PIN is incorrect.',
        attemptsRemaining,
        locked,
      });
      return;
    }

    const isMatch = await comparePin(pin, driverRecord.pin_hash);
    if (!isMatch) {
      const { locked, attemptsRemaining } = recordFailedAttempt(`driver_${cleanPhone}`);
      await logAuditEvent({
        businessId: driverRecord.businessId,
        userId: driverRecord.staffId,
        userRole: 'driver',
        action: 'driver_login_invalid_pin',
        status: 'failed',
        ipAddress: req.ip,
      });

      res.status(401).json({
        success: false,
        error: 'INVALID_PIN',
        message: `Incorrect PIN. (${attemptsRemaining} attempts remaining before lockout)`,
        attemptsRemaining,
        locked,
      });
      return;
    }

    clearFailedAttempts(`driver_${cleanPhone}`);

    const tokens = generateTokens({
      uid: `driver_${driverRecord.businessId}_${driverRecord.staffId}`,
      email: `${cleanPhone}@driver.scalekitchen.internal`,
      role: 'driver',
      businessId: driverRecord.businessId,
      staffId: driverRecord.staffId,
      branchId: driverRecord.branchId,
      name: driverRecord.name,
    });

    await logAuditEvent({
      businessId: driverRecord.businessId,
      userId: driverRecord.staffId,
      userRole: 'driver',
      action: 'driver_login_success',
      status: 'success',
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      driver: {
        uid: `driver_${driverRecord.businessId}_${driverRecord.staffId}`,
        name: driverRecord.name,
        phone: cleanPhone,
        businessId: driverRecord.businessId,
        staffId: driverRecord.staffId,
        branchId: driverRecord.branchId,
        status: 'Active',
      },
      tokens,
    });
  }
);

// GET /api/driver/route
driverRouter.get(
  '/route',
  authenticateToken,
  requireRoles(['driver', 'admin']),
  async (req: Request, res: Response): Promise<void> => {
    const driverId = req.user?.staffId || (req.query.driverId as string) || 'staff_suresh';
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const route = await dbService.getDriverRoute(driverId, date);
    res.status(200).json({
      success: true,
      route,
    });
  }
);

// POST /api/driver/deliver
driverRouter.post(
  '/deliver',
  authenticateToken,
  requireRoles(['driver', 'admin']),
  async (req: Request, res: Response): Promise<void> => {
    const { deliveryId, status, collectedBoxes, notes, latitude, longitude } = req.body;
    const driverId = req.user?.staffId || 'staff_suresh';

    if (!deliveryId || !status) {
      res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'deliveryId and status are required',
      });
      return;
    }

    const updated = await dbService.updateDeliveryStatus(driverId, deliveryId, status, {
      collectedBoxes,
      notes,
    });

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'DELIVERY_NOT_FOUND',
        message: `Delivery ${deliveryId} not found in current route`,
      });
      return;
    }

    await logAuditEvent({
      businessId: req.user?.businessId || 'biz_spicedelight',
      userId: driverId,
      userRole: 'driver',
      action: 'driver_delivery_completed',
      resource: 'delivery',
      resourceId: deliveryId,
      newValue: { status, collectedBoxes, latitude, longitude },
      status: 'success',
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Delivery marked complete',
      updatedDelivery: updated,
    });
  }
);

// POST /api/driver/status
driverRouter.post(
  '/status',
  authenticateToken,
  requireRoles(['driver', 'admin']),
  async (req: Request, res: Response): Promise<void> => {
    const { status, latitude, longitude, batteryLevel, isShiftActive } = req.body;
    const businessId = req.user?.businessId || 'biz_spicedelight';
    const staffId = req.user?.staffId || 'staff_suresh';

    await dbService.updateDriverStatus(businessId, staffId, {
      status,
      latitude,
      longitude,
      batteryLevel,
      isShiftActive,
    });

    res.status(200).json({
      success: true,
      message: 'Driver status and coordinates updated successfully',
    });
  }
);

// GET /api/driver/boxes
driverRouter.get(
  '/boxes',
  authenticateToken,
  requireRoles(['driver', 'admin']),
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      boxes: [
        { boxType: 'Stainless Steel 3-Tier Dabba', count: 8, condition: 'Clean' },
        { boxType: 'Eco Glass-Lock Meal Container', count: 3, condition: 'Clean' },
      ],
    });
  }
);
