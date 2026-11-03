import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import PageHeader          from '@/components/common/PageHeader';
import { Card }            from '@/components/common/Card';
import ViewOnlyBadge       from '@/components/common/ViewOnlyBadge';
import OwnerActions        from '@/components/common/OwnerActions';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import EditDrawer, {
  DrawerField, DrawerInput, DrawerSelect, DrawerTextarea, DrawerSection,
} from '@/components/common/EditDrawer';
import Toast               from '@/components/common/Toast';
import { productionApi, productApi } from '@/api';
import { useAuthStore }    from '@/store/authStore';
import { useToast }        from '@/hooks/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Batch = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProductOption = { value: string; label: string; unit: string; sellingPrice: any };

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function ProductionPage() {
  const { user } = useAuthStore();
  const isAdmin  = user?.role === 'admin';
  const { toasts, show } = useToast();

  const [batches,       setBatches]       = useState<Batch[]>([]);
  const [products,      setProducts]      = useState<ProductOption[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [isNew,         setIsNew]         = useState(false);
  const [editTarget,    setEditTarget]    = useState<Batch | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<Batch | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [actionError,   setActionError]   = useState('');

  // Form fields
  const [editProductId,    setEditProductId]    = useState('');
  const [editProducedQty,  setEditProducedQty]  = useState('');
  const [editCostPerKg,    setEditCostPerKg]    = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editExpiryDate,   setEditExpiryDate]   = useState('');
  const [editNotes,        setEditNotes]        = useState('');

  async function load() {
    setLoading(true);
    try {
      const [batchRes, productRes] = await Promise.all([
        productionApi.list(),
        productApi.list({ active: true }),
      ]);
      setBatches(batchRes.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setProducts((productRes.data as any[]).map((p) => ({
        value: String(p.id),
        label: p.name,
        unit: p.sellingUnit ?? p.unit ?? 'kg',
        sellingPrice: p.sellingPrice ?? p.selling_price,
      })));
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setIsNew(true);
    setEditTarget({} as Batch);
    setEditProductId(products[0]?.value ?? '');
    setEditProducedQty('');
    setEditCostPerKg('');
    setEditSellingPrice(products[0]?.sellingPrice ? String(products[0].sellingPrice) : '');
    setEditExpiryDate('');
    setEditNotes('');
    setActionError('');
  }

  function openEdit(b: Batch) {
    setIsNew(false);
    setEditTarget(b);
    setEditProductId(String(b.productId ?? ''));
    setEditProducedQty(b.produced_quantity ?? b.actualQuantity ?? b.plannedQuantity ?? '');
    setEditCostPerKg(b.cost_per_kg ?? b.costPerUnit ?? '');
    setEditSellingPrice(b.selling_price_per_unit ?? b.sellingPrice ?? '');
    setEditExpiryDate(b.expiryDate ? b.expiryDate.split('T')[0] : '');
    setEditNotes(b.notes ?? '');
    setActionError('');
  }

  async function handleSave() {
    if (!editProducedQty || parseFloat(editProducedQty) <= 0) {
      setActionError('Enter a valid quantity produced.');
      return;
    }
    setSaving(true); setActionError('');
    try {
      if (isNew) {
        if (!editProductId) { setActionError('Select a product.'); setSaving(false); return; }
        const product = products.find((p) => p.value === editProductId);
        await productionApi.create({
          productId:          parseInt(editProductId, 10),
          producedQuantity:   parseFloat(editProducedQty),
          costPerKg:          parseFloat(editCostPerKg) || 0,
          sellingPricePerUnit:parseFloat(editSellingPrice) || undefined,
          expiryDate:         editExpiryDate || undefined,
          notes:              editNotes,
          supervisorId:       1,
        });
        show(`Batch created for ${product?.label ?? 'product'}`, 'success');
      } else {
        if (!editTarget) return;
        await productionApi.complete(editTarget.id, {
          producedQuantity:    parseFloat(editProducedQty) || editTarget.actualQuantity,
          costPerKg:           parseFloat(editCostPerKg) || 0,
          sellingPricePerUnit: parseFloat(editSellingPrice) || undefined,
          expiryDate:          editExpiryDate || undefined,
          notes:               editNotes,
        });
        show('Batch updated', 'success');
      }
      setEditTarget(null);
      await load();
    } catch (e: unknown) {
      setActionError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed',
      );
    } finally { setSaving(false); }
  }

  async function handleDelete(b: Batch) {
    setDeleteTarget(null); setActionError('');
    try {
      await productionApi.complete(b.id, { producedQuantity: b.actualQuantity ?? 0 });
      show('Batch removed', 'success');
      await load();
    } catch (e: unknown) {
      setActionError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Delete failed',
      );
    }
  }

  // When product changes in the New form, prefill selling price
  function handleProductChange(val: string) {
    setEditProductId(val);
    const product = products.find((p) => p.value === val);
    if (product?.sellingPrice) setEditSellingPrice(String(product.sellingPrice));
  }

  const selectedProduct = products.find((p) => p.value === editProductId);

  return (
    <div>
      <Toast toasts={toasts} />
      <PageHeader
        title="Production"
        subtitle="Batch tracking — quantity produced lands in store stock"
        actions={
          isAdmin ? (
            <button
              onClick={openNew}
              style={{ height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={18} /> New Batch
            </button>
          ) : undefined
        }
      />
      <ViewOnlyBadge />

      {actionError && !editTarget && (
        <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#C0392B', fontSize: 15 }}>
          {actionError}
        </div>
      )}

      <EditDrawer
        title={isNew ? 'New Production Batch' : `Edit Batch: ${editTarget?.batchNumber ?? ''}`}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSave}
        saving={saving}
        error={actionError}
      >
        {isNew ? (
          <>
            <DrawerSection title="Batch details" />
            <DrawerField label="Product" required>
              <DrawerSelect
                value={editProductId}
                onChange={handleProductChange}
                options={products}
              />
            </DrawerField>
          </>
        ) : (
          <>
            <DrawerSection title="Batch details" />
            <DrawerField label="Batch No.">
              <DrawerInput value={editTarget?.batchNumber ?? ''} onChange={() => {}} disabled />
            </DrawerField>
            <DrawerField label="Product">
              <DrawerInput value={editTarget?.productName ?? ''} onChange={() => {}} disabled />
            </DrawerField>
          </>
        )}
        <DrawerSection title="Production quantities" />
        <DrawerField
          label="Quantity Produced"
          hint={`In ${selectedProduct?.unit ?? editTarget?.unit ?? 'kg'}. Saved quantity goes to store stock.`}
          required
        >
          <DrawerInput type="number" value={editProducedQty} onChange={setEditProducedQty} placeholder="e.g. 9.80" />
        </DrawerField>
        <DrawerField label="Cost to Make (₹ per unit)">
          <DrawerInput type="number" value={editCostPerKg} onChange={setEditCostPerKg} placeholder="e.g. 400" />
        </DrawerField>
        <DrawerField label={`Selling Price (₹ per ${selectedProduct?.unit ?? editTarget?.unit ?? 'unit'})`}>
          <DrawerInput type="number" value={editSellingPrice} onChange={setEditSellingPrice} placeholder="Pre-filled from product" />
        </DrawerField>
        <DrawerField label="Expiry Date" hint="Optional — leave blank if no expiry.">
          <DrawerInput type="date" value={editExpiryDate} onChange={setEditExpiryDate} />
        </DrawerField>
        <DrawerField label="Notes">
          <DrawerTextarea value={editNotes} onChange={setEditNotes} placeholder="Internal notes" rows={2} />
        </DrawerField>
      </EditDrawer>

      {deleteTarget && (
        <ConfirmDeleteDialog
          recordName={`Batch ${deleteTarget.batchNumber} (${deleteTarget.productName})`}
          requireReason
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <Card>
        {loading ? (
          <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
              <thead>
                <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                  {['Batch No.', 'Date', 'Product', 'Produced', 'Cost / unit', 'Selling / unit', 'Expiry', 'Produced By',
                    ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const qty     = b.produced_quantity ?? b.actualQuantity ?? b.plannedQuantity;
                  const costPer = b.cost_per_kg ?? b.costPerUnit ?? 0;
                  const sellPer = b.selling_price_per_unit;
                  return (
                    <tr
                      key={b.id}
                      style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '0 16px', fontFamily: 'monospace', fontSize: 14, color: '#7A6A5F' }}>{b.batchNumber}</td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>
                        {b.production_date || b.productionDate
                          ? new Date(b.production_date ?? b.productionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : '—'}
                      </td>
                      <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{b.productName}</td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#1F1611' }}>
                        {qty != null ? `${parseFloat(qty).toFixed(2)} ${b.unit}` : '—'}
                      </td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#7A6A5F' }}>
                        {costPer > 0 ? inr(costPer) : '—'}
                      </td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#E8590C', fontWeight: 600 }}>
                        {sellPer != null ? inr(sellPer) : '—'}
                      </td>
                      <td style={{ padding: '0 16px', color: b.expiryDate && new Date(b.expiryDate) < new Date() ? '#C0392B' : '#7A6A5F' }}>
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{b.supervisorName}</td>
                      {isAdmin && (
                        <td style={{ padding: '0 8px' }}>
                          <OwnerActions
                            onEdit={() => openEdit(b)}
                            onDelete={() => setDeleteTarget(b)}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>
                      No batches found
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
