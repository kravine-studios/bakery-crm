/**
 * Bakery CRM — Billing / POS Screen  (v5 — Table-first POS)
 *
 * Layout:
 *   LEFT  (~300 px) — "Today" summary: Take-away, Home delivery, On Hold.
 *                     Lists held bills with Resume / Discard.
 *   RIGHT (flex-1)  — Bill header (order type, employee, customer, bill no.)
 *                     Bill table: Code | Product Name | Rate | Qty | Price | Notes | ×
 *                     Entry row always first; committed lines below.
 *                     Totals footer (discount, taxes, Amount) + payment + Pay.
 *
 * REGRESSION GUARANTEES (unchanged from v4):
 *   - Stock deducted at billingApi.create (FEFO inside demoStore.bills.create)
 *   - Held bills → billingApi.hold  (no stock deduction)
 *   - GST / CGST / SGST / round-off maths identical
 *   - Payment modes: Cash, UPI, Card
 *   - Bill numbering via demoStore.bills.create
 *   - Printing via /bills/:id/print including shop logo
 *   - Role access, owner-only editing untouched
 *   - Settings stockBlockZero respected
 *   - Live counter-stock polling every 15 s
 */

import {
  useState, useEffect, useRef, useCallback,
  KeyboardEvent, ReactNode,
} from 'react';
import {
  Banknote, Smartphone, CreditCard, CheckCircle, Printer,
  ArrowRight, X, HelpCircle, Package, Truck,
  Clock, AlertCircle, RotateCcw, Trash2,
} from 'lucide-react';
import {
  productApi, billingApi, customerApi, categoryApi, settingsApi,
} from '@/api';
import { IS_MOCK, IS_DEMO } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

const USE_MOCK = IS_MOCK || IS_DEMO;

// ─────────────────────────── Types ───────────────────────────────────────────

interface Product {
  id: number;
  productCode: string;
  name: string;
  sellingPrice: number;
  gstRate: number;
  sellingUnit: string;
  hsnCode: string | null;
  categoryId: number;
  foodType: 'veg' | 'non_veg' | 'egg';
  isWeighed: boolean;
  isActive: boolean;
  lowStockLevel?: number | null;
}

interface Category { id: number; name: string; }

interface CartLine {
  productId: number;
  productCode: string;
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
  hsnCode?: string;
  foodType?: 'veg' | 'non_veg' | 'egg';
  notes: string;
}

interface Customer { id: number; name: string; phone: string; loyaltyPoints: number; }

interface HeldBill {
  billId: number;
  invoiceNumber: string;
  grandTotal: number;
  createdAt: string;
  customerName?: string;
  orderType: string;
  items: CartLine[];
  customerId?: number;
  customerPhone?: string;
  discountAmount: number;
  paymentMode: PayMode;
}

interface CompletedBill {
  billId: number;
  invoiceNumber: string;
  grandTotal: number;
}

type PayMode = 'cash' | 'upi' | 'card';

// ─────────────────────────── Colour palette ───────────────────────────────────

const T = {
  bg:       '#FBF6EE',
  surface:  '#FFFFFF',
  border:   '#EADFD0',
  divider:  '#F0EAE3',
  brand:    '#E8590C',
  brandHov: '#C84A0A',
  muted:    '#7A6A5F',
  text:     '#1F1611',
  green:    '#4F7F4A',
  red:      '#C0392B',
  amber:    '#D9822B',
};

// ─────────────────────────── Helpers ─────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function shortUnit(u: string) {
  const map: Record<string, string> = {
    kilogram: 'kg', piece: 'pcs', pieces: 'pcs', box: 'box',
    packet: 'pkt', packets: 'pkt', litre: 'L', dozen: 'doz',
  };
  return map[u.toLowerCase()] ?? u;
}

/** Parse "500g" → 0.5, ".250" → 0.25, "1.5" → 1.5 */
function parseQty(raw: string, unit: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (unit === 'kg') {
    const gMatch = trimmed.match(/^(\d+\.?\d*)\s*g$/);
    if (gMatch) return parseFloat(gMatch[1]) / 1000;
    const kgMatch = trimmed.match(/^(\d+\.?\d*)\s*(kg)?$/);
    if (kgMatch) return parseFloat(kgMatch[1]);
    return null;
  }
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

/** Parse "001*3 005 012*2" → [{code,qty},...] */
function parseCodeString(raw: string): Array<{ code: string; qty: number }> {
  return raw.trim().split(/\s+/).map((token) => {
    const m = token.match(/^(\d+)\*(\d+\.?\d*)$/);
    if (m) return { code: m[1].padStart(3, '0'), qty: parseFloat(m[2]) };
    return { code: token.padStart(3, '0'), qty: 1 };
  });
}

function printBill(billId: number, paper = '80mm') {
  const iframeId = `print-frame-${billId}`;
  let frame = document.getElementById(iframeId) as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = iframeId;
    frame.style.cssText =
      'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:none;';
    document.body.appendChild(frame);
  }
  frame.src = `/bills/${billId}/print?paper=${paper}`;
  frame.onload = () => {
    try {
      frame?.contentWindow?.document.fonts.ready.then(() => {
        frame?.contentWindow?.print();
      });
    } catch {
      frame?.contentWindow?.print();
    }
  };
}

// ─────────────────────────── Veg dot ─────────────────────────────────────────

function VegDot({ type }: { type?: 'veg' | 'non_veg' | 'egg' }) {
  if (!type) return null;
  const color =
    type === 'veg' ? '#4F7F4A' : type === 'non_veg' ? '#C0392B' : '#C98B4B';
  return (
    <span
      title={type === 'veg' ? 'Veg' : type === 'non_veg' ? 'Non-Veg' : 'Egg'}
      style={{
        display: 'inline-flex', height: 13, width: 13, flexShrink: 0,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 2, border: `1.5px solid ${color}`,
      }}
    >
      <span style={{ display: 'block', height: 7, width: 7, borderRadius: '50%', background: color }} />
    </span>
  );
}

// ─────────────────────────── Stock chip ──────────────────────────────────────

function StockChip({ qty, unit, low }: { qty: number; unit: string; low?: number | null }) {
  if (qty <= 0) return (
    <span style={{ background: '#FDE5E0', color: T.red, borderRadius: 9999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
      Out
    </span>
  );
  const isLow = low != null && qty <= low;
  return (
    <span style={{
      background: isLow ? '#FFF1DC' : '#E8F5E9',
      color: isLow ? T.amber : T.green,
      borderRadius: 9999, padding: '1px 7px', fontSize: 11, fontWeight: 700,
    }}>
      {isLow ? 'Low: ' : ''}{qty % 1 === 0 ? qty : qty.toFixed(2)} {shortUnit(unit)}
    </span>
  );
}

// ─────────────────────────── Shortcuts overlay ───────────────────────────────

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['F2', 'Focus Code cell'],
    ['F3', 'Browse menu drawer'],
    ['F4', 'Focus Customer search'],
    ['F6', 'Hold bill'],
    ['Ctrl+Enter', 'Pay (checkout)'],
    ['Esc', 'Clear entry row'],
    ['001*3', 'Add code 001, qty 3'],
    ['001 005 012', 'Add multiple codes'],
    ['500g', 'Enter 500g for weighed item'],
  ];
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, padding: '24px 28px', width: 380,
        boxShadow: '0 8px 32px rgba(43,27,20,0.16)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Keyboard shortcuts</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}>
            <X size={18} />
          </button>
        </div>
        {rows.map(([key, desc]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.divider}` }}>
            <kbd style={{ background: T.bg, color: T.text, borderRadius: 6, padding: '2px 8px', fontSize: 13, fontFamily: 'monospace' }}>{key}</kbd>
            <span style={{ fontSize: 14, color: T.muted }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── Browse menu drawer ───────────────────────────────

function BrowseDrawer({
  products,
  categories,
  stockMap,
  cartLines,
  onSelect,
  onClose,
}: {
  products: Product[];
  categories: Category[];
  stockMap: Record<number, number>;
  cartLines: CartLine[];
  onSelect: (p: Product) => void;
  onClose: () => void;
}) {
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = products.filter((p) => {
    if (!p.isActive) return false;
    if (activeCat !== null && p.categoryId !== activeCat) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.productCode.toLowerCase().startsWith(q);
    }
    return true;
  });

  const inCartQty = (id: number) =>
    cartLines.filter((c) => c.productId === id).reduce((s, c) => s + c.quantity, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.4)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div style={{
        background: '#fff', width: 520, maxWidth: '95vw', height: '100%',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 20px rgba(43,27,20,0.14)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Browse menu  <kbd style={{ background: T.bg, borderRadius: 6, padding: '2px 8px', fontSize: 13, fontFamily: 'monospace', color: T.muted }}>F3</kbd></span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or code…"
            style={{
              width: '100%', height: 40, fontSize: 15, padding: '0 12px',
              border: `1.5px solid ${T.border}`, borderRadius: 10, outline: 'none',
              background: T.bg, color: T.text, boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = T.brand)}
            onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
          />
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '8px 16px', flexShrink: 0 }}>
          <button onClick={() => setActiveCat(null)}
            style={{ height: 28, padding: '0 12px', borderRadius: 9999, border: 'none', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, background: activeCat === null ? T.brand : T.bg, color: activeCat === null ? '#fff' : T.muted }}>
            All
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
              style={{ height: 28, padding: '0 12px', borderRadius: 9999, border: 'none', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, background: activeCat === cat.id ? T.brand : T.bg, color: activeCat === cat.id ? '#fff' : T.muted }}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' }}>
          {filtered.map((p) => {
            const counterQty = (stockMap[p.id] ?? 0) - inCartQty(p.id);
            return (
              <button key={p.id} onClick={() => { onSelect(p); onClose(); }}
                style={{
                  width: 150, minHeight: 72, display: 'flex', flexDirection: 'column',
                  alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10,
                  border: `1px solid ${T.border}`, background: T.bg, cursor: 'pointer',
                  textAlign: 'left', gap: 3,
                }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.brand, fontFamily: 'monospace' }}>{p.productCode}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.brand }}>{fmt(p.sellingPrice)}</span>
                <StockChip qty={counterQty} unit={p.sellingUnit} low={p.lowStockLevel} />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ width: '100%', padding: '40px 0', textAlign: 'center', color: T.muted }}>No products found</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Bill details drawer ──────────────────────────────

function BillsDrawer({
  title,
  bills,
  onClose,
  onReprint,
}: {
  title: string;
  bills: Array<{ id: number; invoiceNumber: string; billDate: string; customerName?: string; grandTotal: number; paymentMode?: string }>;
  onClose: () => void;
  onReprint: (id: number) => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ background: '#fff', width: 480, maxWidth: '95vw', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(43,27,20,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {bills.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: T.muted, fontSize: 15 }}>No bills yet today</div>
          ) : bills.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: `1px solid ${T.divider}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{b.invoiceNumber}</div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  {new Date(b.billDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {b.customerName ? ` · ${b.customerName}` : ''}
                  {b.paymentMode ? ` · ${b.paymentMode.toUpperCase()}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginRight: 12, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(b.grandTotal)}
              </div>
              <button onClick={() => onReprint(b.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Printer size={14} /> Reprint
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Success panel ───────────────────────────────────

function SuccessPanel({
  bill, cashReceived, grandTotal,
  onNewBill, onViewBill, onPrint,
}: {
  bill: CompletedBill; cashReceived: number; grandTotal: number;
  onNewBill: () => void; onViewBill: () => void; onPrint: () => void;
}) {
  const change = Math.max(0, r2(cashReceived - grandTotal));
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(31,22,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '36px 32px', width: 400, boxShadow: '0 12px 40px rgba(43,27,20,0.20)', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ background: '#E8F5E9', borderRadius: '50%', padding: 16 }}>
            <CheckCircle size={48} color={T.green} strokeWidth={2} />
          </div>
        </div>
        <p style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: '0 0 4px' }}>Payment successful!</p>
        <p style={{ fontSize: 15, color: T.muted, margin: '0 0 20px' }}>{bill.invoiceNumber}</p>
        <div style={{ background: T.bg, borderRadius: 14, padding: '14px 20px', marginBottom: change > 0 ? 10 : 20 }}>
          <p style={{ fontSize: 15, color: T.muted, margin: '0 0 2px' }}>Grand Total</p>
          <p style={{ fontSize: 36, fontWeight: 800, color: T.brand, margin: 0, fontFamily: '"DM Serif Display", serif', fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</p>
        </div>
        {change > 0 && (
          <div style={{ background: '#E8F5E9', borderRadius: 14, padding: '10px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 14, color: T.muted, margin: '0 0 2px' }}>Change due</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: T.green, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(change)}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onPrint} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 12, fontSize: 17, fontWeight: 700, background: T.brand, color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Printer size={20} strokeWidth={2} /> Print Bill
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={onNewBill} style={{ height: 48, borderRadius: 12, fontSize: 16, fontWeight: 600, background: T.bg, color: T.text, border: `1.5px solid ${T.border}`, cursor: 'pointer' }}>New Bill</button>
            <button onClick={onViewBill} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 12, fontSize: 16, fontWeight: 600, background: T.bg, color: T.text, border: `1.5px solid ${T.border}`, cursor: 'pointer' }}>
              View Bill <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Main component ───────────────────────────────────

export default function BillingPage() {
  const { user } = useAuthStore();
  const isOwner  = user?.role === 'admin';
  const cashierName = user?.displayName ?? 'Cashier';

  // ── Master data ────────────────────────────────────────────────────────────
  const [products,     setProducts]     = useState<Product[]>([]);
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [stockMap,     setStockMap]     = useState<Record<number, number>>({});
  const [stockBlockZero, setStockBlockZero] = useState(false);
  const [receiptPaper, setReceiptPaper] = useState('80mm');
  const [loadingData,  setLoadingData]  = useState(true);

  // ── Bill lines (cart) ──────────────────────────────────────────────────────
  const [lines, setLines] = useState<CartLine[]>([]);

  // ── Bill header ────────────────────────────────────────────────────────────
  const [orderType,       setOrderType]       = useState<'takeaway' | 'delivery'>('takeaway');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone,   setDeliveryPhone]   = useState('');
  const [customer,        setCustomer]        = useState<Customer | null>(null);
  const [custQuery,       setCustQuery]       = useState('');
  const [custResults,     setCustResults]     = useState<Customer[]>([]);
  const [showCustDrop,    setShowCustDrop]    = useState(false);

  // ── Entry row state ────────────────────────────────────────────────────────
  const [entryCode,    setEntryCode]    = useState('');
  const [entryProduct, setEntryProduct] = useState<Product | null>(null);
  const [entryQtyRaw,  setEntryQtyRaw]  = useState('');
  const [entryNotes,   setEntryNotes]   = useState('');
  const [entryError,   setEntryError]   = useState('');

  // Product-name dropdown
  const [showNameDrop,   setShowNameDrop]   = useState(false);
  const [nameDrop,       setNameDrop]       = useState<Product[]>([]);
  const [nameDropIdx,    setNameDropIdx]    = useState(0);
  const [nameQuery,      setNameQuery]      = useState('');

  // ── Discount ───────────────────────────────────────────────────────────────
  const [discountAmount,    setDiscountAmount]    = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountInput,     setDiscountInput]     = useState('');

  // ── Payment ────────────────────────────────────────────────────────────────
  const [payMode,       setPayMode]       = useState<PayMode>('cash');
  const [cashReceived,  setCashReceived]  = useState('');

  // ── UI state ───────────────────────────────────────────────────────────────
  const [submitting,    setSubmitting]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [completedBill, setCompletedBill] = useState<CompletedBill | null>(null);
  const [heldBills,     setHeldBills]     = useState<HeldBill[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showBrowse,    setShowBrowse]    = useState(false);
  const [drawerType,    setDrawerType]    = useState<'takeaway' | 'delivery' | null>(null);
  // today's paid bills for the summary panel
  const [todayBills,    setTodayBills]    = useState<Array<{
    id: number; invoiceNumber: string; billDate: string; orderType: string;
    customerName?: string; grandTotal: number; cashierName?: string; paymentMode?: string;
  }>>([]);

  // Refs
  const codeRef  = useRef<HTMLInputElement>(null);
  const qtyRef   = useRef<HTMLInputElement>(null);
  const custRef  = useRef<HTMLInputElement>(null);
  const nameRef  = useRef<HTMLInputElement>(null);

  // ── Stock refresh ──────────────────────────────────────────────────────────
  function refreshStock() {
    if (!USE_MOCK) return;
    import('@/store/demoStore').then(({ stock }) => {
      const lots = stock.list();
      const map: Record<number, number> = {};
      lots.forEach((lot: { product_id: number; counter_qty?: number }) => {
        if (lot.product_id) map[lot.product_id] = (map[lot.product_id] ?? 0) + (lot.counter_qty ?? 0);
      });
      setStockMap(map);
    });
  }

  // ── Today bills refresh ────────────────────────────────────────────────────
  function refreshTodayBills() {
    if (!USE_MOCK) return;
    import('@/store/demoStore').then(({ bills }) => {
      const today = new Date().toISOString().split('T')[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all = (bills.list() as any[]).filter((b) =>
        b.billDate?.startsWith(today) && b.status === 'paid'
      );
      setTodayBills(all);
    });
  }

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingData(true);
    Promise.all([
      productApi.list({ active: true }),
      categoryApi.list(),
      settingsApi.get(),
    ]).then(([pr, cr, sr]) => {
      setProducts(pr.data);
      setCategories(cr.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = sr.data as any;
      setStockBlockZero(s?.stockBlockZero === true);
      setReceiptPaper(s?.receiptPaper ?? '80mm');
      setTimeout(refreshStock, 0);
      setTimeout(refreshTodayBills, 0);
    }).catch(() => {}).finally(() => setLoadingData(false));

    const interval = setInterval(() => { refreshStock(); refreshTodayBills(); }, 15000);
    window.addEventListener('focus', () => { refreshStock(); refreshTodayBills(); });
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshStock);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName ?? '';
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'F2') { e.preventDefault(); codeRef.current?.focus(); codeRef.current?.select(); return; }
      if (e.key === 'F3') { e.preventDefault(); setShowBrowse(true); return; }
      if (e.key === 'F4') { e.preventDefault(); custRef.current?.focus(); return; }
      if (e.key === 'F6') { e.preventDefault(); handleHold(); return; }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleCheckout(); return; }
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(true); return; }
      if (!inInput && e.key === 'Escape') { clearEntryRow(); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, orderType, deliveryAddress, customer, payMode, cashReceived]);

  // ── Customer search debounce ───────────────────────────────────────────────
  useEffect(() => {
    if (!custQuery.trim()) { setCustResults([]); setShowCustDrop(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await customerApi.list({ search: custQuery });
        setCustResults(res.data.slice(0, 6));
        setShowCustDrop(true);
      } catch { /* */ }
    }, 260);
    return () => clearTimeout(t);
  }, [custQuery]);

  // ── Product name dropdown filter ───────────────────────────────────────────
  useEffect(() => {
    const q = nameQuery.toLowerCase().trim();
    const results = products
      .filter((p) => p.isActive && (
        !q || p.name.toLowerCase().includes(q) || p.productCode.toLowerCase().startsWith(q)
      ))
      .slice(0, 12);
    setNameDrop(results);
    setNameDropIdx(0);
    // Do NOT auto-open here — only the Name input's onFocus opens the dropdown
  }, [nameQuery, products]);

  // ── Totals calculation ─────────────────────────────────────────────────────
  const lineCalc = lines.map((l) => {
    const base = r2(l.quantity * l.rate);
    return { base, cgst: r2(base * l.gstRate / 200), sgst: r2(base * l.gstRate / 200) };
  });
  const subtotal  = r2(lineCalc.reduce((s, l) => s + l.base, 0));
  const rawCgst   = r2(lineCalc.reduce((s, l) => s + l.cgst, 0));
  const rawSgst   = r2(lineCalc.reduce((s, l) => s + l.sgst, 0));
  const afterDisc = r2(subtotal - discountAmount);
  const ratio     = subtotal > 0 ? afterDisc / subtotal : 1;
  const cgst      = r2(rawCgst * ratio);
  const sgst      = r2(rawSgst * ratio);
  const preGrand  = r2(afterDisc + cgst + sgst);
  const roundOff  = r2(Math.round(preGrand) - preGrand);
  const grandTotal = r2(preGrand + roundOff);
  const cashAmt   = parseFloat(cashReceived) || 0;
  const cashChange = payMode === 'cash' && cashAmt >= grandTotal ? r2(cashAmt - grandTotal) : 0;

  // Counter stock minus what's already in bill
  function availableQty(productId: number): number {
    const inBill = lines.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0);
    return r2((stockMap[productId] ?? 0) - inBill);
  }

  // Code cell all-products dropdown (shown when value is empty or "0")
  const [showCodeDrop,  setShowCodeDrop]  = useState(false);
  const [codeDrop,      setCodeDrop]      = useState<Product[]>([]);
  const [codeDropIdx,   setCodeDropIdx]   = useState(0);
  const [codeDropQuery, setCodeDropQuery] = useState('');

  useEffect(() => {
    const q = codeDropQuery.trim().toLowerCase();
    const show = q === '' || q === '0';
    const results = products
      .filter((p) => p.isActive && (
        show || p.productCode.toLowerCase().startsWith(q) || p.name.toLowerCase().includes(q)
      ))
      .slice(0, 12);
    setCodeDrop(results);
    setCodeDropIdx(0);
    // Visibility is controlled by Code input's onFocus/onBlur — don't touch showCodeDrop here
  }, [codeDropQuery, products]);

  function clearEntryRow() {
    setEntryCode('');
    setEntryProduct(null);
    setEntryQtyRaw('');
    setEntryNotes('');
    setEntryError('');
    setNameQuery('');
    setShowNameDrop(false);
    setShowCodeDrop(false);
    setCodeDropQuery('');
  }

  function selectProductForEntry(p: Product) {
    setEntryProduct(p);
    setEntryCode(p.productCode);
    setNameQuery(p.name);
    setShowNameDrop(false);
    setShowCodeDrop(false);
    setCodeDropQuery(p.productCode);
    // pre-fill quantity
    if (!p.isWeighed) {
      setEntryQtyRaw('1');
    } else {
      setEntryQtyRaw('');
    }
    setEntryError('');
    setTimeout(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, 30);
  }

  function lookupByCode(code: string): Product | undefined {
    return products.find((p) => p.isActive && p.productCode.toLowerCase() === code.toLowerCase());
  }

  function addLineFromProduct(p: Product, qty: number, notes = '') {
    const available = availableQty(p.id);
    if (stockBlockZero && available <= 0) {
      setEntryError(`"${p.name}" is out of stock`);
      return false;
    }
    if (available > 0 && qty > available) {
      if (!stockBlockZero) {
        setEntryError(`Only ${available.toFixed(2)} ${shortUnit(p.sellingUnit)} available — adding anyway`);
      } else {
        setEntryError(`Only ${available.toFixed(2)} ${shortUnit(p.sellingUnit)} available`);
        return false;
      }
    }
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx !== -1) {
        // merge: add qty
        return prev.map((l, i) => i === idx ? { ...l, quantity: r2(l.quantity + qty) } : l);
      }
      return [...prev, {
        productId: p.id, productCode: p.productCode, name: p.name,
        quantity: qty, unit: p.sellingUnit, rate: p.sellingPrice,
        gstRate: p.gstRate ?? 0, hsnCode: p.hsnCode ?? undefined,
        foodType: p.foodType, notes,
      }];
    });
    return true;
  }

  function commitEntry() {
    if (!entryProduct) { setEntryError('Select a product first'); return; }
    const qty = parseQty(entryQtyRaw, entryProduct.sellingUnit);
    if (qty === null || qty <= 0) {
      setEntryError(entryProduct.isWeighed ? 'Enter weight (e.g. 0.5 or 500g)' : 'Enter a valid quantity');
      return;
    }
    const ok = addLineFromProduct(entryProduct, qty, entryNotes.trim());
    if (ok || !stockBlockZero) {
      clearEntryRow();
      setTimeout(() => { codeRef.current?.focus(); }, 30);
    }
  }

  function onCodeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { clearEntryRow(); return; }
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const raw = entryCode.trim();
      if (!raw) { qtyRef.current?.focus(); return; }

      // multi-code mode: "001*2 005 012*3"
      if (/\s/.test(raw)) {
        const tokens = parseCodeString(raw);
        let allOk = true;
        for (const { code, qty } of tokens) {
          const p = lookupByCode(code);
          if (!p) { setEntryError(`Code "${code}" not found`); allOk = false; break; }
          addLineFromProduct(p, qty);
        }
        if (allOk) clearEntryRow();
        return;
      }

      // single code*qty: "001*3"
      const multiMatch = raw.match(/^(\d+)\*(\d+\.?\d*)$/);
      if (multiMatch) {
        const code = multiMatch[1].padStart(3, '0');
        const qty  = parseFloat(multiMatch[2]);
        const p    = lookupByCode(code);
        if (!p) { setEntryError(`Code "${code}" not found`); return; }
        addLineFromProduct(p, qty);
        clearEntryRow();
        return;
      }

      // plain code lookup
      const p = lookupByCode(raw);
      if (p) {
        selectProductForEntry(p);
      } else {
        setEntryError(`Code "${raw}" not found`);
      }
    }
  }

  function onQtyKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { clearEntryRow(); codeRef.current?.focus(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      // validate immediately on enter
      if (!entryProduct) return;
      const qty = parseQty(entryQtyRaw, entryProduct.sellingUnit);
      if (qty === null || qty <= 0) {
        setEntryError(entryProduct.isWeighed ? 'Enter weight (e.g. 0.5 or 500g)' : 'Enter a valid quantity');
        return;
      }
      const available = availableQty(entryProduct.id);
      if (stockBlockZero && available <= 0) {
        setEntryError(`"${entryProduct.name}" is out of stock`);
        return;
      }
      if (qty > available && available > 0) {
        if (stockBlockZero) { setEntryError(`Only ${available.toFixed(2)} available`); return; }
        setEntryError(`Only ${available.toFixed(2)} ${shortUnit(entryProduct.sellingUnit)} available — adding anyway`);
      } else {
        setEntryError('');
      }
      commitEntry();
    }
  }

  function onNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { clearEntryRow(); codeRef.current?.focus(); return; }
    if (e.key === 'ArrowDown') { setNameDropIdx((i) => Math.min(i + 1, nameDrop.length - 1)); return; }
    if (e.key === 'ArrowUp')   { setNameDropIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (nameDrop[nameDropIdx]) selectProductForEntry(nameDrop[nameDropIdx]);
    }
  }

  // ── Today summary helpers ──────────────────────────────────────────────────

  const todayTakeaway  = todayBills.filter((b) => b.orderType === 'takeaway');
  const todayDelivery  = todayBills.filter((b) => b.orderType === 'delivery');

  // Scope cashier to their own bills
  const visibleTakeaway = isOwner ? todayTakeaway : todayTakeaway.filter((b) => b.cashierName === cashierName);
  const visibleDelivery = isOwner ? todayDelivery : todayDelivery.filter((b) => b.cashierName === cashierName);

  const takeawayTotal   = visibleTakeaway.reduce((s, b) => s + b.grandTotal, 0);
  const deliveryTotal   = visibleDelivery.reduce((s, b) => s + b.grandTotal, 0);

  // ── Hold / Resume / Discard ────────────────────────────────────────────────

  async function handleHold() {
    if (!lines.length) return;
    try {
      const res = await billingApi.hold({
        items: lines.map((l) => ({
          productId: l.productId, name: l.name, quantity: l.quantity, unit: l.unit,
          rate: l.rate, gstRate: l.gstRate, hsnCode: l.hsnCode,
        })),
        orderType,
      });
      const held: HeldBill = {
        billId: res.data.billId,
        invoiceNumber: res.data.invoiceNumber ?? `HOLD-${Date.now()}`,
        grandTotal,
        createdAt: new Date().toISOString(),
        customerName: customer?.name,
        orderType,
        items: [...lines],
        customerId: customer?.id,
        customerPhone: customer?.phone,
        discountAmount,
        paymentMode: payMode,
      };
      setHeldBills((prev) => [...prev, held]);
      startNewBill();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorMsg(msg ?? 'Failed to hold bill');
    }
  }

  function resumeHeld(held: HeldBill) {
    if (lines.length > 0) {
      if (!window.confirm('Hold the current bill and resume this one?')) return;
      handleHold();
    }
    setLines(held.items);
    setOrderType(held.orderType as 'takeaway' | 'delivery');
    setDiscountAmount(held.discountAmount);
    setPayMode(held.paymentMode);
    if (held.customerId) {
      setCustomer({ id: held.customerId, name: held.customerName ?? '', phone: held.customerPhone ?? '', loyaltyPoints: 0 });
      setCustQuery(`${held.customerName}  ·  ${held.customerPhone ?? ''}`);
    }
    setHeldBills((prev) => prev.filter((h) => h.billId !== held.billId));
    setTimeout(() => codeRef.current?.focus(), 100);
  }

  function discardHeld(held: HeldBill) {
    if (!window.confirm(`Discard held bill ${held.invoiceNumber}? This cannot be undone.`)) return;
    setHeldBills((prev) => prev.filter((h) => h.billId !== held.billId));
  }

  // ── Checkout ───────────────────────────────────────────────────────────────

  const blockReasons: string[] = [];
  if (!lines.length) blockReasons.push('Add at least one item');
  if (orderType === 'delivery' && !deliveryAddress.trim()) blockReasons.push('Enter delivery address');
  if (orderType === 'delivery' && !customer) blockReasons.push('Select a customer');
  if (payMode === 'cash' && cashAmt > 0 && cashAmt < grandTotal) blockReasons.push('Cash received is less than total');

  async function handleCheckout() {
    if (blockReasons.length || submitting) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await billingApi.create({
        items: lines.map((l) => ({
          productId: l.productId, name: l.name, quantity: l.quantity, unit: l.unit,
          rate: l.rate, gstRate: l.gstRate, hsnCode: l.hsnCode, discountAmount: 0,
        })),
        payments: [{ paymentMode: payMode, amount: grandTotal }],
        customerId: customer?.id,
        customerName: customer?.name ?? undefined,
        customerPhone: customer?.phone ?? undefined,
        totalDiscount: discountAmount,
        orderType,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
        cashierName,
      });
      const bill: CompletedBill = {
        billId: res.data.billId,
        invoiceNumber: res.data.invoiceNumber,
        grandTotal: res.data.grandTotal,
      };
      setCompletedBill(bill);
      printBill(bill.billId, receiptPaper);
      refreshStock();
      refreshTodayBills();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorMsg(msg ?? 'Failed to create bill. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function startNewBill() {
    setLines([]);
    setCustomer(null); setCustQuery('');
    setDiscountAmount(0); setDiscountInput('');
    setCashReceived('');
    setCompletedBill(null);
    setErrorMsg('');
    setOrderType('takeaway');
    setDeliveryAddress('');
    setDeliveryPhone('');
    setPayMode('cash');
    clearEntryRow();
    setTimeout(() => codeRef.current?.focus(), 100);
  }

  function applyDiscount() {
    const v = parseFloat(discountInput);
    if (!isNaN(v) && v >= 0 && v <= subtotal) setDiscountAmount(r2(v));
    setShowDiscountInput(false);
  }

  // ── Next bill number preview ───────────────────────────────────────────────
  const [nextBillNo, setNextBillNo] = useState('—');
  useEffect(() => {
    if (!USE_MOCK) return;
    import('@/store/demoStore').then(({ bills }) => {
      const count = bills.list().length + 1;
      setNextBillNo(`INV-FY2026-27-${String(count).padStart(5, '0')}`);
    });
  }, [completedBill]);

  // ── Live price preview for entry row ──────────────────────────────────────
  const entryQtyParsed = entryProduct ? (parseQty(entryQtyRaw, entryProduct.sellingUnit) ?? 0) : 0;
  const entryLinePrice = entryProduct ? r2(entryQtyParsed * entryProduct.sellingPrice) : 0;

  // ── Compact mode (< 1100px) for summary panel ─────────────────────────────
  const [compact, setCompact] = useState(window.innerWidth < 1100);
  useEffect(() => {
    const handler = () => setCompact(window.innerWidth < 1100);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ───────────────────────────── RENDER ─────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, background: T.bg, position: 'relative', fontFamily: 'inherit' }}>

      {/* ── Overlays ── */}
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      {showBrowse && (
        <BrowseDrawer
          products={products}
          categories={categories}
          stockMap={stockMap}
          cartLines={lines}
          onSelect={(p) => selectProductForEntry(p)}
          onClose={() => setShowBrowse(false)}
        />
      )}
      {drawerType && (
        <BillsDrawer
          title={drawerType === 'takeaway' ? "Today's Take-away" : "Today's Home Delivery"}
          bills={drawerType === 'takeaway' ? visibleTakeaway : visibleDelivery}
          onClose={() => setDrawerType(null)}
          onReprint={(id) => printBill(id, receiptPaper)}
        />
      )}
      {completedBill && (
        <SuccessPanel
          bill={completedBill}
          cashReceived={cashAmt}
          grandTotal={completedBill.grandTotal}
          onNewBill={startNewBill}
          onViewBill={() => window.open(`/bills/${completedBill.billId}/print`, '_blank')}
          onPrint={() => printBill(completedBill.billId, receiptPaper)}
        />
      )}

      {/* ══════════════ LEFT — TODAY SUMMARY ══════════════════════════════════ */}
      {!compact ? (
        <aside style={{
          width: 300, minWidth: 300, display: 'flex', flexDirection: 'column',
          background: T.surface, borderRight: `1px solid ${T.border}`,
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{ padding: '16px 18px 10px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Today</div>
            <div style={{ fontSize: 13, color: T.muted }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Take-away */}
            <button onClick={() => setDrawerType('takeaway')} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#E8F5E9', borderRadius: 12, padding: '12px 14px',
              border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <Package size={22} color={T.green} strokeWidth={2} />
              <div>
                <div style={{ fontSize: 13, color: T.muted }}>Take-away</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                  {visibleTakeaway.length}
                </div>
                <div style={{ fontSize: 12, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(takeawayTotal)}
                </div>
              </div>
            </button>

            {/* Home delivery */}
            <button onClick={() => setDrawerType('delivery')} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#EAF4FC', borderRadius: 12, padding: '12px 14px',
              border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <Truck size={22} color="#1E8E94" strokeWidth={2} />
              <div>
                <div style={{ fontSize: 13, color: T.muted }}>Home Delivery</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                  {visibleDelivery.length}
                </div>
                <div style={{ fontSize: 12, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(deliveryTotal)}
                </div>
              </div>
            </button>

            {/* On Hold */}
            <div style={{
              background: '#FFF1DC', borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: heldBills.length ? 10 : 0 }}>
                <Clock size={22} color={T.amber} strokeWidth={2} />
                <div>
                  <div style={{ fontSize: 13, color: T.muted }}>On Hold</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1.1 }}>
                    {heldBills.length}
                  </div>
                </div>
              </div>

              {heldBills.map((h) => (
                <div key={h.billId} style={{
                  background: '#fff8ee', borderRadius: 8, padding: '10px 10px', marginTop: 8,
                  border: `1px solid #F5C88A`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Bill ref + time */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: 'monospace' }}>
                        {h.invoiceNumber}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted }}>
                        {new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        <span style={{ textTransform: 'capitalize' }}>{h.orderType}</span>
                      </div>

                      {/* Customer name (prominent) */}
                      {h.customerName ? (
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 4 }}>
                          👤 {h.customerName}
                          {h.customerPhone && <span style={{ fontSize: 11, fontWeight: 400, color: T.muted, marginLeft: 5 }}>{h.customerPhone}</span>}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 3, fontStyle: 'italic' }}>Walk-in</div>
                      )}

                      {/* Items list */}
                      <div style={{ marginTop: 5 }}>
                        {h.items.slice(0, 4).map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                              {item.name}
                            </span>
                            <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 4 }}>
                              ×{item.unit === 'kg' ? item.quantity.toFixed(2) : item.quantity} {item.unit === 'kg' ? 'kg' : ''}
                            </span>
                          </div>
                        ))}
                        {h.items.length > 4 && (
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>+{h.items.length - 4} more items</div>
                        )}
                      </div>

                      {/* Total */}
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.amber, fontVariantNumeric: 'tabular-nums', marginTop: 5 }}>
                        {fmt(h.grandTotal)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8, flexShrink: 0 }}>
                      <button onClick={() => resumeHeld(h)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', borderRadius: 6, border: 'none', background: T.amber, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        <RotateCcw size={12} /> Resume
                      </button>
                      {isOwner && (
                        <button onClick={() => discardHeld(h)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px', borderRadius: 6, border: 'none', background: '#FDE5E0', color: T.red, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          <Trash2 size={11} /> Discard
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      ) : (
        /* Compact chip row above the table */
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          background: T.surface, borderBottom: `1px solid ${T.border}`,
          display: 'flex', gap: 8, padding: '6px 12px', alignItems: 'center',
        }}>
          <button onClick={() => setDrawerType('takeaway')}
            style={{ height: 30, padding: '0 12px', borderRadius: 9999, background: '#E8F5E9', color: T.green, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Take-away: {visibleTakeaway.length} ({fmt(takeawayTotal)})
          </button>
          <button onClick={() => setDrawerType('delivery')}
            style={{ height: 30, padding: '0 12px', borderRadius: 9999, background: '#EAF4FC', color: '#1E8E94', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Delivery: {visibleDelivery.length} ({fmt(deliveryTotal)})
          </button>
          <button style={{ height: 30, padding: '0 12px', borderRadius: 9999, background: '#FFF1DC', color: T.amber, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'default' }}>
            Hold: {heldBills.length}
          </button>
        </div>
      )}

      {/* ══════════════ RIGHT — BILL ═══════════════════════════════════════════ */}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        paddingTop: compact ? 44 : 0,
        overflow: 'hidden',
      }}>

        {/* ── Bill header (single compact row) ── */}
        <div style={{
          flexShrink: 0, background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: '8px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {/* Order type */}
          <div style={{ display: 'flex', background: T.bg, borderRadius: 9999, padding: 2 }}>
            {(['takeaway', 'delivery'] as const).map((t) => (
              <button key={t} onClick={() => setOrderType(t)}
                style={{
                  height: 34, padding: '0 14px', borderRadius: 9999,
                  border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  background: orderType === t ? T.brand : 'transparent',
                  color: orderType === t ? '#fff' : T.muted,
                  transition: 'background 120ms',
                }}>
                {t === 'takeaway' ? 'Take-away' : 'Home Delivery'}
              </button>
            ))}
          </div>

          {/* Employee (read-only) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: T.muted, minWidth: 100 }}>
            <span style={{ fontWeight: 600, color: T.text }}>{cashierName}</span>
          </div>

          {/* Customer search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <input
              ref={custRef}
              value={custQuery}
              onChange={(e) => { setCustQuery(e.target.value); if (customer) { setCustomer(null); } }}
              placeholder="Customer — phone or name (F4)"
              style={{
                width: '100%', height: 36, fontSize: 14, padding: '0 28px 0 10px',
                border: `1.5px solid ${T.border}`, borderRadius: 9999,
                background: T.bg, color: T.text, outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = T.brand)}
              onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
            />
            {customer && (
              <button onClick={() => { setCustomer(null); setCustQuery(''); setShowCustDrop(false); }}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.red, display: 'flex' }}>
                <X size={14} />
              </button>
            )}
            {showCustDrop && custResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)', overflow: 'hidden',
              }}>
                {custResults.map((c) => (
                  <button key={c.id}
                    onClick={() => { setCustomer(c); setCustQuery(`${c.name} · ${c.phone}`); setShowCustDrop(false); }}
                    style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: T.text, textAlign: 'left' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ color: T.muted }}>{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bill no. preview */}
          <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap' }}>
            Bill: <span style={{ fontFamily: 'monospace', color: T.text, fontWeight: 600 }}>{nextBillNo}</span>
          </div>

          {/* Shortcut hint */}
          <button onClick={() => setShowShortcuts(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, display: 'flex', alignItems: 'center' }}>
            <HelpCircle size={16} />
          </button>
        </div>

        {/* Delivery address row (shown only for delivery) */}
        {orderType === 'delivery' && (
          <div style={{ flexShrink: 0, background: '#EAF4FC', borderBottom: `1px solid ${T.border}`, padding: '6px 16px', display: 'flex', gap: 10 }}>
            <input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Delivery address *"
              style={{ flex: 2, height: 36, fontSize: 14, padding: '0 10px', border: `1.5px solid ${T.border}`, borderRadius: 8, background: '#fff', color: T.text, outline: 'none' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = T.brand)}
              onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
            />
            <input
              value={deliveryPhone}
              onChange={(e) => setDeliveryPhone(e.target.value)}
              placeholder="Phone"
              style={{ flex: 1, height: 36, fontSize: 14, padding: '0 10px', border: `1.5px solid ${T.border}`, borderRadius: 8, background: '#fff', color: T.text, outline: 'none' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = T.brand)}
              onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>
        )}

        {/* ── Bill table ── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loadingData ? (
            <div style={{ display: 'flex', height: 120, alignItems: 'center', justifyContent: 'center', color: T.muted, gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              Loading…
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr style={{ background: '#F5EFE8', borderBottom: `2px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 5 }}>
                  {['Code', 'Product Name', 'Rate', 'Qty', 'Price (₹)', 'Notes', ''].map((h) => (
                    <th key={h} style={{
                      padding: '9px 10px',
                      textAlign: h === 'Rate' || h === 'Qty' || h === 'Price (₹)' ? 'right' : 'left',
                      fontSize: 13, fontWeight: 700, color: T.muted, whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ── ENTRY ROW (always first) ── */}
                <tr style={{ background: '#FFFCF8', borderBottom: `1px solid ${T.border}` }}>
                  {/* Code cell */}
                  <td style={{ padding: '4px 6px', width: 90, position: 'relative' }}>
                    <input
                      ref={codeRef}
                      value={entryCode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEntryCode(val);
                        setCodeDropQuery(val);
                        // Only show dropdown when user has typed something
                        if (val.trim()) {
                          setShowCodeDrop(true);
                          setShowNameDrop(false);
                        } else {
                          setShowCodeDrop(false);
                        }
                        setEntryProduct(null);
                        setEntryQtyRaw('');
                        setEntryError('');
                        // live preview if code matches exactly
                        const p = val.trim() ? lookupByCode(val.trim()) : null;
                        if (p) { setEntryProduct(p); setNameQuery(p.name); }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { setCodeDropIdx((i) => Math.min(i + 1, codeDrop.length - 1)); return; }
                        if (e.key === 'ArrowUp')   { setCodeDropIdx((i) => Math.max(i - 1, 0)); return; }
                        if ((e.key === 'Enter' || e.key === 'Tab') && showCodeDrop && codeDrop[codeDropIdx] && !lookupByCode(entryCode.trim())) {
                          e.preventDefault();
                          selectProductForEntry(codeDrop[codeDropIdx]);
                          return;
                        }
                        onCodeKeyDown(e);
                      }}
                      onFocus={() => { setCodeDropQuery(entryCode); (codeRef.current as HTMLInputElement | null)?.style && ((codeRef.current as HTMLInputElement).style.borderColor = T.brand); }}
                      onBlur={() => { (codeRef.current as HTMLInputElement | null)?.style && ((codeRef.current as HTMLInputElement).style.borderColor = T.border); setTimeout(() => setShowCodeDrop(false), 180); }}
                      placeholder="F2 or 0=all"
                      style={{
                        width: '100%', height: 44, fontSize: 16, padding: '0 8px',
                        border: `1.5px solid ${T.border}`, borderRadius: 8,
                        background: '#fff', color: T.text, outline: 'none',
                        fontFamily: 'monospace',
                      }}
                    />
                    {/* Code dropdown */}
                    {showCodeDrop && codeDrop.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 70, marginTop: 2,
                        background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
                        boxShadow: '0 6px 20px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto',
                        minWidth: 300,
                      }}>
                        {codeDrop.map((p, i) => {
                          const qty = availableQty(p.id);
                          return (
                            <button key={p.id} onMouseDown={() => selectProductForEntry(p)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                padding: '8px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                                background: i === codeDropIdx ? T.bg : '#fff',
                                fontSize: 14, color: T.text,
                              }}
                              onMouseEnter={() => setCodeDropIdx(i)}>
                              <span style={{ fontFamily: 'monospace', fontSize: 13, color: T.brand, minWidth: 36, fontWeight: 700 }}>{p.productCode}</span>
                              <VegDot type={p.foodType} />
                              <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                              <span style={{ color: T.muted, fontSize: 13, fontVariantNumeric: 'tabular-nums', marginRight: 8 }}>{fmt(p.sellingPrice)}</span>
                              <StockChip qty={qty} unit={p.sellingUnit} low={p.lowStockLevel} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </td>

                  {/* Product name cell with dropdown */}
                  <td style={{ padding: '4px 6px', position: 'relative', minWidth: 200 }}>
                    <input
                      ref={nameRef}
                      value={nameQuery}
                      onChange={(e) => { setNameQuery(e.target.value); setShowCodeDrop(false); setEntryProduct(null); setEntryCode(''); setEntryError(''); }}
                      onKeyDown={onNameKeyDown}
                      onFocus={() => { setShowNameDrop(true); setShowCodeDrop(false); }}
                      onBlur={() => setTimeout(() => setShowNameDrop(false), 200)}
                      placeholder="Click or type name… (all on focus)"
                      style={{
                        width: '100%', height: entryProduct ? 32 : 44, fontSize: 15, padding: '0 8px',
                        border: `1.5px solid ${T.border}`, borderRadius: 8,
                        background: '#fff', color: T.text, outline: 'none',
                        display: 'block',
                      }}
                      onFocusCapture={(e) => (e.currentTarget.style.borderColor = T.brand)}
                      onBlurCapture={(e)  => (e.currentTarget.style.borderColor = T.border)}
                    />
                    {/* Product preview sub-line — inside cell, below input */}
                    {entryProduct && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted, padding: '2px 8px 2px', lineHeight: 1.3 }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(entryProduct.sellingPrice)} / {entryProduct.sellingUnit}</span>
                        <StockChip qty={availableQty(entryProduct.id)} unit={entryProduct.sellingUnit} low={entryProduct.lowStockLevel} />
                      </div>
                    )}
                    {/* Dropdown */}
                    {showNameDrop && nameDrop.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, marginTop: 2,
                        background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
                        boxShadow: '0 6px 20px rgba(0,0,0,0.10)', maxHeight: 280, overflowY: 'auto',
                      }}>
                        {nameDrop.map((p, i) => {
                          const qty = availableQty(p.id);
                          return (
                            <button key={p.id} onMouseDown={() => selectProductForEntry(p)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                padding: '9px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                                background: i === nameDropIdx ? T.bg : '#fff',
                                fontSize: 14, color: T.text,
                              }}
                              onMouseEnter={() => setNameDropIdx(i)}>
                              <VegDot type={p.foodType} />
                              <span style={{ fontFamily: 'monospace', fontSize: 12, color: T.brand, minWidth: 36 }}>{p.productCode}</span>
                              <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                              <span style={{ fontVariantNumeric: 'tabular-nums', color: T.muted, marginRight: 8 }}>{fmt(p.sellingPrice)}</span>
                              <StockChip qty={qty} unit={p.sellingUnit} low={p.lowStockLevel} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </td>

                  {/* Rate (read-only) */}
                  <td style={{ padding: '4px 6px', textAlign: 'right', width: 90, color: T.muted, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                    {entryProduct ? fmt(entryProduct.sellingPrice) : '—'}
                  </td>

                  {/* Qty input */}
                  <td style={{ padding: '4px 6px', width: 110 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        ref={qtyRef}
                        value={entryQtyRaw}
                        onChange={(e) => { setEntryQtyRaw(e.target.value); setEntryError(''); }}
                        onKeyDown={onQtyKeyDown}
                        placeholder={entryProduct?.isWeighed ? 'kg' : '1'}
                        style={{
                          width: '100%', height: 44, fontSize: 16, padding: '0 28px 0 8px',
                          border: `1.5px solid ${T.border}`, borderRadius: 8,
                          background: '#fff', color: T.text, outline: 'none',
                          textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = T.brand; e.currentTarget.select(); }}
                        onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
                      />
                      {entryProduct && (
                        <span style={{ position: 'absolute', right: 6, fontSize: 11, color: T.muted, pointerEvents: 'none' }}>
                          {shortUnit(entryProduct.sellingUnit)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Price preview */}
                  <td style={{ padding: '4px 6px', textAlign: 'right', width: 100, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: entryLinePrice > 0 ? T.brand : T.muted, fontSize: 16 }}>
                    {entryLinePrice > 0 ? fmt(entryLinePrice) : '—'}
                  </td>

                  {/* Notes */}
                  <td style={{ padding: '4px 6px' }}>
                    <input
                      value={entryNotes}
                      onChange={(e) => setEntryNotes(e.target.value.slice(0, 80))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitEntry(); } if (e.key === 'Escape') clearEntryRow(); }}
                      placeholder="Note…"
                      maxLength={80}
                      style={{
                        width: '100%', height: 44, fontSize: 14, padding: '0 8px',
                        border: `1.5px solid ${T.border}`, borderRadius: 8,
                        background: '#fff', color: T.text, outline: 'none',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = T.brand)}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
                    />
                  </td>

                  {/* Add button */}
                  <td style={{ padding: '4px 6px', width: 44 }}>
                    <button onClick={commitEntry}
                      disabled={!entryProduct || !entryQtyRaw.trim()}
                      title="Add line (Enter)"
                      style={{
                        width: 36, height: 44, borderRadius: 8, border: 'none', cursor: entryProduct && entryQtyRaw.trim() ? 'pointer' : 'not-allowed',
                        background: entryProduct && entryQtyRaw.trim() ? T.brand : T.bg,
                        color: entryProduct && entryQtyRaw.trim() ? '#fff' : T.muted,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, fontWeight: 700,
                      }}>
                      +
                    </button>
                  </td>
                </tr>

                {/* ── Entry row error ── */}
                {entryError && (
                  <tr style={{ background: '#FFF8F6' }}>
                    <td colSpan={7} style={{ padding: '4px 10px', fontSize: 13, color: entryError.includes('adding anyway') ? T.amber : T.red, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertCircle size={13} style={{ flexShrink: 0 }} /> {entryError}
                    </td>
                  </tr>
                )}

                {/* ── Committed lines ── */}
                {lines.map((line, idx) => {
                  const lineTax   = r2(line.quantity * line.rate * (line.gstRate ?? 0) / 100);
                  const lineTotal = r2(line.quantity * line.rate + lineTax);
                  const avail     = (stockMap[line.productId] ?? 0) -
                    lines.filter((l, i) => l.productId === line.productId && i < idx).reduce((s, l) => s + l.quantity, 0);
                  return (
                    <tr key={idx}
                      style={{ borderBottom: `1px solid ${T.divider}`, height: 52, verticalAlign: 'middle' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      {/* Code */}
                      <td style={{ padding: '0 10px', fontFamily: 'monospace', fontSize: 13, color: T.muted, whiteSpace: 'nowrap' }}>
                        {line.productCode}
                      </td>
                      {/* Name + stock sub-line */}
                      <td style={{ padding: '2px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <VegDot type={line.foodType} />
                          <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{line.name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
                          left: {avail <= 0 ? <span style={{ color: T.red }}>out</span> : `${avail % 1 === 0 ? avail : avail.toFixed(2)} ${shortUnit(line.unit)}`}
                        </div>
                      </td>
                      {/* Rate */}
                      <td style={{ padding: '0 10px', textAlign: 'right', color: T.muted, fontSize: 14, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {fmt(line.rate)}
                      </td>
                      {/* Qty inline edit */}
                      <td style={{ padding: '2px 6px', textAlign: 'right', width: 110 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                          <input
                            value={line.unit === 'kg' ? line.quantity.toFixed(3) : line.quantity}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v > 0) {
                                setLines((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: r2(v) } : l));
                              } else if (e.target.value === '' || e.target.value === '0') {
                                if (window.confirm('Remove this item?')) {
                                  setLines((prev) => prev.filter((_, i) => i !== idx));
                                }
                              }
                            }}
                            style={{
                              width: 72, height: 36, fontSize: 15, padding: '0 4px',
                              border: `1px solid ${T.border}`, borderRadius: 6,
                              background: T.bg, color: T.text, outline: 'none',
                              textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = T.brand; e.currentTarget.select(); }}
                            onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
                          />
                          <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>{shortUnit(line.unit)}</span>
                        </div>
                      </td>
                      {/* Price */}
                      <td style={{ padding: '0 10px', textAlign: 'right', fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', fontSize: 16, whiteSpace: 'nowrap' }}>
                        {fmt(lineTotal)}
                      </td>
                      {/* Notes inline edit */}
                      <td style={{ padding: '2px 6px' }}>
                        <input
                          value={line.notes}
                          onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, notes: e.target.value.slice(0, 80) } : l))}
                          placeholder="Note…"
                          maxLength={80}
                          style={{
                            width: '100%', minWidth: 80, height: 36, fontSize: 13, padding: '0 7px',
                            border: `1px solid ${T.border}`, borderRadius: 6,
                            background: line.notes ? '#fff' : T.bg, color: T.text, outline: 'none',
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = T.brand)}
                          onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
                        />
                      </td>
                      {/* Remove */}
                      <td style={{ padding: '0 6px', width: 36 }}>
                        <button onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label="Remove line"
                          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FDE5E0', color: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty state below entry */}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '28px 16px', textAlign: 'center', color: T.muted, fontSize: 14 }}>
                      Type a code in the Code cell or click the Product Name cell to add items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Totals footer + payment + buttons ── */}
        <div style={{
          flexShrink: 0, background: T.surface,
          borderTop: `2px solid ${T.border}`, padding: '10px 16px 12px',
        }}>
          {/* Discount + tax rows */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.muted, marginBottom: 2 }}>
                <span>Subtotal</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.red, marginBottom: 2 }}>
                  <span>Discount</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(discountAmount)}</span>
                </div>
              )}
              {cgst > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.muted, marginBottom: 2 }}>
                  <span>CGST</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(cgst)}</span>
                </div>
              )}
              {sgst > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.muted, marginBottom: 2 }}>
                  <span>SGST</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(sgst)}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.muted, marginBottom: 2 }}>
                  <span>Round-off</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{roundOff > 0 ? '+' : ''}{fmt(roundOff)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Discount toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
            <div>
              {!showDiscountInput ? (
                <button onClick={() => { setShowDiscountInput(true); setDiscountInput(discountAmount > 0 ? String(discountAmount) : ''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C98B4B', fontSize: 13, fontWeight: 600, padding: 0 }}>
                  + Add discount
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" min="0" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyDiscount(); if (e.key === 'Escape') setShowDiscountInput(false); }}
                    placeholder="₹ discount"
                    style={{ width: 110, height: 34, fontSize: 14, padding: '0 8px', border: `1.5px solid ${T.border}`, borderRadius: 8, background: '#fff', color: T.text, outline: 'none' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = T.brand)}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
                  />
                  <button onClick={applyDiscount} style={{ height: 34, padding: '0 12px', borderRadius: 8, background: T.brand, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Apply</button>
                  <button onClick={() => { setDiscountAmount(0); setShowDiscountInput(false); setDiscountInput(''); }}
                    style={{ height: 34, padding: '0 10px', borderRadius: 8, background: T.bg, color: T.muted, border: `1px solid ${T.border}`, fontSize: 13, cursor: 'pointer' }}>Clear</button>
                </div>
              )}
            </div>

            {/* Amount total */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: T.muted }}>Amount</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.brand, fontVariantNumeric: 'tabular-nums', fontFamily: '"DM Serif Display", serif', lineHeight: 1.1 }}>
                {fmt(grandTotal)}
              </div>
            </div>
          </div>

          {/* Payment row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Payment mode buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { mode: 'cash' as PayMode, Icon: Banknote,    label: 'Cash' },
                { mode: 'upi'  as PayMode, Icon: Smartphone,  label: 'UPI' },
                { mode: 'card' as PayMode, Icon: CreditCard,  label: 'Card' },
              ] as { mode: PayMode; Icon: typeof Banknote; label: string }[]).map(({ mode, Icon, label }) => (
                <button key={mode} onClick={() => setPayMode(mode)}
                  style={{
                    height: 44, padding: '0 14px', borderRadius: 9, border: '1.5px solid', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    background: payMode === mode ? T.brand : '#fff',
                    color:      payMode === mode ? '#fff'   : T.muted,
                    borderColor: payMode === mode ? T.brand : T.border,
                  }}>
                  <Icon size={15} strokeWidth={2} /> {label}
                </button>
              ))}
            </div>

            {/* Cash received */}
            {payMode === 'cash' && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flex: 1, minWidth: 220 }}>
                <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="Cash received"
                  style={{ flex: 1, minWidth: 80, height: 44, fontSize: 15, padding: '0 8px', border: `1.5px solid ${T.border}`, borderRadius: 9, background: '#fff', color: T.text, outline: 'none' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = T.brand)}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)} />
                {[0, 50, 100, 500].map((add) => (
                  <button key={add}
                    onClick={() => setCashReceived(add === 0 ? String(grandTotal) : String(Math.ceil(grandTotal / (add || 1)) * (add || 1)))}
                    style={{ height: 44, padding: '0 8px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {add === 0 ? 'Exact' : `+${add}`}
                  </button>
                ))}
                {cashChange > 0 && (
                  <span style={{ background: '#E8F5E9', color: T.green, borderRadius: 8, padding: '0 10px', height: 44, display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    Change {fmt(cashChange)}
                  </span>
                )}
              </div>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {/* Hold */}
              <button onClick={handleHold} disabled={!lines.length}
                style={{
                  height: 52, padding: '0 18px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  border: `1.5px solid ${T.border}`, background: T.bg, color: T.muted,
                  cursor: lines.length ? 'pointer' : 'not-allowed', opacity: lines.length ? 1 : 0.5,
                }}>
                Hold  <kbd style={{ fontSize: 11, fontFamily: 'monospace', background: T.border, borderRadius: 4, padding: '1px 4px' }}>F6</kbd>
              </button>

              {/* Pay */}
              <div>
                {(errorMsg || blockReasons.length > 0) && (
                  <div style={{ fontSize: 12, color: T.red, marginBottom: 4, textAlign: 'right', maxWidth: 200 }}>
                    {errorMsg || blockReasons[0]}
                  </div>
                )}
                <button onClick={handleCheckout}
                  disabled={blockReasons.length > 0 || submitting}
                  style={{
                    height: 64, minWidth: 160, padding: '0 24px', borderRadius: 10,
                    fontSize: 20, fontWeight: 800, border: 'none',
                    background: blockReasons.length === 0 ? T.brand : '#F0A580',
                    color: '#fff',
                    cursor: blockReasons.length === 0 && !submitting ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    whiteSpace: 'nowrap',
                  }}>
                  {submitting ? 'Processing…' : `Pay ${fmt(grandTotal)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
