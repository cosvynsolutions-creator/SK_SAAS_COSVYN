import { AuditLogEntry } from '../../../packages/types/src/api';

// In-memory buffer to guarantee instantaneous querying and offline resilience
const inMemoryAuditLogs: AuditLogEntry[] = [];

export interface CreateAuditLogParams {
  businessId: string;
  userId: string;
  userRole: string;
  action: string;
  target?: string;
  resource?: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failed';
}

export const logAuditEvent = async (params: CreateAuditLogParams): Promise<AuditLogEntry> => {
  const entry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    businessId: params.businessId || 'global',
    userId: params.userId || 'anonymous',
    userRole: params.userRole || 'public',
    action: params.action,
    target: params.target || params.resource,
    resource: params.resource,
    resourceId: params.resourceId,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    ipAddress: params.ipAddress || '127.0.0.1',
    userAgent: params.userAgent || 'ScaleKitchen-API',
    status: params.status || 'success',
  };

  inMemoryAuditLogs.unshift(entry);
  if (inMemoryAuditLogs.length > 500) {
    inMemoryAuditLogs.pop();
  }

  // Also write to Firestore when database is connected
  try {
    const { getFirestoreInstance } = await import('../../db-service/src/firestore');
    const { collection, addDoc } = await import('firebase/firestore');
    const db = getFirestoreInstance();
    if (db) {
      await addDoc(collection(db, 'audit_logs'), entry);
    }
  } catch (err) {
    // Keep in-memory copy without failing request
  }

  return entry;
};

export const getAuditLogs = (params: {
  businessId?: string;
  action?: string;
  page?: number;
  limit?: number;
}): { logs: AuditLogEntry[]; total: number } => {
  let filtered = [...inMemoryAuditLogs];
  if (params.businessId && params.businessId !== 'all') {
    filtered = filtered.filter(l => l.businessId === params.businessId);
  }
  if (params.action) {
    filtered = filtered.filter(l => l.action.toLowerCase().includes(params.action!.toLowerCase()));
  }

  const page = params.page || 1;
  const limit = params.limit || 50;
  const start = (page - 1) * limit;
  const logs = filtered.slice(start, start + limit);

  return {
    logs,
    total: filtered.length,
  };
};
