import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import PageHeader        from '@/components/common/PageHeader';
import { Card }          from '@/components/common/Card';
import ViewOnlyBadge     from '@/components/common/ViewOnlyBadge';
import OwnerActions      from '@/components/common/OwnerActions';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import EditDrawer, {
  DrawerField, DrawerInput, DrawerSelect, DrawerTextarea, DrawerSection,
} from '@/components/common/EditDrawer';
import { expenseApi }    from '@/api';
import { useAuthStore }  from '@/store/authStore';
import { useToast }      from '@/hooks/useToast';
import ToastList         from '@/components/common/Toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Expense = Record<string, any>;

const categoryOptions = [
  'electricity', 'rent', 'salaries', 'gas', 'packaging', 'transport', 'repairs', 'others',
].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

const modeOptions = [
  { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' }, { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function ExpensesPage() {
  const { user }         = useAuthStore();
  const isAdmin          = user?.role === 'admin';
  const { toasts, show } = useToast();

  const [expenses,     setExpenses]     = useState<Expense[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editTarget,   setEditTarget]   = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [actionError,  setActionError]  = useState('');
  const [isNew,        setIsNew]        = useState(false);

  const [editCategory,    setEditCategory]    = useState('electricity');
  const [editAmount,      setEditAmount]       = useState('');
  const [editMode,        setEditMode]         = useState('cash');
  const [editDescription, setEditDescription]  = useState('');
  const [editDate,        setEditDate]         = useState('');

  async function load() {
    setLoading(true);
    try { const r = await expenseApi.list(); setExpenses(r.data); }
    catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setIsNew(true); setEditTarget(null);
    setEditCategory('electricity'); setEditAmount(''); setEditMode('cash'); setEditDescription(''); setEditDate(new Date().toISOString().split('T')[0]);
    setActionError('');
  }

  function openEdit(e: Expense) {
    setIsNew(false); setEditTarget(e);
    setEditCategory(e.category ?? 'others');
    setEditAmount(e.amount != null ? String(e.amount) : '');
    setEditMode(e.payment_mode ?? 'cash');
    setEditDescription(e.description ?? '');
    setEditDate(e.expense_date ? new Date(e.expense_date).toISOString().split('T')[0] : '');
    setActionError('');
  }

  async function handleSave() {
    if (!editAmount || parseFloat(editAmount) <= 0) { setActionError('Amount is required'); return; }
    setSaving(true); setActionError('');
    const payload = { category: editCategory, amount: parseFloat(editAmount), payment_mode: editMode, description: editDescription, expenseDate: editDate };
    try {
      if (isNew) { await expenseApi.create(payload); show('Expense added'); }
      else if (editTarget) { await expenseApi.update(editTarget.id, payload); show('Expense updated'); }
      setEditTarget(null); setIsNew(false); await load();
    } catch (e: unknown) {
      setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <ToastList toasts={toasts} />
      <PageHeader
        title="Expenses"
        subtitle="Track expenses for profit calculation"
        actions={
          isAdmin ? (
            <button onClick={openNew} style={{ height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={18} /> Add Expense
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

      <EditDrawer
        title={isNew ? 'New Expense' : 'Edit Expense'}
        open={isNew || !!editTarget}
        onClose={() => { setEditTarget(null); setIsNew(false); }}
        onSave={handleSave}
        saving={saving}
        error={actionError}
      >
        <DrawerSection title="Expense details" />
        <DrawerField label="Category" required>
          <DrawerSelect value={editCategory} onChange={setEditCategory} options={categoryOptions} />
        </DrawerField>
        <DrawerField label="Amount (₹)" required>
          <DrawerInput type="number" value={editAmount} onChange={setEditAmount} placeholder="e.g. 4800" />
        </DrawerField>
        <DrawerField label="Payment Mode">
          <DrawerSelect value={editMode} onChange={setEditMode} options={modeOptions} />
        </DrawerField>
        <DrawerField label="Date">
          <DrawerInput type="date" value={editDate} onChange={setEditDate} />
        </DrawerField>
        <DrawerField label="Description">
          <DrawerTextarea value={editDescription} onChange={setEditDescription} placeholder="What was this expense for?" rows={2} />
        </DrawerField>
      </EditDrawer>

      {deleteTarget && (
        <ConfirmDeleteDialog
          recordName={`Expense: ${deleteTarget.category} — ${inr(deleteTarget.amount ?? 0)}`}
          requireReason
          onConfirm={() => { setDeleteTarget(null); }}
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
                  {['Date', 'Category', 'Amount', 'Mode', 'Description', 'Recorded By', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr
                    key={e.id}
                    style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = '#FDFAF6')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{new Date(e.expense_date).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '0 16px', textTransform: 'capitalize', color: '#1F1611' }}>{e.category}</td>
                    <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#E8590C', fontWeight: 700 }}>{inr(e.amount)}</td>
                    <td style={{ padding: '0 16px', textTransform: 'capitalize', color: '#7A6A5F' }}>{e.payment_mode}</td>
                    <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{e.description ?? '—'}</td>
                    <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{e.created_by_name}</td>
                    {isAdmin && (
                      <td style={{ padding: '0 8px' }}>
                        <OwnerActions
                          onEdit={() => openEdit(e)}
                          onDelete={() => setDeleteTarget(e)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>
                      No expenses found
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
