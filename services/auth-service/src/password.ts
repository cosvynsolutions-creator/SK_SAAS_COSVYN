import bcrypt from 'bcryptjs';

const PASSWORD_SALT_ROUNDS = 12;
const PIN_SALT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
};

export const hashPin = async (pin: string): Promise<string> => {
  return bcrypt.hash(pin.trim(), PIN_SALT_ROUNDS);
};

export const comparePin = async (pin: string, hash: string): Promise<boolean> => {
  if (!pin || !hash) return false;
  return bcrypt.compare(pin.trim(), hash);
};
