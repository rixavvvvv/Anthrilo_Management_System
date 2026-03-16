export { cn } from './cn';

// Formats a number as Indian Rupee currency (e.g. ₹1,23,456)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

// Adds Indian-style locale commas to a number (e.g. 12,34,567)
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

// Cuts text to a max length with an ellipsis at the end
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '…';
}

// Pulls the first two initials from a name (e.g. "John Doe" → "JD")
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Joins non-null parts with ":" to build a cache key string
export function cacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter((p) => p != null).join(':');
}
