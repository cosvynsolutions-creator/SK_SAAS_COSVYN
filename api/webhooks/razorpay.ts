import { Router, Request, Response } from 'express';
import { verifyRazorpayWebhookSignature } from '../../services/payment-service/src/razorpay';
import { logAuditEvent } from '../../services/audit-service/src/logger';

export const webhooksRouter = Router();

// POST /api/webhooks/razorpay
webhooksRouter.post('/razorpay', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
  if (!isValid && process.env.NODE_ENV === 'production') {
    res.status(400).json({ success: false, error: 'INVALID_SIGNATURE' });
    return;
  }

  const event = req.body?.event || 'payment.captured';
  const paymentEntity = req.body?.payload?.payment?.entity;

  await logAuditEvent({
    businessId: paymentEntity?.notes?.businessId || 'global',
    userId: 'razorpay_webhook',
    userRole: 'public',
    action: `webhook_${event}`,
    resource: 'payment',
    resourceId: paymentEntity?.id || 'unknown_payment',
    newValue: paymentEntity,
    ipAddress: req.ip,
  });

  res.status(200).json({
    success: true,
    message: 'Webhook processed successfully',
  });
});
