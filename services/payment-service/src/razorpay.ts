import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_secret';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_default';

export const createRazorpayOrder = async (params: {
  planId: string;
  durationMonths: number;
  businessId: string;
}) => {
  // Plan pricing lookup
  const priceMap: Record<string, number> = {
    starter: 999,
    pro: 2499,
    enterprise: 4999,
    premium_1_month: 4999,
  };

  const basePrice = priceMap[params.planId] || 2499;
  const totalAmount = basePrice * (params.durationMonths || 1);
  const amountInPaise = totalAmount * 100;
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    orderId,
    amount: amountInPaise,
    currency: 'INR',
    keyId: RAZORPAY_KEY_ID,
    planId: params.planId,
    message: 'Order created successfully. Proceed to payment gateway.',
  };
};

export const verifyRazorpayWebhookSignature = (
  rawBody: string,
  receivedSignature: string
): boolean => {
  if (!receivedSignature) return false;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch {
    return false;
  }
};
