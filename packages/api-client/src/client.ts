import { storage } from '../../utils/src/storage';

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const apiClient = async <T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { requiresAuth = true, headers = {}, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has('Content-Type') && !(rest.body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (requiresAuth) {
    const token = storage.getAccessToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const normalizedUrl = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  let response: Response;
  try {
    response = await fetch(normalizedUrl, {
      ...rest,
      headers: requestHeaders,
    });
  } catch (err: any) {
    throw new ApiError(err?.message || 'Network request failed', 0);
  }

  // Handle 401 Unauthorized (attempt refresh)
  if (response.status === 401 && requiresAuth) {
    const refreshToken = storage.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.accessToken) {
            storage.setAccessToken(refreshData.accessToken);
            requestHeaders.set('Authorization', `Bearer ${refreshData.accessToken}`);
            response = await fetch(normalizedUrl, {
              ...rest,
              headers: requestHeaders,
            });
          }
        } else {
          storage.clearAuth();
        }
      } catch {
        storage.clearAuth();
      }
    }
  }

  let data: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errMsg = (data && (data.error || data.message)) || `HTTP ${response.status}: ${response.statusText}`;
    throw new ApiError(errMsg, response.status, data);
  }

  return data as T;
};
