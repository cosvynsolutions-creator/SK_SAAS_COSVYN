import { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

const attemptsStore = new Map<string, AttemptRecord>();

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

export const recordFailedAttempt = (key: string): { locked: boolean; attemptsRemaining: number } => {
  const now = Date.now();
  let record = attemptsStore.get(key);

  if (!record || (record.lockedUntil && record.lockedUntil < now)) {
    record = { count: 0, lockedUntil: null };
  }

  record.count += 1;
  if (record.count >= MAX_FAILURES) {
    record.lockedUntil = now + LOCKOUT_MS;
    attemptsStore.set(key, record);
    return { locked: true, attemptsRemaining: 0 };
  }

  attemptsStore.set(key, record);
  return { locked: false, attemptsRemaining: MAX_FAILURES - record.count };
};

export const clearFailedAttempts = (key: string): void => {
  attemptsStore.delete(key);
};

export const checkRateLimit = (getKey: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = getKey(req);
    const record = attemptsStore.get(key);
    const now = Date.now();

    if (record?.lockedUntil && record.lockedUntil > now) {
      const waitMinutes = Math.ceil((record.lockedUntil - now) / 60000);
      res.status(429).json({
        success: false,
        error: 'ACCOUNT_LOCKED',
        message: `Too many failed attempts. Try again in ${waitMinutes} minutes.`,
        locked: true,
      });
      return;
    }

    next();
  };
};
