import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import PageHeader        from '@/components/common/PageHeader';
import { Card }          from '@/components/common/Card';
import OwnerActions      from '@/components/common/OwnerActions';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import EditDrawer, {
  DrawerField, DrawerInput, DrawerSection,
} from '@/components/common/EditDrawer';
import ToastList from '@/components/common/Toast';
import { customerApi }   from '@/api';
import { useAuthStore }  from '@/store/authStore';
import { useToast }      from '@/hooks/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Customer = Record<string, any>;

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function CustomersPage() {
  const { user }         = useAuthStore();
  const isAdmin          = user?.role === 'admin';
  const canCreate        = ['admin','manager','cashier'].includes(user?.role ?? '');
  const { toasts, show } = useToast();

  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [editTarget,   setEditTarget]   = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [actionError,  setActionError]  = useState('');
  const [isNew,        setIsNew]        = useState(false);

  const [editName,     setEditName]     = useState('');
  const [editPhone,    setEditPhone]    = useState('');
  const [editEmail,    setEditEmail]    = useState('');
  const [editAddress,  setEditAddress]  = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [editLimit,    setEditLimit]    = useState('');

  async function load() {
    setLoading(true);
    try { const r = await customerApi.list({ search: search || undefined }); setCustomers(r.data); }
    catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [search]);

  function blank() { setEditName(''); setEditPhone(''); setEditEmail(''); setEditAddress(''); setEditBirthday(''); setEditLimit('0'); setActionError(''); }

  function openNew() { setIsNew(true); setEditTarget(null); blank(); }

  function openEdit(c: Customer) {
    setIsNew(false); setEditTarget(c);
    setEditName(c.name ?? ''); setEditPhone(c.phone ?? ''); setEditEmail(c.email ?? '');
    setEditAddress(c.address ?? ''); setEditBirthday(c.birthday ? c.birthday.split('T')[0] : '');
    setEditLimit(c.creditLimit != null ? String(c.creditLimit) : '0');
    setActionError('');
  }

  async function handleSave() {
    if (!editName.trim()) { setActionError('Name is required'); return; }
    if (!editPhone.trim()) { setActionError('Phone is required'); return; }
    setSaving(true); setActionError('');
    const payload = { name: editName, phone: editPhone, email: editEmail || undefined, address: editAddress || undefined, birthday: editBirthday || undefined, creditLimit: parseFloat(editLimit) || 0 };
    try {
      if (isNew) { await customerApi.create(payload); show('Customer added'); }
      else       { await customerApi.update(editTarget!.id, payload); show('Customer updated'); }
      setEditTarget(null); setIsNew(false); await load();
    } catch (e: unknown) {
      setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleDelete(c: Customer) {
    setDeleteTarget(null);
    try { await customerApi.update(c.id, { isActive: false }); show('Customer archived'); await load(); }
    catch (e: unknown) { show((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Delete failed', 'error'); }
  }

  return (
    <div>
      <ToastList toasts={toasts} />
      <PageHeader
        title="Customers"
        subtitle="CRM with purchase history and loyalty"
        actions={
          canCreate ? (
            <button onClick={openNew} style={{ height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={18} /> Add Customer
            </button>
          ) : undefined
        }
      />

      <EditDrawer
        title={isNew ? 'New Customer' : `Edit: ${editTarget?.name ?? ''}`}
        open={isNew || !!editTarget}
        onClose={() => { setEditTarget(null); setIsNew(false); }}
        onSave={handleSave} saving={saving} error={actionError}
      >
        <DrawerSection title="Contact" />
        <DrawerField label="Name" required><DrawerInput value={editName} onChange={setEditName} placeholder="Full name" /></DrawerField>
        <DrawerField label="Phone" required><DrawerInput value={editPhone} onChange={setEditPhone} placeholder="Mobile number" /></DrawerField>
        <DrawerField label="Email"><DrawerInput type="email" value={editEmail} onChange={setEditEmail} placeholder="Email (optional)" /></DrawerField>
        <DrawerField label="Address"><DrawerInput value={editAddress} onChange={setEditAddress} placeholder="Address (optional)" /></DrawerField>
        <DrawerSection title="Details" />
        <DrawerField label="Birthday"><DrawerInput type="date" value={editBirthday} onChange={setEditBirthday} /></DrawerField>
        <DrawerField label="Credit Limit (₹)" hint="0 = no credit."><DrawerInput type="number" value={editLimit} onChange={setEditLimit} placeholder="0" /></DrawerField>
      </EditDrawer>

      {deleteTarget && (
        <ConfirmDeleteDialog recordName={`Customer: ${deleteTarget.name}`} requireReason
          onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            style={{ width: '100%', height: 48, fontSize: 16, padding: '0 16px', border: '1.5px solid #EADFD0', borderRadius: 12, background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box' as const }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
            onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
          />
        </div>
        {loading ? (
          <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
              <thead>
                <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                  {['Name', 'Phone', 'Loyalty Pts', 'Credit', 'Balance', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>{c.name}</td>
                    <td style={{ padding: '0 16px', fontFamily: 'monospace', color: '#7A6A5F' }}>{c.phone}</td>
                    <td style={{ padding: '0 16px', color: '#C98B4B', fontWeight: 600 }}>{c.loyaltyPoints ?? 0}</td>
                    <td style={{ padding: '0 16px' }}>
                      {c.isCreditCustomer
                        ? <span style={{ background: '#E3F4F4', color: '#1E8E94', borderRadius: 9999, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>Credit</span>
                        : <span style={{ color: '#C4B5A8', fontSize: 14 }}>—</span>}
                    </td>
                    <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: (c.creditBalance ?? 0) > 0 ? '#C0392B' : '#4F7F4A' }}>
                      {(c.creditBalance ?? 0) > 0 ? inr(c.creditBalance) : '—'}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '0 8px' }}>
                        <OwnerActions
                          onEdit={() => openEdit(c)}
                          onDelete={() => setDeleteTarget(c)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} style={{ padding: '32px 16px', textAlign: 'center', color: '#7A6A5F' }}>
                      No customers found
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
