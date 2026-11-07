import { Router, Request, Response } from 'express';
import { dbService } from '../../services/db-service/src/firestore';
import { comparePassword, hashPassword } from '../../services/auth-service/src/password';
import { generateTokens, verifyRefreshToken } from '../../services/auth-service/src/jwt';
import { recordFailedAttempt, clearFailedAttempts, checkRateLimit } from '../middleware/rateLimit';
import { logAuditEvent } from '../../services/audit-service/src/logger';
import { authenticateToken } from '../middleware/auth';
import { UserRole } from '../../packages/types/src/auth';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post(
  '/login',
  checkRateLimit((req) => `login_${req.body.email || req.ip}`),
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Email and password are required',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await dbService.findUserByEmail(normalizedEmail);

    if (!user || !user.password_hash) {
      const { locked, attemptsRemaining } = recordFailedAttempt(`login_${normalizedEmail}`);
      await logAuditEvent({
        businessId: 'unknown',
        userId: normalizedEmail,
        userRole: role || 'public',
        action: 'auth_login_failed',
        status: 'failed',
        ipAddress: req.ip,
      });

      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
        attemptsRemaining,
        locked,
      });
      return;
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      const { locked, attemptsRemaining } = recordFailedAttempt(`login_${normalizedEmail}`);
      await logAuditEvent({
        businessId: user.businessId,
        userId: user.uid,
        userRole: user.role,
        action: 'auth_login_password_mismatch',
        status: 'failed',
        ipAddress: req.ip,
      });

      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
        attemptsRemaining,
        locked,
      });
      return;
    }

    clearFailedAttempts(`login_${normalizedEmail}`);

    const tokens = generateTokens({
      uid: user.uid,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
      branchId: user.branchId,
      name: user.name,
    });

    await logAuditEvent({
      businessId: user.businessId,
      userId: user.uid,
      userRole: user.role,
      action: 'auth_login_success',
      status: 'success',
      ipAddress: req.ip,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
        branchId: user.branchId,
      },
      tokens,
    });
  }
);

// POST /api/auth/signup
authRouter.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const { email, password, businessName, ownerName, phone, city } = req.body;

  if (!email || !password || !businessName || !ownerName) {
    res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'Email, password, businessName and ownerName are required',
    });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await dbService.findUserByEmail(normalizedEmail);
  if (existing) {
    res.status(409).json({
      success: false,
      error: 'EMAIL_ALREADY_EXISTS',
      message: 'An account with this email already exists',
    });
    return;
  }

  const hashedPassword = await hashPassword(password);
  const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const bizId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Create Business
  await dbService.createBusiness({
    id: bizId,
    uid,
    name: businessName,
    email: normalizedEmail,
    phone: phone || '',
    city: city || 'Bangalore',
    subscription: {
      status: 'active',
      plan: 'free_trial',
      startDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      features: { mealsPerDay: 50, staff: 5, branches: 1 },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Create User
  const newUser = await dbService.createUser({
    uid,
    email: normalizedEmail,
    name: ownerName,
    role: 'owner',
    businessId: bizId,
    phone: phone || '',
    password_hash: hashedPassword,
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  const tokens = generateTokens({
    uid: newUser.uid,
    email: newUser.email,
    role: newUser.role,
    businessId: newUser.businessId,
    name: newUser.name,
  });

  await logAuditEvent({
    businessId: bizId,
    userId: uid,
    userRole: 'owner',
    action: 'auth_signup',
    resource: 'user',
    resourceId: uid,
    status: 'success',
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    user: {
      uid: newUser.uid,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      businessId: newUser.businessId,
    },
    message: 'Account created successfully. Welcome to ScaleKitchen!',
    tokens,
  });
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  if (!token) {
    res.status(400).json({ success: false, error: 'MISSING_REFRESH_TOKEN' });
    return;
  }

  try {
    const verified = verifyRefreshToken(token);
    const user = await dbService.findUserById(verified.uid);
    if (!user) {
      res.status(401).json({ success: false, error: 'USER_NOT_FOUND' });
      return;
    }

    const tokens = generateTokens({
      uid: user.uid,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
      branchId: user.branchId,
      name: user.name,
    });

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'INVALID_REFRESH_TOKEN',
      message: err?.message || 'Refresh token has expired or is invalid',
    });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('refreshToken');
  if (req.user) {
    await logAuditEvent({
      businessId: req.user.businessId,
      userId: req.user.uid,
      userRole: req.user.role,
      action: 'auth_logout',
      status: 'success',
      ipAddress: req.ip,
    });
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/verify
authRouter.get('/verify', authenticateToken, (req: Request, res: Response): void => {
  res.json({
    success: true,
    user: req.user,
  });
});
