import jwt from 'jsonwebtoken';
import { JWTPayload, AuthTokens, UserRole } from '../../../packages/types/src/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'scalekitchen-jwt-production-secret-key-2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'scalekitchen-refresh-token-secret-key-2026';

export const generateTokens = (payload: Omit<JWTPayload, 'iat' | 'exp'>): AuthTokens => {
  const isDriver = payload.role === 'driver';
  const expiresInSeconds = isDriver ? 86400 : 900; // 24 hours for driver, 15 mins for owner/manager

  const accessToken = jwt.sign(
    { ...payload },
    JWT_SECRET,
    { expiresIn: expiresInSeconds }
  );

  const refreshToken = jwt.sign(
    { uid: payload.uid, role: payload.role, businessId: payload.businessId },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: expiresInSeconds,
  };
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

export const verifyRefreshToken = (token: string): { uid: string; role: UserRole; businessId: string } => {
  return jwt.verify(token, REFRESH_SECRET) as { uid: string; role: UserRole; businessId: string };
};
