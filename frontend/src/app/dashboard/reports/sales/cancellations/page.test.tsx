import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/features/sales', () => ({
    ucSales: {
        getCancellationReport: vi.fn(),
    },
}));

import { ucSales } from '@/features/sales';
import CancellationReportPage from './page';

const mockedGetCancellationReport = vi.mocked(ucSales.getCancellationReport);

describe('CancellationReportPage', () => {
    beforeEach(() => {
        mockedGetCancellationReport.mockResolvedValue({
            data: {
                success: true,
                from_date: '2026-03-01',
                to_date: '2026-03-01',
                by_channel: [],
                items: [],
                totals: {
                    total_orders: 10,
                    total_cancellations: 2,
                    total_items: 2,
                    total_value: 200,
                    cod_orders: 1,
                    prepaid_orders: 1,
                    cancellation_rate: 20,
                },
                search_results: {
                    method: 'export_job_sale_orders',
                    total_time: 1.2,
                },
            },
        } as any);
    });

    it('renders and loads cancellation report data', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        render(
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                React.createElement(CancellationReportPage),
            ),
        );

        expect(screen.getByText('Cancellation Report')).toBeInTheDocument();

        await waitFor(() => {
            expect(mockedGetCancellationReport).toHaveBeenCalled();
        });

        expect(screen.getByText('Generating…')).toBeInTheDocument();
    });
});
