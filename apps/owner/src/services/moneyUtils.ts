/**
 * Helper to handle currency amounts between legacy records (in Rupees)
 * and new Phase 3 records (stored as integer paise).
 *
 * Old records: { amount: 999 } (in Rupees)
 * New records: { amountPaise: 99900, amount: 999, currency: 'INR' }
 */

export interface MoneyRecord {
  amount?: number;
  amountPaise?: number;
  price?: number;
  pricePaise?: number;
  currency?: string;
  [key: string]: any;
}

/**
 * Returns the amount in Rupees (decimal/float).
 * Prioritizes integer amountPaise if available.
 */
export const getAmountInRupees = (record: MoneyRecord | number | null | undefined): number => {
  if (record === null || record === undefined) return 0;
  if (typeof record === 'number') {
    return isNaN(record) ? 0 : record;
  }

  // If amountPaise is present as a number
  if (typeof record.amountPaise === 'number' && !isNaN(record.amountPaise)) {
    return Math.round(record.amountPaise) / 100;
  }

  if (typeof record.pricePaise === 'number' && !isNaN(record.pricePaise)) {
    return Math.round(record.pricePaise) / 100;
  }

  // Fallback to legacy amount / price in rupees
  if (typeof record.amount === 'number' && !isNaN(record.amount)) {
    return record.amount;
  }

  if (typeof record.price === 'number' && !isNaN(record.price)) {
    return record.price;
  }

  return 0;
};

/**
 * Returns the amount in integer Paise.
 */
export const getAmountInPaise = (record: MoneyRecord | number | null | undefined): number => {
  if (record === null || record === undefined) return 0;
  if (typeof record === 'number') {
    return Math.round((isNaN(record) ? 0 : record) * 100);
  }

  if (typeof record.amountPaise === 'number' && !isNaN(record.amountPaise)) {
    return Math.round(record.amountPaise);
  }

  if (typeof record.pricePaise === 'number' && !isNaN(record.pricePaise)) {
    return Math.round(record.pricePaise);
  }

  if (typeof record.amount === 'number' && !isNaN(record.amount)) {
    return Math.round(record.amount * 100);
  }

  if (typeof record.price === 'number' && !isNaN(record.price)) {
    return Math.round(record.price * 100);
  }

  return 0;
};

/**
 * Formats a money record or number into INR currency string (e.g. ₹999 or ₹9,599)
 */
export const formatMoney = (recordOrNumber: MoneyRecord | number | null | undefined): string => {
  const rupees = getAmountInRupees(recordOrNumber);
  return `₹${rupees.toLocaleString('en-IN')}`;
};
