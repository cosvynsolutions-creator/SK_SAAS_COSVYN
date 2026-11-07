import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.status || err.statusCode || 500;
  const errorKey = err.code || err.name || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  console.error(`[API Error] ${req.method} ${req.originalUrl} - ${errorKey}: ${message}`);

  res.status(statusCode).json({
    success: false,
    error: errorKey,
    message: message,
    timestamp: new Date().toISOString()
  });
};
