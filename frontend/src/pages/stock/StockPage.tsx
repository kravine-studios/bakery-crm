/**
 * Stock page — Part 5.3
 *
 * Shows per-product: In Store, At Counter, Total, Low-stock level, Nearest Expiry.
 * Admin actions: Move to Counter, Return to Store, Adjust (reason required), Wastage.
 * Manager: view-only.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Sliders, Trash2, RefreshCw } from 'lucide-react';
import PageHeader        from '@/components/common/PageHeader';
import { Card }          from '@/components/common/Card';
import ViewOnlyBadge     from '@/components/common/ViewOnlyBadge';
import EditDrawer, {
  DrawerField, DrawerInput, DrawerSelect, DrawerTextarea, DrawerSection,
} from '@/components/common/EditDrawer';
import Toast             from '@/components/common/Toast';
import { stockApi }      from '@/api';
import { useAuthStore }  from '@/store/authStore';
import { useToast }      from '@/hooks/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StockRow = Record<string, any>;

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type ActionType = 'move' | 'return' | 'adjust' | 'wastage';

const wastageReasonOptions = [
  { value: 'expired',           label: 'Expired' },
  { value: 'damaged',           label: 'Damaged' },
  { value: 'sampling',          label: 'Sampling' },
  { value: 'spillage',          label: 'Spillage' },
  { value: 'staff_consumption', label: 'Staff Consumption' },
];

export default function StockPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { toasts, show } = useToast();

  const [tab,          setTab]          = useState<'finished' | 'expired' | 'wastage'>('finished');
  const [data,         setData]         = useState<StockRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [actionError,  setActionError]  = useState('');

  // Action drawer state
  const [actionTarget, setActionTarget] = useState<StockRow | null>(null);
  const [actionType,   setActionType]   = useState<ActionType>('move');
  const [actionQty,    setActionQty]    = useState('');
  const [actionReason, setActionReason] = useState('');
  const [saving,       setSaving]       = useState(false);

  async function load() {
    setLoading(true);
    const fetch = tab === 'finished' ? stockApi.finished()
      : tab === 'expired' ? stockApi.expired()
      : stockApi.listWastage();
    try { const r = await fetch; setData(r.data); }
    catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tab]);

  function openAction(row: StockRow, type: ActionType) {
    setActionTarget(row);
    setActionType(type);
    setActionQty('');
    setActionReason('');
    setActionError('');
  }

  async function handleAction() {
    if (!actionTarget) return;
    if (!actionQty || parseFloat(actionQty) <= 0) {
      setActionError('Enter a positive quantity.');
      return;
    }
    if ((actionType === 'adjust' || actionType === 'wastage') && !actionReason.trim()) {
      setActionError('A reason is required.');
      return;
    }

    setSaving(true); setActionError('');
    try {
      const qty = parseFloat(actionQty);
      if (actionType === 'move') {
        await stockApi.moveToCounter({
          productId: actionTarget.product_id,
          batchId:   actionTarget.batch_id ?? undefined,
          quantity:  qty,
        });
      } else if (actionType === 'return') {
        await stockApi.returnToStore({
          productId: actionTarget.product_id,
          batchId:   actionTarget.batch_id ?? undefined,
          quantity:  qty,
        });
      } else if (actionType === 'wastage') {
        await stockApi.wastage({
          productId: actionTarget.product_id,
          batchId:   actionTarget.batch_id ?? undefined,
          quantity:  qty,
          unit:      actionTarget.selling_unit ?? 'piece',
          reason:    actionReason,
        });
      } else {
        await stockApi.adjust({
          productId:          actionTarget.product_id,
          batchId:            actionTarget.batch_id ?? undefined,
          adjustmentQuantity: qty,
          unit:               actionTarget.selling_unit ?? 'piece',
          reason:             actionReason,
        });
      }
      setActionTarget(null);
        show(
          actionType === 'move' ? 'Moved to counter' :
          actionType === 'return' ? 'Returned to store' :
          actionType === 'wastage' ? 'Wastage recorded' : 'Stock adjusted',
          'success',
        );
      await load();
    } catch (e: unknown) {
      setActionError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Action failed'
      );
    } finally { setSaving(false); }
  }

  const drawerTitle: Record<ActionType, string> = {
    move:    'Move to Counter',
    return:  'Return to Store',
    adjust:  'Adjust Stock',
    wastage: 'Record Wastage',
  };

  return (
    <div>
      <Toast toasts={toasts} />
      <PageHeader
        title="Stock"
        subtitle="Store stock and counter stock per product"
      />
      <ViewOnlyBadge />

      {actionError && !actionTarget && (
        <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#C0392B', fontSize: 15 }}>
          {actionError}
        </div>
      )}

      {/* Action drawer */}
      {actionTarget && (
        <EditDrawer
          title={`${drawerTitle[actionType]}: ${actionTarget.product_name}`}
          open
          onClose={() => setActionTarget(null)}
          onSave={handleAction}
          saving={saving}
          error={actionError}
        >
          <DrawerSection title="Details" />
          <DrawerField label="Product">
            <DrawerInput value={actionTarget.product_name ?? ''} onChange={() => {}} disabled />
          </DrawerField>
          {actionTarget.batch_number && (
            <DrawerField label="Batch">
              <DrawerInput value={actionTarget.batch_number} onChange={() => {}} disabled />
            </DrawerField>
          )}

          {actionType === 'move' && (
            <DrawerField label="Available in Store" hint="Cannot move more than available.">
              <DrawerInput value={`${parseFloat(actionTarget.store_qty ?? actionTarget.currentStock ?? 0).toFixed(2)} ${actionTarget.selling_unit ?? ''}`} onChange={() => {}} disabled />
            </DrawerField>
          )}
          {actionType === 'return' && (
            <DrawerField label="Available at Counter">
              <DrawerInput value={`${parseFloat(actionTarget.counter_qty ?? 0).toFixed(2)} ${actionTarget.selling_unit ?? ''}`} onChange={() => {}} disabled />
            </DrawerField>
          )}

          <DrawerField label="Quantity" required hint={`Unit: ${actionTarget.selling_unit ?? 'piece'}`}>
            <DrawerInput type="number" value={actionQty} onChange={setActionQty} placeholder="e.g. 5" />
          </DrawerField>

          {(actionType === 'adjust' || actionType === 'wastage') && (
            <DrawerField label="Reason" required>
              {actionType === 'wastage' ? (
                <DrawerSelect value={actionReason} onChange={setActionReason} options={wastageReasonOptions} />
              ) : (
                <DrawerTextarea value={actionReason} onChange={setActionReason} placeholder="Why is this quantity being adjusted?" rows={2} />
              )}
            </DrawerField>
          )}
        </EditDrawer>
      )}

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['finished', 'expired', 'wastage'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ height: 40, padding: '0 18px', borderRadius: 10, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', textTransform: 'capitalize', background: tab === t ? '#E8590C' : '#FBF6EE', color: tab === t ? '#fff' : '#7A6A5F' }}>
            {t === 'finished' ? 'Finished Goods' : t}
          </button>
        ))}
        {isAdmin && (
          <button onClick={() => load()} style={{ marginLeft: 'auto', height: 40, padding: '0 14px', borderRadius: 10, fontSize: 15, border: '1px solid #EADFD0', background: '#fff', color: '#7A6A5F', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} /> Refresh
          </button>
        )}
      </div>

      <Card>
        {loading ? (
          <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
              <thead>
                <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                  {(tab === 'finished'
                    // Part 5.3: Store, Counter, Total, Low-stock, Expiry columns
                    ? ['Product', 'Batch', 'In Store', 'At Counter', 'Total', 'Low-stock Level', 'Nearest Expiry']
                    : tab === 'expired'
                    ? ['Product', 'Batch', 'Expiry', 'Stock']
                    : ['Product', 'Reason', 'Quantity', 'Cost Value', 'Date']
                  ).concat(isAdmin && tab === 'finished' ? ['Actions'] : []).map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const storeQty   = parseFloat(row.store_qty   ?? 0);
                  const counterQty = parseFloat(row.counter_qty ?? 0);
                  const totalQty   = parseFloat(row.currentStock ?? storeQty + counterQty);
                  const lowLevel   = parseFloat(row.low_stock_level ?? row.lowStockLevel ?? 0);
                  const isLow      = lowLevel > 0 && counterQty <= lowLevel;

                  return (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {tab === 'finished' && (
                        <>
                          <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{row.product_name}</td>
                          <td style={{ padding: '0 16px', fontFamily: 'monospace', fontSize: 14, color: '#7A6A5F', whiteSpace: 'nowrap' }}>{row.batch_number ?? '—'}</td>
                          <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#1E8E94', fontWeight: 600 }}>
                            {storeQty.toFixed(2)} {row.selling_unit}
                          </td>
                          <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: isLow ? '#D9822B' : '#1F1611', fontWeight: isLow ? 700 : 400 }}>
                            {counterQty.toFixed(2)} {row.selling_unit}
                            {isLow && <span style={{ marginLeft: 6, fontSize: 12, background: '#FFF1DC', color: '#D9822B', borderRadius: 6, padding: '1px 6px' }}>Low</span>}
                          </td>
                          <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#1F1611' }}>
                            {totalQty.toFixed(2)} {row.selling_unit}
                          </td>
                          <td style={{ padding: '0 16px', color: lowLevel > 0 ? '#C98B4B' : '#C4B5A8' }}>
                            {lowLevel > 0 ? `${lowLevel} ${row.selling_unit}` : '—'}
                          </td>
                          <td style={{ padding: '0 16px', color: row.expiry_date && new Date(row.expiry_date) < new Date() ? '#C0392B' : '#7A6A5F' }}>
                            {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '0 8px' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  onClick={() => openAction(row, 'move')}
                                  title="Move to counter"
                                  aria-label="Move to counter"
                                  style={{ height: 34, padding: '0 10px', borderRadius: 8, border: 'none', background: '#E3F4F4', color: '#1E8E94', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}
                                >
                                  <ArrowRight size={14} /> Counter
                                </button>
                                <button
                                  onClick={() => openAction(row, 'return')}
                                  title="Return to store"
                                  aria-label="Return to store"
                                  style={{ height: 34, padding: '0 10px', borderRadius: 8, border: 'none', background: '#FBF6EE', color: '#7A6A5F', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}
                                >
                                  <ArrowLeft size={14} /> Store
                                </button>
                                <button
                                  onClick={() => openAction(row, 'adjust')}
                                  title="Adjust stock"
                                  aria-label="Adjust stock"
                                  style={{ height: 34, width: 34, borderRadius: 8, border: 'none', background: '#FBF6EE', color: '#7A6A5F', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Sliders size={15} />
                                </button>
                                <button
                                  onClick={() => openAction(row, 'wastage')}
                                  title="Record wastage"
                                  aria-label="Record wastage"
                                  style={{ height: 34, width: 34, borderRadius: 8, border: 'none', background: '#FDE5E0', color: '#C8503A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          )}
                        </>
                      )}
                      {tab === 'expired' && (
                        <>
                          <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{row.product_name}</td>
                          <td style={{ padding: '0 16px', fontFamily: 'monospace', fontSize: 14, color: '#7A6A5F', whiteSpace: 'nowrap' }}>{row.batch_number ?? '—'}</td>
                          <td style={{ padding: '0 16px', color: '#C0392B' }}>
                            {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#1F1611' }}>
                            {parseFloat(row.currentStock ?? 0).toFixed(2)}
                          </td>
                        </>
                      )}
                      {tab === 'wastage' && (
                        <>
                          <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{row.product_name}</td>
                          <td style={{ padding: '0 16px', textTransform: 'capitalize', color: '#7A6A5F' }}>{(row.reason ?? '').replace('_', ' ')}</td>
                          <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#1F1611' }}>{parseFloat(row.quantity ?? 0).toFixed(2)} {row.unit}</td>
                          <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#C0392B', fontWeight: 700 }}>{inr(row.costValue ?? 0)}</td>
                          <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
