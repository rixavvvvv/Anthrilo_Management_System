// App info
export const APP_NAME = 'Anthrilo';
export const APP_DESCRIPTION = 'Enterprise Resource Management';

// API settings
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
export const API_TIMEOUT = 720_000; // 12 min

// Pagination
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

// Date formats
export const DATE_FORMAT_DISPLAY = 'dd MMM yyyy';
export const DATE_FORMAT_API = 'yyyy-MM-dd';

// React Query cache timing
export const QUERY_STALE_TIME = 5 * 60 * 1000; // 5 min
export const QUERY_RETRY_COUNT = 1;

// Debounce delays (ms)
export const DEBOUNCE_SEARCH = 300;
export const DEBOUNCE_FILTER = 200;

// Toast auto-dismiss timeout (ms)
export const TOAST_DURATION = 4000;
