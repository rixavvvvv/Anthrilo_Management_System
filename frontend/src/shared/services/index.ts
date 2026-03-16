// Shared services — centralized modules re-exported for convenience.
// Feature-specific API calls live in features/{module}/api/.

// Core API client (Axios instance with auth interceptor)
export { apiClient } from '@/lib/api-client';

// Auth utilities
export { getStoredToken, storeAuth, clearAuth, isAuthenticated } from '@/lib/auth';
export type { AuthUser } from '@/lib/auth';

// Auth context
export { useAuth } from '@/contexts/AuthContext';

// WebSocket
export { useWebSocket } from '@/lib/hooks/useWebSocket';

// Date utilities
export { resolveReportDateRange, getTodayYmd, getYesterdayYmd } from '@/lib/report-date-range';
export type { ReportDateMode } from '@/lib/report-date-range';
