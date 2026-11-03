import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import PageHeader          from '@/components/common/PageHeader';
import { Card }            from '@/components/common/Card';
import OwnerActions        from '@/components/common/OwnerActions';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import EditDrawer, {
  DrawerField, DrawerInput, DrawerTextarea, DrawerSection,
} from '@/components/common/EditDrawer';
import ToastList from '@/components/common/Toast';
import { orderApi, customerApi } from '@/api';
import { useAuthStore }    from '@/store/authStore';
import { useToast }        from '@/hooks/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Order = Record<string, any>;

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function OrdersPage() {
  const { user }         = useAuthStore();
  const isAdmin          = user?.role === 'admin';
  const canCreate        = ['admin','manager','cashier'].includes(user?.role ?? '');
  const { toasts, show } = useToast();

  const [orders,       setOrders]       = useState<Order[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customers,    setCustomers]    = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editTarget,   setEditTarget]   = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [actionError,  setActionError]  = useState('');
  const [isNew,        setIsNew]        = useState(false);

  // Form fields — simplified, no status (Part 1a), Pickup/Delivery only (Part B)
  const [fCustomer,    setFCustomer]    = useState('');
  const [fCustomerId,  setFCustomerId]  = useState<number | null>(null);
  const [fType,        setFType]        = useState<'pickup' | 'delivery'>('pickup');
  const [fDate,        setFDate]        = useState('');
  const [fAddress,     setFAddress]     = useState('');
  const [fTotal,       setFTotal]       = useState('');
  const [fAdvance,     setFAdvance]     = useState('');
  const [fNotes,       setFNotes]       = useState('');

  async function load() {
    setLoading(true);
    try {
      const [ordRes, custRes] = await Promise.all([orderApi.list(), customerApi.list()]);
      setOrders(ordRes.data);
      setCustomers(custRes.data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setIsNew(true); setEditTarget(null);
    setFCustomer(''); setFCustomerId(null);
    setFType('pickup'); setFDate(''); setFAddress('');
    setFTotal(''); setFAdvance(''); setFNotes('');
    setActionError('');
  }

  function openEdit(o: Order) {
    setIsNew(false); setEditTarget(o);
    setFCustomer(o.customerName ?? '');
    setFCustomerId(o.customerId ?? null);
    setFType(o.deliveryType === 'delivery' ? 'delivery' : 'pickup');
    setFDate(o.deliveryDate ?? o.pickupDate ?? '');
    setFAddress(o.deliveryAddress ?? '');
    setFTotal(o.totalAmount != null ? String(o.totalAmount) : '');
    setFAdvance(o.advancePaid != null ? String(o.advancePaid) : '0');
    setFNotes(o.notes ?? o.customisationNotes ?? '');
    setActionError('');
  }

  async function handleSave() {
    if (!fDate) { setActionError('Date is required'); return; }
    if (fType === 'delivery' && !fAddress.trim()) { setActionError('Delivery address is required'); return; }
    if (!fTotal) { setActionError('Total amount is required'); return; }
    setSaving(true); setActionError('');

    const total   = parseFloat(fTotal) || 0;
    const advance = parseFloat(fAdvance) || 0;
    const payload = {
      customerId:          fCustomerId ?? undefined,
      customerName:        fCustomer,
      deliveryType:        fType,
      orderType:           fType,
      pickupDate:          fType === 'pickup'   ? fDate : undefined,
      deliveryDate:        fType === 'delivery' ? fDate : undefined,
      deliveryAddress:     fType === 'delivery' ? fAddress : undefined,
      totalAmount:         total,
      advancePaid:         advance,
      balanceDue:          total - advance,
      customisationNotes:  fNotes,
      notes:               fNotes,
    };

    try {
      if (isNew) {
        await orderApi.create(payload);
        show('Order created');
      } else if (editTarget) {
        await orderApi.updateStatus(editTarget.id, payload);
        show('Order updated');
      }
      setEditTarget(null); setIsNew(false);
      await load();
    } catch (e: unknown) {
      setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleDelete(o: Order) {
    setDeleteTarget(null);
    try {
      await orderApi.delete(o.id);
      show('Order deleted'); await load();
    } catch (e: unknown) {
      show((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Delete failed', 'error');
    }
  }

  const drawerOpen = isNew || !!editTarget;

  return (
    <div>
      <ToastList toasts={toasts} />
      <PageHeader
        title="Orders"
        subtitle="Custom cakes and bulk orders — Pickup or Delivery"
        actions={
          canCreate ? (
            <button
              onClick={openNew}
              style={{ height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={18} /> New Order
            </button>
          ) : undefined
        }
      />

      <EditDrawer
        title={isNew ? 'New Order' : `Edit Order: ${editTarget?.orderNumber ?? ''}`}
        open={drawerOpen}
        onClose={() => { setEditTarget(null); setIsNew(false); }}
        onSave={handleSave}
        saving={saving}
        error={actionError}
      >
        <DrawerSection title="Customer" />
        <DrawerField label="Customer Name" required>
          <input
            type="text"
            value={fCustomer}
            onChange={(e) => setFCustomer(e.target.value)}
            list="order-customers"
            placeholder="Search customer…"
            style={{ width: '100%', height: 48, fontSize: 16, padding: '0 14px', border: '1.5px solid #EADFD0', borderRadius: 12, background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box' as const }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#EADFD0';
              const match = customers.find((c) => c.name === e.currentTarget.value);
              if (match) setFCustomerId(match.id);
            }}
          />
          <datalist id="order-customers">
            {customers.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
        </DrawerField>

        <DrawerSection title="Order type" />
        {/* Part B: Pickup / Delivery only — no Custom / Bulk */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {(['pickup', 'delivery'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFType(t)}
              style={{
                height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
                fontSize: 16, fontWeight: 600, textTransform: 'capitalize',
                background: fType === t ? '#E8590C' : '#FBF6EE',
                color:      fType === t ? '#fff'     : '#7A6A5F',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <DrawerField label="Pickup / Delivery Date" required>
          <DrawerInput type="date" value={fDate} onChange={setFDate} />
        </DrawerField>

        {fType === 'delivery' && (
          <DrawerField label="Delivery Address" required>
            <DrawerTextarea value={fAddress} onChange={setFAddress} placeholder="Full address…" rows={2} />
          </DrawerField>
        )}

        <DrawerSection title="Payment" />
        <DrawerField label="Total Amount (₹)" required>
          <DrawerInput type="number" value={fTotal} onChange={setFTotal} placeholder="e.g. 1800" />
        </DrawerField>
        <DrawerField label="Advance Paid (₹)">
          <DrawerInput type="number" value={fAdvance} onChange={setFAdvance} placeholder="0" />
        </DrawerField>
        {fTotal && (
          <p style={{ fontSize: 14, color: '#7A6A5F', marginBottom: 12 }}>
            Balance due: <strong style={{ color: '#C0392B' }}>
              {inr(Math.max(0, (parseFloat(fTotal) || 0) - (parseFloat(fAdvance) || 0)))}
            </strong>
          </p>
        )}

        <DrawerField label="Notes">
          <DrawerTextarea value={fNotes} onChange={setFNotes} placeholder="Cake message, design notes…" rows={3} />
        </DrawerField>
      </EditDrawer>

      {deleteTarget && (
        <ConfirmDeleteDialog
          recordName={`Order: ${deleteTarget.orderNumber}`}
          requireReason
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <Card>
        {loading ? <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>Loading…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
              <thead>
                <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                  {['Order No.', 'Customer', 'Type', 'Pickup / Delivery Date', 'Total', 'Balance Due',
                    ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const date = o.deliveryDate ?? o.pickupDate ?? o.delivery_date ?? o.pickup_date;
                  const typeLabel = (o.deliveryType ?? o.orderType ?? 'pickup').replace('_', ' ');
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '0 16px', fontFamily: 'monospace', fontSize: 14, color: '#7A6A5F' }}>{o.orderNumber}</td>
                      <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{o.customerName}</td>
                      <td style={{ padding: '0 16px' }}>
                        <span style={{ background: typeLabel === 'delivery' ? '#E3F4F4' : '#FFF1DC', color: typeLabel === 'delivery' ? '#1E8E94' : '#D9822B', borderRadius: 9999, padding: '2px 10px', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                          {typeLabel}
                        </span>
                      </td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{date ?? '—'}</td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#E8590C', fontWeight: 700 }}>{inr(o.totalAmount ?? 0)}</td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: (o.balanceDue ?? 0) > 0 ? '#C0392B' : '#4F7F4A', fontWeight: 600 }}>{inr(o.balanceDue ?? 0)}</td>
                      {isAdmin && (
                        <td style={{ padding: '0 8px' }}>
                          <OwnerActions onEdit={() => openEdit(o)} onDelete={() => setDeleteTarget(o)} />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 6} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>No orders yet. Click "+ New Order" to add one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
