/**
 * Utilities for formatting currencies, dates, phone numbers, and addresses.
 */

export const formatCurrencyINR = (amountInPaiseOrRupees: number, isPaise = false): string => {
  const value = isPaise ? amountInPaiseOrRupees / 100 : amountInPaiseOrRupees;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

export const formatDate = (dateInput: string | Date | number): string => {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateInput);
  }
};

export const formatTime = (dateInput: string | Date | number): string => {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

export const sanitizePhone = (phone: string): string => {
  const cleaned = (phone || '').replace(/\D/g, '');
  if (cleaned.length > 10 && cleaned.startsWith('91')) {
    return cleaned.slice(2);
  }
  return cleaned.slice(-10);
};
