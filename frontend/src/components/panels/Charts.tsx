/**
 * Chart Components for Dashboard
 * ===============================
 * Reusable chart components for data visualization
 */

'use client';

import React from 'react';

// ============================================================================
// BAR CHART - For Channel Comparison
// ============================================================================

interface BarChartProps {
    data: Array<{
        label: string;
        value: number;
        color?: string;
    }>;
    title?: string;
    valuePrefix?: string;
    height?: string;
}

export function BarChart({ data, title, valuePrefix = '', height = '400px' }: BarChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="card">
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
            </div>
        );
    }

    const maxValue = Math.max(...data.map(d => d.value));
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="card">
            {title && (
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{title}</h3>
            )}
            <div className="space-y-4" style={{ height, overflowY: 'auto' }}>
                {sortedData.map((item, index) => {
                    const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                    return (
                        <div key={item.label} className="group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {item.label}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        #{index + 1}
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {valuePrefix}{item.value.toLocaleString('en-IN')}
                                </span>
                            </div>
                            <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                                <div
                                    className={`absolute h-full transition-all duration-700 ease-out ${item.color || 'bg-blue-500'
                                        } group-hover:brightness-110`}
                                    style={{ width: `${percentage}%` }}
                                >
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-xs font-semibold opacity-90">
                                        {percentage.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// DONUT CHART - For Status / Category Distribution
// ============================================================================

interface DonutChartProps {
    data: Array<{
        label: string;
        value: number;
        color: string;
    }>;
    title?: string;
    centerLabel?: string;
    centerValue?: string;
}

export function DonutChart({ data, title, centerLabel, centerValue }: DonutChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="card">
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
            </div>
        );
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90; // Start from top

    const segments = data.map(item => {
        const percentage = (item.value / total) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        return {
            ...item,
            percentage,
            startAngle,
            endAngle,
        };
    });

    const createArc = (startAngle: number, endAngle: number) => {
        const start = polarToCartesian(50, 50, 40, endAngle);
        const end = polarToCartesian(50, 50, 40, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
        return `M ${start.x} ${start.y} A 40 40 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
    };

    function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians),
        };
    }

    return (
        <div className="card">
            {title && (
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
            )}
            <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Donut Chart */}
                <div className="relative w-64 h-64">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                        {segments.map((segment, index) => (
                            <path
                                key={index}
                                d={createArc(segment.startAngle, segment.endAngle)}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth="20"
                                className="transition-all duration-300 hover:brightness-110"
                            />
                        ))}
                    </svg>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                            {centerValue || total.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            {centerLabel || 'Total'}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-3">
                    {segments.map((segment, index) => (
                        <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: segment.color }}
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {segment.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {segment.percentage.toFixed(1)}%
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-[60px] text-right">
                                    {segment.value.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// TREND LINE CHART - For Time Series Data
// ============================================================================

interface TrendLineProps {
    current: number;
    previous: number;
    label: string;
}

export function TrendIndicator({ current, previous, label }: TrendLineProps) {
    const change = current - previous;
    const percentChange = previous > 0 ? ((change / previous) * 100) : 0;
    const isPositive = change >= 0;

    return (
        <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                <span className="text-lg">{isPositive ? '↑' : '↓'}</span>
                <span>{Math.abs(percentChange).toFixed(1)}%</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
                vs {label}
            </span>
        </div>
    );
}

// ============================================================================
// COMPARISON CARDS - For Period Comparison
// ============================================================================

interface ComparisonCardProps {
    period: string;
    revenue: number;
    orders: number;
    isActive?: boolean;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

export function ComparisonCard({ period, revenue, orders, isActive, trend }: ComparisonCardProps) {
    return (
        <div
            className={`
        p-5 rounded-xl transition-all duration-300 cursor-pointer
        ${isActive
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl scale-105'
                    : 'bg-white dark:bg-gray-800 hover:shadow-lg hover:scale-102 border border-gray-200 dark:border-gray-700'
                }
      `}
        >
            <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-medium ${isActive ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>
                    {period}
                </span>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-semibold ${isActive
                            ? 'text-white'
                            : trend.isPositive
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                        }`}>
                        <span>{trend.isPositive ? '↑' : '↓'}</span>
                        <span>{Math.abs(trend.value).toFixed(0)}%</span>
                    </div>
                )}
            </div>

            <div className={`text-2xl font-bold mb-1 ${isActive ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                ₹{revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>

            <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                {orders.toLocaleString()} orders
            </div>
        </div>
    );
}

// ============================================================================
// METRIC CARD WITH SPARKLINE
// ============================================================================

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: string;
    trend?: {
        value: number;
        isPositive: boolean;
        label?: string;
    };
    color?: string;
}

export function MetricCard({ title, value, subtitle, icon, trend, color = 'blue' }: MetricCardProps) {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        purple: 'from-purple-500 to-purple-600',
        orange: 'from-orange-500 to-orange-600',
    };

    return (
        <div className="card hover:shadow-2xl transition-all duration-300 group relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

            <div className="relative">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {title}
                        </p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {value}
                        </p>
                        {subtitle && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
                        )}
                    </div>
                    {icon && (
                        <div className={`text-3xl opacity-80 group-hover:scale-110 transition-transform duration-300`}>
                            {icon}
                        </div>
                    )}
                </div>

                {trend && (
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className={`flex items-center gap-1 text-sm font-semibold ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                            <span>{trend.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(trend.value).toFixed(1)}%</span>
                        </div>
                        {trend.label && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {trend.label}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
