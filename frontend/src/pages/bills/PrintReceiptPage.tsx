/**
 * /bills/:id/print
 *
 * Standalone page — NO sidebar, no Layout wrapper, no app chrome.
 * Loaded in a hidden iframe; the caller does iframe.contentWindow.print().
 * All styles are self-contained and scoped inside this file.
 * Never calls window.print() directly; that's the caller's job.
 *
 * Formats: 80mm thermal (default), 58mm thermal, A4 invoice.
 * Paper size is read from shop settings or overridden with ?paper=80mm|58mm|A4.
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { billingApi, settingsApi } from '@/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BillItem {
  id: number;
  name: string;
  hsnCode: string | null;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
}

interface Payment {
  paymentMode: string;
  amount: number;
}

interface Bill {
  invoiceNumber: string;
  finYear: string;
  billDate: string;
  status: string;
  printCount: number;
  cashierName: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string | null;
  items: BillItem[];
  payments: Payment[];
}

interface ShopSettings {
  shopName: string;
  address: string | null;
  phone: string | null;
  gstin: string | null;
  fssaiNumber: string | null;
  invoiceFooter: string;
  receiptPaper: '58mm' | '80mm' | 'A4';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
  }).format(n);
}

function formatDT(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

function paymentLabel(mode: string) {
  const m: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit', wallet: 'Wallet (Legacy)' };
  return m[mode] ?? mode;
}

// ─── CSS strings (scoped, no global leak) ────────────────────────────────────

function thermalCss(width: '58mm' | '80mm') {
  return `
    @page { size: ${width} auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.4; width: ${width}; }
    .receipt { width: 100%; padding: 6px 6px 24px; }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .large  { font-size: 15px; }
    .xlarge { font-size: 18px; font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    .row    { display: flex; justify-content: space-between; }
    .row-3  { display: flex; gap: 4px; }
    .row-3 .name { flex: 1; }
    .row-3 .qty  { width: 54px; text-align: right; }
    .row-3 .amt  { width: 62px; text-align: right; }
    .stamp  { border: 2px solid #000; display: inline-block; padding: 2px 8px; font-weight: bold; letter-spacing: 2px; font-size: 13px; margin: 4px 0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `;
}

function a4Css() {
  return `
    @page { size: A4; margin: 15mm 15mm 20mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.5; }
    h1 { margin: 0; font-size: 22pt; }
    h2 { margin: 0; font-size: 14pt; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12pt; border-bottom: 2px solid #000; padding-bottom: 8pt; }
    .shop-info p { margin: 0; font-size: 10pt; }
    .invoice-meta { text-align: right; }
    .invoice-meta p { margin: 0; font-size: 10pt; }
    .stamp  { border: 2px solid #000; display: inline-block; padding: 2px 10px; font-weight: bold; letter-spacing: 2px; font-size: 14pt; }
    table  { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; }
    th     { background: #f0f0f0; border: 1px solid #ccc; padding: 5pt 6pt; text-align: left; font-weight: bold; }
    td     { border: 1px solid #ddd; padding: 4pt 6pt; }
    td.right, th.right { text-align: right; }
    .totals { width: 220pt; margin-left: auto; font-size: 10pt; }
    .totals tr td { border: none; padding: 2pt 4pt; }
    .totals tr td:last-child { text-align: right; }
    .grand  { font-size: 14pt; font-weight: bold; border-top: 2px solid #000 !important; }
    .footer { margin-top: 20pt; border-top: 1px solid #ccc; padding-top: 8pt; font-size: 9pt; text-align: center; color: #555; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `;
}

// ─── Thermal receipt layout ───────────────────────────────────────────────────

function ThermalReceipt({ bill, shop, isDuplicate }: { bill: Bill; shop: ShopSettings; isDuplicate: boolean }) {
  const payment = bill.payments?.[0];
  const cashReceived = payment?.paymentMode === 'cash' && payment.amount >= bill.grandTotal
    ? payment.amount
    : null;
  const change = cashReceived != null ? Math.max(0, cashReceived - bill.grandTotal) : 0;

  return (
    <div className="receipt">
      {/* Shop header */}
      <div className="center bold large">{shop.shopName}</div>
      {shop.address && <div className="center">{shop.address}</div>}
      {shop.phone && <div className="center">Tel: {shop.phone}</div>}
      {shop.gstin && <div className="center">GSTIN: {shop.gstin}</div>}
      {shop.fssaiNumber && <div className="center">FSSAI: {shop.fssaiNumber}</div>}

      {/* Status stamps */}
      {isDuplicate && (
        <div className="center" style={{ marginTop: 4 }}>
          <span className="stamp">DUPLICATE COPY</span>
        </div>
      )}
      {bill.status === 'cancelled' && (
        <div className="center" style={{ marginTop: 4 }}>
          <span className="stamp">CANCELLED</span>
        </div>
      )}

      <div className="divider" />

      {/* Invoice meta */}
      <div className="row"><span>Invoice:</span><span className="bold">{bill.invoiceNumber}</span></div>
      <div className="row"><span>Date:</span><span>{formatDT(bill.billDate)}</span></div>
      <div className="row"><span>Cashier:</span><span>{bill.cashierName}</span></div>
      {bill.customerName && (
        <div className="row"><span>Customer:</span><span>{bill.customerName}{bill.customerPhone ? ` / ${bill.customerPhone}` : ''}</span></div>
      )}

      <div className="divider" />

      {/* Column headers */}
      <div className="row-3">
        <span className="name bold">Item</span>
        <span className="qty bold" style={{ textAlign: 'right' }}>Qty</span>
        <span className="amt bold" style={{ textAlign: 'right' }}>Amt</span>
      </div>
      <div className="divider" />

      {/* Items */}
      {bill.items.map((item, i) => (
        <div key={i}>
          <div className="row-3">
            <span className="name">{item.name}</span>
            <span className="qty">{item.unit === 'kg' ? item.quantity.toFixed(3) : item.quantity} {item.unit}</span>
            <span className="amt">{inr(item.totalAmount)}</span>
          </div>
          <div style={{ paddingLeft: 2, fontSize: 11, color: '#444' }}>
            {inr(item.rate)} × {item.unit === 'kg' ? item.quantity.toFixed(3) : item.quantity}
            {item.hsnCode ? `  HSN:${item.hsnCode}` : ''}
            {item.gstRate > 0 ? `  GST:${item.gstRate}%` : ''}
          </div>
        </div>
      ))}

      <div className="divider" />

      {/* Totals */}
      <div className="row"><span>Subtotal</span><span>{inr(bill.subtotal)}</span></div>
      {bill.totalDiscount > 0 && (
        <div className="row"><span>Discount</span><span>-{inr(bill.totalDiscount)}</span></div>
      )}
      {bill.totalCgst > 0 && <div className="row"><span>CGST</span><span>{inr(bill.totalCgst)}</span></div>}
      {bill.totalSgst > 0 && <div className="row"><span>SGST</span><span>{inr(bill.totalSgst)}</span></div>}
      {bill.roundOff !== 0 && <div className="row"><span>Round-off</span><span>{bill.roundOff > 0 ? '+' : ''}{inr(bill.roundOff)}</span></div>}

      <div className="divider" />
      <div className="row xlarge"><span>TOTAL</span><span>{inr(bill.grandTotal)}</span></div>
      <div className="divider" />

      {/* Payment */}
      {payment && (
        <div className="row bold"><span>Paid by</span><span>{paymentLabel(payment.paymentMode)}</span></div>
      )}
      {cashReceived != null && (
        <>
          <div className="row"><span>Cash received</span><span>{inr(cashReceived)}</span></div>
          <div className="row bold"><span>Change</span><span>{inr(change)}</span></div>
        </>
      )}

      {bill.amountInWords && (
        <div style={{ fontSize: 11, marginTop: 4 }}>
          <em>{bill.amountInWords}</em>
        </div>
      )}

      <div className="divider" />

      {/* Footer */}
      <div className="center" style={{ marginTop: 6, fontSize: 11 }}>
        {shop.invoiceFooter || 'Thank you! Visit again.'}
      </div>
    </div>
  );
}

// ─── A4 receipt layout ────────────────────────────────────────────────────────

function A4Receipt({ bill, shop, isDuplicate }: { bill: Bill; shop: ShopSettings; isDuplicate: boolean }) {
  const payment = bill.payments?.[0];
  const cashReceived = payment?.paymentMode === 'cash' ? payment.amount : null;
  const change = cashReceived != null ? Math.max(0, cashReceived - bill.grandTotal) : 0;

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="shop-info">
          <h1>{shop.shopName}</h1>
          {shop.address && <p>{shop.address}</p>}
          {shop.phone && <p>Tel: {shop.phone}</p>}
          {shop.gstin && <p>GSTIN: {shop.gstin}</p>}
          {shop.fssaiNumber && <p>FSSAI: {shop.fssaiNumber}</p>}
        </div>
        <div className="invoice-meta">
          <h2>TAX INVOICE</h2>
          {isDuplicate && <span className="stamp">DUPLICATE COPY</span>}
          {bill.status === 'cancelled' && <span className="stamp">CANCELLED</span>}
          <p><strong>Invoice:</strong> {bill.invoiceNumber}</p>
          <p><strong>Date:</strong> {formatDT(bill.billDate)}</p>
          <p><strong>Cashier:</strong> {bill.cashierName}</p>
          {bill.customerName && <p><strong>Customer:</strong> {bill.customerName}{bill.customerPhone ? ` / ${bill.customerPhone}` : ''}</p>}
        </div>
      </div>

      {/* Items table */}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>HSN</th>
            <th className="right">Qty</th>
            <th className="right">Rate</th>
            <th className="right">Taxable</th>
            <th className="right">CGST</th>
            <th className="right">SGST</th>
            <th className="right">Total</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{item.name}</td>
              <td>{item.hsnCode ?? '—'}</td>
              <td className="right">{item.unit === 'kg' ? item.quantity.toFixed(3) : item.quantity} {item.unit}</td>
              <td className="right">{inr(item.rate)}</td>
              <td className="right">{inr(item.taxableValue)}</td>
              <td className="right">{inr(item.cgstAmount)} ({item.gstRate / 2}%)</td>
              <td className="right">{inr(item.sgstAmount)} ({item.gstRate / 2}%)</td>
              <td className="right">{inr(item.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals block */}
      <table className="totals">
        <tbody>
          <tr><td>Subtotal</td><td>{inr(bill.subtotal)}</td></tr>
          {bill.totalDiscount > 0 && <tr><td>Discount</td><td>−{inr(bill.totalDiscount)}</td></tr>}
          {bill.totalCgst > 0 && <tr><td>Total CGST</td><td>{inr(bill.totalCgst)}</td></tr>}
          {bill.totalSgst > 0 && <tr><td>Total SGST</td><td>{inr(bill.totalSgst)}</td></tr>}
          {bill.roundOff !== 0 && <tr><td>Round-off</td><td>{bill.roundOff > 0 ? '+' : ''}{inr(bill.roundOff)}</td></tr>}
          <tr className="grand"><td>Grand Total</td><td>{inr(bill.grandTotal)}</td></tr>
          {payment && <tr><td>Payment Mode</td><td>{paymentLabel(payment.paymentMode)}</td></tr>}
          {cashReceived != null && <tr><td>Cash Received</td><td>{inr(cashReceived)}</td></tr>}
          {cashReceived != null && <tr><td>Change</td><td>{inr(change)}</td></tr>}
        </tbody>
      </table>

      {bill.amountInWords && (
        <p style={{ fontSize: '10pt', marginTop: 8 }}>
          <strong>Amount in words:</strong> {bill.amountInWords}
        </p>
      )}

      <div className="footer">
        {shop.invoiceFooter || 'Thank you for your business!'}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PrintReceiptPage() {
  const { id }          = useParams<{ id: string }>();
  const [searchParams]  = useSearchParams();

  const [bill,   setBill]   = useState<Bill | null>(null);
  const [shop,   setShop]   = useState<ShopSettings | null>(null);
  const [error,  setError]  = useState('');
  const [ready,  setReady]  = useState(false);

  useEffect(() => {
    if (!id) { setError('No bill ID provided.'); return; }

    Promise.all([
      billingApi.getByIdFull(Number(id)),
      settingsApi.get(),
    ])
      .then(([billRes, shopRes]) => {
        setBill(billRes.data as Bill);
        setShop(shopRes.data as ShopSettings);
        setReady(true);
      })
      .catch(() => setError(`Failed to load bill #${id}. Please try again.`));
  }, [id]);

  // Determine paper size: query param wins over settings
  const paperParam = searchParams.get('paper');
  const paper: '58mm' | '80mm' | 'A4' =
    paperParam === '58mm' || paperParam === '80mm' || paperParam === 'A4'
      ? paperParam
      : (shop?.receiptPaper ?? '80mm');

  const isDuplicate = (bill?.printCount ?? 0) > 1;

  if (error) {
    return (
      <html>
        <body style={{ fontFamily: 'sans-serif', padding: 32, color: '#c00' }}>
          <h2>Print error</h2>
          <p>{error}</p>
          <p>This page can be closed.</p>
        </body>
      </html>
    );
  }

  if (!ready || !bill || !shop) {
    return (
      <html>
        <body style={{ fontFamily: 'sans-serif', padding: 32, color: '#666' }}>
          <p>Loading receipt…</p>
        </body>
      </html>
    );
  }

  const css = paper === 'A4' ? a4Css() : thermalCss(paper as '58mm' | '80mm');

  return (
    // We render a full HTML document via React Portals isn't needed here —
    // because this route is rendered standalone (no Layout wrapper), the
    // outermost DOM node is the app root. We inject the scoped <style>.
    <div id="print-root" style={{ margin: 0, padding: 0, background: '#fff' }}>
      {/* Scoped CSS — injected as a <style> tag inside the component tree */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {paper === 'A4'
        ? <A4Receipt   bill={bill} shop={shop} isDuplicate={isDuplicate} />
        : <ThermalReceipt bill={bill} shop={shop} isDuplicate={isDuplicate} />
      }
    </div>
  );
}
