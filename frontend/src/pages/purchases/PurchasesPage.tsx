import { useEffect, useState } from 'react';
import { Plus, X as XIcon } from 'lucide-react';
import PageHeader          from '@/components/common/PageHeader';
import { Card }            from '@/components/common/Card';
import ViewOnlyBadge       from '@/components/common/ViewOnlyBadge';
import OwnerActions        from '@/components/common/OwnerActions';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import EditDrawer, {
  DrawerField, DrawerInput, DrawerSelect, DrawerTextarea, DrawerSection,
} from '@/components/common/EditDrawer';
import ToastList from '@/components/common/Toast';
import { purchaseApi, supplierApi, userApi } from '@/api';
import { useAuthStore }    from '@/store/authStore';
import { useToast }        from '@/hooks/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Receipt = Record<string, any>;

const payStatusOptions = [
  { value: 'unpaid',  label: 'Unpaid' },
  { value: 'partial', label: 'Partially Paid' },
  { value: 'paid',    label: 'Paid' },
];

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function PayStatusPill({ status }: { status?: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    paid:    { bg: '#E8F5E9', color: '#4F7F4A', label: 'Paid' },
    partial: { bg: '#FFF1DC', color: '#D9822B', label: 'Partial' },
    unpaid:  { bg: '#FDE5E0', color: '#C8503A', label: 'Unpaid' },
  };
  const s = map[status ?? 'unpaid'] ?? map.unpaid;
  return <span style={{ background: s.bg, color: s.color, borderRadius: 9999, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{s.label}</span>;
}

interface LineItem { itemName: string; quantity: string; unit: string; rate: string; }

export default function PurchasesPage() {
  const { user }         = useAuthStore();
  const isAdmin          = user?.role === 'admin';
  const { toasts, show } = useToast();

  const [receipts,  setReceipts]  = useState<Receipt[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [suppliers, setSuppliers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [users,     setUsers]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editTarget,setEditTarget]= useState<Receipt | null>(null);
  const [deleteTarget,setDeleteTarget] = useState<Receipt | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [actionError,setActionError] = useState('');
  const [isNew,     setIsNew]     = useState(false);
  const [expandRow, setExpandRow] = useState<number | null>(null);

  const [fSupplierId, setFSupplierId] = useState<number | null>(null);
  const [fSupplier,   setFSupplier]   = useState('');
  const [fBillNo,     setFBillNo]     = useState('');
  const [fDate,       setFDate]       = useState('');
  const [fPayStatus,  setFPayStatus]  = useState('unpaid');
  const [fAmountPaid, setFAmountPaid] = useState('');
  const [fPayMode,    setFPayMode]    = useState('');
  const [fPayDate,    setFPayDate]    = useState('');
  const [fReceivedBy, setFReceivedBy] = useState('');
  const [fNotes,      setFNotes]      = useState('');
  const [fLines,      setFLines]      = useState<LineItem[]>([{ itemName: '', quantity: '', unit: '', rate: '' }]);

  const fTotal = fLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0);

  async function load() {
    setLoading(true);
    try {
      const [rRes, sRes, uRes] = await Promise.all([purchaseApi.listReceipts(), supplierApi.list(), userApi.list()]);
      setReceipts(rRes.data); setSuppliers(sRes.data); setUsers(uRes.data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function blank() {
    setFSupplierId(null); setFSupplier(''); setFBillNo(''); setFDate(new Date().toISOString().split('T')[0]);
    setFPayStatus('unpaid'); setFAmountPaid(''); setFPayMode(''); setFPayDate('');
    setFReceivedBy(user?.displayName ?? ''); setFNotes('');
    setFLines([{ itemName: '', quantity: '', unit: '', rate: '' }]);
    setActionError('');
  }

  function openNew() { setIsNew(true); setEditTarget(null); blank(); }

  function openEdit(r: Receipt) {
    setIsNew(false); setEditTarget(r);
    setFSupplierId(r.supplier_id ?? null); setFSupplier(r.supplier_name ?? '');
    setFBillNo(r.bill_number ?? r.grn_number ?? ''); setFDate(r.receipt_date?.split('T')[0] ?? '');
    setFPayStatus(r.payment_status ?? 'unpaid');
    setFAmountPaid(r.amount_paid != null ? String(r.amount_paid) : '');
    setFPayMode(r.payment_mode ?? ''); setFPayDate(r.payment_date ?? '');
    setFReceivedBy(r.received_by_name ?? ''); setFNotes(r.notes ?? '');
    const items = r.items ?? [];
    setFLines(items.length > 0 ? items.map((i: Record<string, unknown>) => ({ itemName: String(i.raw_material_name ?? i.item_name ?? ''), quantity: String(i.quantity_received ?? i.quantity ?? ''), unit: String(i.unit ?? ''), rate: String(i.rate ?? '') })) : [{ itemName: '', quantity: '', unit: '', rate: '' }]);
    setActionError('');
  }

  async function handleSave() {
    if (!fBillNo.trim()) { setActionError('Bill No. is required'); return; }
    if (!fSupplierId)    { setActionError('Supplier is required'); return; }
    const validLines = fLines.filter((l) => l.itemName.trim() && parseFloat(l.quantity) > 0 && parseFloat(l.rate) >= 0);
    if (validLines.length === 0) { setActionError('At least one line item is required'); return; }

    setSaving(true); setActionError('');
    const amtPaid = fPayStatus === 'paid' ? fTotal : fPayStatus === 'unpaid' ? 0 : parseFloat(fAmountPaid) || 0;

    const payload = {
      supplierId: fSupplierId, supplier_id: fSupplierId, supplier_name: fSupplier,
      bill_number: fBillNo, grn_number: fBillNo,
      receipt_date: fDate, receiptDate: fDate,
      grandTotal: fTotal, grand_total: fTotal,
      payment_status: fPayStatus, paymentStatus: fPayStatus,
      amount_paid: amtPaid, amountPaid: amtPaid,
      payment_mode: fPayMode, payment_date: fPayDate,
      received_by_name: fReceivedBy, receivedByName: fReceivedBy,
      notes: fNotes,
      items: validLines.map((l, i) => ({
        id: i + 1, raw_material_name: l.itemName, item_name: l.itemName,
        quantity_received: parseFloat(l.quantity), quantity: parseFloat(l.quantity),
        unit: l.unit, rate: parseFloat(l.rate),
        line_amount: parseFloat(l.quantity) * parseFloat(l.rate),
        gst_rate: 0,
      })),
    };

    try {
      if (isNew) { await purchaseApi.createReceipt(payload); show('Purchase added'); }
      else {
        // For edits we update the payment status
        await purchaseApi.createPayment({ receiptId: editTarget!.id, amountPaid: amtPaid, paymentMode: fPayMode });
        show('Purchase updated');
      }
      setEditTarget(null); setIsNew(false); await load();
    } catch (e: unknown) {
      setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed');
    } finally { setSaving(false); }
  }

  function itemsSummary(r: Receipt) {
    const items = r.items ?? [];
    if (!items.length) return r.supplier_invoice_no ?? '—';
    const first = `${items[0].raw_material_name ?? items[0].item_name ?? 'Item'} ${items[0].quantity_received ?? ''} ${items[0].unit ?? ''}`.trim();
    return items.length > 1 ? `${first}, +${items.length - 1} more` : first;
  }

  // Supplier's supplied items for datalist
  const selectedSupplier = suppliers.find((s) => s.id === fSupplierId);
  const suppliedNames = (selectedSupplier?.suppliedItems ?? []).map((i: Record<string, string>) => i.itemName);

  return (
    <div>
      <ToastList toasts={toasts} />
      <PageHeader title="Purchases" subtitle="Goods received — Bill No. replaces GRN No."
        actions={isAdmin ? (
          <button onClick={openNew} style={{ height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={18} /> New Purchase
          </button>
        ) : undefined}
      />
      <ViewOnlyBadge />

      <EditDrawer
        title={isNew ? 'New Purchase' : `Record Payment: ${editTarget?.bill_number ?? ''}`}
        open={isNew || !!editTarget}
        onClose={() => { setEditTarget(null); setIsNew(false); }}
        onSave={handleSave} saving={saving} error={actionError}
      >
        <DrawerSection title="Purchase details" />
        <DrawerField label="Supplier" required>
          <input type="text" value={fSupplier} list="sup-names"
            onChange={(e) => {
              setFSupplier(e.target.value);
              const match = suppliers.find((s) => s.name === e.target.value);
              if (match) setFSupplierId(match.id);
            }}
            placeholder="Select supplier…"
            style={{ width: '100%', height: 48, fontSize: 16, padding: '0 14px', border: '1.5px solid #EADFD0', borderRadius: 12, background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box' as const }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')} onBlur={(e) => (e.currentTarget.style.borderColor = '#EADFD0')}
          />
          <datalist id="sup-names">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
        </DrawerField>
        <DrawerField label="Bill No." required hint="Supplier's invoice/bill number."><DrawerInput value={fBillNo} onChange={setFBillNo} placeholder="e.g. ADF-2234" /></DrawerField>
        <DrawerField label="Date"><DrawerInput type="date" value={fDate} onChange={setFDate} /></DrawerField>
        <DrawerField label="Received By">
          <DrawerSelect value={fReceivedBy} onChange={setFReceivedBy}
            options={[{ value: '', label: '— Select —' }, ...users.map((u) => ({ value: u.displayName, label: u.displayName }))]} />
        </DrawerField>

        <DrawerSection title="Items" />
        {fLines.map((line, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 32px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input type="text" value={line.itemName} list="purchase-items-list"
              onChange={(e) => setFLines((prev) => prev.map((l, i) => i === idx ? { ...l, itemName: e.target.value } : l))}
              placeholder="Item name"
              style={{ height: 40, fontSize: 15, padding: '0 10px', border: '1.5px solid #EADFD0', borderRadius: 10, background: '#FBF6EE', color: '#1F1611', outline: 'none' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')} onBlur={(e) => (e.currentTarget.style.borderColor = '#EADFD0')}
            />
            {['quantity', 'unit', 'rate'].map((field) => (
              <input key={field} type={field === 'unit' ? 'text' : 'number'}
                value={(line as unknown as Record<string, string>)[field]}
                onChange={(e) => setFLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: e.target.value } : l))}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                style={{ height: 40, fontSize: 14, padding: '0 8px', border: '1.5px solid #EADFD0', borderRadius: 10, background: '#FBF6EE', color: '#1F1611', outline: 'none' }}
              />
            ))}
            <button onClick={() => setFLines((prev) => prev.filter((_, i) => i !== idx))}
              style={{ height: 32, width: 32, borderRadius: 8, border: 'none', background: '#FDE5E0', color: '#C0392B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XIcon size={14} />
            </button>
          </div>
        ))}
        <datalist id="purchase-items-list">
          {suppliedNames.map((n: string) => <option key={n} value={n} />)}
        </datalist>
        <button onClick={() => setFLines((prev) => [...prev, { itemName: '', quantity: '', unit: '', rate: '' }])}
          style={{ height: 40, padding: '0 14px', borderRadius: 10, border: '1.5px dashed #EADFD0', background: 'none', color: '#E8590C', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Add row
        </button>

        <DrawerSection title="Payment" />
        <div style={{ background: '#FBF6EE', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
            <span style={{ color: '#7A6A5F' }}>Total</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1F1611' }}>{inr(fTotal)}</span>
          </div>
        </div>
        <DrawerField label="Payment Status">
          <DrawerSelect value={fPayStatus} onChange={setFPayStatus} options={payStatusOptions} />
        </DrawerField>
        {fPayStatus === 'partial' && (
          <DrawerField label="Amount Paid (₹)"><DrawerInput type="number" value={fAmountPaid} onChange={setFAmountPaid} placeholder="e.g. 2000" /></DrawerField>
        )}
        {fPayStatus !== 'unpaid' && (
          <>
            <DrawerField label="Payment Mode">
              <DrawerSelect value={fPayMode} onChange={setFPayMode} options={[{ value: '', label: '—' }, { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }]} />
            </DrawerField>
            <DrawerField label="Payment Date"><DrawerInput type="date" value={fPayDate} onChange={setFPayDate} /></DrawerField>
          </>
        )}
        <DrawerField label="Notes"><DrawerTextarea value={fNotes} onChange={setFNotes} placeholder="Internal notes…" rows={2} /></DrawerField>
      </EditDrawer>

      {deleteTarget && (
        <ConfirmDeleteDialog recordName={`Purchase: ${deleteTarget.bill_number ?? deleteTarget.grn_number}`} requireReason
          onConfirm={() => setDeleteTarget(null)} onCancel={() => setDeleteTarget(null)} />
      )}

      <Card>
        {loading ? <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>Loading…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
              <thead>
                <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                  {['Date', 'Bill No.', 'Supplier', 'Items', 'Amount', 'Payment', 'Received By', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <>
                    <tr key={r.id}
                      style={{ borderBottom: expandRow === r.id ? 'none' : '1px solid #F0EAE3', height: 56, cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      onClick={() => setExpandRow(expandRow === r.id ? null : r.id)}
                    >
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{new Date(r.receipt_date).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '0 16px', fontFamily: 'monospace', fontSize: 14, color: '#7A6A5F' }}>{r.bill_number ?? r.grn_number ?? '—'}</td>
                      <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{r.supplier_name}</td>
                      {/* Part D: Items column */}
                      <td style={{ padding: '0 16px', color: '#7A6A5F', fontSize: 14 }}>{itemsSummary(r)}</td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#E8590C', fontWeight: 700 }}>{inr(r.grandTotal ?? r.grand_total ?? 0)}</td>
                      <td style={{ padding: '0 16px' }}><PayStatusPill status={r.payment_status} /></td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{r.received_by_name}</td>
                      {isAdmin && (
                        <td style={{ padding: '0 8px' }} onClick={(e) => e.stopPropagation()}>
                          <OwnerActions onEdit={() => openEdit(r)} onDelete={() => setDeleteTarget(r)} editLabel="Record payment" />
                        </td>
                      )}
                    </tr>
                    {/* Expanded row with full item table */}
                    {expandRow === r.id && (
                      <tr key={`${r.id}-expanded`} style={{ borderBottom: '1px solid #F0EAE3' }}>
                        <td colSpan={isAdmin ? 8 : 7} style={{ padding: '0 16px 12px 32px', background: '#FDFAF6' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #EADFD0' }}>
                                {['Item', 'Qty', 'Unit', 'Rate', 'Amount'].map((h) => (
                                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: '#7A6A5F' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(r.items ?? []).map((item: Record<string, unknown>, i: number) => (
                                <tr key={i}>
                                  <td style={{ padding: '6px 12px', color: '#1F1611' }}>{String(item.raw_material_name ?? item.item_name ?? '—')}</td>
                                  <td style={{ padding: '6px 12px', fontVariantNumeric: 'tabular-nums', color: '#1F1611' }}>{String(item.quantity_received ?? item.quantity ?? 0)}</td>
                                  <td style={{ padding: '6px 12px', color: '#7A6A5F' }}>{String(item.unit ?? '—')}</td>
                                  <td style={{ padding: '6px 12px', fontVariantNumeric: 'tabular-nums', color: '#7A6A5F' }}>{inr(Number(item.rate ?? 0))}</td>
                                  <td style={{ padding: '6px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#E8590C' }}>{inr(Number(item.line_amount ?? (Number(item.quantity_received ?? item.quantity ?? 0) * Number(item.rate ?? 0))))}</td>
                                </tr>
                              ))}
                              {(r.items ?? []).length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '8px 12px', color: '#C4B5A8' }}>No line items recorded</td></tr>
                              )}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {receipts.length === 0 && (
                  <tr><td colSpan={isAdmin ? 8 : 7} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>No purchases yet. Click "+ New Purchase" to add one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
