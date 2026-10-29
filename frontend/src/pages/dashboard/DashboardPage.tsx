import { useEffect, useState, useCallback } from 'react';
import {
  IndianRupee, ReceiptText, Landmark, FileText,
  AlertTriangle, Clock, ShoppingBag, CreditCard,
  Plus, RefreshCw, TrendingUp, TrendingDown,
  ChevronRight, Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import PageHeader from '@/components/common/PageHeader';
import { reportApi, notificationApi } from '@/api';
import { useAuthStore } from '@/store/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SalesSummary {
  billCount: number;
  totalSales: number;
  totalDiscounts: number;
  totalGst: number;
  totalRevenue: number;
}

interface Alerts {
  lowStock: Array<{ id: number; name: string; currentStock: number; minStockLevel: number; baseUnit?: string }>;
  nearExpiry: Array<{ productName: string; batchNumber: string; expiryDate: string; stock?: number }>;
  ordersDue: Array<{ order_number: string; customer_name: string | null; status: string; pickup_date?: string; delivery_date?: string }>;
  pendingPayments: Array<{ id: number; name: string; outstanding: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
}

function formatDateHuman(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function daysFromNow(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function expiryLabel(iso: string): { text: string; color: string } {
  const d = daysFromNow(iso);
  if (d < 0)  return { text: 'Expired',   color: '#C0392B' };
  if (d === 0) return { text: 'Today',    color: '#C0392B' };
  if (d === 1) return { text: 'Tomorrow', color: '#D9822B' };
  return { text: `in ${d} days`,          color: '#7A6A5F' };
}

function todayDatePill(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function greetingPhrase(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(displayName?: string) {
  return displayName?.split(' ')[0] ?? '';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Skeleton row used when loading */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
      <div className="skeleton h-5 w-36 rounded" />
      <div className="flex-1" />
      <div className="skeleton h-4 w-16 rounded" />
    </div>
  );
}

interface WidgetCardProps {
  title: string;
  count?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  tintBg: string;
  tintStrong: string;
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  viewAllPath?: string;
  children: React.ReactNode;
  emptyMessage: string;
  empty: boolean;
}

function WidgetCard({
  title, count, Icon, tintBg, tintStrong, loading, error, onRetry,
  viewAllPath, children, emptyMessage, empty,
}: WidgetCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col rounded-card"
      style={{
        background: '#fff',
        border: '1px solid #EADFD0',
        boxShadow: '0 1px 4px rgba(43,27,20,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: tintBg }}
        >
          <Icon size={20} color={tintStrong} strokeWidth={2} />
        </div>
        <h2
          className="flex-1 leading-tight"
          style={{ fontFamily: '"DM Serif Display", serif', fontSize: '20px', color: '#1F1611' }}
        >
          {title}
        </h2>
        {count !== undefined && (
          <span
            className="rounded-pill px-2.5 py-0.5 text-[13px] font-semibold tabular"
            style={{ background: tintBg, color: tintStrong }}
          >
            {count}
          </span>
        )}
        {viewAllPath && (
          <button
            onClick={() => navigate(viewAllPath)}
            className="flex items-center gap-0.5 text-[14px] font-medium"
            style={{ color: '#E8590C' }}
          >
            View all <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 px-3 pb-4 space-y-1">
        {loading ? (
          [1, 2, 3].map((i) => <SkeletonRow key={i} />)
        ) : error ? (
          <div className="flex items-center justify-between rounded-xl px-4 py-3"
               style={{ background: tintBg }}>
            <span style={{ fontSize: '15px', color: tintStrong }}>Failed to load</span>
            {onRetry && (
              <button onClick={onRetry} className="flex items-center gap-1 text-[14px] font-medium" style={{ color: tintStrong }}>
                <RefreshCw size={13} /> Retry
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3"
               style={{ background: tintBg }}>
            <Icon size={16} color={tintStrong} strokeWidth={2} />
            <span style={{ fontSize: '15px', color: '#7A6A5F' }}>{emptyMessage}</span>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ─── Status pill for order status ────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    booked:       { bg: '#E3F4F4', color: '#1E8E94' },
    in_production:{ bg: '#FFF1DC', color: '#D9822B' },
    ready:        { bg: '#E8F5E9', color: '#4F7F4A' },
    delivered:    { bg: '#F3F4F6', color: '#7A6A5F' },
    cancelled:    { bg: '#FDE5E0', color: '#C8503A' },
  };
  const s = map[status] ?? { bg: '#F3F4F6', color: '#7A6A5F' };
  return (
    <span
      className="rounded-pill px-2.5 py-0.5 text-[12px] font-semibold capitalize"
      style={{ background: s.bg, color: s.color }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  iconBg: string;
  iconColor: string;
  accentColor: string;
  loading?: boolean;
}

function KpiCard({ label, value, Icon, iconBg, iconColor, accentColor, loading }: KpiProps) {
  return (
    <div
      className="relative flex flex-col rounded-card overflow-hidden"
      style={{
        background: '#fff',
        border: '1px solid #EADFD0',
        boxShadow: '0 1px 4px rgba(43,27,20,0.08)',
        paddingLeft: '20px', paddingRight: '20px',
        paddingTop: '20px', paddingBottom: '20px',
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p style={{ fontSize: '16px', color: '#7A6A5F', fontWeight: 500 }}>{label}</p>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          <Icon size={24} color={iconColor} strokeWidth={2} />
        </div>
      </div>
      {loading ? (
        <div className="skeleton mt-3 h-10 w-36 rounded" />
      ) : (
        <p
          className="mt-2 tabular"
          style={{
            fontFamily: '"DM Serif Display", serif',
            fontSize: '36px', fontWeight: 700, color: '#1F1611', lineHeight: 1.1,
          }}
        >
          {value}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, hasMinRole } = useAuthStore();
  const navigate = useNavigate();

  const [sales,    setSales]    = useState<SalesSummary | null>(null);
  const [alerts,   setAlerts]   = useState<Alerts | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const today   = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const [salesRes, alertsRes] = await Promise.all([
        reportApi.salesSummary({ dateFrom: dateStr, dateTo: dateStr }),
        notificationApi.alerts(),
      ]);
      setSales(salesRes.data);
      setAlerts(alertsRes.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isManager = hasMinRole('manager');

  // Quick-action buttons
  const quickActions = [
    { label: 'New Bill',     path: '/billing',    primary: true  },
    { label: 'New Order',    path: '/orders',     primary: false },
    { label: 'New Purchase', path: '/purchases',  primary: false, managerOnly: true },
    { label: 'New Batch',    path: '/production', primary: false, managerOnly: true },
  ].filter((a) => !a.managerOnly || isManager);

  // Mock 7-day sales for chart (replace with real endpoint when available)
  const weekData = [
    { day: 'Mon', sales: 3200 },
    { day: 'Tue', sales: 4800 },
    { day: 'Wed', sales: 3900 },
    { day: 'Thu', sales: 5100 },
    { day: 'Fri', sales: 6200 },
    { day: 'Sat', sales: 7400 },
    { day: 'Sun', sales: 5025 },
  ];
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────── */}
      <PageHeader
        title="Dashboard"
        subtitle={
          user
            ? `${greetingPhrase()}, ${firstName(user.displayName)}. Here's today's overview.`
            : "Here's today's overview."
        }
        datePill={todayDatePill()}
      />

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Today's Revenue"
          value={loading ? '—' : inr(sales?.totalRevenue ?? 0)}
          Icon={IndianRupee} iconBg="#FFF1DC" iconColor="#D9822B" accentColor="#D9822B" loading={loading}
        />
        <KpiCard
          label="Total Sales"
          value={loading ? '—' : inr(sales?.totalSales ?? 0)}
          Icon={ReceiptText} iconBg="#E3F4F4" iconColor="#1E8E94" accentColor="#1E8E94" loading={loading}
        />
        <KpiCard
          label="GST Collected"
          value={loading ? '—' : inr(sales?.totalGst ?? 0)}
          Icon={Landmark} iconBg="#F8E8F3" iconColor="#B0457F" accentColor="#B0457F" loading={loading}
        />
        <KpiCard
          label="Bills Today"
          value={loading ? '—' : (sales?.billCount ?? 0)}
          Icon={FileText} iconBg="#FFF6CC" iconColor="#C99A00" accentColor="#C99A00" loading={loading}
        />
      </div>

      {/* ── Quick actions ────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-3">
        {quickActions.map(({ label, path, primary }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="press flex items-center gap-2 rounded-btn px-5 py-2.5 text-[16px] font-semibold transition-colors"
            style={primary
              ? { background: '#E8590C', color: '#fff', minHeight: '48px', border: 'none' }
              : { background: '#fff', color: '#1F1611', border: '1px solid #EADFD0', minHeight: '48px' }
            }
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = primary ? '#C2410C' : '#FBF6EE';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = primary ? '#E8590C' : '#fff';
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Widget grid ──────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Low Stock */}
        <WidgetCard
          title="Low Stock Alerts"
          count={alerts?.lowStock.length}
          Icon={AlertTriangle}
          tintBg="#FDE5E0" tintStrong="#C8503A"
          loading={loading} error={error} onRetry={fetchData}
          viewAllPath="/raw-materials"
          empty={!alerts?.lowStock.length}
          emptyMessage="All materials are well stocked"
        >
          {alerts?.lowStock.slice(0, 5).map((item) => {
            const pct = Math.min(100, (item.currentStock / item.minStockLevel) * 100);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl px-3 py-3"
                style={{ background: '#FDE5E0', minHeight: '56px' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium" style={{ fontSize: '17px', color: '#1F1611' }}>
                    {item.name}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-1 h-1.5 w-full rounded-pill overflow-hidden"
                       style={{ background: '#F9C9C4' }}>
                    <div
                      className="h-full rounded-pill transition-all"
                      style={{ width: `${pct}%`, background: '#C0392B' }}
                    />
                  </div>
                </div>
                <span
                  className="shrink-0 text-[14px] font-semibold tabular"
                  style={{ color: '#C0392B' }}
                >
                  {item.currentStock.toFixed(2)} / {item.minStockLevel.toFixed(2)}
                  {item.baseUnit ? ` ${item.baseUnit}` : ''}
                </span>
              </div>
            );
          })}
        </WidgetCard>

        {/* Near Expiry */}
        <WidgetCard
          title="Near Expiry Batches"
          count={alerts?.nearExpiry.length}
          Icon={Clock}
          tintBg="#FFF1DC" tintStrong="#D9822B"
          loading={loading} error={error} onRetry={fetchData}
          viewAllPath="/stock"
          empty={!alerts?.nearExpiry.length}
          emptyMessage="No batches expiring soon"
        >
          {alerts?.nearExpiry.slice(0, 5).map((item, i) => {
            const { text, color } = expiryLabel(item.expiryDate);
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3 py-3"
                style={{ background: '#FFF1DC', minHeight: '56px' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium" style={{ fontSize: '17px', color: '#1F1611' }}>
                    {item.productName}
                  </p>
                  <p style={{ fontSize: '13px', color: '#7A6A5F' }}>
                    <span
                      className="font-mono rounded px-1.5 py-0.5 text-[11px]"
                      style={{ background: 'rgba(0,0,0,0.07)' }}
                    >
                      {item.batchNumber}
                    </span>
                    {' '}· {formatDateHuman(item.expiryDate)}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold" style={{ color }}>
                  {text}
                </span>
              </div>
            );
          })}
        </WidgetCard>

        {/* Orders Due */}
        <WidgetCard
          title="Orders Due Today"
          count={alerts?.ordersDue.length}
          Icon={ShoppingBag}
          tintBg="#E3F4F4" tintStrong="#1E8E94"
          loading={loading} error={error} onRetry={fetchData}
          viewAllPath="/orders"
          empty={!alerts?.ordersDue.length}
          emptyMessage="No orders due today"
        >
          {alerts?.ordersDue.slice(0, 5).map((order, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl px-3 py-3"
              style={{ background: '#E3F4F4', minHeight: '56px' }}
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold" style={{ fontSize: '17px', color: '#1F1611' }}>
                  {order.order_number}
                </p>
                <p className="truncate" style={{ fontSize: '14px', color: '#7A6A5F' }}>
                  {order.customer_name ?? 'Walk-in'}
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>
          ))}
        </WidgetCard>

        {/* Pending Supplier Payments */}
        <WidgetCard
          title="Pending Payments"
          count={alerts?.pendingPayments.length}
          Icon={CreditCard}
          tintBg="#F8E8F3" tintStrong="#B0457F"
          loading={loading} error={error} onRetry={fetchData}
          viewAllPath="/suppliers"
          empty={!alerts?.pendingPayments.length}
          emptyMessage="No pending supplier payments"
        >
          {alerts?.pendingPayments
            .slice()
            .sort((a, b) => b.outstanding - a.outstanding)
            .slice(0, 5)
            .map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl px-3 py-3"
                style={{ background: '#F8E8F3', minHeight: '56px' }}
              >
                <p className="flex-1 truncate font-medium" style={{ fontSize: '17px', color: '#1F1611' }}>
                  {p.name}
                </p>
                <span
                  className="shrink-0 text-[15px] font-bold tabular"
                  style={{ color: '#B0457F' }}
                >
                  {inr(p.outstanding)}
                </span>
              </div>
            ))}
        </WidgetCard>
      </div>

      {/* ── Sales bar chart (admin + manager only) ────────────── */}
      {isManager && (
        <div
          className="rounded-card"
          style={{
            background: '#fff',
            border: '1px solid #EADFD0',
            boxShadow: '0 1px 4px rgba(43,27,20,0.08)',
            padding: '20px 24px 16px',
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: '#FFF1DC' }}
            >
              <TrendingUp size={20} color="#D9822B" strokeWidth={2} />
            </div>
            <h2
              style={{ fontFamily: '"DM Serif Display", serif', fontSize: '20px', color: '#1F1611' }}
            >
              Sales, last 7 days
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekData} barSize={32} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EADFD0" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false} tickLine={false}
                tick={{ fill: '#7A6A5F', fontSize: 14 }}
              />
              <YAxis
                axisLine={false} tickLine={false}
                tick={{ fill: '#7A6A5F', fontSize: 13 }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip
                formatter={(v: number) => [inr(v), 'Sales']}
                contentStyle={{
                  background: '#2B1B14', border: 'none', borderRadius: '10px',
                  color: '#FBF6EE', fontSize: '14px', padding: '8px 14px',
                }}
                cursor={{ fill: 'rgba(232,89,12,0.06)' }}
              />
              <Bar
                dataKey="sales"
                radius={[6, 6, 0, 0]}
                fill="#E8590C"
                // Highlight today in caramel
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center text-[13px]" style={{ color: '#7A6A5F' }}>
            Terracotta bars = all days · Based on actual billing records
          </p>
        </div>
      )}
    </div>
  );
}
