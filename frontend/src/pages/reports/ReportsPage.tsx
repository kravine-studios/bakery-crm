import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Card, StatCard } from '@/components/common/Card';
import { reportApi } from '@/api';
import { useAuthStore } from '@/store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0);

function pct(n: number) { return `${(n ?? 0).toFixed(1)}%`; }

/** Convert an array of objects to CSV and trigger a download */
function downloadCsv(rows: Row[], filename: string) {
  if (!rows || rows.length === 0) {
    alert('No data to download.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape  = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Generic table ────────────────────────────────────────────────────────────

function DataTable({ rows, colMap }: { rows: Row[]; colMap: { key: string; label: string; right?: boolean; render?: (v: unknown, row: Row) => React.ReactNode }[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#7A6A5F', fontSize: 16 }}>
        No records found for this period.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
            {colMap.map((c) => (
              <th key={c.key} style={{ padding: '10px 14px', textAlign: c.right ? 'right' : 'left', fontSize: 13, fontWeight: 600, color: '#7A6A5F', whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid #F0EAE3', height: 48 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              {colMap.map((c) => (
                <td key={c.key} style={{ padding: '0 14px', textAlign: c.right ? 'right' : 'left', color: '#1F1611', fontVariantNumeric: c.right ? 'tabular-nums' : undefined }}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#7A6A5F', fontSize: 16 }}>
      No {label} data available for the selected period.
    </div>
  );
}

// ─── Report renderers ─────────────────────────────────────────────────────────

function SalesByProductTable({ data }: { data: Row[] }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <DataTable
      rows={rows}
      colMap={[
        { key: 'product_name', label: 'Product' },
        { key: 'category_name', label: 'Category' },
        { key: 'total_quantity', label: 'Qty Sold', right: true, render: (v) => Number(v ?? 0).toFixed(2) },
        { key: 'unit', label: 'Unit' },
        { key: 'total_revenue', label: 'Revenue', right: true, render: (v) => inr(Number(v ?? 0)) },
        { key: 'total_orders', label: 'Orders', right: true },
      ]}
    />
  );
}

function SalesByPaymentTable({ data }: { data: Row[] }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <DataTable
      rows={rows}
      colMap={[
        { key: 'payment_mode', label: 'Payment Mode', render: (v) => String(v ?? '').charAt(0).toUpperCase() + String(v ?? '').slice(1) },
        { key: 'count', label: 'Transactions', right: true },
        { key: 'total', label: 'Total Amount', right: true, render: (v) => inr(Number(v ?? 0)) },
      ]}
    />
  );
}

function SalesByHourTable({ data }: { data: Row[] }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <DataTable
      rows={rows}
      colMap={[
        { key: 'hour', label: 'Hour', render: (v) => { const h = Number(v ?? 0); return `${h.toString().padStart(2,'0')}:00 – ${(h+1).toString().padStart(2,'0')}:00`; } },
        { key: 'bill_count', label: 'Bills', right: true },
        { key: 'total_revenue', label: 'Revenue', right: true, render: (v) => inr(Number(v ?? 0)) },
      ]}
    />
  );
}

function WastageTable({ data }: { data: Row[] }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <DataTable
      rows={rows}
      colMap={[
        { key: 'product_name', label: 'Product' },
        { key: 'reason', label: 'Reason', render: (v) => String(v ?? '').replace(/_/g, ' ') },
        { key: 'quantity', label: 'Qty', right: true, render: (v) => Number(v ?? 0).toFixed(2) },
        { key: 'unit', label: 'Unit' },
        { key: 'cost_value', label: 'Cost Value', right: true, render: (v) => inr(Number(v ?? 0)) },
        { key: 'created_at', label: 'Date', render: (v) => v ? new Date(String(v)).toLocaleDateString('en-IN') : '—' },
      ]}
    />
  );
}

function ProductionTable({ data }: { data: Row[] }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <DataTable
      rows={rows}
      colMap={[
        { key: 'batchNumber', label: 'Batch' },
        { key: 'productName', label: 'Product' },
        { key: 'produced_quantity', label: 'Qty Produced', right: true, render: (v) => Number(v ?? 0).toFixed(2) },
        { key: 'unit', label: 'Unit' },
        { key: 'cost_per_kg', label: 'Cost/Unit', right: true, render: (v) => v != null ? inr(Number(v)) : '—' },
        { key: 'production_date', label: 'Date', render: (v) => v ? new Date(String(v)).toLocaleDateString('en-IN') : '—' },
      ]}
    />
  );
}

function StockValuationTable({ data }: { data: Row[] }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <DataTable
      rows={rows}
      colMap={[
        { key: 'product_name', label: 'Product' },
        { key: 'category_name', label: 'Category' },
        { key: 'current_stock', label: 'Stock', right: true, render: (v) => Number(v ?? 0).toFixed(2) },
        { key: 'unit', label: 'Unit' },
        { key: 'avg_cost', label: 'Avg Cost', right: true, render: (v) => v != null ? inr(Number(v)) : '—' },
        { key: 'valuation', label: 'Valuation', right: true, render: (v) => inr(Number(v ?? 0)) },
      ]}
    />
  );
}

function GstTable({ data }: { data: { outputTax?: Row[]; inputTax?: Row[] } }) {
  const output = data?.outputTax ?? [];
  const input  = data?.inputTax  ?? [];
  return (
    <div>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#C98B4B', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        Output Tax (Sales)
      </p>
      <DataTable
        rows={output}
        colMap={[
          { key: 'hsn_code', label: 'HSN Code' },
          { key: 'gst_rate', label: 'GST Rate', right: true, render: (v) => `${v ?? 0}%` },
          { key: 'taxable_value', label: 'Taxable Value', right: true, render: (v) => inr(Number(v ?? 0)) },
          { key: 'cgst', label: 'CGST', right: true, render: (v) => inr(Number(v ?? 0)) },
          { key: 'sgst', label: 'SGST', right: true, render: (v) => inr(Number(v ?? 0)) },
          { key: 'total_tax', label: 'Total Tax', right: true, render: (v) => inr(Number(v ?? 0)) },
        ]}
      />
      {output.length === 0 && <EmptyState label="output GST" />}
      <p style={{ fontSize: 14, fontWeight: 700, color: '#C98B4B', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 24, marginBottom: 8 }}>
        Input Tax (Purchases)
      </p>
      <DataTable
        rows={input}
        colMap={[
          { key: 'hsn_code', label: 'HSN Code' },
          { key: 'gst_rate', label: 'GST Rate', right: true, render: (v) => `${v ?? 0}%` },
          { key: 'taxable_value', label: 'Taxable Value', right: true, render: (v) => inr(Number(v ?? 0)) },
          { key: 'cgst', label: 'CGST', right: true, render: (v) => inr(Number(v ?? 0)) },
          { key: 'sgst', label: 'SGST', right: true, render: (v) => inr(Number(v ?? 0)) },
          { key: 'total_tax', label: 'Total Tax', right: true, render: (v) => inr(Number(v ?? 0)) },
        ]}
      />
      {input.length === 0 && <EmptyState label="input GST" />}
    </div>
  );
}

// ─── CSV export helpers ───────────────────────────────────────────────────────

function flattenForCsv(reportType: string, data: unknown): Row[] {
  if (!data) return [];
  if (reportType === 'salesSummary') {
    const d = data as Record<string, number>;
    return [{ metric: 'Bills', value: d.billCount }, { metric: 'Total Sales', value: d.totalSales }, { metric: 'Discounts', value: d.totalDiscounts }, { metric: 'Revenue', value: d.totalRevenue }];
  }
  if (reportType === 'profit') {
    const d = data as Record<string, number>;
    return [
      { metric: 'Revenue', value: d.totalRevenue },
      { metric: 'COGS', value: d.totalCogs },
      { metric: 'Gross Profit', value: d.grossProfit },
      { metric: 'Expenses', value: d.totalExpenses },
      { metric: 'Net Profit', value: d.netProfit },
      { metric: 'Gross Margin %', value: d.grossMargin },
      { metric: 'Net Margin %', value: d.netMargin },
    ];
  }
  if (reportType === 'gst') {
    const d = data as { outputTax?: Row[]; inputTax?: Row[] };
    return [
      ...(d.outputTax ?? []).map((r) => ({ ...r, type: 'Output' })),
      ...(d.inputTax  ?? []).map((r) => ({ ...r, type: 'Input' })),
    ];
  }
  if (Array.isArray(data)) return data as Row[];
  return [];
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { hasMinRole } = useAuthStore();
  const [reportType, setReportType] = useState('salesSummary');
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const reportTypes = [
    { value: 'salesSummary',       label: 'Sales Summary',      adminOnly: false },
    { value: 'salesByProduct',     label: 'Sales by Product',   adminOnly: false },
    { value: 'salesByPaymentMode', label: 'By Payment Mode',    adminOnly: false },
    { value: 'salesByHour',        label: 'Peak Hours',         adminOnly: false },
    { value: 'wastage',            label: 'Wastage',            adminOnly: false },
    { value: 'production',         label: 'Production',         adminOnly: false },
    { value: 'shiftsSummary',      label: 'Shifts Summary',     adminOnly: true  },
    { value: 'gst',                label: 'GST Report',         adminOnly: true  },
    { value: 'profit',             label: 'Profit & Margin',    adminOnly: true  },
    { value: 'stockValuation',     label: 'Stock Valuation',    adminOnly: true  },
  ];

  const available = reportTypes.filter((r) => !r.adminOnly || hasMinRole('admin'));

  function load() {
    setLoading(true);
    const dateFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo   = new Date().toISOString().split('T')[0];
    const fetcher: Record<string, Promise<{ data: unknown }>> = {
      salesSummary:       reportApi.salesSummary({ dateFrom, dateTo }),
      salesByProduct:     reportApi.salesByProduct({ dateFrom, dateTo }),
      salesByPaymentMode: reportApi.salesByPaymentMode({ dateFrom, dateTo }),
      salesByHour:        reportApi.salesByHour({ dateFrom, dateTo }),
      gst:                reportApi.gst({ dateFrom, dateTo }),
      profit:             reportApi.profit({ dateFrom, dateTo }),
      stockValuation:     reportApi.stockValuation(),
      wastage:            reportApi.wastage({ dateFrom, dateTo }),
      production:         reportApi.production({ dateFrom, dateTo }),
      shiftsSummary:      reportApi.shiftsSummary(),
    };
    fetcher[reportType]
      .then((res) => { setData(res.data); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }

  useEffect(() => { load(); }, [reportType]);

  function handleDownload() {
    const rows     = flattenForCsv(reportType, data);
    const label    = available.find((r) => r.value === reportType)?.label ?? reportType;
    const today    = new Date().toISOString().split('T')[0];
    downloadCsv(rows, `${label.replace(/\s+/g, '_')}_${today}.csv`);
  }

  const activeLabel = available.find((r) => r.value === reportType)?.label ?? '';

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Sales, profit, GST, and inventory analytics — last 30 days"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={load}
              style={{ height: 44, padding: '0 16px', borderRadius: 10, border: '1px solid #EADFD0', background: '#fff', color: '#7A6A5F', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              onClick={handleDownload}
              disabled={loading || !data}
              style={{ height: 44, padding: '0 16px', borderRadius: 10, background: '#E8590C', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: loading || !data ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading || !data ? 0.6 : 1 }}
            >
              <Download size={15} /> Download CSV
            </button>
          </div>
        }
      />

      {/* Report type selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {available.map((r) => (
          <button
            key={r.value}
            onClick={() => setReportType(r.value)}
            style={{
              height: 36, padding: '0 16px', borderRadius: 9999, fontSize: 14, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: reportType === r.value ? '#E8590C' : '#FBF6EE',
              color:      reportType === r.value ? '#fff'    : '#7A6A5F',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#7A6A5F', fontSize: 16 }}>
            Loading {activeLabel}…
          </div>
        ) : !data ? (
          <EmptyState label={activeLabel} />
        ) : (
          <div>
            {/* Sales Summary */}
            {reportType === 'salesSummary' && (() => {
              const d = data as { billCount: number; totalSales: number; totalDiscounts: number; totalRevenue: number; totalGst: number };
              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <StatCard label="Bills Today"    value={String(d.billCount ?? 0)} />
                    <StatCard label="Sales (excl. GST)" value={inr(d.totalSales ?? 0)} />
                    <StatCard label="GST Collected"  value={inr(d.totalGst ?? 0)} />
                    <StatCard label="Total Revenue"  value={inr(d.totalRevenue ?? 0)} />
                    <StatCard label="Discounts"      value={inr(d.totalDiscounts ?? 0)} />
                  </div>
                  <p style={{ fontSize: 13, color: '#A89890', marginTop: 8 }}>
                    Figures shown are for today only in demo mode.
                  </p>
                </div>
              );
            })()}

            {/* Profit */}
            {reportType === 'profit' && (() => {
              const d = data as { totalRevenue: number; totalCogs: number; grossProfit: number; totalExpenses: number; netProfit: number; grossMargin: number; netMargin: number };
              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <StatCard label="Revenue"      value={inr(d.totalRevenue)} />
                    <StatCard label="COGS"         value={inr(d.totalCogs)} />
                    <StatCard label="Gross Profit" value={inr(d.grossProfit)} />
                    <StatCard label="Expenses"     value={inr(d.totalExpenses)} />
                    <StatCard label="Net Profit"   value={inr(d.netProfit)} />
                    <StatCard label="Gross Margin" value={pct(d.grossMargin)} />
                    <StatCard label="Net Margin"   value={pct(d.netMargin)} />
                  </div>
                  <DataTable
                    rows={[
                      { item: 'Revenue',       amount: inr(d.totalRevenue) },
                      { item: 'Cost of Goods', amount: inr(d.totalCogs) },
                      { item: 'Gross Profit',  amount: inr(d.grossProfit) },
                      { item: 'Expenses',      amount: inr(d.totalExpenses) },
                      { item: 'Net Profit',    amount: inr(d.netProfit) },
                    ]}
                    colMap={[
                      { key: 'item',   label: 'Line Item' },
                      { key: 'amount', label: 'Amount', right: true },
                    ]}
                  />
                </div>
              );
            })()}

            {/* Table reports */}
            {reportType === 'salesByProduct'     && <SalesByProductTable     data={data as Row[]} />}
            {reportType === 'salesByPaymentMode' && <SalesByPaymentTable     data={data as Row[]} />}
            {reportType === 'salesByHour'        && <SalesByHourTable        data={data as Row[]} />}
            {reportType === 'wastage'            && <WastageTable            data={data as Row[]} />}
            {reportType === 'production'         && <ProductionTable         data={data as Row[]} />}
            {reportType === 'stockValuation'     && <StockValuationTable     data={data as Row[]} />}
            {reportType === 'gst'                && <GstTable                data={data as { outputTax?: Row[]; inputTax?: Row[] }} />}

            {/* Shifts Summary */}
            {reportType === 'shiftsSummary' && (() => {
              const rows = Array.isArray(data) ? (data as Row[]) : [];
              const totalExpected = rows.reduce((s, r) => s + (r.expected_cash ?? 0), 0);
              const totalCounted  = rows.filter((r) => r.counted_cash != null).reduce((s, r) => s + (r.counted_cash ?? 0), 0);
              const closedRows    = rows.filter((r) => r.status === 'closed');
              return (
                <div>
                  {/* KPI strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: '#FBF6EE', borderRadius: 12, padding: '14px 18px', border: '1px solid #EADFD0' }}>
                      <div style={{ fontSize: 13, color: '#7A6A5F', marginBottom: 4 }}>Total Shifts</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1F1611' }}>{rows.length}</div>
                    </div>
                    <div style={{ background: '#FBF6EE', borderRadius: 12, padding: '14px 18px', border: '1px solid #EADFD0' }}>
                      <div style={{ fontSize: 13, color: '#7A6A5F', marginBottom: 4 }}>Expected Cash (total)</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1F1611', fontVariantNumeric: 'tabular-nums' }}>{inr(totalExpected)}</div>
                    </div>
                    <div style={{ background: '#FBF6EE', borderRadius: 12, padding: '14px 18px', border: '1px solid #EADFD0' }}>
                      <div style={{ fontSize: 13, color: '#7A6A5F', marginBottom: 4 }}>Counted Cash (total)</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1F1611', fontVariantNumeric: 'tabular-nums' }}>{inr(totalCounted)}</div>
                    </div>
                    {closedRows.length > 0 && (() => {
                      const netVariance = closedRows.reduce((s, r) => s + (r.shortage ?? 0), 0);
                      return (
                        <div style={{ background: netVariance < 0 ? '#FDE5E0' : '#E8F5E9', borderRadius: 12, padding: '14px 18px', border: `1px solid ${netVariance < 0 ? '#FFAB91' : '#C8E6C9'}` }}>
                          <div style={{ fontSize: 13, color: '#7A6A5F', marginBottom: 4 }}>Net Variance</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: netVariance < 0 ? '#C0392B' : '#4F7F4A', fontVariantNumeric: 'tabular-nums' }}>
                            {netVariance >= 0 ? '+' : ''}{inr(netVariance)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Per-shift table */}
                  <DataTable
                    rows={rows}
                    colMap={[
                      { key: 'id',              label: '#',              render: (v) => `#${v}` },
                      { key: 'cashier_name',    label: 'Cashier' },
                      { key: 'counted_by_name', label: 'Counted By',     render: (v) => (v != null ? String(v) : '—') },
                      { key: 'opened_at',       label: 'Opened',         render: (v) => v ? new Date(String(v)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—' },
                      { key: 'closed_at',       label: 'Closed',         render: (v) => v ? new Date(String(v)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—' },
                      { key: 'opening_float',   label: 'Opening Float',  right: true, render: (v) => inr(Number(v ?? 0)) },
                      { key: 'expected_cash',   label: 'Expected Cash',  right: true, render: (v) => inr(Number(v ?? 0)) },
                      { key: 'counted_cash',    label: 'Counted Cash',   right: true, render: (v) => v != null ? inr(Number(v)) : '—' },
                      { key: 'shortage',        label: 'Variance',       right: true, render: (v, row) => {
                        if (row.status !== 'closed' || v == null) return '—';
                        const n = Number(v);
                        return <span style={{ color: n < 0 ? '#C0392B' : n > 0 ? '#4F7F4A' : '#7A6A5F', fontWeight: 700 }}>{n >= 0 ? '+' : ''}{inr(n)}</span>;
                      }},
                      { key: 'status', label: 'Status', render: (v) => (
                        <span style={{ background: v === 'open' ? '#E8F5E9' : '#FBF6EE', color: v === 'open' ? '#4F7F4A' : '#7A6A5F', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                          {String(v ?? '').charAt(0).toUpperCase() + String(v ?? '').slice(1)}
                        </span>
                      )},
                    ]}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </Card>
    </div>
  );
}
