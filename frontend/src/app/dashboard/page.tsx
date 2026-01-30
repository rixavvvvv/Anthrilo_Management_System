'use client';

import { useQuery } from '@tanstack/react-query';
import { garmentApi, salesApi, inventoryApi, panelApi } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  // Fetch summary data
  const { data: garments, isLoading: garmentsLoading } = useQuery({
    queryKey: ['garments'],
    queryFn: async () => {
      const response = await garmentApi.getAll();
      return response.data;
    },
  });

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await salesApi.getAll();
      return response.data;
    },
  });

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await inventoryApi.getAll();
      return response.data;
    },
  });

  const { data: panels, isLoading: panelsLoading } = useQuery({
    queryKey: ['panels'],
    queryFn: async () => {
      const response = await panelApi.getAll();
      return response.data;
    },
  });

  // Calculate stats
  const activeGarments = garments?.filter((g: any) => g.is_active)?.length || 0;
  const lowStockItems = inventory?.filter((i: any) => parseInt(i.good_stock) < 50)?.length || 0;
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
  const activePanels = panels?.filter((p: any) => p.is_active)?.length || 0;
  const totalInventoryValue = inventory?.reduce((sum: number, i: any) => {
    const garment = garments?.find((g: any) => g.style_sku === i.sku);
    const price = garment?.mrp || 0;
    return sum + (price * parseInt(i.good_stock || 0));
  }, 0) || 0;

  const isLoading = garmentsLoading || salesLoading || inventoryLoading || panelsLoading;

  const quickActions = [
    {
      title: 'Garment Master',
      description: 'Manage product catalog & SKUs',
      href: '/dashboard/garments/master',
      icon: '👕',
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Sales Management',
      description: 'Track daily sales & returns',
      href: '/dashboard/sales/daily',
      icon: '💰',
      gradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Inventory Control',
      description: 'Monitor stock levels by SKU',
      href: '/dashboard/garments/inventory',
      icon: '📦',
      gradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      title: 'Raw Materials',
      description: 'Manage yarn, fabric & processes',
      href: '/dashboard/raw-materials/yarn',
      icon: '🧵',
      gradient: 'from-orange-500 to-orange-600',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      title: 'Panel Settlement',
      description: 'Calculate settlements & payments',
      href: '/dashboard/reports/panels/settlement',
      icon: '💵',
      gradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      title: 'Analytics & Reports',
      description: 'View insights & business reports',
      href: '/dashboard/reports/reports-index',
      icon: '📊',
      gradient: 'from-indigo-500 to-indigo-600',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-purple-600 dark:from-primary-600 dark:via-primary-700 dark:to-purple-700 p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
        <div className="relative">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Welcome to Anthrilo
          </h1>
          <p className="text-primary-100 text-lg max-w-2xl">
            Enterprise ERP for textile manufacturing and garment production management
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {/* Active Garments */}
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Active Products</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : activeGarments}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center">
              <span className="text-3xl">👕</span>
            </div>
          </div>
        </div>

        {/* Today's Sales */}
        <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Today's Sales</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : todaySales}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-green-500/20 dark:bg-green-500/30 flex items-center justify-center">
              <span className="text-3xl">💰</span>
            </div>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Today's Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : `₹${todaysRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center">
              <span className="text-3xl">💵</span>
            </div>
          </div>
        </div>

        {/* Low Stock */}
        <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">Low Stock Items</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : lowStockItems}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-yellow-500/20 dark:bg-yellow-500/30 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
          </div>
        </div>

        {/* Active Panels */}
        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Active Panels</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : activePanels}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-purple-500/20 dark:bg-purple-500/30 flex items-center justify-center">
              <span className="text-3xl">🏪</span>
            </div>
          </div>
        </div>

        {/* Inventory Value */}
        <div className="card bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : `₹${(totalInventoryValue / 1000).toFixed(0)}K`}
              </p>
            </div>
            <div className="h-14 w-14 rounded-full bg-indigo-500/20 dark:bg-indigo-500/30 flex items-center justify-center">
              <span className="text-3xl">📦</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quick Access</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">Navigate to key modules</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action, index) => (
            <Link
              key={action.title}
              href={action.href}
              className="group relative card hover:shadow-2xl transition-all duration-300 overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300`}></div>
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-16 w-16 rounded-2xl ${action.iconBg} flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                    <span className="text-4xl">{action.icon}</span>
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
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {action.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="card bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">System Status</h2>
          <span className="flex items-center text-sm text-green-600 dark:text-green-400">
            <span className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            All systems operational
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Database</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Connected</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">API Server</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Running</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reports</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">19 Available</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
