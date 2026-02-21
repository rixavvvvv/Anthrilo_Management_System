'use client';

import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import Link from 'next/link';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useEffect, useRef, useState } from 'react';


export default function DashboardPage() {

  // WebSocket for real-time updates (auto-updates React Query cache)
  const { isConnected: wsConnected, lastUpdate: wsLastUpdate, newOrderNotification, dismissNotification, requestRefresh } = useWebSocket();

  // ─── New-order toast auto-dismiss ──────────────────────────────
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (newOrderNotification) {
      setShowToast(true);
      // Auto-hide after 15 seconds
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false);
        dismissNotification();
      }, 15000);
    }
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [newOrderNotification, dismissNotification]);

  // Real-time Unicommerce data with auto-refresh
  const { data: todayData, isLoading: loadingToday, dataUpdatedAt: updatedToday } = useQuery({
    queryKey: ['unicommerce-today'],
    queryFn: async () => {
      const response = await ucSales.getToday();
      return response.data;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: yesterdayData, isLoading: loadingYesterday } = useQuery({
    queryKey: ['unicommerce-yesterday'],
    queryFn: async () => {
      const response = await ucSales.getYesterday();
      return response.data;
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: last7Days, isLoading: loading7d, dataUpdatedAt: updated7d } = useQuery({
    queryKey: ['unicommerce-last-7-days'],
    queryFn: async () => {
      const response = await ucSales.getLast7Days();
      return response.data;
    },
    refetchInterval: 30 * 60 * 1000, // Match backend cache TTL (30 minutes)
    staleTime: 30 * 60 * 1000, // Keep data fresh for 30 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Show old data while refetching
  });

  const { data: channelData } = useQuery({
    queryKey: ['unicommerce-channels'],
    queryFn: async () => {
      const response = await ucSales.getChannelRevenue('last_7_days');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Real-time Unicommerce stats
  const todayOrders = todayData?.summary?.total_orders || 0;
  const todayRevenue = todayData?.summary?.total_revenue || 0;

  // UC-derived stats for system overview
  const activeChannels = channelData?.channels?.length || 0;
  const weeklyRevenue = last7Days?.summary?.total_revenue || 0;
  const avgOrderValue = todayData?.summary?.avg_order_value || (todayOrders > 0 ? todayRevenue / todayOrders : 0);
  const todayItems = todayData?.summary?.total_items || 0;  // NEW
  const yesterdayOrders = yesterdayData?.summary?.total_orders || 0;
  const yesterdayRevenue = yesterdayData?.summary?.total_revenue || 0;
  const yesterdayItems = yesterdayData?.summary?.total_items || 0;  // NEW
  const last7DaysOrders = last7Days?.summary?.total_orders || 0;
  const last7DaysRevenue = last7Days?.summary?.total_revenue || 0;
  const last7DaysItems = last7Days?.summary?.total_items || 0;  // NEW

  // Smart loading: only show loading when there's NO data at all (first load)
  const showLoading7d = loading7d && !last7Days;
  const isLoading = loadingToday || showLoading7d; // Don't block page for cached data
  const isUnicommerceLoading = loadingToday || loadingYesterday || showLoading7d;

  // Helper function to format time ago
  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

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
      href: '/dashboard/sales',
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
      {/* ─── New Order Toast Notification ─────────────────────────── */}
      {showToast && newOrderNotification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300 max-w-md w-full">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-emerald-200 dark:border-emerald-700 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <span className="text-white font-semibold text-sm">
                  {newOrderNotification.count} New Order{newOrderNotification.count > 1 ? 's' : ''}!
                </span>
              </div>
              <button onClick={() => { setShowToast(false); dismissNotification(); }}
                className="text-white/80 hover:text-white text-lg leading-none px-1">&times;</button>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total Orders Today</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{newOrderNotification.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Revenue</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{newOrderNotification.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
              {newOrderNotification.orders.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1">
                  {newOrderNotification.orders.slice(0, 3).map((o: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                        {o.saleOrderCode || o.channel || 'Order'}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        ₹{(o.sellingPrice || o.revenue || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hero Section with Real-time Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-purple-600 dark:from-primary-600 dark:via-primary-700 dark:to-purple-700 p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Welcome to Anthrilo
              </h1>
              <p className="text-primary-100 text-lg max-w-2xl">
                Enterprise ERP for textile manufacturing and garment production management
              </p>
            </div>
          </div>

          {/* Real-time Status Indicator */}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className={`h-2 w-2 rounded-full ${isUnicommerceLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></span>
              <span className="text-sm text-white">
                {isUnicommerceLoading ? 'Updating...' : 'Live Data'}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              <span className="text-xs text-white">
                {wsConnected ? 'WebSocket Live' : 'WS Offline'}
              </span>
            </div>
            {wsConnected && (
              <button onClick={requestRefresh}
                className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white hover:bg-white/20 transition-colors"
                title="Fetch latest orders now">
                🔄 Refresh
              </button>
            )}
            {(wsLastUpdate || updatedToday) && (
              <div className="text-xs text-white/70 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
                Last update: {wsLastUpdate ? timeAgo(wsLastUpdate.getTime()) : updatedToday ? timeAgo(updatedToday) : '—'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Unicommerce Sales Stats */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            🔥 Real-time Sales (Unicommerce)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Today */}
          <div className="card bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 border-l-4 border-green-500 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">📊</span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Today</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">00:00 to now</p>
              </div>
              {loadingToday && (
                <div className="h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Orders</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {loadingToday ? '...' : todayOrders.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Items</p>
                <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
                  {loadingToday ? '...' : todayItems.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Revenue</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {loadingToday ? '...' : `₹${todayRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                </p>
              </div>
              {todayData?.fetch_info?.fetch_time_seconds && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                  Fetch: {todayData.fetch_info.fetch_time_seconds.toFixed(1)}s
                </div>
              )}
            </div>
          </div>

          {/* Yesterday */}
          <div className="card bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-800/20 border-l-4 border-amber-500 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">📆</span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yesterday</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Full day</p>
              </div>
              {loadingYesterday && (
                <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Orders</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {loadingYesterday ? '...' : yesterdayOrders.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Items</p>
                <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
                  {loadingYesterday ? '...' : yesterdayItems.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Revenue</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {loadingYesterday ? '...' : `₹${yesterdayRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                </p>
              </div>
              {yesterdayData?.fetch_info?.fetch_time_seconds && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                  Fetch: {yesterdayData.fetch_info.fetch_time_seconds.toFixed(1)}s
                </div>
              )}
            </div>
          </div>

          {/* Last 7 Days */}
          <div className="card bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-800/20 border-l-4 border-blue-500 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">📈</span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Last 7 Days</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Complete days</p>
              </div>
              {showLoading7d && (
                <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Orders</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {showLoading7d ? '...' : last7DaysOrders.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Items</p>
                <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
                  {showLoading7d ? '...' : last7DaysItems.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Revenue</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {showLoading7d ? '...' : `₹${last7DaysRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                </p>
              </div>
              {last7Days?.fetch_info?.fetch_time_seconds && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                  Fetch: {last7Days.fetch_info.fetch_time_seconds.toFixed(1)}s
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* System Stats from Unicommerce */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Business Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Today's Orders */}
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Today&apos;s Orders</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {isLoading ? '...' : todayOrders}
                </p>
              </div>
              <div className="h-14 w-14 rounded-full bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center">
                <span className="text-3xl">🛒</span>
              </div>
            </div>
          </div>

          {/* Avg Order Value */}
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">Avg Order Value</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {isLoading ? '...' : `₹${avgOrderValue.toFixed(0)}`}
                </p>
              </div>
              <div className="h-14 w-14 rounded-full bg-yellow-500/20 dark:bg-yellow-500/30 flex items-center justify-center">
                <span className="text-3xl">📊</span>
              </div>
            </div>
          </div>

          {/* Active Channels */}
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Active Channels</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {isLoading ? '...' : activeChannels}
                </p>
              </div>
              <div className="h-14 w-14 rounded-full bg-purple-500/20 dark:bg-purple-500/30 flex items-center justify-center">
                <span className="text-3xl">🏪</span>
              </div>
            </div>
          </div>

          {/* Weekly Revenue */}
          <div className="card bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">7-Day Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {isLoading ? '...' : `₹${(weeklyRevenue / 1000).toFixed(0)}K`}
                </p>
              </div>
              <div className="h-14 w-14 rounded-full bg-indigo-500/20 dark:bg-indigo-500/30 flex items-center justify-center">
                <span className="text-3xl">💰</span>
              </div>
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

    </div>
  );
}
