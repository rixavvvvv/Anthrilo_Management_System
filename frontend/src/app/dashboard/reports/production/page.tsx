'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useMemo, useState } from 'react';
import { ReportDateMode, resolveReportDateRange } from '@/lib/report-date-range';

export default function ProductionReportsPage() {
  const [reportType, setReportType] = useState<'plan' | 'variance'>('plan');
  const [dateMode, setDateMode] = useState<ReportDateMode>('daily');
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const effectiveRange = useMemo(() => resolveReportDateRange({
    mode: dateMode,
    anchorDate,
    fromDate,
    toDate,
  }), [dateMode, anchorDate, fromDate, toDate]);

  const varianceDate = effectiveRange.toDate;

  const { data: planReport, isLoading: loadingPlan } = useQuery({
    queryKey: ['productionReport', 'plan'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/production/plan-status');
      return response.data;
    },
    enabled: reportType === 'plan',
  });

  const { data: varianceReport, isLoading: loadingVariance } = useQuery({
    queryKey: ['productionReport', 'variance', varianceDate],
    queryFn: async () => {
      const response = await apiClient.get(`/reports/production/daily-variance/${varianceDate}`);
      return response.data;
    },
    enabled: reportType === 'variance' && !!varianceDate,
  });

  const isLoading = loadingPlan || loadingVariance;
  const currentReport = reportType === 'plan' ? planReport : varianceReport;

  return (
    <div className="page-section-gap">
      <h1 className="mb-6">Production Reports</h1>

      <div className="card mb-6">
        <h3 className="mb-4">Select Report Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setReportType('plan')}
            className={`p-4 border-2 rounded-lg transition-all ${
              reportType === 'plan'
                ? 'border-primary-600 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300'
            }`}
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold">Plan Status</div>
            <div className="text-sm text-gray-500">Production plan tracking</div>
          </button>

          <button
            onClick={() => setReportType('variance')}
            className={`p-4 border-2 rounded-lg transition-all ${
              reportType === 'variance'
                ? 'border-primary-600 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300'
            }`}
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold">Daily Variance</div>
            <div className="text-sm text-gray-500">Calculated vs actual</div>
          </button>
        </div>

        {reportType === 'variance' && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-3">Report Range</label>
            <div className="space-y-2">
              <div className="tab-strip">
                {([
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'custom', label: 'Custom' },
                ] as const).map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setDateMode(mode.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${dateMode === mode.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {dateMode === 'daily' && (
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                  className="input w-full sm:w-auto"
                />
              )}

              {dateMode === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="input w-full"
                  />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="input w-full"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">{effectiveRange.label} (variance uses end date)</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="card text-center py-12">Loading...</div>
      ) : currentReport ? (
        <div className="space-y-6">
          {/* Plan Status Report */}
          {reportType === 'plan' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card">
                  <div className="text-sm text-gray-600 mb-1">Total Plans</div>
                  <div className="text-3xl font-bold text-primary-600">
                    {currentReport.total_plans}
                  </div>
                </div>
                <div className="card">
                  <div className="text-sm text-gray-600 mb-1">In Progress</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {currentReport.in_progress}
                  </div>
                </div>
                <div className="card">
                  <div className="text-sm text-gray-600 mb-1">Completed</div>
                  <div className="text-3xl font-bold text-green-600">
                    {currentReport.completed}
                  </div>
                </div>
                <div className="card">
                  <div className="text-sm text-gray-600 mb-1">Pending</div>
                  <div className="text-3xl font-bold text-yellow-600">
                    {currentReport.pending}
                  </div>
                </div>
              </div>

              {currentReport.plans && currentReport.plans.length > 0 && (
                <div className="card">
                  <h3 className="mb-4">Production Plans</h3>
                  <div className="table-scroll-wrap">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Garment
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Planned Date
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Target Qty
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Activities
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Completed
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Completion %
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentReport.plans.map((plan: any) => (
                          <tr key={plan.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium">
                              {plan.garment_name}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {new Date(plan.planned_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {plan.target_quantity}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {plan.total_activities}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {plan.completed_activities}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      plan.completion_percentage === 100
                                        ? 'bg-green-600'
                                        : plan.completion_percentage >= 50
                                        ? 'bg-blue-600'
                                        : 'bg-yellow-600'
                                    }`}
                                    style={{ width: `${plan.completion_percentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-medium w-12 text-right">
                                  {plan.completion_percentage}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span
                                className={`px-2 py-1 text-xs rounded ${
                                  plan.status === 'COMPLETED'
                                    ? 'bg-green-100 text-green-800'
                                    : plan.status === 'IN_PROGRESS'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {plan.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Variance Report */}
          {reportType === 'variance' && (
            <>
              {currentReport.summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="card">
                    <div className="text-sm text-gray-600 mb-1">Total Activities</div>
                    <div className="text-3xl font-bold text-primary-600">
                      {currentReport.summary.total_activities}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600 mb-1">Avg Variance</div>
                    <div
                      className={`text-3xl font-bold ${
                        currentReport.summary.avg_variance_percentage >= 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {currentReport.summary.avg_variance_percentage.toFixed(2)}%
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600 mb-1">Within Tolerance</div>
                    <div className="text-3xl font-bold text-green-600">
                      {currentReport.summary.within_tolerance}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600 mb-1">Out of Tolerance</div>
                    <div className="text-3xl font-bold text-red-600">
                      {currentReport.summary.out_of_tolerance}
                    </div>
                  </div>
                </div>
              )}

              {currentReport.activities && currentReport.activities.length > 0 ? (
                <div className="card">
                  <h3 className="mb-4">Production Activities - {varianceDate}</h3>
                  <div className="table-scroll-wrap">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Garment
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Pcs Produced
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Calculated (kg)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Actual (kg)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Variance (kg)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Variance %
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentReport.activities.map((activity: any) => (
                          <tr key={activity.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium">
                              {activity.garment_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {activity.pieces_produced}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {activity.calculated_gross_weight.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {activity.actual_gross_weight.toFixed(2)}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-medium ${
                                activity.variance >= 0 ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {activity.variance >= 0 ? '+' : ''}
                              {activity.variance.toFixed(2)}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-medium ${
                                activity.variance_percentage >= 0
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }`}
                            >
                              {activity.variance_percentage >= 0 ? '+' : ''}
                              {activity.variance_percentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              {Math.abs(activity.variance_percentage) <= 2 ? (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                  ✓ OK
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                                  ⚠ Alert
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Understanding Variance</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>
                        • <strong>Positive variance (+):</strong> Actual weight exceeds calculated
                        (possible waste or measurement error)
                      </li>
                      <li>
                        • <strong>Negative variance (-):</strong> Actual weight less than calculated
                        (efficient production)
                      </li>
                      <li>
                        • <strong>Tolerance:</strong> ±2% variance is considered acceptable
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="card text-center py-12 text-gray-500">
                  No production activities on this date
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
