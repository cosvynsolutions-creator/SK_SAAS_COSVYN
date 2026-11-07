import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    // Suppress spammy log outputs for health checks
    if (!originalUrl.includes('/health')) {
      console.log(`[HTTP] ${method} ${originalUrl} -> ${status} (${duration}ms)`);
    }
  });

  next();
};
