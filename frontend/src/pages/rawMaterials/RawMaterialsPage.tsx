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
import Toast               from '@/components/common/Toast';
import { rawMaterialApi }  from '@/api';
import { useAuthStore }    from '@/store/authStore';
import { useToast }        from '@/hooks/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Material = Record<string, any>;

const unitOptions = ['kg', 'litre', 'gram', 'ml', 'packet', 'box', 'dozen'].map((v) => ({ value: v, label: v }));
const costOptions = [{ value: 'avg', label: 'Weighted Average' }, { value: 'fifo', label: 'FIFO' }];

export default function RawMaterialsPage() {
  const { user }         = useAuthStore();
  const isAdmin          = user?.role === 'admin';
  const { toasts, show } = useToast();

  const [materials,    setMaterials]    = useState<Material[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [isNew,        setIsNew]        = useState(false);
  const [editTarget,   setEditTarget]   = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [actionError,  setActionError]  = useState('');

  const [editName,       setEditName]       = useState('');
  const [editUnit,       setEditUnit]       = useState('kg');
  const [editMinLevel,   setEditMinLevel]   = useState('');
  const [editCostMethod, setEditCostMethod] = useState('avg');
  const [editShelfLife,  setEditShelfLife]  = useState('');

  async function load() {
    setLoading(true);
    try { const r = await rawMaterialApi.list(true); setMaterials(r.data); }
    catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setIsNew(true);
    setEditTarget({} as Material);
    setEditName('');
    setEditUnit('kg');
    setEditMinLevel('');
    setEditCostMethod('avg');
    setEditShelfLife('');
    setActionError('');
  }

  function openEdit(m: Material) {
    setIsNew(false);
    setEditTarget(m);
    setEditName(m.name ?? '');
    setEditUnit(m.baseUnit ?? 'kg');
    setEditMinLevel(m.minStockLevel != null ? String(m.minStockLevel) : '');
    setEditCostMethod(m.costMethod ?? 'avg');
    setEditShelfLife(m.shelfLifeDays != null ? String(m.shelfLifeDays) : '');
    setActionError('');
  }

  async function handleSave() {
    if (!editName.trim()) { setActionError('Name is required.'); return; }
    setSaving(true); setActionError('');
    try {
      if (isNew) {
        await rawMaterialApi.create({
          name:          editName,
          baseUnit:      editUnit,
          minStockLevel: parseFloat(editMinLevel) || 0,
          costMethod:    editCostMethod,
          shelfLifeDays: editShelfLife ? parseInt(editShelfLife, 10) : null,
        });
        show(`${editName} added`, 'success');
      } else {
        if (!editTarget) return;
        await rawMaterialApi.update(editTarget.id, {
          name:          editName,
          baseUnit:      editUnit,
          minStockLevel: parseFloat(editMinLevel) || 0,
          costMethod:    editCostMethod,
          shelfLifeDays: editShelfLife ? parseInt(editShelfLife, 10) : null,
        });
        show(`${editName} updated`, 'success');
      }
      setEditTarget(null);
      await load();
    } catch (e: unknown) {
      setActionError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed',
      );
    } finally { setSaving(false); }
  }

  async function handleDelete(m: Material) {
    setDeleteTarget(null); setActionError('');
    try {
      await rawMaterialApi.update(m.id, { isActive: false });
      show(`${m.name} removed`, 'success');
      await load();
    } catch (e: unknown) {
      setActionError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Delete failed',
      );
    }
  }

  return (
    <div>
      <Toast toasts={toasts} />
      <PageHeader
        title="Raw Materials"
        subtitle="Manage raw material inventory and stock levels"
        actions={
          isAdmin ? (
            <button
              onClick={openNew}
              style={{ height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={18} /> Add Material
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
        title={isNew ? 'Add Raw Material' : `Edit: ${editTarget?.name ?? ''}`}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSave}
        saving={saving}
        error={actionError}
      >
        <DrawerSection title="Material details" />
        <DrawerField label="Name" required>
          <DrawerInput value={editName} onChange={setEditName} placeholder="e.g. Maida" />
        </DrawerField>
        <DrawerField label="Base Unit">
          <DrawerSelect value={editUnit} onChange={setEditUnit} options={unitOptions} />
        </DrawerField>
        <DrawerField label="Minimum Stock Level" hint="Alert triggers when stock falls below this.">
          <DrawerInput type="number" value={editMinLevel} onChange={setEditMinLevel} placeholder="e.g. 10" />
        </DrawerField>
        <DrawerField label="Costing Method">
          <DrawerSelect value={editCostMethod} onChange={setEditCostMethod} options={costOptions} />
        </DrawerField>
        <DrawerField label="Shelf Life (days)" hint="Leave blank if not perishable.">
          <DrawerInput type="number" value={editShelfLife} onChange={setEditShelfLife} placeholder="e.g. 180" />
        </DrawerField>
      </EditDrawer>

      {deleteTarget && (
        <ConfirmDeleteDialog
          recordName={`Raw Material: ${deleteTarget.name}`}
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
                  {['Name', 'Unit', 'Current Stock', 'Min Level', 'Costing', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => {
                  const isLow = parseFloat(m.currentStock) < parseFloat(m.minStockLevel);
                  return (
                    <tr
                      key={m.id}
                      style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{m.name}</td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{m.baseUnit}</td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: isLow ? '#C0392B' : '#4F7F4A', fontWeight: isLow ? 700 : 400 }}>
                        {parseFloat(m.currentStock ?? 0).toFixed(2)}
                        {isLow && <span style={{ marginLeft: 6, fontSize: 12, background: '#FDE5E0', color: '#C0392B', borderRadius: 6, padding: '1px 6px' }}>Low</span>}
                      </td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(m.minStockLevel ?? 0).toFixed(2)}</td>
                      <td style={{ padding: '0 16px' }}>
                        <span style={{ background: '#FBF6EE', color: '#C98B4B', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>
                          {m.costMethod ?? 'avg'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '0 8px' }}>
                          <OwnerActions
                            onEdit={() => openEdit(m)}
                            onDelete={() => setDeleteTarget(m)}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>
                      No raw materials found
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
