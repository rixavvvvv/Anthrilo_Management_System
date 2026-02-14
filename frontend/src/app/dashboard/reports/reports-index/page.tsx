'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/Common';

const reportCategories = [
  {
    category: 'Sales & Discounts',
    icon: '💰',
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    borderColor: 'border-amber-500/30',
    reports: [
      {
        title: 'Sales Analytics',
        description: 'Comprehensive sales performance analysis',
        href: '/dashboard/reports/sales',
      },
      {
        title: 'Bundle SKU Sales',
        description: 'Size-wise bundle sales breakdown',
        href: '/dashboard/reports/sales/bundle-sku',
        badge: 'NEW',
      },
      {
        title: 'General Discount Report',
        description: 'Product-wise discount analysis',
        href: '/dashboard/reports/sales/discount-general',
        badge: 'NEW',
      },
      {
        title: 'Discount by Panel',
        description: 'Panel-wise discount tracking',
        href: '/dashboard/reports/sales/discount-by-panel',
        badge: 'NEW',
      },
    ],
  },
  {
    category: 'Panel Management',
    icon: '🏪',
    gradient: 'from-purple-500 to-violet-500',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    borderColor: 'border-purple-500/30',
    reports: [
      {
        title: 'Panel Performance',
        description: 'Track panel sales performance',
        href: '/dashboard/reports/panels',
      },
      {
        title: 'Top Performing Panels',
        description: 'Identify best performing panels',
        href: '/dashboard/reports/panels',
      },
      {
        title: 'Panel Settlement',
        description: 'Calculate settlements with commissions',
        href: '/dashboard/reports/panels/settlement',
        badge: 'NEW',
      },
    ],
  },
  {
    category: 'Raw Materials & Processing',
    icon: '📦',
    gradient: 'from-blue-500 to-cyan-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-500/30',
    reports: [
      {
        title: 'Stock Analysis',
        description: 'Monitor inventory levels and stock status',
        href: '/dashboard/reports/raw-materials/stock-analysis',
      },
      {
        title: 'Yarn Forecasting',
        description: 'AI-powered demand forecasting for yarn',
        href: '/dashboard/reports/raw-materials/yarn-forecasting',
      },
    ],
  },
  {
    category: 'Financial Reports',
    icon: '📊',
    gradient: 'from-indigo-500 to-primary-500',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    borderColor: 'border-indigo-500/30',
    reports: [
      {
        title: 'Purchase Analysis',
        description: 'Raw material purchase tracking',
        href: '/dashboard/reports/financial',
      },
      {
        title: 'Sales Analysis',
        description: 'Finished goods sales performance',
        href: '/dashboard/reports/financial',
      },
      {
        title: 'Profit Margin',
        description: 'Profitability analysis',
        href: '/dashboard/reports/financial',
      },
      {
        title: 'Expense Tracking',
        description: 'Track all business expenses',
        href: '/dashboard/reports/financial',
      },
    ],
  },
];

const totalReports = reportCategories.reduce((sum, cat) => sum + cat.reports.length, 0);

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & Analytics"
        description={`Access comprehensive business intelligence and reporting tools — ${totalReports} reports available`}
      />

      {/* Category Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {reportCategories.map((category) => (
          <div
            key={category.category}
            className="card flex items-center gap-3 py-4"
          >
            <div className={`h-10 w-10 rounded-xl ${category.iconBg} flex items-center justify-center flex-shrink-0`}>
              <span className="text-xl">{category.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {category.category}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {category.reports.length} reports
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Report Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {reportCategories.map((category) => (
          <div
            key={category.category}
            className={`card overflow-hidden border ${category.borderColor}`}
          >
            {/* Category Header */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700/50">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${category.gradient} flex items-center justify-center shadow-lg`}>
                <span className="text-2xl">{category.icon}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {category.category}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {category.reports.length} reports available
                </p>
              </div>
            </div>

            {/* Report Links */}
            <div className="space-y-2">
              {category.reports.map((report) => (
                <Link
                  key={report.title + report.href}
                  href={report.href}
                  className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all duration-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {report.title}
                      </h3>
                      {report.badge && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-md font-bold uppercase tracking-wide">
                          {report.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {report.description}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-500 dark:group-hover:text-primary-400 flex-shrink-0 ml-3 transform group-hover:translate-x-0.5 transition-all"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
