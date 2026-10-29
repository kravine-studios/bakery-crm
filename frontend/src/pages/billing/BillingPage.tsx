/**
 * Bakery CRM — Billing / POS Screen  (v3)
 *
 * Changes from v2:
 *  - Wallet payment removed (Cash / UPI / Card only)
 *  - Cash: amount-received input + change calculation
 *  - UPI: QR placeholder shown
 *  - Lucide icons replace emoji icons on payment buttons
 *  - After successful payment → success panel with Print / New Bill / View Bill
 *  - Print loads /bills/:id/print in a hidden iframe → calls iframe.print()
 *  - Part 3 sizing: 20px item name, 24px price, 420px panel, 230px card,
 *    56px search, 52px category chips, 64px pay button, 38px total
 *  - Quantity badge + inline stepper on product cards
 *  - Weight dialog for per-kg items
 *  - Shortcuts help popover
 */

import {
  useState, useEffect, useRef, useCallback, KeyboardEvent,
} from 'react';
import {
  Banknote, Smartphone, CreditCard, ShoppingBag, HelpCircle,
  Scale, X, Plus, Minus, CheckCircle, Printer, ArrowRight,
} from 'lucide-react';
import { productApi, billingApi, customerApi, categoryApi, settingsApi } from '@/api';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

interface Category { id: number; name: string; }

interface CartItem {
  productId?: number;
  productCode?: string;
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
  hsnCode?: string;
  foodType?: 'veg' | 'non_veg' | 'egg';
}

interface Customer { id: number; name: string; phone: string; loyaltyPoints: number; }

interface CompletedBill {
  billId: number;
  invoiceNumber: string;
  grandTotal: number;
}

// ─── Payment modes (Wallet removed) ──────────────────────────────────────────

type PayMode = 'cash' | 'upi' | 'card';

// ─── Category colours ─────────────────────────────────────────────────────────

interface CatStyle {
  bg: string; border: string; badge: string; price: string;
  chipBg: string; chipText: string; chipActiveBg: string; chipActiveText: string;
}

const CAT: Record<string, CatStyle> = {
  'Sweets':         { bg: '#FFF0D9', border: '#E8590C', badge: '#E8590C', price: '#E8590C', chipBg: '#FEE8D5', chipText: '#C44A06', chipActiveBg: '#E8590C', chipActiveText: '#fff' },
  'Dates':          { bg: '#FEF9E7', border: '#C98B4B', badge: '#C98B4B', price: '#9B6F00', chipBg: '#FDF3CC', chipText: '#9B6F00', chipActiveBg: '#C98B4B', chipActiveText: '#fff' },
  'Chocolates':     { bg: '#F9EEF8', border: '#B0457F', badge: '#B0457F', price: '#8C3069', chipBg: '#F5E0F2', chipText: '#8C3069', chipActiveBg: '#B0457F', chipActiveText: '#fff' },
  'Bakery Items':   { bg: '#EAF4FC', border: '#1E8E94', badge: '#1E8E94', price: '#056B76', chipBg: '#D5EEF5', chipText: '#056B76', chipActiveBg: '#1E8E94', chipActiveText: '#fff' },
  'Cakes':          { bg: '#FCE4DF', border: '#C8503A', badge: '#C8503A', price: '#A3382A', chipBg: '#F9D0CA', chipText: '#A3382A', chipActiveBg: '#C8503A', chipActiveText: '#fff' },
  'Cold Drinks':    { bg: '#E0F3F4', border: '#1E8E94', badge: '#1E8E94', price: '#056B76', chipBg: '#C8EBEC', chipText: '#056B76', chipActiveBg: '#1E8E94', chipActiveText: '#fff' },
  'Snacks':         { bg: '#FFF4C8', border: '#C98B4B', badge: '#C98B4B', price: '#9B6F00', chipBg: '#FDEEB0', chipText: '#9B6F00', chipActiveBg: '#C98B4B', chipActiveText: '#fff' },
  'Packaged Goods': { bg: '#F3F4F6', border: '#7A6A5F', badge: '#7A6A5F', price: '#6B5B52', chipBg: '#E8E3E0', chipText: '#6B5B52', chipActiveBg: '#7A6A5F', chipActiveText: '#fff' },
  '__default__':    { bg: '#F8F6F3', border: '#7A6A5F', badge: '#7A6A5F', price: '#6B5B52', chipBg: '#EDE9E6', chipText: '#6B5B52', chipActiveBg: '#7A6A5F', chipActiveText: '#fff' },
};

function cs(name: string): CatStyle { return CAT[name] ?? CAT['__default__']; }

// ─── Veg dot ─────────────────────────────────────────────────────────────────

function FoodDot({ type }: { type: 'veg' | 'non_veg' | 'egg' }) {
  const color = type === 'veg' ? '#4F7F4A' : type === 'non_veg' ? '#C0392B' : '#C98B4B';
  return (
    <span
      title={type === 'veg' ? 'Veg' : type === 'non_veg' ? 'Non-Veg' : 'Egg'}
      style={{ display: 'inline-flex', height: 18, width: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: `2px solid ${color}`, flexShrink: 0 }}
    >
      <span style={{ display: 'block', height: 10, width: 10, borderRadius: '50%', background: color }} />
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
}

function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// ─── Iframe print helper ──────────────────────────────────────────────────────

function printBill(billId: number, paper = '80mm') {
  const iframeId = `print-frame-${billId}`;
  let frame = document.getElementById(iframeId) as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = iframeId;
    frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:none;';
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

// ─── Shortcuts popover ────────────────────────────────────────────────────────

function ShortcutsPopover({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ['Ctrl+K / F2', 'Focus search bar'],
    ['F4', 'Focus customer search'],
    ['Enter', 'Add by exact code, or only match'],
    ['↑ / ↓', 'Navigate filtered product grid'],
    ['Esc', 'Clear search / close popover'],
  ];
  return (
    <div
      style={{
        position: 'absolute', right: 0, top: 48, zIndex: 50, width: 320,
        background: '#fff', border: '1px solid #EADFD0', borderRadius: 14,
        boxShadow: '0 8px 24px rgba(43,27,20,0.12)', padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1F1611' }}>Keyboard shortcuts</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F' }}>
          <X size={18} />
        </button>
      </div>
      {shortcuts.map(([key, desc]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F4EDE4' }}>
          <kbd style={{ background: '#F4EDE4', color: '#1F1611', borderRadius: 6, padding: '2px 8px', fontSize: 14, fontFamily: 'monospace' }}>
            {key}
          </kbd>
          <span style={{ fontSize: 15, color: '#7A6A5F' }}>{desc}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Weight entry dialog ──────────────────────────────────────────────────────

function WeightDialog({
  product,
  onConfirm,
  onClose,
}: {
  product: Product;
  onConfirm: (qty: number) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [unit,  setUnit]  = useState<'kg' | 'g'>('kg');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const qty = unit === 'g'
    ? (parseFloat(input) / 1000) || 0
    : parseFloat(input) || 0;

  const chips = [
    { label: '250 g', kg: 0.25 },
    { label: '500 g', kg: 0.5 },
    { label: '1 kg',  kg: 1 },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, padding: 28, width: 360,
          boxShadow: '0 8px 32px rgba(43,27,20,0.16)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#1F1611', margin: 0 }}>{product.name}</p>
            <p style={{ fontSize: 16, color: '#7A6A5F', margin: 0 }}>{fmt(product.sellingPrice)} / kg</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F' }}>
            <X size={22} />
          </button>
        </div>

        {/* Unit toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['kg', 'g'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              style={{
                flex: 1, height: 44, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer',
                background: unit === u ? '#E8590C' : '#F4EDE4',
                color: unit === u ? '#fff' : '#7A6A5F',
                border: 'none',
              }}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Weight input */}
        <input
          ref={inputRef}
          type="number"
          step="0.001"
          min="0"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && qty > 0) { onConfirm(qty); onClose(); } }}
          placeholder={unit === 'kg' ? 'e.g. 0.500' : 'e.g. 500'}
          style={{
            width: '100%', height: 56, fontSize: 22, textAlign: 'center',
            border: '2px solid #EADFD0', borderRadius: 12, outline: 'none',
            padding: '0 12px', marginBottom: 12, boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#EADFD0')}
        />

        {/* Chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={() => { setUnit('kg'); setInput(String(c.kg)); }}
              style={{
                flex: 1, height: 44, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                background: '#FFF1DC', color: '#D9822B', border: '1px solid #F5C88A',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {qty > 0 && (
          <p style={{ textAlign: 'center', color: '#7A6A5F', marginBottom: 12, fontSize: 16 }}>
            <Scale size={15} style={{ display: 'inline', marginRight: 4 }} />
            {qty.toFixed(3)} kg × {fmt(product.sellingPrice)} = <strong>{fmt(qty * product.sellingPrice)}</strong>
          </p>
        )}

        <button
          disabled={qty <= 0}
          onClick={() => { if (qty > 0) { onConfirm(qty); onClose(); } }}
          style={{
            width: '100%', height: 52, borderRadius: 12, fontSize: 18, fontWeight: 700,
            background: qty > 0 ? '#E8590C' : '#F8C4AA',
            color: '#fff', border: 'none', cursor: qty > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Add to bill
        </button>
      </div>
    </div>
  );
}

// ─── Success panel ────────────────────────────────────────────────────────────

function SuccessPanel({
  bill,
  cashReceived,
  grandTotal,
  onNewBill,
  onViewBill,
  onPrint,
}: {
  bill: CompletedBill;
  cashReceived: number;
  grandTotal: number;
  onNewBill: () => void;
  onViewBill: () => void;
  onPrint: () => void;
}) {
  const change = Math.max(0, r2(cashReceived - grandTotal));

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(31,22,17,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 24, padding: '36px 32px',
          width: 420, boxShadow: '0 12px 40px rgba(43,27,20,0.20)', textAlign: 'center',
        }}
      >
        {/* Check icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ background: '#E8F5E9', borderRadius: '50%', padding: 16 }}>
            <CheckCircle size={48} color="#4F7F4A" strokeWidth={2} />
          </div>
        </div>

        <p style={{ fontSize: 22, fontWeight: 700, color: '#1F1611', margin: '0 0 4px' }}>
          Payment successful!
        </p>
        <p style={{ fontSize: 16, color: '#7A6A5F', margin: '0 0 20px' }}>
          {bill.invoiceNumber}
        </p>

        {/* Total */}
        <div
          style={{
            background: '#FBF6EE', borderRadius: 14, padding: '16px 20px',
            marginBottom: change > 0 ? 12 : 20,
          }}
        >
          <p style={{ fontSize: 16, color: '#7A6A5F', margin: '0 0 4px' }}>Grand Total</p>
          <p style={{ fontSize: 38, fontWeight: 800, color: '#E8590C', margin: 0, fontFamily: '"DM Serif Display", serif', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(grandTotal)}
          </p>
        </div>

        {/* Change */}
        {change > 0 && (
          <div
            style={{
              background: '#E8F5E9', borderRadius: 14, padding: '12px 20px', marginBottom: 20,
            }}
          >
            <p style={{ fontSize: 16, color: '#7A6A5F', margin: '0 0 4px' }}>Change due</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: '#4F7F4A', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(change)}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onPrint}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 56, borderRadius: 14, fontSize: 18, fontWeight: 700,
              background: '#E8590C', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            <Printer size={22} strokeWidth={2} />
            Print Bill
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={onNewBill}
              style={{
                height: 52, borderRadius: 12, fontSize: 17, fontWeight: 600,
                background: '#FBF6EE', color: '#1F1611', border: '1.5px solid #EADFD0', cursor: 'pointer',
              }}
            >
              New Bill
            </button>
            <button
              onClick={onViewBill}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 52, borderRadius: 12, fontSize: 17, fontWeight: 600,
                background: '#FBF6EE', color: '#1F1611', border: '1.5px solid #EADFD0', cursor: 'pointer',
              }}
            >
              View Bill <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BillingPage() {
  // ── Data ─────────────────────────────────────────────────────────────────────
  const [products,    setProducts]    = useState<Product[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [receiptPaper, setReceiptPaper] = useState('80mm');

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [highlightIdx,   setHighlightIdx]   = useState(-1);

  // ── Cart ──────────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Order type ────────────────────────────────────────────────────────────────
  const [orderType, setOrderType] = useState<'takeaway' | 'dine-in'>('takeaway');

  // ── Customer ──────────────────────────────────────────────────────────────────
  const [customerQuery,    setCustomerQuery]    = useState('');
  const [customer,         setCustomer]         = useState<Customer | null>(null);
  const [customerResults,  setCustomerResults]  = useState<Customer[]>([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  // ── Discount ──────────────────────────────────────────────────────────────────
  const [discountAmount,    setDiscountAmount]    = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountInput,     setDiscountInput]     = useState('');

  // ── Payment ───────────────────────────────────────────────────────────────────
  const [paymentMode,   setPaymentMode]   = useState<PayMode>('cash');
  const [cashReceived,  setCashReceived]  = useState('');

  // ── UI status ─────────────────────────────────────────────────────────────────
  const [submitting,      setSubmitting]      = useState(false);
  const [errorMsg,        setErrorMsg]        = useState('');
  const [completedBill,   setCompletedBill]   = useState<CompletedBill | null>(null);
  const [showShortcuts,   setShowShortcuts]   = useState(false);
  const [weightProduct,   setWeightProduct]   = useState<Product | null>(null);
  const [codeFlash,       setCodeFlash]       = useState('');

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const searchRef  = useRef<HTMLInputElement>(null);
  const custRef    = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Load data ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingData(true);
    Promise.all([
      productApi.list({ active: true }),
      categoryApi.list(),
      settingsApi.get(),
    ])
      .then(([pr, cr, sr]) => {
        setProducts(pr.data);
        setCategories(cr.data);
        setReceiptPaper(sr.data?.receiptPaper ?? '80mm');
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, []);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const isSearch = e.target === searchRef.current;
      const isCust   = e.target === custRef.current;
      const tag      = (e.target as HTMLElement).tagName;
      const inOther  = (tag === 'INPUT' || tag === 'TEXTAREA') && !isSearch && !isCust;

      if ((e.ctrlKey && e.key === 'k') || e.key === 'F2') {
        e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return;
      }
      if (e.key === 'F4') { e.preventDefault(); custRef.current?.focus(); return; }
      if (inOther) return;
      if (e.key === 'Escape') {
        if (isSearch) { setSearch(''); setHighlightIdx(-1); searchRef.current?.blur(); }
        setShowShortcuts(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Derived: filtered products ────────────────────────────────────────────────
  const filtered = products.filter((p) => {
    if (!p.isActive) return false;
    if (activeCategory !== null && p.categoryId !== activeCategory) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return p.name.toLowerCase().includes(q) || p.productCode?.toLowerCase().startsWith(q);
    }
    return true;
  });

  const catCount = products.reduce<Record<number, number>>((acc, p) => {
    if (p.isActive) acc[p.categoryId] = (acc[p.categoryId] ?? 0) + 1;
    return acc;
  }, {});

  useEffect(() => { setHighlightIdx(-1); }, [search, activeCategory]);

  // ── Cart operations ───────────────────────────────────────────────────────────
  const addToCart = useCallback((p: Product, qty = 1) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === p.id);
      if (i !== -1) return prev.map((x, n) => n === i ? { ...x, quantity: r2(x.quantity + qty) } : x);
      return [...prev, {
        productId: p.id, productCode: p.productCode, name: p.name,
        quantity: qty, unit: p.sellingUnit, rate: p.sellingPrice,
        gstRate: p.gstRate, hsnCode: p.hsnCode ?? undefined,
        foodType: p.foodType,
      }];
    });
  }, []);

  function handleCardClick(p: Product) {
    if (p.isWeighed) { setWeightProduct(p); return; }
    addToCart(p);
  }

  function flash(msg: string, ok: boolean) {
    setCodeFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setCodeFlash(''), ok ? 1800 : 2500);
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Escape')    { setSearch(''); setHighlightIdx(-1); searchRef.current?.blur(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = search.trim();
      if (!q) return;
      const byCode = products.find((p) => p.isActive && p.productCode?.toLowerCase() === q.toLowerCase());
      if (byCode) { handleCardClick(byCode); flash(`✓ ${byCode.name} added`, true); setSearch(''); setHighlightIdx(-1); setTimeout(() => searchRef.current?.focus(), 50); return; }
      if (highlightIdx >= 0 && highlightIdx < filtered.length) { handleCardClick(filtered[highlightIdx]); setSearch(''); setHighlightIdx(-1); setTimeout(() => searchRef.current?.focus(), 50); return; }
      if (filtered.length === 1) { handleCardClick(filtered[0]); setSearch(''); setHighlightIdx(-1); setTimeout(() => searchRef.current?.focus(), 50); return; }
      if (filtered.length === 0) flash(`No product found for "${q}"`, false);
    }
  }

  function updateQty(idx: number, delta: number) {
    setCart((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const step = item.unit === 'kg' ? delta * 0.25 : delta;
      return { ...item, quantity: Math.max(item.unit === 'kg' ? 0.25 : 1, r2(item.quantity + step)) };
    }));
  }

  function removeItem(idx: number) { setCart((prev) => prev.filter((_, i) => i !== idx)); }

  // ── Customer search ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); setShowCustDropdown(false); return; }
    const t = setTimeout(async () => {
      try { const res = await customerApi.list({ search: customerQuery }); setCustomerResults(res.data.slice(0, 5)); setShowCustDropdown(true); }
      catch {}
    }, 280);
    return () => clearTimeout(t);
  }, [customerQuery]);

  function selectCustomer(c: Customer) { setCustomer(c); setCustomerQuery(`${c.name}  ·  ${c.phone}`); setShowCustDropdown(false); }
  function clearCustomer()              { setCustomer(null); setCustomerQuery(''); setShowCustDropdown(false); }

  // ── Totals ────────────────────────────────────────────────────────────────────
  const lines     = cart.map((item) => { const base = r2(item.quantity * item.rate); return { base, cgst: r2(base * item.gstRate / 200), sgst: r2(base * item.gstRate / 200) }; });
  const subtotal  = r2(lines.reduce((s, l) => s + l.base, 0));
  const rawCgst   = r2(lines.reduce((s, l) => s + l.cgst, 0));
  const rawSgst   = r2(lines.reduce((s, l) => s + l.sgst, 0));
  const afterDisc = r2(subtotal - discountAmount);
  const ratio     = subtotal > 0 ? afterDisc / subtotal : 1;
  const cgst      = r2(rawCgst * ratio);
  const sgst      = r2(rawSgst * ratio);
  const preGrand  = r2(afterDisc + cgst + sgst);
  const roundOff  = r2(Math.round(preGrand) - preGrand);
  const grandTotal = r2(preGrand + roundOff);

  // Cash change
  const cashAmt    = parseFloat(cashReceived) || 0;
  const cashChange = paymentMode === 'cash' && cashAmt >= grandTotal ? r2(cashAmt - grandTotal) : 0;

  // ── Discount ──────────────────────────────────────────────────────────────────
  function applyDiscount() {
    const v = parseFloat(discountInput);
    if (!isNaN(v) && v >= 0 && v <= subtotal) setDiscountAmount(r2(v));
    setShowDiscountInput(false);
  }

  // ── Checkout ──────────────────────────────────────────────────────────────────
  async function handleCheckout() {
    if (!cart.length || submitting) return;
    if (paymentMode === 'cash' && cashAmt > 0 && cashAmt < grandTotal) {
      setErrorMsg('Cash received is less than the total. Please enter the correct amount.');
      return;
    }
    setSubmitting(true); setErrorMsg('');
    try {
      const res = await billingApi.create({
        items: cart.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unit: i.unit, rate: i.rate, gstRate: i.gstRate, hsnCode: i.hsnCode, discountAmount: 0 })),
        payments: [{ paymentMode, amount: grandTotal }],
        customerId: customer?.id, customerName: customer?.name, customerPhone: customer?.phone,
        totalDiscount: discountAmount, orderType,
      });
      const bill: CompletedBill = {
        billId: res.data.billId,
        invoiceNumber: res.data.invoiceNumber,
        grandTotal: res.data.grandTotal,
      };
      setCompletedBill(bill);
      // Auto-print
      printBill(bill.billId, receiptPaper);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorMsg(msg ?? 'Failed to create bill. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function startNewBill() {
    setCart([]); setCustomer(null); setCustomerQuery('');
    setDiscountAmount(0); setDiscountInput(''); setSearch('');
    setCashReceived(''); setCompletedBill(null); setErrorMsg('');
    setTimeout(() => searchRef.current?.focus(), 100);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, background: '#FBF6EE', position: 'relative' }}>

      {/* Weight dialog */}
      {weightProduct && (
        <WeightDialog
          product={weightProduct}
          onConfirm={(qty) => addToCart(weightProduct, qty)}
          onClose={() => setWeightProduct(null)}
        />
      )}

      {/* Success panel overlay */}
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

      {/* ═══ A — PRODUCT SELECTION AREA ═══════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', overflow: 'hidden' }}>

        {/* Search bar */}
        <div
          style={{
            flexShrink: 0, padding: '10px 20px 8px',
            background: '#fff', borderBottom: '1px solid #EADFD0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                 width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7A6A5F" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search items or type a code (001, 001*3)"
              style={{
                width: '100%', height: 56, fontSize: 20, paddingLeft: 50, paddingRight: 52,
                border: '1.5px solid #EADFD0', borderRadius: 14, outline: 'none',
                background: '#F8F5F0', color: '#1F1611', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#E8590C'; e.currentTarget.style.background = '#fff'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = '#EADFD0'; e.currentTarget.style.background = '#F8F5F0'; }}
            />
            {/* Clear button */}
            {search && (
              <button
                onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                aria-label="Clear search"
                style={{ position: 'absolute', right: 44, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F', display: 'flex' }}
              >
                <X size={18} />
              </button>
            )}
            {/* Shortcuts help */}
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <button
                onClick={() => setShowShortcuts((v) => !v)}
                aria-label="Keyboard shortcuts"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F', display: 'flex' }}
              >
                <HelpCircle size={20} />
              </button>
              {showShortcuts && <ShortcutsPopover onClose={() => setShowShortcuts(false)} />}
            </div>
          </div>

          {/* Code flash feedback */}
          {codeFlash && (
            <p style={{ marginTop: 6, fontSize: 15, fontWeight: 600, color: codeFlash.startsWith('✓') ? '#4F7F4A' : '#C0392B' }}>
              {codeFlash}
            </p>
          )}
        </div>

        {/* Category chips */}
        <div
          style={{
            flexShrink: 0, overflowX: 'auto', padding: '8px 20px',
            background: '#fff', borderBottom: '1px solid #EADFD0',
            scrollbarWidth: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 'max-content' }}>
            {/* All chip */}
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 52, padding: '0 18px', borderRadius: 9999, border: '1.5px solid',
                fontSize: 18, fontWeight: 600, cursor: 'pointer',
                ...(activeCategory === null
                  ? { background: '#E8590C', color: '#fff', borderColor: '#E8590C' }
                  : { background: '#FEE8D5', color: '#C44A06', borderColor: '#FBCEB1' }),
              }}
            >
              All
              <span style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 9999, padding: '2px 8px', fontSize: 14, fontWeight: 700 }}>
                {products.filter((p) => p.isActive).length}
              </span>
            </button>

            {categories.map((cat) => {
              const style   = cs(cat.name);
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(isActive ? null : cat.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 52, padding: '0 18px', borderRadius: 9999, border: '1.5px solid',
                    fontSize: 18, fontWeight: 600, cursor: 'pointer',
                    ...(isActive
                      ? { background: style.chipActiveBg, color: style.chipActiveText, borderColor: style.chipActiveBg }
                      : { background: style.chipBg, color: style.chipText, borderColor: `${style.border}44` }),
                  }}
                >
                  {cat.name}
                  <span style={{ background: 'rgba(0,0,0,0.09)', borderRadius: 9999, padding: '2px 8px', fontSize: 14, fontWeight: 700 }}>
                    {catCount[cat.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loadingData ? (
            <div style={{ display: 'flex', height: 200, alignItems: 'center', justifyContent: 'center', color: '#7A6A5F' }}>
              <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 10 }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Loading products…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', height: 200, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#7A6A5F' }}>
              <ShoppingBag size={40} strokeWidth={1.5} />
              <p style={{ fontSize: 18 }}>
                {search ? <>No product found for "<strong>{search}</strong>"</> : 'No products in this category'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
              {filtered.map((product, idx) => {
                const catName = categories.find((c) => c.id === product.categoryId)?.name ?? '';
                const style   = cs(catName);
                const cartItem = cart.find((x) => x.productId === product.id);
                const inCart   = cartItem != null;
                const cartIdx  = cart.findIndex((x) => x.productId === product.id);

                return (
                  <button
                    key={product.id}
                    onClick={() => handleCardClick(product)}
                    style={{
                      position: 'relative', display: 'flex', flexDirection: 'column',
                      minHeight: 140, padding: '14px 14px 12px',
                      background: style.bg,
                      borderLeft: `5px solid ${style.border}`,
                      border: `1px solid ${style.border}22`,
                      borderLeftWidth: 5, borderLeftColor: style.border,
                      borderRadius: 16, textAlign: 'left', cursor: 'pointer',
                      outline: idx === highlightIdx ? `2px solid ${style.border}` : 'none',
                      outlineOffset: 2,
                      boxShadow: inCart ? '0 2px 10px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.06)',
                      transition: 'transform 100ms, box-shadow 100ms',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = inCart ? '0 2px 10px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.06)'; }}
                  >
                    {/* Code badge top-right */}
                    <span
                      style={{
                        position: 'absolute', right: 10, top: 10,
                        background: style.badge, color: '#fff',
                        borderRadius: 9999, padding: '3px 10px',
                        fontSize: 15, fontWeight: 700, lineHeight: 1,
                      }}
                    >
                      {product.productCode}
                    </span>

                    {/* Cart qty badge */}
                    {inCart && (
                      <span
                        style={{
                          position: 'absolute', left: 10, top: 10,
                          background: '#E8590C', color: '#fff',
                          borderRadius: 9999, padding: '2px 8px',
                          fontSize: 14, fontWeight: 700, lineHeight: 1,
                        }}
                      >
                        ×{cartItem.unit === 'kg' ? cartItem.quantity.toFixed(2) : cartItem.quantity}
                      </span>
                    )}

                    {/* Veg dot */}
                    <span style={{ marginBottom: 8 }}>
                      <FoodDot type={product.foodType} />
                    </span>

                    {/* Product name — 2 lines, no truncate */}
                    <span
                      style={{
                        fontSize: 20, fontWeight: 600, color: '#1F1611',
                        lineHeight: 1.25, paddingRight: 40,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}
                    >
                      {product.name}
                    </span>

                    {/* Unit */}
                    {product.isWeighed && (
                      <span style={{ marginTop: 3, fontSize: 16, color: '#7A6A5F', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Scale size={14} color="#7A6A5F" /> per {product.sellingUnit}
                      </span>
                    )}
                    {!product.isWeighed && (
                      <span style={{ marginTop: 3, fontSize: 16, color: '#7A6A5F' }}>
                        per {product.sellingUnit}
                      </span>
                    )}

                    {/* Price */}
                    <span style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: style.price, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(product.sellingPrice)}
                    </span>

                    {/* Inline stepper if in cart */}
                    {inCart && !product.isWeighed && (
                      <div
                        style={{
                          marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); cartIdx >= 0 && (cartItem.quantity <= 1 ? removeItem(cartIdx) : updateQty(cartIdx, -1)); }}
                          aria-label="Decrease quantity"
                          style={{
                            width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: '#E8E0D8', color: '#6B5B52', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Minus size={16} />
                        </button>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#1F1611', minWidth: 24, textAlign: 'center' }}>
                          {cartItem.quantity}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); cartIdx >= 0 && updateQty(cartIdx, 1); }}
                          aria-label="Increase quantity"
                          style={{
                            width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: '#E8E0D8', color: '#6B5B52', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ B — CURRENT BILL PANEL (420px) ══════════════════════════════════ */}
      <div
        style={{
          width: 420, minWidth: 420, display: 'flex', flexDirection: 'column',
          background: '#fff', borderLeft: '1px solid #EADFD0',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.05)', minHeight: 0, height: '100%',
        }}
      >
        {/* Panel header */}
        <div style={{ flexShrink: 0, padding: '14px 18px 0', borderBottom: '1px solid #F0EAE3' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1F1611', margin: '0 0 10px' }}>
            Current Bill
          </h2>

          {/* Order type toggle */}
          <div style={{ display: 'flex', background: '#F0EAE3', borderRadius: 12, padding: 3, marginBottom: 12 }}>
            {(['dine-in', 'takeaway'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                style={{
                  flex: 1, height: 56, borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 18, fontWeight: 600, textTransform: 'capitalize', transition: 'background 150ms',
                  ...(orderType === t
                    ? { background: '#E8590C', color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                    : { background: 'transparent', color: '#7A6A5F' }),
                }}
              >
                {t === 'dine-in' ? 'Dine-in' : 'Takeaway'}
              </button>
            ))}
          </div>

          {/* Error message */}
          {errorMsg && (
            <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, color: '#C0392B' }}>{errorMsg}</span>
              <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B' }}><X size={16} /></button>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 6px', minHeight: 0, scrollbarWidth: 'thin' }}>
          {cart.length === 0 ? (
            <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#C4B5A8' }}>
              <ShoppingBag size={56} strokeWidth={1.4} />
              <p style={{ fontSize: 18, textAlign: 'center' }}>Tap an item or type a code to start</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cart.map((item, idx) => {
                const lineTax   = r2(item.quantity * item.rate * item.gstRate / 100);
                const lineTotal = r2(item.quantity * item.rate + lineTax);
                return (
                  <div
                    key={idx}
                    style={{
                      background: '#F8F5F0', border: '1px solid #EDE9E4',
                      borderRadius: 14, padding: '10px 12px',
                    }}
                  >
                    {/* Row 1: veg dot, name, code, remove */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <span style={{ marginTop: 2, flexShrink: 0 }}><FoodDot type={item.foodType ?? 'veg'} /></span>
                      <span style={{ flex: 1, fontSize: 18, fontWeight: 600, color: '#1F1611', lineHeight: 1.3 }}>
                        {item.name}
                      </span>
                      {item.productCode && (
                        <span style={{ background: '#E8E0D8', color: '#6B5B52', borderRadius: 6, padding: '1px 7px', fontSize: 13, fontWeight: 700, flexShrink: 0, alignSelf: 'flex-start' }}>
                          {item.productCode}
                        </span>
                      )}
                      <button
                        onClick={() => removeItem(idx)}
                        aria-label="Remove item"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B', flexShrink: 0, display: 'flex', padding: 2 }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Row 2: rate, qty stepper, line total */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 16, color: '#7A6A5F' }}>
                        {fmt(item.rate)} / {item.unit}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => (item.unit === 'kg' ? item.quantity <= 0.25 : item.quantity <= 1) ? removeItem(idx) : updateQty(idx, -1)}
                          aria-label="Decrease"
                          style={{ width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#E8E0D8', color: '#6B5B52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={16} />
                        </button>
                        <span style={{ minWidth: 34, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#1F1611' }}>
                          {item.unit === 'kg' ? item.quantity.toFixed(2) : item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(idx, 1)}
                          aria-label="Increase"
                          style={{ width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#E8E0D8', color: '#6B5B52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#1F1611', minWidth: 80, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(lineTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer search */}
        <div style={{ flexShrink: 0, padding: '8px 16px 0', borderTop: '1px solid #F0EAE3', position: 'relative' }}>
          <input
            ref={custRef}
            type="text"
            value={customerQuery}
            onChange={(e) => { setCustomerQuery(e.target.value); if (customer) clearCustomer(); }}
            placeholder="Search customer by phone or name… (F4)"
            style={{
              width: '100%', height: 52, fontSize: 18, padding: '0 14px', borderRadius: 12,
              border: '1px solid #EADFD0', background: '#F8F5F0', color: '#1F1611', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
            onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
          />
          {customer && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FEF3EC', border: '1px solid #FBCEB1', borderRadius: 10, padding: '8px 12px' }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1F1611' }}>{customer.name}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#7A6A5F' }}>{customer.phone} · {customer.loyaltyPoints} pts</p>
              </div>
              <button onClick={clearCustomer} aria-label="Remove customer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F' }}><X size={18} /></button>
            </div>
          )}
          {showCustDropdown && customerResults.length > 0 && !customer && (
            <div style={{ position: 'absolute', left: 16, right: 16, top: '100%', zIndex: 30, marginTop: 4, border: '1px solid #EADFD0', borderRadius: 12, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              {customerResults.map((c) => (
                <button key={c.id} onClick={() => selectCustomer(c)} style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #F0EAE3', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FEF3EC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#1F1611' }}>{c.name}</span>
                  <span style={{ fontSize: 14, color: '#7A6A5F' }}>{c.phone} · {c.loyaltyPoints} pts</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Discount */}
        <div style={{ flexShrink: 0, padding: '6px 16px' }}>
          {discountAmount === 0 && !showDiscountInput && (
            <button
              onClick={() => { setShowDiscountInput(true); setDiscountInput(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 17, fontWeight: 600, color: '#E8590C', background: 'none', border: 'none', cursor: 'pointer', minHeight: 48 }}
            >
              <Plus size={18} strokeWidth={2.5} /> Add discount
            </button>
          )}
          {showDiscountInput && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                autoFocus
                type="number" min={0} max={subtotal}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyDiscount(); if (e.key === 'Escape') setShowDiscountInput(false); }}
                placeholder="Discount (₹)"
                style={{ flex: 1, height: 48, fontSize: 18, padding: '0 12px', borderRadius: 10, border: '1px solid #EADFD0', outline: 'none', background: '#F8F5F0', color: '#1F1611' }}
              />
              <button onClick={applyDiscount} style={{ height: 48, padding: '0 16px', borderRadius: 10, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>Apply</button>
              <button onClick={() => setShowDiscountInput(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F' }}><X size={18} /></button>
            </div>
          )}
          {discountAmount > 0 && !showDiscountInput && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
              <button onClick={() => { setShowDiscountInput(true); setDiscountInput(String(discountAmount)); }} style={{ fontSize: 16, fontWeight: 600, color: '#E8590C', background: 'none', border: 'none', cursor: 'pointer' }}>
                Discount: −{fmt(discountAmount)}
              </button>
              <button onClick={() => { setDiscountAmount(0); setDiscountInput(''); }} style={{ fontSize: 14, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer' }}>remove</button>
            </div>
          )}
        </div>

        {/* Totals */}
        <div style={{ flexShrink: 0, margin: '0 14px 6px', padding: '12px 16px', background: '#FBF6EE', borderRadius: 14, border: '1px solid #EADFD0' }}>
          {[
            { label: 'Subtotal', value: subtotal, show: true },
            { label: 'Discount', value: -discountAmount, show: discountAmount > 0, color: '#4F7F4A' },
            { label: 'CGST', value: cgst, show: true },
            { label: 'SGST', value: sgst, show: true },
            { label: 'Round-off', value: roundOff, show: roundOff !== 0 },
          ].filter((r) => r.show).map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 18, color: '#7A6A5F' }}>{label}</span>
              <span style={{ fontSize: 18, color: color ?? '#7A6A5F', fontVariantNumeric: 'tabular-nums' }}>
                {label === 'Discount' ? `−${fmt(discountAmount)}` : fmt(Math.abs(value))}
              </span>
            </div>
          ))}

          {/* Grand total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1.5px solid #EADFD0', paddingTop: 10, marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#1F1611' }}>Total</span>
            <span style={{ fontSize: 38, fontWeight: 800, color: '#E8590C', fontFamily: '"DM Serif Display", serif', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(grandTotal)}
            </span>
          </div>
        </div>

        {/* Payment mode — Cash / UPI / Card (Wallet removed) */}
        <div style={{ flexShrink: 0, padding: '0 14px 6px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {([
            { v: 'cash' as PayMode, l: 'Cash',  Icon: Banknote },
            { v: 'upi'  as PayMode, l: 'UPI',   Icon: Smartphone },
            { v: 'card' as PayMode, l: 'Card',  Icon: CreditCard },
          ]).map(({ v, l, Icon }) => (
            <button
              key={v}
              onClick={() => setPaymentMode(v)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, height: 64, borderRadius: 14, cursor: 'pointer',
                fontSize: 18, fontWeight: 600,
                ...(paymentMode === v
                  ? { background: '#E8590C', color: '#fff', border: '2px solid #E8590C' }
                  : { background: '#fff', color: '#1F1611', border: '2px solid #EADFD0' }),
              }}
            >
              <Icon size={28} strokeWidth={1.8} />
              {l}
            </button>
          ))}
        </div>

        {/* Cash received + change */}
        {paymentMode === 'cash' && (
          <div style={{ flexShrink: 0, padding: '0 14px 6px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 16, color: '#7A6A5F' }}>Amount received</p>
            <input
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder={fmt(grandTotal)}
              style={{
                width: '100%', height: 52, fontSize: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                border: '1.5px solid #EADFD0', borderRadius: 12, outline: 'none',
                background: '#F8F5F0', color: '#1F1611', boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
            />
            {/* Quick chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[
                { label: 'Exact', val: grandTotal },
                { label: `₹${Math.ceil(grandTotal / 50) * 50}`, val: Math.ceil(grandTotal / 50) * 50 },
                { label: '₹500', val: 500 },
                { label: '₹2000', val: 2000 },
              ].filter((c) => c.val > 0).map((c) => (
                <button
                  key={c.label}
                  onClick={() => setCashReceived(String(r2(c.val)))}
                  style={{ flex: 1, height: 38, borderRadius: 8, border: '1px solid #EADFD0', background: '#FBF6EE', fontSize: 14, fontWeight: 600, color: '#7A6A5F', cursor: 'pointer' }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {cashChange > 0 && (
              <div style={{ marginTop: 8, background: '#E8F5E9', borderRadius: 10, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 17, color: '#4F7F4A' }}>Change</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#4F7F4A', fontVariantNumeric: 'tabular-nums' }}>{fmt(cashChange)}</span>
              </div>
            )}
          </div>
        )}

        {/* UPI QR placeholder */}
        {paymentMode === 'upi' && (
          <div style={{ flexShrink: 0, padding: '0 14px 6px', textAlign: 'center' }}>
            <div style={{ background: '#E3F4F4', borderRadius: 12, padding: '12px 16px' }}>
              <Smartphone size={32} color="#1E8E94" style={{ margin: '0 auto 6px' }} />
              <p style={{ margin: 0, fontSize: 16, color: '#1E8E94', fontWeight: 600 }}>UPI Payment</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: '#7A6A5F' }}>Show UPI QR or share payment link</p>
            </div>
          </div>
        )}

        {/* Hold + Pay buttons */}
        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, padding: '6px 14px 16px' }}>
          <button
            onClick={() => {
              if (!cart.length) return;
              if (window.confirm('Hold this bill?')) {
                billingApi.hold({ items: cart.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unit: i.unit, rate: i.rate, gstRate: i.gstRate })) })
                  .then(() => { setCart([]); setErrorMsg(''); })
                  .catch(() => {});
              }
            }}
            disabled={!cart.length}
            style={{
              height: 64, borderRadius: 14, fontSize: 18, fontWeight: 600, cursor: cart.length ? 'pointer' : 'not-allowed',
              background: '#F8F5F0', color: '#6B5B52', border: '1.5px solid #EADFD0', opacity: cart.length ? 1 : 0.4,
            }}
          >
            Hold
          </button>
          <button
            onClick={handleCheckout}
            disabled={submitting || !cart.length}
            style={{
              height: 64, borderRadius: 14, fontSize: 22, fontWeight: 700, color: '#fff', border: 'none',
              cursor: submitting || !cart.length ? 'not-allowed' : 'pointer',
              background: submitting || !cart.length ? '#F0A580' : '#E8590C',
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {submitting ? '…' : `Pay ${fmt(grandTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
