import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../services/auth-service/src/jwt';
import { JWTPayload, UserRole } from '../../packages/types/src/auth';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header with Bearer token'
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'TOKEN_EXPIRED_OR_INVALID',
      message: err?.message || 'Invalid or expired access token'
    });
    return;
  }
};

export const requireRoles = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (roles.includes(req.user.role) || req.user.role === 'admin') {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: `Role '${req.user.role}' is not authorized to access this resource`
    });
  };
};

export const enforceTenantIsolation = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  // Admins bypass tenant isolation
  if (req.user.role === 'admin') {
    next();
    return;
  }

  const requestedBizId = req.params.businessId || req.body.businessId || req.query.businessId;

  if (requestedBizId && requestedBizId !== req.user.businessId) {
    res.status(403).json({
      success: false,
      error: 'TENANT_ACCESS_DENIED',
      message: 'Cross-tenant data access is strictly forbidden'
    });
    return;
  }

  next();
};
