export const API_BASE_URL = typeof window !== 'undefined' ? (window.location.origin) : '';

export const JWT_EXPIRY_OWNER = '15m';
export const JWT_EXPIRY_DRIVER = '24h';
export const REFRESH_EXPIRY = '7d';

export const MEAL_SESSIONS = ['breakfast', 'lunch', 'dinner'] as const;

export const REUSABLE_CONTAINER_TYPES = [
  'Stainless Steel 3-Tier Dabba',
  'Stainless Steel 4-Tier Dabba',
  'Insulated Thermal Bento Box',
  'Eco Glass-Lock Meal Container',
  'None (Disposable)'
] as const;
