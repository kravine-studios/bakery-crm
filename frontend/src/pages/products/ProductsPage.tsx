import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import PageHeader          from '@/components/common/PageHeader';
import { Card }            from '@/components/common/Card';
import ViewOnlyBadge       from '@/components/common/ViewOnlyBadge';
import OwnerActions        from '@/components/common/OwnerActions';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import EditDrawer, {
  DrawerField, DrawerInput, DrawerSelect, DrawerSection,
} from '@/components/common/EditDrawer';
import { productApi }      from '@/api';
import { useAuthStore }    from '@/store/authStore';

interface Product {
  id:             number;
  name:           string;
  productCode?:   string;
  productType:    'produced' | 'traded';
  sellingPrice:   number;
  costPrice:      number;
  gstRate:        number | null;      // optional — null = no tax
  sellingUnit:    string | null;      // optional — null = piece
  isActive:       boolean;
  sku:            string | null;
  foodType:       string;
  hsnCode:        string | null;
  shelfLifeDays:  number | null;
  lowStockLevel?: number | null;      // Part 2
}

// Optional unit list — blank option means "piece"
const unitOptions = [
  { value: '', label: '— (piece)' },
  ...['piece', 'kg', 'gram', 'box', 'dozen', 'litre', 'ml', 'packet'].map((v) => ({ value: v, label: v })),
];

// Optional GST — blank means no tax
const gstOptions = [
  { value: '', label: '— (no GST)' },
  ...['0', '5', '12', '18', '28'].map((v) => ({ value: v, label: `${v}%` })),
];

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
}

export default function ProductsPage() {
  const { user } = useAuthStore();
  const isAdmin  = user?.role === 'admin';

  const [products,     setProducts]     = useState<Product[]>([]);
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [editTarget,   setEditTarget]   = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [actionError,  setActionError]  = useState('');

  // Edit form state
  const [editName,      setEditName]      = useState('');
  const [editPrice,     setEditPrice]     = useState('');
  const [editCost,      setEditCost]      = useState('');
  const [editGst,       setEditGst]       = useState('');    // '' = no GST
  const [editUnit,      setEditUnit]      = useState('');    // '' = piece
  const [editHsn,       setEditHsn]       = useState('');
  const [editFood,      setEditFood]      = useState('veg');
  const [editShelf,     setEditShelf]     = useState('');
  const [editSku,       setEditSku]       = useState('');
  const [editLowStock,  setEditLowStock]  = useState('');    // Part 2

  async function load() {
    setLoading(true);
    try {
      const res = await productApi.list({ search: search || undefined });
      setProducts(res.data);
    } catch { /* interceptor handles */ }
    finally   { setLoading(false); }
  }

  useEffect(() => { load(); }, [search]);

  function openEdit(p: Product) {
    setEditTarget(p);
    setEditName(p.name);
    setEditPrice(String(p.sellingPrice));
    setEditCost(String(p.costPrice));
    setEditGst(p.gstRate != null ? String(p.gstRate) : '');
    setEditUnit(p.sellingUnit ?? '');
    setEditHsn(p.hsnCode ?? '');
    setEditFood(p.foodType ?? 'veg');
    setEditShelf(p.shelfLifeDays != null ? String(p.shelfLifeDays) : '');
    setEditSku(p.sku ?? '');
    setEditLowStock(p.lowStockLevel != null ? String(p.lowStockLevel) : '');
    setActionError('');
  }

  async function handleSave() {
    if (!editTarget) return;
    setSaving(true); setActionError('');
    try {
      await productApi.update(editTarget.id, {
        name:          editName,
        sellingPrice:  parseFloat(editPrice),
        costPrice:     parseFloat(editCost),
        gstRate:       editGst !== '' ? parseFloat(editGst) : null,
        sellingUnit:   editUnit !== '' ? editUnit : null,
        hsnCode:       editHsn || undefined,
        foodType:      editFood,
        shelfLifeDays: editShelf ? parseInt(editShelf, 10) : null,
        sku:           editSku || undefined,
        lowStockLevel: editLowStock ? parseFloat(editLowStock) : null,
      });
      setEditTarget(null);
      await load();
    } catch (e: unknown) {
      setActionError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed'
      );
    } finally { setSaving(false); }
  }

  async function handleDelete(product: Product) {
    setDeleteTarget(null); setActionError('');
    try {
      await productApi.update(product.id, { isActive: false });
      await load();
    } catch (e: unknown) {
      setActionError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Delete failed'
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Ready-to-sell items — GST and Unit are optional"
        actions={
          isAdmin ? (
            <button style={{ height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={18} strokeWidth={2.5} />
              Add Product
            </button>
          ) : undefined
        }
      />
      <ViewOnlyBadge />

      {actionError && (
        <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#C0392B', fontSize: 15 }}>
          {actionError}
        </div>
      )}

      {/* Edit drawer */}
      <EditDrawer
        title={`Edit Product: ${editTarget?.name ?? ''}`}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSave}
        saving={saving}
        error={actionError}
      >
        <DrawerSection title="Identity" />
        <DrawerField label="Name" required>
          <DrawerInput value={editName} onChange={setEditName} placeholder="Product name" />
        </DrawerField>
        <DrawerField label="SKU / Barcode">
          <DrawerInput value={editSku} onChange={setEditSku} placeholder="e.g. KK-001" />
        </DrawerField>
        <DrawerField label="HSN Code">
          <DrawerInput value={editHsn} onChange={setEditHsn} placeholder="e.g. 2106" />
        </DrawerField>

        <DrawerSection title="Pricing" />
        <DrawerField label="Selling Price (₹)" required>
          <DrawerInput type="number" value={editPrice} onChange={setEditPrice} placeholder="e.g. 850" />
        </DrawerField>
        <DrawerField label="Cost Price (₹)">
          <DrawerInput type="number" value={editCost} onChange={setEditCost} placeholder="e.g. 400" />
        </DrawerField>
        <DrawerField label="GST Rate" hint="Leave blank if this item has no GST.">
          <DrawerSelect value={editGst} onChange={setEditGst} options={gstOptions} />
        </DrawerField>

        <DrawerSection title="Classification" />
        <DrawerField label="Selling Unit" hint="Leave blank to default to 'piece'.">
          <DrawerSelect value={editUnit} onChange={setEditUnit} options={unitOptions} />
        </DrawerField>
        <DrawerField label="Food Type">
          <DrawerSelect value={editFood} onChange={setEditFood} options={[{ value: 'veg', label: 'Veg' }, { value: 'non_veg', label: 'Non-Veg' }, { value: 'egg', label: 'Egg' }]} />
        </DrawerField>
        <DrawerField label="Shelf Life (days)" hint="Leave blank if no expiry.">
          <DrawerInput type="number" value={editShelf} onChange={setEditShelf} placeholder="e.g. 7" />
        </DrawerField>
        <DrawerField label="Low-stock level" hint="Billing shows 'Low' warning at or below this counter quantity.">
          <DrawerInput type="number" value={editLowStock} onChange={setEditLowStock} placeholder="e.g. 2" />
        </DrawerField>
      </EditDrawer>

      {/* Confirm delete */}
      {deleteTarget && (
        <ConfirmDeleteDialog
          recordName={`Product: ${deleteTarget.name}`}
          requireReason={true}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <Card>
        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            style={{ width: '100%', height: 48, fontSize: 16, padding: '0 16px', border: '1.5px solid #EADFD0', borderRadius: 12, background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box' as const }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
            onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
          />
        </div>

        {loading ? (
          <p style={{ padding: '32px 0', textAlign: 'center', color: '#7A6A5F', fontSize: 17 }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
              <thead>
                <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                  {/* Code column first (Part 2) */}
                  {['Code', 'Name', 'Type', 'Selling Price', 'Cost', 'GST', 'Unit', 'Low Stock', 'Active',
                    ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '0 16px', fontFamily: 'monospace', color: '#7A6A5F', fontSize: 14 }}>
                      {p.productCode ?? '—'}
                    </td>
                    <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{p.name}</td>
                    <td style={{ padding: '0 16px' }}>
                      <span style={{ background: p.productType === 'produced' ? '#E3F4F4' : '#FFF1DC', color: p.productType === 'produced' ? '#1E8E94' : '#D9822B', borderRadius: 9999, padding: '2px 10px', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                        {p.productType}
                      </span>
                    </td>
                    <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#E8590C', fontWeight: 700 }}>{inr(p.sellingPrice)}</td>
                    <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#7A6A5F' }}>{inr(p.costPrice)}</td>
                    {/* GST: show — if null/undefined */}
                    <td style={{ padding: '0 16px', color: p.gstRate != null ? '#1F1611' : '#C4B5A8' }}>
                      {p.gstRate != null ? `${p.gstRate}%` : '—'}
                    </td>
                    {/* Unit: show — if null/undefined */}
                    <td style={{ padding: '0 16px', color: p.sellingUnit ? '#7A6A5F' : '#C4B5A8', textTransform: 'capitalize' }}>
                      {p.sellingUnit ?? '—'}
                    </td>
                    <td style={{ padding: '0 16px', color: p.lowStockLevel != null ? '#D9822B' : '#C4B5A8', fontVariantNumeric: 'tabular-nums' }}>
                      {p.lowStockLevel != null ? String(p.lowStockLevel) : '—'}
                    </td>
                    <td style={{ padding: '0 16px' }}>
                      {p.isActive
                        ? <span style={{ color: '#4F7F4A', fontWeight: 600 }}>✓</span>
                        : <span style={{ color: '#C0392B', fontWeight: 600 }}>✗</span>}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '0 8px' }}>
                        <OwnerActions
                          onEdit={() => openEdit(p)}
                          onDelete={() => setDeleteTarget(p)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 9} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>
                      No products found
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
