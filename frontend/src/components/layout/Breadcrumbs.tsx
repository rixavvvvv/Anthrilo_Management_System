'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo } from 'react';

// ─── Helpers ───────────────────────────────────────────────────────────────
const ACRONYMS: Record<string, string> = {
  sku: 'SKU',
  cod: 'COD',
  roi: 'ROI',
  grn: 'GRN',
  ai: 'AI',
  uc: 'UC',
};

function toTitleCase(segment: string): string {
  return segment
    .split('-')
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Segments that are internal routing artefacts — skip from display
const SKIP_SEGMENTS = new Set(['reports-index', 'v1']);

// ─── Component ─────────────────────────────────────────────────────────────
export const Breadcrumbs = memo(function Breadcrumbs() {
  const pathname = usePathname();

  const rawSegments = pathname.split('/').filter(Boolean);
  const segments = rawSegments.filter((s) => !SKIP_SEGMENTS.has(s));

  return (
    <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-0.5 text-sm min-w-0 flex-1">
      {segments.map((seg, i) => {
        // Reconstruct href using rawSegments so routing still works
        const rawUntil = rawSegments.slice(0, rawSegments.indexOf(seg, i) + 1);
        const href = '/' + rawUntil.join('/');
        const label = toTitleCase(seg);
        const isLast = i === segments.length - 1;

        return (
          <span key={`${seg}-${i}`} className="flex items-center gap-0.5 min-w-0">
            {i > 0 && (
              <span className="text-slate-300 dark:text-slate-700 flex-shrink-0 px-0.5 select-none text-base leading-none">
                /
              </span>
            )}
            {isLast ? (
              <span
                aria-current="page"
                className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]"
                title={label}
              >
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-[140px]"
                title={label}
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
});
