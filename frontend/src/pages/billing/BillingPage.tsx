/**
 * Bakery CRM — Billing / POS Screen  (v4 — Assure POS layout)
 * Left: category sections with compact product tiles
 * Right: bill table (Code | Item | Rate | Qty | Price)
 */

import {
  useState, useEffect, useRef, useCallback, KeyboardEvent,
} from 'react';
import {
  Banknote, Smartphone, CreditCard, ShoppingBag,
  Scale, X, Plus, Minus, CheckCircle, Printer, ArrowRight,
} from 'lucide-react';
import { productApi, billingApi, customerApi, categoryApi, settingsApi } from '@/api';
import { IS_MOCK, IS_DEMO } from '@/api/client';
const USE_MOCK = IS_MOCK || IS_DEMO;

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
      style={{ display: 'inline-flex', height: 14, width: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 2, border: `1.5px solid ${color}`, flexShrink: 0 }}
    >
      <span style={{ display: 'block', height: 7, width: 7, borderRadius: '50%', background: color }} />
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
    try { frame?.contentWindow?.document.fonts.ready.then(() => { frame?.contentWindow?.print(); }); }
    catch { frame?.contentWindow?.print(); }
  };
}

// ─── Weight entry dialog ──────────────────────────────────────────────────────

function WeightDialog({ product, onConfirm, onClose }: { product: Product; onConfirm: (qty: number) => void; onClose: () => void; }) {
  const [input, setInput] = useState('');
  const [unit, setUnit] = useState<'kg' | 'g'>('kg');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const qty = unit === 'g' ? (parseFloat(input) / 1000) || 0 : parseFloat(input) || 0;
  const chips = [{ label: '250 g', kg: 0.25 }, { label: '500 g', kg: 0.5 }, { label: '1 kg', kg: 1 }];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: 360, boxShadow: '0 8px 32px rgba(43,27,20,0.16)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#1F1611', margin: 0 }}>{product.name}</p>
            <p style={{ fontSize: 16, color: '#7A6A5F', margin: 0 }}>{fmt(product.sellingPrice)} / kg</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F' }}><X size={22} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['kg', 'g'] as const).map((u) => (
            <button key={u} onClick={() => setUnit(u)} style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer', background: unit === u ? '#E8590C' : '#F4EDE4', color: unit === u ? '#fff' : '#7A6A5F', border: 'none' }}>{u}</button>
          ))}
        </div>
        <input ref={inputRef} type="number" step="0.001" min="0" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && qty > 0) { onConfirm(qty); onClose(); } }}
          placeholder={unit === 'kg' ? 'e.g. 0.500' : 'e.g. 500'}
          style={{ width: '100%', height: 56, fontSize: 22, textAlign: 'center', border: '2px solid #EADFD0', borderRadius: 12, outline: 'none', padding: '0 12px', marginBottom: 12, boxSizing: 'border-box' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')} onBlur={(e) => (e.currentTarget.style.borderColor = '#EADFD0')} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {chips.map((c) => (
            <button key={c.label} onClick={() => { setUnit('kg'); setInput(String(c.kg)); }} style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', background: '#FFF1DC', color: '#D9822B', border: '1px solid #F5C88A' }}>{c.label}</button>
          ))}
        </div>
        {qty > 0 && (
          <p style={{ textAlign: 'center', color: '#7A6A5F', marginBottom: 12, fontSize: 16 }}>
            <Scale size={15} style={{ display: 'inline', marginRight: 4 }} />
            {qty.toFixed(3)} kg × {fmt(product.sellingPrice)} = <strong>{fmt(qty * product.sellingPrice)}</strong>
          </p>
        )}
        <button disabled={qty <= 0} onClick={() => { if (qty > 0) { onConfirm(qty); onClose(); } }}
          style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 18, fontWeight: 700, background: qty > 0 ? '#E8590C' : '#F8C4AA', color: '#fff', border: 'none', cursor: qty > 0 ? 'pointer' : 'not-allowed' }}>
          Add to bill
        </button>
      </div>
    </div>
  );
}

// ─── Success panel ────────────────────────────────────────────────────────────

function SuccessPanel({ bill, cashReceived, grandTotal, onNewBill, onViewBill, onPrint }: {
  bill: CompletedBill; cashReceived: number; grandTotal: number;
  onNewBill: () => void; onViewBill: () => void; onPrint: () => void;
}) {
  const change = Math.max(0, r2(cashReceived - grandTotal));
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(31,22,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '36px 32px', width: 420, boxShadow: '0 12px 40px rgba(43,27,20,0.20)', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ background: '#E8F5E9', borderRadius: '50%', padding: 16 }}>
            <CheckCircle size={48} color="#4F7F4A" strokeWidth={2} />
          </div>
        </div>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#1F1611', margin: '0 0 4px' }}>Payment successful!</p>
        <p style={{ fontSize: 16, color: '#7A6A5F', margin: '0 0 20px' }}>{bill.invoiceNumber}</p>
        <div style={{ background: '#FBF6EE', borderRadius: 14, padding: '16px 20px', marginBottom: change > 0 ? 12 : 20 }}>
          <p style={{ fontSize: 16, color: '#7A6A5F', margin: '0 0 4px' }}>Grand Total</p>
          <p style={{ fontSize: 38, fontWeight: 800, color: '#E8590C', margin: 0, fontFamily: '"DM Serif Display", serif', fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</p>
        </div>
        {change > 0 && (
          <div style={{ background: '#E8F5E9', borderRadius: 14, padding: '12px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 16, color: '#7A6A5F', margin: '0 0 4px' }}>Change due</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: '#4F7F4A', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(change)}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onPrint} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 14, fontSize: 18, fontWeight: 700, background: '#E8590C', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Printer size={22} strokeWidth={2} /> Print Bill
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={onNewBill} style={{ height: 52, borderRadius: 12, fontSize: 17, fontWeight: 600, background: '#FBF6EE', color: '#1F1611', border: '1.5px solid #EADFD0', cursor: 'pointer' }}>New Bill</button>
            <button onClick={onViewBill} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, borderRadius: 12, fontSize: 17, fontWeight: 600, background: '#FBF6EE', color: '#1F1611', border: '1.5px solid #EADFD0', cursor: 'pointer' }}>
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
  const [products,    setProducts]    = useState<Product[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [receiptPaper, setReceiptPaper] = useState('80mm');

  const [search,         setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [highlightIdx,   setHighlightIdx]   = useState(-1);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'takeaway' | 'dine-in'>('takeaway');

  const [customerQuery,    setCustomerQuery]    = useState('');
  const [customer,         setCustomer]         = useState<Customer | null>(null);
  const [customerResults,  setCustomerResults]  = useState<Customer[]>([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  const [discountAmount,    setDiscountAmount]    = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountInput,     setDiscountInput]     = useState('');

  const [paymentMode,  setPaymentMode]  = useState<PayMode>('cash');
  const [cashReceived, setCashReceived] = useState('');

  const [submitting,    setSubmitting]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [completedBill, setCompletedBill] = useState<CompletedBill | null>(null);
  const [weightProduct, setWeightProduct] = useState<Product | null>(null);
  const [codeFlash,     setCodeFlash]     = useState('');
  const [stockMap,      setStockMap]      = useState<Record<number, number>>({});

  const searchRef  = useRef<HTMLInputElement>(null);
  const custRef    = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  function refreshStock() {
    if (!USE_MOCK) return;
    import('@/store/demoStore').then(({ stock }) => {
      const lots = stock.list();
      const map: Record<number, number> = {};
      lots.forEach((lot) => { if (lot.product_id) map[lot.product_id] = (map[lot.product_id] ?? 0) + (lot.counter_qty ?? 0); });
      setStockMap(map);
    });
  }

  useEffect(() => {
    refreshStock();
    const interval = setInterval(refreshStock, 15000);
    window.addEventListener('focus', refreshStock);
    return () => { clearInterval(interval); window.removeEventListener('focus', refreshStock); };
  }, []);

  useEffect(() => {
    setLoadingData(true);
    Promise.all([productApi.list({ active: true }), categoryApi.list(), settingsApi.get()])
      .then(([pr, cr, sr]) => {
        setProducts(pr.data); setCategories(cr.data);
        setReceiptPaper(sr.data?.receiptPaper ?? '80mm');
        setTimeout(refreshStock, 0);
      })
      .catch(() => {}).finally(() => setLoadingData(false));
  }, []);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const isSearch = e.target === searchRef.current;
      const isCust   = e.target === custRef.current;
      const tag      = (e.target as HTMLElement).tagName;
      const inOther  = (tag === 'INPUT' || tag === 'TEXTAREA') && !isSearch && !isCust;
      if ((e.ctrlKey && e.key === 'k') || e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return; }
      if (e.key === 'F4') { e.preventDefault(); custRef.current?.focus(); return; }
      if (inOther) return;
      if (e.key === 'Escape') { if (isSearch) { setSearch(''); setHighlightIdx(-1); searchRef.current?.blur(); } }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const catCount = products.reduce<Record<number, number>>((acc, p) => {
    if (p.isActive) acc[p.categoryId] = (acc[p.categoryId] ?? 0) + 1;
    return acc;
  }, {});

  useEffect(() => { setHighlightIdx(-1); }, [search, activeCategory]);

  const addToCart = useCallback((p: Product, qty = 1) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === p.id);
      if (i !== -1) return prev.map((x, n) => n === i ? { ...x, quantity: r2(x.quantity + qty) } : x);
      return [...prev, { productId: p.id, productCode: p.productCode, name: p.name, quantity: qty, unit: p.sellingUnit, rate: p.sellingPrice, gstRate: p.gstRate, hsnCode: p.hsnCode ?? undefined, foodType: p.foodType }];
    });
  }, []);

  function handleCardClick(p: Product) { if (p.isWeighed) { setWeightProduct(p); return; } addToCart(p); }

  function flash(msg: string, ok: boolean) {
    setCodeFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setCodeFlash(''), ok ? 1800 : 2500);
  }

  const filtered = products.filter((p) => {
    if (!p.isActive) return false;
    if (activeCategory !== null && p.categoryId !== activeCategory) return false;
    if (search.trim()) { const q = search.trim().toLowerCase(); return p.name.toLowerCase().includes(q) || p.productCode?.toLowerCase().startsWith(q); }
    return true;
  });

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Escape')    { setSearch(''); setHighlightIdx(-1); searchRef.current?.blur(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = search.trim(); if (!q) return;
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

  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); setShowCustDropdown(false); return; }
    const t = setTimeout(async () => {
      try { const res = await customerApi.list({ search: customerQuery }); setCustomerResults(res.data.slice(0, 5)); setShowCustDropdown(true); } catch {}
    }, 280);
    return () => clearTimeout(t);
  }, [customerQuery]);

  function selectCustomer(c: Customer) { setCustomer(c); setCustomerQuery(`${c.name}  ·  ${c.phone}`); setShowCustDropdown(false); }
  function clearCustomer()              { setCustomer(null); setCustomerQuery(''); setShowCustDropdown(false); }

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
  const cashAmt    = parseFloat(cashReceived) || 0;
  const cashChange = paymentMode === 'cash' && cashAmt >= grandTotal ? r2(cashAmt - grandTotal) : 0;

  function applyDiscount() {
    const v = parseFloat(discountInput);
    if (!isNaN(v) && v >= 0 && v <= subtotal) setDiscountAmount(r2(v));
    setShowDiscountInput(false);
  }

  async function handleCheckout() {
    if (!cart.length || submitting) return;
    if (paymentMode === 'cash' && cashAmt > 0 && cashAmt < grandTotal) { setErrorMsg('Cash received is less than the total.'); return; }
    setSubmitting(true); setErrorMsg('');
    try {
      const res = await billingApi.create({
        items: cart.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unit: i.unit, rate: i.rate, gstRate: i.gstRate, hsnCode: i.hsnCode, discountAmount: 0 })),
        payments: [{ paymentMode, amount: grandTotal }],
        customerId: customer?.id, customerName: customer?.name, customerPhone: customer?.phone,
        totalDiscount: discountAmount, orderType,
      });
      const bill: CompletedBill = { billId: res.data.billId, invoiceNumber: res.data.invoiceNumber, grandTotal: res.data.grandTotal };
      setCompletedBill(bill);
      printBill(bill.billId, receiptPaper);
      refreshStock();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorMsg(msg ?? 'Failed to create bill. Please try again.');
    } finally { setSubmitting(false); }
  }

  function startNewBill() {
    setCart([]); setCustomer(null); setCustomerQuery('');
    setDiscountAmount(0); setDiscountInput(''); setSearch('');
    setCashReceived(''); setCompletedBill(null); setErrorMsg('');
    setTimeout(() => searchRef.current?.focus(), 100);
  }

  // Group products by category for Assure POS layout
  const productsByCategory = categories
    .filter((cat) => (catCount[cat.id] ?? 0) > 0)
    .map((cat) => ({
      cat,
      items: products.filter((p) =>
        p.isActive && p.categoryId === cat.id &&
        (search.trim()
          ? p.name.toLowerCase().includes(search.trim().toLowerCase()) || p.productCode?.toLowerCase().startsWith(search.trim().toLowerCase())
          : activeCategory === null || activeCategory === cat.id)
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, background: '#F2EDE8', position: 'relative' }}>

      {weightProduct && (
        <WeightDialog product={weightProduct} onConfirm={(qty) => addToCart(weightProduct, qty)} onClose={() => setWeightProduct(null)} />
      )}
      {completedBill && (
        <SuccessPanel bill={completedBill} cashReceived={cashAmt} grandTotal={completedBill.grandTotal}
          onNewBill={startNewBill} onViewBill={() => window.open(`/bills/${completedBill.billId}/print`, '_blank')}
          onPrint={() => printBill(completedBill.billId, receiptPaper)} />
      )}

      {/* ═══ LEFT — PRODUCT BROWSER ═══════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', overflow: 'hidden' }}>

        {/* Search + category chips */}
        <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #EADFD0', padding: '8px 12px 6px' }}>
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A6A5F" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey}
              placeholder="Type code or name  (Ctrl+K)"
              style={{ width: '100%', height: 40, fontSize: 15, paddingLeft: 36, paddingRight: 36, border: '1.5px solid #EADFD0', borderRadius: 10, outline: 'none', background: '#F8F5F0', color: '#1F1611', boxSizing: 'border-box' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#E8590C'; e.currentTarget.style.background = '#fff'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = '#EADFD0'; e.currentTarget.style.background = '#F8F5F0'; }} />
            {search && (
              <button onClick={() => { setSearch(''); searchRef.current?.focus(); }} aria-label="Clear"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F', display: 'flex' }}>
                <X size={15} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            <button onClick={() => setActiveCategory(null)}
              style={{ height: 30, padding: '0 12px', borderRadius: 9999, border: '1.5px solid', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                ...(activeCategory === null ? { background: '#E8590C', color: '#fff', borderColor: '#E8590C' } : { background: '#FEE8D5', color: '#C44A06', borderColor: '#FBCEB1' }) }}>
              All ({products.filter((p) => p.isActive).length})
            </button>
            {categories.map((cat) => {
              const st = cs(cat.name); const active = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(active ? null : cat.id)}
                  style={{ height: 30, padding: '0 12px', borderRadius: 9999, border: '1.5px solid', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    ...(active ? { background: st.chipActiveBg, color: st.chipActiveText, borderColor: st.chipActiveBg } : { background: st.chipBg, color: st.chipText, borderColor: `${st.border}44` }) }}>
                  {cat.name} ({catCount[cat.id] ?? 0})
                </button>
              );
            })}
          </div>
          {codeFlash && <p style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: codeFlash.startsWith('✓') ? '#4F7F4A' : '#C0392B' }}>{codeFlash}</p>}
        </div>

        {/* Category sections with product tiles */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loadingData ? (
            <div style={{ display: 'flex', height: 200, alignItems: 'center', justifyContent: 'center', color: '#7A6A5F', gap: 10 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              Loading products…
            </div>
          ) : productsByCategory.length === 0 ? (
            <div style={{ display: 'flex', height: 200, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#7A6A5F' }}>
              <ShoppingBag size={36} strokeWidth={1.5} />
              <p style={{ fontSize: 16 }}>{search ? <>No match for "<strong>{search}</strong>"</> : 'No products'}</p>
            </div>
          ) : (
            productsByCategory.map(({ cat, items }) => {
              const catStyle = cs(cat.name);
              return (
                <div key={cat.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: catStyle.bg, border: `1px solid ${catStyle.border}33`, borderLeft: `4px solid ${catStyle.border}`, borderRadius: '10px 10px 0 0', padding: '7px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: catStyle.price, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.name}</span>
                    <span style={{ fontSize: 11, color: catStyle.chipText, background: `${catStyle.border}22`, borderRadius: 9999, padding: '1px 8px', fontWeight: 600 }}>{items.length} items</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', background: '#fff', border: `1px solid ${catStyle.border}22`, borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                    {items.map((product) => {
                      const cartItem  = cart.find((x) => x.productId === product.id);
                      const inCart    = cartItem != null;
                      const cartIdx   = cart.findIndex((x) => x.productId === product.id);
                      const counterQty = (stockMap[product.id] ?? 0) - cart.filter((c) => c.productId === product.id).reduce((s, c) => s + c.quantity, 0);
                      const outOfStock = counterQty <= 0;
                      const lowStk    = (product as { lowStockLevel?: number | null }).lowStockLevel;
                      const isLow     = lowStk != null && counterQty <= lowStk && counterQty > 0;

                      return (
                        <button key={product.id} onClick={() => !outOfStock && handleCardClick(product)}
                          title={`${product.name} — ${fmt(product.sellingPrice)} / ${product.sellingUnit}`}
                          style={{
                            position: 'relative', width: 88, minHeight: 72,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '6px 4px 4px', textAlign: 'center',
                            background: inCart ? catStyle.bg : '#FAFAF8',
                            border: `1.5px solid ${inCart ? catStyle.border : '#E8E3DD'}`,
                            borderRadius: 8, cursor: outOfStock ? 'not-allowed' : 'pointer',
                            opacity: outOfStock ? 0.45 : 1, transition: 'border-color 80ms, background 80ms',
                          }}
                          onMouseEnter={(e) => { if (!outOfStock) (e.currentTarget as HTMLElement).style.borderColor = catStyle.border; }}
                          onMouseLeave={(e) => { if (!inCart) (e.currentTarget as HTMLElement).style.borderColor = '#E8E3DD'; }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 700, color: catStyle.badge, background: `${catStyle.badge}18`, borderRadius: 5, padding: '1px 5px', marginBottom: 3, lineHeight: 1.4 }}>{product.productCode}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#1F1611', lineHeight: 1.25, wordBreak: 'break-word', maxWidth: '100%' }}>
                            {product.name.length > 18 ? product.name.slice(0, 17) + '…' : product.name}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: catStyle.price, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{fmt(product.sellingPrice)}</span>
                          {inCart && (
                            <span style={{ position: 'absolute', top: -6, right: -6, background: '#E8590C', color: '#fff', borderRadius: 9999, fontSize: 10, fontWeight: 800, padding: '1px 5px', lineHeight: 1.4, border: '1.5px solid #fff' }}>
                              ×{cartItem.unit === 'kg' ? cartItem.quantity.toFixed(1) : cartItem.quantity}
                            </span>
                          )}
                          {!inCart && isLow && <span style={{ fontSize: 9, color: '#D9822B', fontWeight: 700, marginTop: 1 }}>LOW</span>}
                          {inCart && !product.isWeighed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={(e) => { e.stopPropagation(); cartItem.quantity <= 1 ? removeItem(cartIdx) : updateQty(cartIdx, -1); }}
                                style={{ width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer', background: '#E8E0D8', color: '#6B5B52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Minus size={10} />
                              </button>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1F1611', minWidth: 14, textAlign: 'center' }}>{cartItem.quantity}</span>
                              <button onClick={(e) => { e.stopPropagation(); updateQty(cartIdx, 1); }}
                                style={{ width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer', background: '#E8E0D8', color: '#6B5B52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={10} />
                              </button>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ RIGHT — BILL PANEL ═══════════════════════════════════════════ */}
      <div style={{ width: 440, minWidth: 380, display: 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1px solid #EADFD0', minHeight: 0, height: '100%' }}>

        {/* Bill header */}
        <div style={{ flexShrink: 0, padding: '10px 14px 8px', borderBottom: '1px solid #EADFD0', background: '#FBF6EE' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={18} color="#E8590C" />
              <span style={{ fontSize: 17, fontWeight: 700, color: '#1F1611' }}>Current Bill</span>
              {cart.length > 0 && <span style={{ background: '#E8590C', color: '#fff', borderRadius: 9999, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['takeaway', 'dine-in'] as const).map((t) => (
                <button key={t} onClick={() => setOrderType(t)}
                  style={{ height: 28, padding: '0 10px', borderRadius: 7, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    ...(orderType === t ? { background: '#E8590C', color: '#fff', borderColor: '#E8590C' } : { background: '#fff', color: '#7A6A5F', borderColor: '#EADFD0' }) }}>
                  {t === 'dine-in' ? 'Dine-in' : 'Takeaway'}
                </button>
              ))}
            </div>
          </div>

          {/* Customer search */}
          <div style={{ position: 'relative' }}>
            <input ref={custRef} type="text" value={customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); if (customer) clearCustomer(); }}
              placeholder="Customer name or phone (F4)"
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 30px 0 10px', border: '1.5px solid #EADFD0', borderRadius: 8, background: '#fff', color: '#1F1611', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')} onBlur={(e) => (e.currentTarget.style.borderColor = '#EADFD0')} />
            {customer && (
              <button onClick={clearCustomer} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
            {showCustDropdown && customerResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, background: '#fff', border: '1px solid #EADFD0', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {customerResults.map((c) => (
                  <button key={c.id} onClick={() => selectCustomer(c)}
                    style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', display: 'block', fontSize: 14, color: '#1F1611' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FBF6EE')} onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ color: '#7A6A5F', marginLeft: 8 }}>{c.phone}</span>
                    {c.loyaltyPoints > 0 && <span style={{ marginLeft: 8, fontSize: 12, color: '#C98B4B' }}>★ {c.loyaltyPoints} pts</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {errorMsg && (
            <div style={{ background: '#FDE5E0', borderRadius: 8, padding: '6px 10px', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#C0392B' }}>{errorMsg}</span>
              <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B' }}><X size={14} /></button>
            </div>
          )}
        </div>

        {/* Bill table */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {cart.length === 0 ? (
            <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#C4B5A8' }}>
              <ShoppingBag size={40} strokeWidth={1.4} />
              <p style={{ fontSize: 15, textAlign: 'center' }}>Tap a product to add it</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F5EFE8', borderBottom: '2px solid #E8DDD0', position: 'sticky', top: 0 }}>
                  {['Code', 'Item', 'Rate', 'Qty', 'Price', ''].map((h) => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Rate' || h === 'Qty' || h === 'Price' ? 'right' : 'left', fontSize: 12, fontWeight: 700, color: '#7A6A5F', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => {
                  const lineTax   = r2(item.quantity * item.rate * (item.gstRate ?? 0) / 100);
                  const lineTotal = r2(item.quantity * item.rate + lineTax);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #F0EAE3' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FBF6EE')} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '8px 8px', color: '#7A6A5F', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{item.productCode ?? '—'}</td>
                      <td style={{ padding: '8px 8px', fontWeight: 600, color: '#1F1611', maxWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <FoodDot type={item.foodType ?? 'veg'} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#A89890', marginTop: 1 }}>per {item.unit}</div>
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: '#7A6A5F', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(item.rate)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                          <button onClick={() => (item.unit === 'kg' ? item.quantity <= 0.25 : item.quantity <= 1) ? removeItem(idx) : updateQty(idx, -1)}
                            style={{ width: 24, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer', background: '#EDE9E4', color: '#6B5B52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Minus size={12} />
                          </button>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1F1611', minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                            {item.unit === 'kg' ? item.quantity.toFixed(2) : item.quantity}
                          </span>
                          <button onClick={() => updateQty(idx, 1)}
                            style={{ width: 24, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer', background: '#EDE9E4', color: '#6B5B52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: '#1F1611', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(lineTotal)}</td>
                      <td style={{ padding: '4px 6px' }}>
                        <button onClick={() => removeItem(idx)} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B', display: 'flex', padding: 3, borderRadius: 5 }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals + payment footer */}
        <div style={{ flexShrink: 0, borderTop: '2px solid #EADFD0', padding: '10px 14px 12px', background: '#FBF6EE' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#7A6A5F' }}>
                <span>Discount</span><span style={{ color: '#C0392B' }}>−{fmt(discountAmount)}</span>
              </div>
            )}
            {cgst > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#7A6A5F' }}><span>CGST</span><span>{fmt(cgst)}</span></div>}
            {sgst > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#7A6A5F' }}><span>SGST</span><span>{fmt(sgst)}</span></div>}
            <button onClick={() => setShowDiscountInput((v) => !v)}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: '#C98B4B', fontSize: 12, fontWeight: 600, padding: '2px 0', marginTop: 2 }}>
              {showDiscountInput ? '− Hide discount' : '+ Add discount'}
            </button>
            {showDiscountInput && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input type="number" min="0" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="₹ amount"
                  style={{ flex: 1, height: 34, fontSize: 14, padding: '0 10px', border: '1.5px solid #EADFD0', borderRadius: 8, background: '#fff', color: '#1F1611', outline: 'none' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')} onBlur={(e) => (e.currentTarget.style.borderColor = '#EADFD0')} />
                <button onClick={applyDiscount} style={{ height: 34, padding: '0 14px', borderRadius: 8, background: '#E8590C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Apply</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #EADFD0', marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1F1611' }}>Amount</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#E8590C', fontVariantNumeric: 'tabular-nums', fontFamily: '"DM Serif Display", serif' }}>{fmt(grandTotal)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
            {([
              { mode: 'cash' as PayMode, Icon: Banknote,   label: 'Cash' },
              { mode: 'upi'  as PayMode, Icon: Smartphone, label: 'UPI' },
              { mode: 'card' as PayMode, Icon: CreditCard, label: 'Card' },
            ] as { mode: PayMode; Icon: typeof Banknote; label: string }[]).map(({ mode, Icon, label }) => (
              <button key={mode} onClick={() => setPaymentMode(mode)}
                style={{ height: 42, borderRadius: 9, border: '1.5px solid', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  ...(paymentMode === mode ? { background: '#E8590C', color: '#fff', borderColor: '#E8590C' } : { background: '#fff', color: '#7A6A5F', borderColor: '#EADFD0' }) }}>
                <Icon size={15} strokeWidth={2} /> {label}
              </button>
            ))}
          </div>

          {paymentMode === 'cash' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="Cash received"
                  style={{ flex: 1, height: 36, fontSize: 14, padding: '0 10px', border: '1.5px solid #EADFD0', borderRadius: 8, background: '#fff', color: '#1F1611', outline: 'none' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')} onBlur={(e) => (e.currentTarget.style.borderColor = '#EADFD0')} />
                {[0, 50, 100, 500].map((add) => (
                  <button key={add} onClick={() => setCashReceived(add === 0 ? String(grandTotal) : String(Math.ceil(grandTotal / (add || 1)) * (add || 1)))}
                    style={{ height: 36, padding: '0 8px', borderRadius: 8, border: '1px solid #EADFD0', background: '#fff', color: '#7A6A5F', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {add === 0 ? 'Exact' : `+${add}`}
                  </button>
                ))}
              </div>
              {cashChange > 0 && (
                <div style={{ background: '#E8F5E9', borderRadius: 8, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                  <span style={{ color: '#4F7F4A', fontWeight: 600 }}>Change</span>
                  <span style={{ color: '#4F7F4A', fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{fmt(cashChange)}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <button onClick={async () => { if (!cart.length) return; await billingApi.hold({ items: cart, orderType }); startNewBill(); }} disabled={cart.length === 0}
              style={{ height: 48, borderRadius: 10, background: '#F0EAE3', color: '#7A6A5F', border: 'none', fontSize: 14, fontWeight: 700, cursor: cart.length > 0 ? 'pointer' : 'not-allowed', opacity: cart.length > 0 ? 1 : 0.5 }}>
              Hold
            </button>
            <button onClick={handleCheckout} disabled={cart.length === 0 || submitting}
              style={{ height: 48, borderRadius: 10, background: cart.length > 0 ? '#E8590C' : '#F0A580', color: '#fff', border: 'none', fontSize: 16, fontWeight: 800, cursor: cart.length > 0 && !submitting ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {submitting ? 'Processing…' : <>Pay {fmt(grandTotal)}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
