'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salesApi, panelApi, unicommerceApi } from '@/lib/api';

export default function SalesTransactionsPage() {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    sku: '',
    size: '',
    panelId: '',
    transactionType: 'all', // all, sale, return
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Auto-fetch when mandatory filters are filled
  const shouldFetchData = filters.dateFrom.trim() !== '' &&
    filters.dateTo.trim() !== '' &&
    filters.transactionType !== '' &&
    filters.panelId.trim() !== '';

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['sales', filters],
    queryFn: async () => {
      const response = await salesApi.getAll();
      return response.data;
    },
    enabled: shouldFetchData,
  });

  const { data: panels } = useQuery({
    queryKey: ['panels'],
    queryFn: async () => {
      const response = await panelApi.getAll();
      return response.data;
    },
  });

  // Fetch Unicommerce sales data (last 24 hours, 7 days, 30 days) for stats - REAL-TIME with parallel calls
  const { data: unicommerceSales, isLoading: loadingSales } = useQuery({
    queryKey: ['unicommerce-last-24-hours'],
    queryFn: async () => {
      const response = await unicommerceApi.getLast24Hours();
      return response.data;
    },
    refetchInterval: 60000, // Refresh every 1 minute for real-time data
    staleTime: 30000, // Consider stale after 30s
    retry: 2,
  });

  const { data: unicommerce7Days, isLoading: loading7Days } = useQuery({
    queryKey: ['unicommerce-last-7-days'],
    queryFn: async () => {
      const response = await unicommerceApi.getLast7Days();
      return response.data;
    },
    refetchInterval: 60000, // Refresh every 1 minute
    staleTime: 30000,
    retry: 2,
  });

  const { data: unicommerce30Days, isLoading: loading30Days } = useQuery({
    queryKey: ['unicommerce-last-30-days'],
    queryFn: async () => {
      const response = await unicommerceApi.getLast24Hours();
      return response.data;
    },
    refetchInterval: 60000, // Refresh every 1 minute
    staleTime: 30000,
    retry: 2,
  });

  // Filter sales based on criteria - handle both local sales and Unicommerce orders
  const filteredSales = useMemo(() => {
    // Check if a channel is selected (not a numeric panel ID)
    const isChannelSelected = filters.panelId && isNaN(parseInt(filters.panelId));

    if (isChannelSelected) {
      // Filter Unicommerce data
      let allOrders: any[] = [];

      // Combine orders from all Unicommerce data sources
      if (unicommerceSales?.orders) allOrders = [...allOrders, ...unicommerceSales.orders];
      if (unicommerce7Days?.orders) allOrders = [...allOrders, ...unicommerce7Days.orders];
      if (unicommerce30Days?.orders) allOrders = [...allOrders, ...unicommerce30Days.orders];

      // Remove duplicates by order code
      const uniqueOrders = allOrders.reduce((acc, order) => {
        if (!acc.find((o: any) => o.code === order.code)) {
          acc.push(order);
        }
        return acc;
      }, []);

      return uniqueOrders.filter((order: any) => {
        // Date range filter
        if (filters.dateFrom) {
          const orderDate = new Date(order.displayOrderDateTime);
          const fromDate = new Date(filters.dateFrom);
          if (orderDate < fromDate) return false;
        }
        if (filters.dateTo) {
          const orderDate = new Date(order.displayOrderDateTime);
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59);
          if (orderDate > toDate) return false;
        }

        // Channel filter
        if (filters.panelId !== 'all' && order.channel !== filters.panelId) {
          return false;
        }

        // Search term
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchesCode = order.code?.toLowerCase().includes(term) || false;
          const matchesChannel = order.channel?.toLowerCase().includes(term) || false;
          if (!matchesCode && !matchesChannel) return false;
        }

        return true;
      });
    }

    // Filter local sales data
    if (!sales) return [];

    return sales.filter((sale: any) => {
      // Date range filter
      if (filters.dateFrom) {
        if (!sale.sale_date || isNaN(new Date(sale.sale_date).getTime())) return false;
        const saleDate = new Date(sale.sale_date);
        const fromDate = new Date(filters.dateFrom);
        if (saleDate < fromDate) return false;
      }
      if (filters.dateTo) {
        if (!sale.sale_date || isNaN(new Date(sale.sale_date).getTime())) return false;
        const saleDate = new Date(sale.sale_date);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59);
        if (saleDate > toDate) return false;
      }

      // SKU filter
      if (filters.sku && !sale.sku.toLowerCase().includes(filters.sku.toLowerCase())) {
        return false;
      }

      // Size filter
      if (filters.size && sale.size !== filters.size) {
        return false;
      }

      // Panel filter
      if (filters.panelId && filters.panelId !== 'all' && sale.panel_id !== parseInt(filters.panelId)) {
        return false;
      }

      // Transaction type filter
      if (filters.transactionType !== 'all') {
        const quantity = parseInt(sale.quantity);
        if (filters.transactionType === 'sale' && quantity < 0) return false;
        if (filters.transactionType === 'return' && quantity >= 0) return false;
      }

      // Search term (SKU or panel)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSKU = sale.sku.toLowerCase().includes(term);
        const panel = panels?.find((p: any) => p.id === sale.panel_id);
        const matchesPanel = panel?.panel_name.toLowerCase().includes(term) || false;
        if (!matchesSKU && !matchesPanel) return false;
      }

      return true;
    });
  }, [sales, filters, searchTerm, panels, unicommerceSales, unicommerce7Days, unicommerce30Days]);

  // Calculate statistics
  const today = new Date().toDateString();
  const todaySales = filteredSales.filter((s: any) => {
    const saleDate = s.sale_date && !isNaN(new Date(s.sale_date).getTime())
      ? new Date(s.sale_date).toDateString()
      : null;
    return saleDate === today;
  });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSales = filteredSales.filter((s: any) => {
    if (!s.sale_date || isNaN(new Date(s.sale_date).getTime())) return false;
    return new Date(s.sale_date) >= weekAgo;
  });

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthSales = filteredSales.filter((s: any) => {
    if (!s.sale_date || isNaN(new Date(s.sale_date).getTime())) return false;
    return new Date(s.sale_date) >= monthAgo;
  });

  const totalRevenue = filteredSales.reduce((sum: number, s: any) => {
    const quantity = parseInt(s.quantity);
    const price = parseFloat(s.unit_price);
    return sum + (quantity * price);
  }, 0);

  const uniqueSizes = Array.from(new Set(sales?.map((s: any) => s.size) || [])).sort();

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      sku: '',
      size: '',
      panelId: '',
      transactionType: 'all',
    });
    setSearchTerm('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v && v !== 'all') || searchTerm;

  // Extract unique channels from Unicommerce data to merge with panels
  const uniqueChannels = useMemo(() => {
    const channels = new Set<string>();

    // Add from 24 hours data
    unicommerceSales?.orders?.forEach((order: any) => {
      if (order.channel) channels.add(order.channel);
    });

    // Add from 7 days data
    unicommerce7Days?.orders?.forEach((order: any) => {
      if (order.channel) channels.add(order.channel);
    });

    // Add from 30 days data
    unicommerce30Days?.orders?.forEach((order: any) => {
      if (order.channel) channels.add(order.channel);
    });

    return Array.from(channels).sort();
  }, [unicommerceSales, unicommerce7Days, unicommerce30Days]);

  // Data fetches automatically when mandatory filters are filled

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Sales Transactions
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and filter all sales transactions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-l-4 border-blue-500">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Today's Sales</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {loadingSales ? '...' : (unicommerceSales?.summary?.total_orders || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Real-time Unicommerce (Last 24hrs)
            </span>
          </p>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mt-2">
            Revenue: {loadingSales ? '...' : `₹${(unicommerceSales?.summary?.total_revenue || 0).toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-l-4 border-green-500">
          <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">This Week</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {loading7Days ? '...' : (unicommerce7Days?.summary?.total_orders || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Real-time Unicommerce (Last 7 days)
            </span>
          </p>
          <p className="text-xs font-semibold text-green-700 dark:text-green-300 mt-2">
            Revenue: {loading7Days ? '...' : `₹${(unicommerce7Days?.summary?.total_revenue || 0).toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-l-4 border-purple-500">
          <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">This Month</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {loading30Days ? '...' : (unicommerce30Days?.summary?.total_orders || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Real-time Unicommerce (Last 30 days)
            </span>
          </p>
          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mt-2">
            Revenue: {loading30Days ? '...' : `₹${(unicommerce30Days?.summary?.total_revenue || 0).toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-l-4 border-emerald-500">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {loading30Days ? '...' : `₹${(unicommerce30Days?.summary?.total_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Real-time Unicommerce (Last 30 days)
            </span>
          </p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by SKU or Panel..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date From <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="dd-mm-yyyy"
              required
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date To <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="dd-mm-yyyy"
              required
            />
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <select
              value={filters.transactionType}
              onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="all">All Transactions</option>
              <option value="sale">Sales Only</option>
              <option value="return">Returns Only</option>
            </select>
          </div>

          {/* SKU Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              SKU
            </label>
            <input
              type="text"
              value={filters.sku}
              onChange={(e) => setFilters({ ...filters, sku: e.target.value })}
              placeholder="Filter by SKU..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Size Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Size
            </label>
            <select
              value={filters.size}
              onChange={(e) => setFilters({ ...filters, size: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Sizes</option>
              {uniqueSizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          {/* Panel / Channel Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Panel / Channel <span className="text-red-500">*</span>
            </label>
            <select
              value={filters.panelId}
              onChange={(e) => setFilters({ ...filters, panelId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">Select Panel or Channel</option>
              <option value="all">All Channels</option>
              {panels && panels.length > 0 && (
                <optgroup label="Panels">
                  {panels.map((panel: any) => (
                    <option key={`panel-${panel.id}`} value={panel.id}>{panel.panel_name}</option>
                  ))}
                </optgroup>
              )}
              {uniqueChannels && uniqueChannels.length > 0 && (
                <optgroup label="Channels">
                  {uniqueChannels.map((channel) => (
                    <option key={`channel-${channel}`} value={channel}>{channel}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Active Filters Summary */}
        {shouldFetchData && hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing <span className="font-semibold text-primary-600 dark:text-primary-400">{filteredSales.length}</span> of {sales?.length || 0} transactions
            </p>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Transactions ({filteredSales.length})
          </h2>
        </div>

        {!shouldFetchData ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Please select all required filters to view transactions
          </div>
        ) : salesLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {hasActiveFilters ? 'No transactions match your filters' : 'No sales transactions recorded yet'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Order Code</th>
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Channel</th>
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Source</th>
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Order Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((item: any, index: number) => {
                  // Check if this is a Unicommerce order or local sale
                  const isUnicommerceOrder = !!item.channel;

                  if (isUnicommerceOrder) {
                    // Render Unicommerce order
                    return (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                          {item.displayOrderDateTime
                            ? new Date(item.displayOrderDateTime).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                            : 'N/A'
                          }
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-sm font-mono font-semibold">
                            {item.displayOrderCode || item.code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-semibold">
                            {item.channel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-sm">
                            {item.source}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.status === 'COMPLETE'
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : item.status === 'PROCESSING'
                                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                : item.status === 'CANCELLED'
                                  ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                  : item.status === 'CREATED'
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                    : 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                            }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100 text-sm">
                          {item.orderCategory || '-'}
                        </td>
                      </tr>
                    );
                  } else {
                    // Render local sale
                    const quantity = parseInt(item.quantity);
                    const unitPrice = parseFloat(item.unit_price);
                    const total = quantity * unitPrice;
                    const isReturn = quantity < 0;
                    const panel = panels?.find((p: any) => p.id === item.panel_id);

                    return (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                          {item.sale_date && !isNaN(new Date(item.sale_date).getTime())
                            ? new Date(item.sale_date).toLocaleDateString('en-IN')
                            : 'N/A'
                          }
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-mono font-semibold">
                            {item.sku}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{item.size}</td>
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                          {panel?.panel_name || `Panel ${item.panel_id}`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${isReturn
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            }`}>
                            {isReturn ? 'Return' : 'Sale'}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
