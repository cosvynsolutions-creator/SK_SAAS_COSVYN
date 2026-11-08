/**
 * Centralized Reusable Message Template Service (Module 2)
 *
 * Ensures all customer-facing notifications, WhatsApp links, and driver dispatches
 * dynamically use the authenticated tenant's actual business name instead of
 * hardcoded platform names.
 */

import { formatDateDDMMYYYY } from './store';

/**
 * Normalizes and extracts the tenant's business name with a sensible fallback.
 */
export const getEffectiveBusinessName = (businessName?: string | null): string => {
  if (businessName && businessName.trim()) {
    const trimmed = businessName.trim();
    // Guard against placeholder / hardcoded names
    if (trimmed.toLowerCase() !== 'scalekitchen') {
      return trimmed;
    }
  }
  return 'Your Kitchen Service';
};

/**
 * Formats a clean WhatsApp URL with URL-encoded message text.
 */
export const buildWhatsAppUrl = (mobile: string | null | undefined, message: string): string => {
  const cleanDigits = String(mobile || '').replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  // Prepend 91 country code if 10-digit Indian number
  const finalPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
  return `https://wa.me/${finalPhone}?text=${encoded}`;
};

/**
 * Customer meal arrival notification for delivery boys.
 */
export const getDeliveryArrivalMessage = (
  customerName: string,
  mealTime: string,
  businessName?: string | null
): string => {
  const biz = getEffectiveBusinessName(businessName);
  return `Hi ${customerName}, your ${mealTime} meal is arriving shortly from ${biz}!`;
};

/**
 * Customer subscription meal plan status update.
 */
export const getCustomerPlanStatusMessage = (
  customerName: string,
  mealTime: string,
  planName: string,
  delivered: number,
  totalDays: number,
  pending: number,
  pausedDays: number,
  endDate: string,
  businessName?: string | null
): string => {
  const biz = getEffectiveBusinessName(businessName);
  return (
    `*${mealTime} Status - ${biz}*\n\n` +
    `Hello ${customerName},\n` +
    `Your ${mealTime} subscription (${planName}) status:\n` +
    `✅ Delivered: ${delivered}/${totalDays}\n` +
    `⏳ Pending: ${pending}\n` +
    `⏸ Paused: ${pausedDays} days\n` +
    `📅 Expiry: ${formatDateDDMMYYYY(endDate)}\n\n` +
    `Thank you for choosing ${biz}!`
  );
};

/**
 * Full subscription summary message for customer WhatsApp sharing.
 */
export const getSubscriptionSummaryMessage = (
  customer: any,
  activePlans: any[],
  plansConfig: any[],
  calculateRemainingFn: (endDate: string, weekdays: number[], pauses: any[]) => number,
  businessName?: string | null
): string => {
  const biz = getEffectiveBusinessName(businessName);
  let msg = `*${biz} - Subscription Summary: ${customer.name}*\n\n`;

  (activePlans || []).forEach(p => {
    const planConfig = plansConfig.find(pc => pc.id === p.planId);
    const left = calculateRemainingFn(p.endDate, planConfig?.weekdays || [], p.pauses || []);
    msg += `🍴 *${p.mealTime} Plan* ${p.isStarred ? '⭐ (Spl Req)' : ''}\nPlan: ${p.planName}\nExpiry: ${formatDateDDMMYYYY(p.endDate)}\nDeliveries Left: ${left}\n\n`;
  });

  if (customer.notes) msg += `📝 Notes: ${customer.notes}\n\n`;
  if (customer.locationLink) msg += `📍 Location: ${customer.locationLink}\n\n`;
  if (customer.deliveryCharges && Number(customer.deliveryCharges) > 0) msg += `🚚 Delivery: ₹${customer.deliveryCharges}\n`;
  if (customer.discount && Number(customer.discount) > 0) msg += `🏷️ Discount Applied: ₹${customer.discount} OFF\n`;
  msg += `📍 Address: ${customer.address}\n💰 Total Pending: ₹${customer.pendingAmount || 0}\n\n`;
  msg += `Thank you for subscribing to ${biz}!`;

  return msg;
};

/**
 * Reusable box return gentle reminder message.
 */
export const getReusableBoxReminderMessage = (
  customerName: string,
  uncollectedCount: number,
  boxName: string,
  businessName?: string | null
): string => {
  const biz = getEffectiveBusinessName(businessName);
  return (
    `Hello ${customerName}! 👋\n\n` +
    `Gentle reminder from *${biz}*: You currently have *${uncollectedCount} ${boxName}* with you.\n\n` +
    `Kindly hand it over to our delivery partner during today's meal delivery. Thank you for supporting eco-friendly packaging! 🍱🌿`
  );
};

/**
 * Customer Invoice sharing message.
 */
export const getInvoiceShareMessage = (
  invoiceNo: string,
  grandTotal: number,
  dueDate: string,
  companyName?: string | null,
  isAttachmentNotice: boolean = false
): string => {
  const biz = getEffectiveBusinessName(companyName);
  let msg = `*Invoice from ${biz}*\n\n` +
    `Invoice No: ${invoiceNo}\n` +
    `Amount Due: ₹${grandTotal.toLocaleString('en-IN')}\n` +
    `Due Date: ${formatDateDDMMYYYY(dueDate)}\n\n`;

  if (isAttachmentNotice) {
    msg += `📄 *The official Invoice PDF has been downloaded to your device.* Please find it attached.\n\n`;
  }

  msg += `Thank you for your business!`;
  return msg;
};

/**
 * Driver app access link sharing message.
 */
export const getDriverAppShareMessage = (
  boyName: string,
  boyUrl: string,
  businessName?: string | null
): string => {
  const biz = getEffectiveBusinessName(businessName);
  return (
    `Hello ${boyName}! 🚀\n\n` +
    `Here is your *${biz}* Delivery App access link for today's deliveries:\n` +
    `${boyUrl}\n\n` +
    `📱 *Steps:*\n` +
    `1. Open link on your phone browser\n` +
    `2. Sign in with the email address and password configured by your kitchen owner\n` +
    `3. Punch In to activate live route tracking and view today's meal stops!\n\n` +
    `Have a safe delivery ride!`
  );
};

/**
 * Branch manager access credentials message.
 */
export const getManagerPortalShareMessage = (
  managerName: string,
  branchName: string,
  baseUrl: string,
  email: string,
  password: string,
  allowedPagesCount: number,
  businessName?: string | null
): string => {
  const biz = getEffectiveBusinessName(businessName);
  return (
    `Hello ${managerName}! 👨‍🍳\n\n` +
    `Here are your *${biz}* Manager Portal login credentials for ${branchName}:\n\n` +
    `🔗 *Manager App Link:*\n${baseUrl}\n\n` +
    `🔑 *Login Credentials:*\n• *Email:* ${email}\n• *Password:* ${password}\n\n` +
    `📌 *Permissions Enabled:* ${allowedPagesCount} modules\n\n` +
    `Please log in to manage orders, inventory, and kitchen dispatch for your assigned branch.`
  );
};
