/**
 * Users page
 *
 * Admin:   full table with fingerprint, active toggle, Edit / Reset / Unlock / Deactivate / Add actions.
 * Manager: read-only table, no actions, no fingerprint, no Add User button.
 *
 * Warm Café styling: 56px rows, 17-18px text, terracotta accents.
 */

import { useEffect, useState } from 'react';
import {
  UserPlus, RefreshCw, Lock, Unlock, Power, PowerOff,
  Eye, EyeOff, Copy, Check, AlertCircle, X, ShieldCheck,
} from 'lucide-react';
import PageHeader    from '@/components/common/PageHeader';
import EditDrawer, { DrawerField, DrawerInput, DrawerSelect, DrawerSection } from '@/components/common/EditDrawer';
import Toast         from '@/components/common/Toast';
import { userApi }   from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useToast }  from '@/hooks/useToast';
import { ALL_PERMISSION_KEYS, getDefaultPermissions } from '@/store/demoStore';
import type { PermissionKey } from '@/store/demoStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id:                   number;
  username:             string;
  role:                 'admin' | 'manager' | 'cashier';
  displayName:          string;
  isActive:             boolean;
  lastLoginAt:          string | null;
  lastLoginTab:         string | null;
  isLocked:             boolean;
  lockedUntil:          string | null;
  passwordFingerprint?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const roleOptions = [
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
];

// ─── Role pill ────────────────────────────────────────────────────────────────

function RolePill({ role }: { role: User['role'] }) {
  const map = {
    admin:   { bg: '#FFF1DC', color: '#D9822B', label: 'Admin' },
    manager: { bg: '#E3F4F4', color: '#1E8E94', label: 'Manager' },
    cashier: { bg: '#F8E8F3', color: '#B0457F', label: 'Cashier' },
  };
  const s = map[role] ?? map.cashier;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 9999, padding: '2px 12px', fontSize: 14, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

// ─── Fingerprint cell ─────────────────────────────────────────────────────────

function FingerprintCell({ fp }: { fp?: string }) {
  const [visible, setVisible] = useState(false);
  if (!fp) return <span style={{ color: '#C4B5A8' }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#7A6A5F' }}>
        {visible ? fp : '••••••••'}
      </span>
      <button
        aria-label={visible ? 'Hide fingerprint' : 'Show fingerprint'}
        title="Passwords are stored as one-way hashes and cannot be viewed."
        onClick={() => setVisible((v) => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F', display: 'flex' }}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <Lock size={13} color="#C4B5A8" />
    </div>
  );
}

// ─── Reset password dialog ────────────────────────────────────────────────────

function ResetPasswordDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [generated,   setGenerated]   = useState('');
  const [copied,      setCopied]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  async function handleGenerate() {
    setLoading(true); setError('');
    try {
      const res = await userApi.resetPassword(userId, null);
      setGenerated(res.data.generatedPassword ?? '');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed');
    } finally { setLoading(false); }
  }

  async function handleSet() {
    setLoading(true); setError('');
    try {
      await userApi.resetPassword(userId, newPassword);
      onClose();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed');
    } finally { setLoading(false); }
  }

  function copy() {
    navigator.clipboard.writeText(generated).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 420, boxShadow: '0 8px 32px rgba(43,27,20,0.16)' }}>
        <h2 style={{ fontFamily: '"DM Serif Display", serif', fontSize: 22, color: '#1F1611', margin: '0 0 20px' }}>Reset Password</h2>

        {generated ? (
          <>
            <p style={{ fontSize: 15, color: '#7A6A5F', marginBottom: 12 }}>Generated password (shown once — copy now):</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF1DC', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <code style={{ flex: 1, fontSize: 15, fontFamily: 'monospace', color: '#1F1611', wordBreak: 'break-all' }}>{generated}</code>
              <button onClick={copy} aria-label="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4F7F4A' : '#7A6A5F' }}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <button onClick={onClose} style={{ width: '100%', height: 50, borderRadius: 12, fontSize: 16, fontWeight: 700, background: '#E8590C', color: '#fff', border: 'none', cursor: 'pointer' }}>Done</button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 15, color: '#1F1611', marginBottom: 6 }}>New password (min 10 chars)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••"
                style={{ width: '100%', height: 52, fontSize: 16, padding: '0 14px', border: '1.5px solid #EADFD0', borderRadius: 12, background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
              />
            </div>
            {error && <p style={{ fontSize: 14, color: '#C0392B', marginBottom: 12 }}><AlertCircle size={14} style={{ display: 'inline', marginRight: 4 }} />{error}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <button onClick={handleSet} disabled={loading || newPassword.length < 10}
                style={{ height: 50, borderRadius: 12, fontSize: 16, fontWeight: 700, background: newPassword.length >= 10 ? '#E8590C' : '#F0A580', color: '#fff', border: 'none', cursor: newPassword.length >= 10 ? 'pointer' : 'not-allowed' }}>
                Set Password
              </button>
              <button onClick={handleGenerate} disabled={loading}
                style={{ height: 50, borderRadius: 12, fontSize: 16, fontWeight: 600, background: '#FBF6EE', color: '#E8590C', border: '1.5px solid #E8590C', cursor: 'pointer' }}>
                Generate
              </button>
            </div>
            <button onClick={onClose} style={{ width: '100%', height: 44, borderRadius: 12, fontSize: 15, fontWeight: 500, background: 'transparent', color: '#7A6A5F', border: '1px solid #EADFD0', cursor: 'pointer' }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Permission groups for the UI ────────────────────────────────────────────

const PERM_GROUPS: { title: string; keys: PermissionKey[] }[] = [
  { title: 'Sales',   keys: ['dashboard', 'billing', 'orders', 'customers'] },
  { title: 'Stock',   keys: ['products', 'suppliers', 'purchases', 'rawMaterials', 'production', 'stock'] },
  { title: 'Money',   keys: ['shifts', 'expenses', 'reports'] },
  { title: 'Admin',   keys: ['users', 'settings'] },
];

const PERM_LABELS: Record<PermissionKey, string> = {
  dashboard:   'Dashboard',
  billing:     'Billing',
  orders:      'Orders',
  customers:   'Customers',
  products:    'Products',
  suppliers:   'Suppliers',
  purchases:   'Purchases',
  rawMaterials:'Raw Materials',
  production:  'Production',
  stock:       'Stock',
  shifts:      'Shifts',
  expenses:    'Expenses',
  reports:     'Reports',
  users:       'Users',
  settings:    'Settings',
};

function PermissionsDrawer({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [perms,   setPerms]   = useState<Record<string, boolean>>({});
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    userApi.getPermissions(user.id).then((res) => {
      setPerms((res.data as Record<string, boolean>) ?? getDefaultPermissions(user.role));
    }).catch(() => {
      setPerms(getDefaultPermissions(user.role));
    });
  }, [user.id, user.role]);

  function toggle(key: string) {
    if (isAdmin) return; // admin permissions are immutable
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await userApi.setPermissions(user.id, perms);
      onSaved();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ background: '#fff', width: 380, maxWidth: '95vw', height: '100%', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(43,27,20,0.14)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #EADFD0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1F1611', fontFamily: '"DM Serif Display", serif' }}>
              Section Permissions
            </div>
            <div style={{ fontSize: 13, color: '#7A6A5F', marginTop: 2 }}>
              {user.displayName} · <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F', display: 'flex', padding: 6, borderRadius: 8 }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
          {isAdmin ? (
            <div style={{ background: '#FFF1DC', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#D9822B', marginBottom: 16 }}>
              Admin / Owner has access to all sections by default. Permissions cannot be restricted for admin accounts.
            </div>
          ) : (
            <p style={{ fontSize: 14, color: '#7A6A5F', marginBottom: 16 }}>
              Toggle which sections this user can access. Changes take effect at next login.
            </p>
          )}

          {PERM_GROUPS.map((group) => (
            <div key={group.title} style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#C98B4B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, borderBottom: '1px solid #F0EAE3', paddingBottom: 4 }}>
                {group.title}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.keys.map((key) => {
                  const enabled = isAdmin ? true : (perms[key] ?? false);
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 10,
                        background: enabled ? '#F0FAF0' : '#FBF6EE',
                        border: `1px solid ${enabled ? '#C8E6C9' : '#EADFD0'}`,
                        cursor: isAdmin ? 'default' : 'pointer',
                        transition: 'background 120ms',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={isAdmin}
                        onChange={() => toggle(key)}
                        style={{ width: 18, height: 18, accentColor: '#4F7F4A', cursor: isAdmin ? 'default' : 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 15, fontWeight: 500, color: '#1F1611', flex: 1 }}>
                        {PERM_LABELS[key]}
                      </span>
                      {enabled
                        ? <span style={{ fontSize: 12, color: '#4F7F4A', fontWeight: 600 }}>Allowed</span>
                        : <span style={{ fontSize: 12, color: '#C4B5A8' }}>Hidden</span>
                      }
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {error && <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '8px 14px', marginTop: 8, color: '#C0392B', fontSize: 14 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #EADFD0', display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 48, borderRadius: 12, background: '#FBF6EE', color: '#7A6A5F', border: '1px solid #EADFD0', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          {!isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1, height: 48, borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.75 : 1 }}
            >
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: me }     = useAuthStore();
  const isAdmin          = me?.role === 'admin';
  const { toasts, show } = useToast();

  const [users,          setUsers]          = useState<User[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [resetTarget,    setResetTarget]    = useState<number | null>(null);
  const [permTarget,     setPermTarget]     = useState<User | null>(null);
  const [actionLoading,  setActionLoading]  = useState<number | null>(null);
  const [error,          setError]          = useState('');

  // Add User drawer
  const [addOpen,        setAddOpen]        = useState(false);
  const [addSaving,      setAddSaving]      = useState(false);
  const [addError,       setAddError]       = useState('');
  const [newUsername,    setNewUsername]    = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole,        setNewRole]        = useState('cashier');
  const [newPassword,    setNewPassword]    = useState('');
  const [newPassVisible, setNewPassVisible] = useState(false);

  async function load() {
    setLoading(true);
    try { const res = await userApi.list(true); setUsers(res.data); }
    catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function doAction(userId: number, action: () => Promise<unknown>) {
    setActionLoading(userId); setError('');
    try { await action(); await load(); }
    catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Action failed');
    } finally { setActionLoading(null); }
  }

  function openAdd() {
    setNewUsername(''); setNewDisplayName(''); setNewRole('cashier');
    setNewPassword(''); setNewPassVisible(false); setAddError('');
    setAddOpen(true);
  }

  async function handleAddUser() {
    if (!newUsername.trim())    { setAddError('Username is required.'); return; }
    if (!newDisplayName.trim()) { setAddError('Display name is required.'); return; }
    if (newPassword.length < 8) { setAddError('Password must be at least 8 characters.'); return; }
    setAddSaving(true); setAddError('');
    try {
      await userApi.create({ username: newUsername.trim(), displayName: newDisplayName.trim(), role: newRole, password: newPassword });
      setAddOpen(false);
      show(`${newDisplayName} added`, 'success');
      await load();
    } catch (e: unknown) {
      setAddError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not create user');
    } finally { setAddSaving(false); }
  }

  return (
    <div>
      <Toast toasts={toasts} />

      <PageHeader
        title="Users"
        subtitle={isAdmin ? 'Manage all accounts and permissions' : 'User accounts (view only)'}
        actions={
          isAdmin ? (
            <button
              onClick={openAdd}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 48, padding: '0 20px', borderRadius: 12, background: '#E8590C', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
            >
              <UserPlus size={18} strokeWidth={2} /> Add User
            </button>
          ) : undefined
        }
      />

      {/* View-only label */}
      {!isAdmin && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: '#E3F4F4', color: '#1E8E94', borderRadius: 9999, padding: '4px 14px', fontSize: 14 }}>
          <Eye size={14} /> View only
        </div>
      )}

      {error && (
        <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#C0392B', fontSize: 15 }}>{error}</div>
      )}

      {/* Add User drawer */}
      <EditDrawer
        title="Add User"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddUser}
        saving={addSaving}
        error={addError}
      >
        <DrawerSection title="Account details" />
        <DrawerField label="Username" required>
          <DrawerInput value={newUsername} onChange={setNewUsername} placeholder="e.g. riya_cashier" />
        </DrawerField>
        <DrawerField label="Display Name" required>
          <DrawerInput value={newDisplayName} onChange={setNewDisplayName} placeholder="e.g. Riya Sharma" />
        </DrawerField>
        <DrawerField label="Role">
          <DrawerSelect value={newRole} onChange={setNewRole} options={roleOptions} />
        </DrawerField>
        <DrawerSection title="Password" />
        <DrawerField label="Initial Password" hint="Min 8 characters. Share with the user privately." required>
          <div style={{ position: 'relative' }}>
            <DrawerInput
              type={newPassVisible ? 'text' : 'password'}
              value={newPassword}
              onChange={setNewPassword}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setNewPassVisible((v) => !v)}
              aria-label={newPassVisible ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F', display: 'flex' }}
            >
              {newPassVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </DrawerField>
      </EditDrawer>

      {/* Reset password dialog */}
      {resetTarget !== null && (
        <ResetPasswordDialog userId={resetTarget} onClose={() => { setResetTarget(null); load(); }} />
      )}

      {/* Permissions drawer */}
      {permTarget && (
        <PermissionsDrawer
          user={permTarget}
          onClose={() => setPermTarget(null)}
          onSaved={() => { setPermTarget(null); show(`Permissions updated for ${permTarget.displayName}`, 'success'); load(); }}
        />
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EADFD0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(43,27,20,0.06)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7A6A5F', fontSize: 17 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
            <thead>
              <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                {[
                  'Username', 'Display Name', 'Role', 'Status',
                  ...(isAdmin ? ['Password'] : []),
                  'Last Login',
                  ...(isAdmin ? ['Actions'] : []),
                ].map((h) => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: '1px solid #F0EAE3', height: 56 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '0 20px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1F1611' }}>{u.username}</span>
                    {u.isLocked && (
                      <span title="Account is locked" style={{ marginLeft: 8 }}>
                        <Lock size={13} color="#C0392B" />
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0 20px', color: '#1F1611' }}>{u.displayName}</td>
                  <td style={{ padding: '0 20px' }}><RolePill role={u.role} /></td>
                  <td style={{ padding: '0 20px' }}>
                    {u.isActive
                      ? <span style={{ color: '#4F7F4A', fontWeight: 600 }}>✓ Active</span>
                      : <span style={{ color: '#C0392B', fontWeight: 600 }}>✗ Inactive</span>
                    }
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '0 20px' }}>
                      <FingerprintCell fp={u.passwordFingerprint} />
                    </td>
                  )}
                  <td style={{ padding: '0 20px', color: '#7A6A5F', fontSize: 14 }}>
                    {u.lastLoginAt ? (
                      <>
                        {formatDate(u.lastLoginAt)}
                        {u.lastLoginTab && (
                          <span style={{ marginLeft: 6, background: '#FBF6EE', borderRadius: 6, padding: '1px 8px', fontSize: 12, color: '#C98B4B' }}>
                            {u.lastLoginTab}
                          </span>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '0 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Permissions */}
                        <button
                          onClick={() => setPermTarget(u)}
                          title="Edit permissions"
                          aria-label="Edit section permissions"
                          disabled={actionLoading === u.id}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E8E94', display: 'flex', padding: 6, borderRadius: 8 }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#E3F4F4')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <ShieldCheck size={17} strokeWidth={2} />
                        </button>

                        {/* Reset password */}
                        <button
                          onClick={() => setResetTarget(u.id)}
                          title="Reset password"
                          aria-label="Reset password"
                          disabled={actionLoading === u.id}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F', display: 'flex', padding: 6, borderRadius: 8 }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#FBF6EE')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <RefreshCw size={17} strokeWidth={2} />
                        </button>

                        {/* Unlock */}
                        {u.isLocked && (
                          <button
                            onClick={() => doAction(u.id, () => userApi.unlock(u.id))}
                            title="Unlock account"
                            aria-label="Unlock account"
                            disabled={actionLoading === u.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D9822B', display: 'flex', padding: 6, borderRadius: 8 }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF1DC')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            <Unlock size={17} strokeWidth={2} />
                          </button>
                        )}

                        {/* Deactivate / Activate */}
                        {u.id !== me?.id && u.role !== 'admin' && (
                          <button
                            onClick={() => doAction(u.id, () =>
                              u.isActive
                                ? userApi.deactivate(u.id, 'Deactivated by admin')
                                : userApi.activate(u.id)
                            )}
                            title={u.isActive ? 'Deactivate account' : 'Activate account'}
                            aria-label={u.isActive ? 'Deactivate' : 'Activate'}
                            disabled={actionLoading === u.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: u.isActive ? '#C0392B' : '#4F7F4A', display: 'flex', padding: 6, borderRadius: 8 }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = u.isActive ? '#FDE5E0' : '#E8F5E9')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            {u.isActive ? <PowerOff size={17} strokeWidth={2} /> : <Power size={17} strokeWidth={2} />}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 4} style={{ padding: '32px 20px', textAlign: 'center', color: '#7A6A5F' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
