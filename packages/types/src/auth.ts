export type UserRole = 'owner' | 'manager' | 'driver' | 'admin' | 'public';

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  branchId?: string;
  staffId?: string;
  phone?: string;
  email_verified?: boolean;
  createdAt?: string;
  lastLogin?: string;
  status: 'active' | 'suspended' | 'deleted';
}

export interface JWTPayload {
  uid: string;
  email: string;
  role: UserRole;
  businessId: string;
  staffId?: string;
  branchId?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  success: boolean;
  user?: Partial<AuthUser>;
  driver?: Partial<AuthUser>;
  tokens?: AuthTokens;
  error?: string;
  message?: string;
  attemptsRemaining?: number;
}
