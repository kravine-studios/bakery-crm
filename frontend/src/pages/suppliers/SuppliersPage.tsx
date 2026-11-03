import { useEffect, useState } from 'react';
import { Plus, X as XIcon } from 'lucide-react';
import PageHeader          from '@/components/common/PageHeader';
import { Card }            from '@/components/common/Card';
import ViewOnlyBadge       from '@/components/common/ViewOnlyBadge';
import OwnerActions        from '@/components/common/OwnerActions';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import EditDrawer, {
  DrawerField, DrawerInput, DrawerTextarea, DrawerSection,
} from '@/components/common/EditDrawer';
import ToastList from '@/components/common/Toast';
import { supplierApi, rawMaterialApi, productApi } from '@/api';
import { useAuthStore }    from '@/store/authStore';
import { useToast }        from '@/hooks/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supplier = Record<string, any>;
interface SuppliedItem { id?: number; itemName: string; unit: string; usualRate: string; }

export default function SuppliersPage() {
  const { user }         = useAuthStore();
  const isAdmin          = user?.role === 'admin';
  const { toasts, show } = useToast();

  const [suppliers,    setSuppliers]    = useState<Supplier[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products,     setProducts]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editTarget,   setEditTarget]   = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [actionError,  setActionError]  = useState('');
  const [isNew,        setIsNew]        = useState(false);

  const [fName,    setFName]    = useState('');
  const [fContact, setFContact] = useState('');
  const [fPhone,   setFPhone]   = useState('');
  const [fEmail,   setFEmail]   = useState('');
  const [fAddress, setFAddress] = useState('');
  const [fGstin,   setFGstin]   = useState('');
  const [fTerms,   setFTerms]   = useState('');
  const [fNotes,   setFNotes]   = useState('');
  const [fItems,   setFItems]   = useState<SuppliedItem[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [sRes, rmRes, pRes] = await Promise.all([supplierApi.list(true), rawMaterialApi.list(), productApi.list({ active: true })]);
      setSuppliers(sRes.data); setRawMaterials(rmRes.data); setProducts(pRes.data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function blank() { setFName(''); setFContact(''); setFPhone(''); setFEmail(''); setFAddress(''); setFGstin(''); setFTerms(''); setFNotes(''); setFItems([]); setActionError(''); }

  function openNew() { setIsNew(true); setEditTarget(null); blank(); }

  function openEdit(s: Supplier) {
    setIsNew(false); setEditTarget(s);
    setFName(s.name ?? ''); setFContact(s.contactPerson ?? ''); setFPhone(s.phone ?? '');
    setFEmail(s.email ?? ''); setFAddress(s.address ?? ''); setFGstin(s.gstin ?? '');
    setFTerms(s.paymentTerms ?? ''); setFNotes(s.ratingNotes ?? '');
    setFItems((s.suppliedItems ?? []).map((i: SuppliedItem) => ({ itemName: i.itemName ?? '', unit: i.unit ?? '', usualRate: i.usualRate != null ? String(i.usualRate) : '' })));
    setActionError('');
  }

  async function handleSave() {
    if (!fName.trim()) { setActionError('Supplier name is required'); return; }
    setSaving(true); setActionError('');
    const payload = {
      name: fName, contactPerson: fContact, phone: fPhone, email: fEmail || undefined,
      address: fAddress, gstin: fGstin, paymentTerms: fTerms, ratingNotes: fNotes,
      isActive: true,
      suppliedItems: fItems.filter((i) => i.itemName.trim()).map((i, idx) => ({ id: idx + 1, itemName: i.itemName, unit: i.unit, usualRate: i.usualRate ? parseFloat(i.usualRate) : null })),
    };
    try {
      if (isNew) { await supplierApi.create(payload); show('Supplier added'); }
      else       { await supplierApi.update(editTarget!.id, payload); show('Supplier updated'); }
      setEditTarget(null); setIsNew(false);
      await load();
    } catch (e: unknown) {
      setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleDelete(s: Supplier) {
    setDeleteTarget(null);
    try { await supplierApi.update(s.id, { isActive: false }); show('Supplier archived'); await load(); }
    catch (e: unknown) { show((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed', 'error'); }
  }

  // All item names for datalist
  const allItemNames = [...rawMaterials.map((r) => r.name), ...products.map((p) => p.name)];

  return (
    <div>
      <ToastList toasts={toasts} />
      <PageHeader title="Suppliers" subtitle="Supplier master and ledger"
        actions={isAdmin ? (
          <button onClick={openNew} style={{ height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={18} /> Add Supplier
          </button>
        ) : undefined}
      />
      <ViewOnlyBadge />

      <EditDrawer
        title={isNew ? 'New Supplier' : `Edit: ${editTarget?.name ?? ''}`}
        open={isNew || !!editTarget}
        onClose={() => { setEditTarget(null); setIsNew(false); }}
        onSave={handleSave} saving={saving} error={actionError}
      >
        <DrawerSection title="Basic details" />
        <DrawerField label="Name" required><DrawerInput value={fName} onChange={setFName} placeholder="Supplier name" /></DrawerField>
        <DrawerField label="Contact Person"><DrawerInput value={fContact} onChange={setFContact} placeholder="Contact name" /></DrawerField>
        <DrawerField label="Phone"><DrawerInput value={fPhone} onChange={setFPhone} placeholder="Phone" /></DrawerField>
        <DrawerField label="Email"><DrawerInput type="email" value={fEmail} onChange={setFEmail} placeholder="email@example.com" /></DrawerField>

        <DrawerSection title="Business details" />
        <DrawerField label="Address"><DrawerTextarea value={fAddress} onChange={setFAddress} placeholder="Full address" rows={2} /></DrawerField>
        <DrawerField label="GSTIN"><DrawerInput value={fGstin} onChange={setFGstin} placeholder="27XXXXX0000X1ZX" /></DrawerField>
        <DrawerField label="Payment Terms"><DrawerInput value={fTerms} onChange={setFTerms} placeholder="Net 15, COD, etc." /></DrawerField>
        <DrawerField label="Rating / Notes"><DrawerTextarea value={fNotes} onChange={setFNotes} placeholder="Quality, punctuality notes…" rows={2} /></DrawerField>

        <DrawerSection title="Products Supplied" />
        <p style={{ fontSize: 14, color: '#7A6A5F', marginBottom: 10 }}>Items this supplier provides. Shows as chips in the table.</p>
        {fItems.map((item, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 32px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input type="text" value={item.itemName} list="sup-items"
              onChange={(e) => setFItems((prev) => prev.map((x, i) => i === idx ? { ...x, itemName: e.target.value } : x))}
              placeholder="Item name"
              style={{ height: 40, fontSize: 15, padding: '0 10px', border: '1.5px solid #EADFD0', borderRadius: 10, background: '#FBF6EE', color: '#1F1611', outline: 'none' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')} onBlur={(e) => (e.currentTarget.style.borderColor = '#EADFD0')}
            />
            <input type="text" value={item.unit}
              onChange={(e) => setFItems((prev) => prev.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))}
              placeholder="Unit"
              style={{ height: 40, fontSize: 14, padding: '0 8px', border: '1.5px solid #EADFD0', borderRadius: 10, background: '#FBF6EE', color: '#1F1611', outline: 'none' }}
            />
            <input type="number" value={item.usualRate}
              onChange={(e) => setFItems((prev) => prev.map((x, i) => i === idx ? { ...x, usualRate: e.target.value } : x))}
              placeholder="Rate"
              style={{ height: 40, fontSize: 14, padding: '0 8px', border: '1.5px solid #EADFD0', borderRadius: 10, background: '#FBF6EE', color: '#1F1611', outline: 'none' }}
            />
            <button onClick={() => setFItems((prev) => prev.filter((_, i) => i !== idx))}
              style={{ height: 32, width: 32, borderRadius: 8, border: 'none', background: '#FDE5E0', color: '#C0392B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XIcon size={14} />
            </button>
          </div>
        ))}
        <datalist id="sup-items">{allItemNames.map((n) => <option key={n} value={n} />)}</datalist>
        <button onClick={() => setFItems((prev) => [...prev, { itemName: '', unit: '', usualRate: '' }])}
          style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1.5px dashed #EADFD0', background: 'none', color: '#E8590C', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Add item
        </button>
      </EditDrawer>

      {deleteTarget && (
        <ConfirmDeleteDialog recordName={`Supplier: ${deleteTarget.name}`} requireReason
          onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}

      <Card>
        {loading ? <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>Loading…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
              <thead>
                <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                  {['Name', 'Phone', 'GSTIN', 'Payment Terms', 'Supplies', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => {
                  const items: SuppliedItem[] = s.suppliedItems ?? [];
                  const chips = items.slice(0, 3);
                  const extra = items.length - 3;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>
                        {s.name}
                        {!s.isActive && <span style={{ marginLeft: 8, fontSize: 12, background: '#F3F4F6', color: '#7A6A5F', borderRadius: 6, padding: '1px 6px' }}>Inactive</span>}
                      </td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{s.phone ?? '—'}</td>
                      <td style={{ padding: '0 16px', fontFamily: 'monospace', fontSize: 14, color: '#7A6A5F' }}>{s.gstin ?? '—'}</td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{s.paymentTerms ?? '—'}</td>
                      {/* Part C: Supplies chips */}
                      <td style={{ padding: '0 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {chips.length > 0
                            ? chips.map((item, i) => (
                                <span key={i} style={{ background: '#FBF6EE', color: '#C98B4B', borderRadius: 9999, padding: '2px 10px', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                  {item.itemName}
                                </span>
                              ))
                            : <span style={{ color: '#C4B5A8', fontSize: 14 }}>—</span>
                          }
                          {extra > 0 && (
                            <span title={items.slice(3).map((i) => i.itemName).join(', ')}
                              style={{ background: '#F3F4F6', color: '#7A6A5F', borderRadius: 9999, padding: '2px 8px', fontSize: 13, cursor: 'help' }}>
                              +{extra}
                            </span>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '0 8px' }}>
                          <OwnerActions onEdit={() => openEdit(s)} onDelete={() => setDeleteTarget(s)} />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {suppliers.length === 0 && (
                  <tr><td colSpan={isAdmin ? 6 : 5} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>No suppliers yet. Click "+ Add Supplier" to add one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
