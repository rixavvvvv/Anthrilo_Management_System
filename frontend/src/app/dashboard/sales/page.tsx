'use client';

import { useQuery } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import Link from 'next/link';

export default function SalesPage() {
  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await salesApi.getAll();
      return response.data;
    },
  });

  // Calculate statistics
  const totalSales = sales?.length || 0;
  const totalRevenue = sales?.reduce((sum: number, sale: any) => 
    sum + (parseFloat(sale.unit_price) * parseInt(sale.quantity)), 0
  ) || 0;
  const todaySales = sales?.filter((s: any) => {
    const saleDate = new Date(s.sale_date).toDateString();
    const today = new Date().toDateString();
    return saleDate === today;
  })?.length || 0;
  const todaysRevenue = sales?.filter((s: any) => {
    const saleDate = new Date(s.sale_date).toDateString();
    const today = new Date().toDateString();
    return saleDate === today;
  })?.reduce((sum: number, s: any) => sum + (parseFloat(s.unit_price) * parseInt(s.quantity)), 0) || 0;

  const modules = [
    {
      title: 'Daily Sales',
      description: 'Record and manage daily sales transactions',
      href: '/dashboard/sales/transactions',
      icon: '💰',
      gradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      stats: `${todaySales} sales today`,
    },
    {
      title: 'Panel Management',
      description: 'Manage sales panels and distribution',
      href: '/dashboard/sales/panels',
      icon: '🏪',
      gradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      stats: 'Track panel performance',
    },
    {
      title: 'Sales Reports',
      description: 'View detailed sales analytics and reports',
      href: '/dashboard/sales/reports',
      icon: '📊',
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      stats: 'Multiple report types',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Sales Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage sales transactions, panels, and view analytics
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Total Sales</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : totalSales}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-green-500/20 dark:bg-green-500/30 flex items-center justify-center">
              <span className="text-3xl">📦</span>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center">
              <span className="text-3xl">💰</span>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Today's Sales</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : todaySales}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center">
              <span className="text-3xl">📈</span>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Today's Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : `₹${todaysRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-purple-500/20 dark:bg-purple-500/30 flex items-center justify-center">
              <span className="text-3xl">💵</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Modules */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Sales Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <Link
              key={module.title}
              href={module.href}
              className="group relative card hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${module.gradient} opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300`}></div>
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-16 w-16 rounded-2xl ${module.iconBg} flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                    <span className="text-4xl">{module.icon}</span>
                  </div>
                  <svg 
                    className="h-6 w-6 text-gray-400 dark:text-gray-600 group-hover:text-primary-500 dark:group-hover:text-primary-400 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {module.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {module.description}
                </p>
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-500">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  {module.stats}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recent Sales</h2>
          <Link 
            href="/dashboard/sales/transactions" 
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            View all →
          </Link>
        </div>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : sales && sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">SKU</th>
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Size</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Quantity</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Unit Price</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 10).map((sale: any, index: number) => {
                  const total = parseFloat(sale.unit_price) * parseInt(sale.quantity);
                  return (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        {new Date(sale.sale_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-mono font-semibold">
                          {sale.sku}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{sale.size}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-gray-100">
                        {sale.quantity}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900 dark:text-gray-100">
                        ₹{parseFloat(sale.unit_price).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600 dark:text-green-400">
                        ₹{total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No sales records found
          </div>
        )}
      </div>
    </div>
  );
}
