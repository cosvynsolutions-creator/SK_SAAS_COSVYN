/**
 * ScaleKitchen Delivery Application — WhatsApp Communication Service
 *
 * Source Provenance:
 * Extracted from root `/services/messageTemplates.ts`.
 */

export const getEffectiveBusinessName = (businessName?: string | null): string => {
  if (businessName && businessName.trim()) {
    const trimmed = businessName.trim();
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
