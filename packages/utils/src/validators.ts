export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());
};

export const isValidPhone = (phone: string): boolean => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
};

export const isValidPin = (pin: string): boolean => {
  return /^\d{4,6}$/.test(pin?.trim());
};
