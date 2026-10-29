import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card, StatCard } from '@/components/common/Card';
import { reportApi } from '@/api';
import { useAuthStore } from '@/store/authStore';

export default function ReportsPage() {
  const { hasMinRole } = useAuthStore();
  const [reportType, setReportType] = useState('salesSummary');
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const reportTypes = [
    { value: 'salesSummary', label: 'Sales Summary', adminOnly: false },
    { value: 'salesByProduct', label: 'Sales by Product', adminOnly: false },
    { value: 'salesByPaymentMode', label: 'Sales by Payment Mode', adminOnly: false },
    { value: 'salesByHour', label: 'Peak Hours', adminOnly: false },
    { value: 'gst', label: 'GST Report', adminOnly: true },
    { value: 'profit', label: 'Profit & Margin', adminOnly: true },
    { value: 'stockValuation', label: 'Stock Valuation', adminOnly: true },
    { value: 'wastage', label: 'Wastage Report', adminOnly: false },
    { value: 'production', label: 'Production Report', adminOnly: false },
  ];

  const availableReports = reportTypes.filter((r) => !r.adminOnly || hasMinRole('admin'));

  useEffect(() => {
    setLoading(true);
    const dateFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = new Date().toISOString().split('T')[0];

    const fetcher: Record<string, Promise<{ data: unknown }>> = {
      salesSummary: reportApi.salesSummary({ dateFrom, dateTo }),
      salesByProduct: reportApi.salesByProduct({ dateFrom, dateTo }),
      salesByPaymentMode: reportApi.salesByPaymentMode({ dateFrom, dateTo }),
      salesByHour: reportApi.salesByHour({ dateFrom, dateTo }),
      gst: reportApi.gst({ dateFrom, dateTo }),
      profit: reportApi.profit({ dateFrom, dateTo }),
      stockValuation: reportApi.stockValuation(),
      wastage: reportApi.wastage({ dateFrom, dateTo }),
      production: reportApi.production({ dateFrom, dateTo }),
    };

    fetcher[reportType].then((res) => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [reportType]);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, profit, GST, and inventory analytics" />

      <div className="mb-4 flex flex-wrap gap-2">
        {availableReports.map((r) => (
          <button key={r.value} onClick={() => setReportType(r.value)} className={`rounded-md px-4 py-2 text-sm ${reportType === r.value ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {r.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : data ? (
          <div>
            {/* Sales summary */}
            {reportType === 'salesSummary' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Bills" value={(data as { billCount: number }).billCount} />
                <StatCard label="Total Sales" value={formatCurrency((data as { totalSales: number }).totalSales)} />
                <StatCard label="Discounts" value={formatCurrency((data as { totalDiscounts: number }).totalDiscounts)} />
                <StatCard label="Revenue" value={formatCurrency((data as { totalRevenue: number }).totalRevenue)} />
              </div>
            )}

            {/* Profit report */}
            {reportType === 'profit' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Revenue" value={formatCurrency((data as { totalRevenue: number }).totalRevenue)} />
                <StatCard label="COGS" value={formatCurrency((data as { totalCogs: number }).totalCogs)} color="text-orange-600" />
                <StatCard label="Gross Profit" value={formatCurrency((data as { grossProfit: number }).grossProfit)} color="text-green-600" />
                <StatCard label="Net Profit" value={formatCurrency((data as { netProfit: number }).netProfit)} color="text-green-700" />
                <StatCard label="Expenses" value={formatCurrency((data as { totalExpenses: number }).totalExpenses)} color="text-red-600" />
                <StatCard label="Gross Margin" value={`${(data as { grossMargin: number }).grossMargin}%`} />
                <StatCard label="Net Margin" value={`${(data as { netMargin: number }).netMargin}%`} />
              </div>
            )}

            {/* Table-style reports */}
            {(reportType === 'salesByProduct' || reportType === 'salesByHour' || reportType === 'salesByPaymentMode' || reportType === 'wastage' || reportType === 'production' || reportType === 'stockValuation') && (
              <pre className="overflow-x-auto rounded bg-slate-50 p-4 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}

            {/* GST report */}
            {reportType === 'gst' && (
              <pre className="overflow-x-auto rounded bg-slate-50 p-4 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        ) : <p className="py-8 text-center text-slate-400">No data</p>}
      </Card>
    </div>
  );
}
