/**
 * ShiftsPage — Part F
 *
 * Tabs:
 *   Cash Management  — open/close shift, confirm-identity modal before cash count
 *   Shifts History   — table of all shifts with Cashier, open/close times, amounts, status
 *   Access           — who can manage shifts (role summary)
 *
 * Rules:
 *   - Owner (admin) is exempt from "Confirm it's you" modal
 *   - Manager/Cashier must confirm their display name before submitting cash count
 *   - Only admin can see all shifts; others see their own
 */

import { useEffect, useRef, useState } from 'react';
import { Clock, CheckCircle, ChevronDown, ChevronUp, Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import PageHeader    from '@/components/common/PageHeader';
import { Card }      from '@/components/common/Card';
import Toast         from '@/components/common/Toast';
import { shiftApi }  from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useToast }  from '@/hooks/useToast';
import { IS_MOCK, IS_DEMO } from '@/api/client';
const USE_MOCK = IS_MOCK || IS_DEMO;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = Record<string, any>;

type Tab = 'cash' | 'history' | 'access';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Staff Authentication Modal ───────────────────────────────────────────────
// Non-admin users must supply username + password + role before closing a shift.

const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
];

function StaffAuthModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (verifiedName: string) => void;
  onCancel: () => void;
}) {
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [role,        setRole]        = useState('cashier');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { usernameRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError('Enter your username and password.'); return; }
    setLoading(true); setError('');
    try {
      if (USE_MOCK) {
        // Validate against demoStore users — any non-empty password accepted in demo
        const { users } = await import('@/store/demoStore');
        const all = users.list(false);
        const match = all.find(
          (u: { username: string; role: string; isActive: boolean }) =>
            u.username.toLowerCase() === username.trim().toLowerCase() &&
            u.role === role &&
            u.isActive !== false,
        );
        if (!match) {
          setError(`No active ${role} account found for "${username.trim()}". Check your username and role.`);
          setLoading(false);
          return;
        }
        // Demo: password is not hashed, so any non-empty value passes
        onConfirm(match.displayName ?? username.trim());
      } else {
        // Real mode: hit the staff login endpoint
        const { authApi } = await import('@/api');
        const res = await authApi.staffLogin(username.trim(), password, role);
        const name = (res as { data?: { user?: { displayName?: string } } }).data?.user?.displayName ?? username.trim();
        onConfirm(name);
      }
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 50, fontSize: 16, padding: '0 14px',
    border: '1.5px solid #EADFD0', borderRadius: 12,
    background: '#FBF6EE', color: '#1F1611', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.50)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 22, padding: '32px 28px', width: 420,
        boxShadow: '0 10px 48px rgba(43,27,20,0.20)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ background: '#FFF1DC', borderRadius: 14, padding: 12, display: 'flex', flexShrink: 0 }}>
            <Shield size={26} color="#D9822B" />
          </span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1F1611', fontFamily: '"DM Serif Display", serif' }}>
              Verify your identity
            </div>
            <div style={{ fontSize: 14, color: '#7A6A5F', marginTop: 2 }}>
              Enter your credentials to proceed with cash count
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Role */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1F1611', marginBottom: 6 }}>
              Role
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  style={{
                    height: 44, borderRadius: 10, fontSize: 15, fontWeight: 600,
                    border: '1.5px solid', cursor: 'pointer', transition: 'all 120ms',
                    ...(role === opt.value
                      ? { background: '#E8590C', color: '#fff', borderColor: '#E8590C' }
                      : { background: '#FBF6EE', color: '#7A6A5F', borderColor: '#EADFD0' }),
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1F1611', marginBottom: 6 }}>
              Username
            </label>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. cashier1"
              autoComplete="username"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1F1611', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F', display: 'flex',
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FDE5E0', borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#C0392B',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ height: 50, borderRadius: 12, fontSize: 16, fontWeight: 600, background: '#FBF6EE', color: '#7A6A5F', border: '1px solid #EADFD0', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              style={{
                height: 50, borderRadius: 12, fontSize: 16, fontWeight: 700,
                background: !loading && username.trim() && password.trim() ? '#E8590C' : '#F0A580',
                color: '#fff', border: 'none',
                cursor: !loading && username.trim() && password.trim() ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Verifying…' : 'Confirm Identity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  if (status === 'open') return (
    <span style={{ background: '#E8F5E9', color: '#4F7F4A', borderRadius: 9999, padding: '2px 12px', fontSize: 13, fontWeight: 700 }}>
      Open
    </span>
  );
  return (
    <span style={{ background: '#FBF6EE', color: '#7A6A5F', borderRadius: 9999, padding: '2px 12px', fontSize: 13, fontWeight: 600 }}>
      Closed
    </span>
  );
}

// ─── Cash Management Tab ──────────────────────────────────────────────────────

function CashManagementTab({ user }: { user: { displayName?: string; role?: string } | null }) {
  const { toasts, show } = useToast();
  const isOwner = user?.role === 'admin';

  const [shifts,       setShifts]       = useState<Shift[]>([]);
  const [openingFloat, setOpeningFloat] = useState('0');
  const [countedCash,  setCountedCash]  = useState('');
  const [notes,        setNotes]        = useState('');
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [dayEndReport, setDayEndReport] = useState<Shift | null>(null);

  // Two-step close flow for non-owners:
  // Step 0 — idle (show "Confirm & Close Shift" button)
  // Step 1 — show auth modal (username + password + role)
  // Step 2 — auth passed, show cash count form
  type CloseStep = 'idle' | 'auth' | 'count';
  const [closeStep,    setCloseStep]    = useState<CloseStep>('idle');
  const [verifiedName, setVerifiedName] = useState('');  // name of who verified identity

  async function loadShifts() {
    try {
      const res = await shiftApi.list();
      const all: Shift[] = res.data ?? [];
      setShifts(all);
      const open = all.find((s) => s.status === 'open');
      setCurrentShift(open ?? null);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadShifts(); }, []);

  async function handleOpenShift() {
    setSaving(true); setError('');
    try {
      const res = await shiftApi.open(parseFloat(openingFloat) || 0);
      show('Shift opened', 'success');
      setCurrentShift({ id: res.data.shiftId, status: 'open', opening_float: parseFloat(openingFloat) });
      await loadShifts();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to open shift');
    } finally { setSaving(false); }
  }

  // Non-owner clicks "Confirm & Close Shift" → open auth modal first
  function handleCloseClick() {
    if (!currentShift) return;
    if (isOwner) {
      // Owner goes straight to cash count
      setCloseStep('count');
    } else {
      setCloseStep('auth');
    }
  }

  // Auth modal confirmed → advance to cash count
  function handleAuthConfirmed(name: string) {
    setVerifiedName(name);
    setCloseStep('count');
  }

  // Cancel at any step
  function handleCancelClose() {
    setCloseStep('idle');
    setVerifiedName('');
    setCountedCash('');
    setNotes('');
  }

  async function doCloseShift() {
    setSaving(true); setError('');
    try {
      const closedByName = isOwner ? (user?.displayName ?? 'Owner') : verifiedName;
      const res = await shiftApi.close(currentShift!.id, parseFloat(countedCash) || 0, notes, closedByName);
      const report = res.data;
      setDayEndReport({ ...report, counted_by_name: closedByName });
      setCurrentShift(null);
      setCloseStep('idle');
      setVerifiedName('');
      setCountedCash('');
      setNotes('');
      show('Shift closed', 'success');
      await loadShifts();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to close shift');
    } finally { setSaving(false); }
  }

  const expected = (currentShift?.opening_float ?? 0) + (currentShift?.expected_cash ?? 0);
  const counted  = parseFloat(countedCash) || 0;
  const diff     = counted - expected;

  if (loading) return <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>Loading…</p>;

  return (
    <>
      <Toast toasts={toasts} />

      {/* Step 1 — Auth modal for non-owners */}
      {closeStep === 'auth' && (
        <StaffAuthModal
          onConfirm={handleAuthConfirmed}
          onCancel={handleCancelClose}
        />
      )}

      {error && (
        <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#C0392B', fontSize: 15 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* ── Open Shift card ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ background: '#E8F5E9', borderRadius: 10, padding: 8, display: 'flex' }}>
              <Clock size={20} color="#4F7F4A" />
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1F1611', margin: 0 }}>Open Shift</h2>
          </div>

          {currentShift ? (
            <div style={{ background: '#F0FAF0', borderRadius: 12, padding: '14px 16px', fontSize: 15, color: '#4F7F4A', fontWeight: 600 }}>
              ✓ Shift #{currentShift.id} is open
              <div style={{ fontSize: 13, color: '#7A6A5F', fontWeight: 400, marginTop: 4 }}>
                Opening float: {inr(currentShift.opening_float ?? 0)}
              </div>
            </div>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 15, color: '#1F1611', marginBottom: 6 }}>
                Opening Cash Float (₹)
              </label>
              <input
                type="number"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                style={{ width: '100%', height: 52, fontSize: 16, padding: '0 14px', border: '1.5px solid #EADFD0', borderRadius: 12, background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
              />
              <button
                onClick={handleOpenShift}
                disabled={saving}
                style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 16, fontWeight: 700, background: '#4F7F4A', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Opening…' : 'Open Shift'}
              </button>
            </>
          )}
        </Card>

        {/* ── Close Shift card ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ background: '#FFF1DC', borderRadius: 10, padding: 8, display: 'flex' }}>
              <CheckCircle size={20} color="#D9822B" />
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1F1611', margin: 0 }}>Close Shift</h2>
          </div>

          {!currentShift ? (
            <div style={{ background: '#FBF6EE', borderRadius: 12, padding: '14px 16px', fontSize: 15, color: '#7A6A5F' }}>
              No shift is currently open
            </div>

          ) : closeStep === 'idle' ? (
            /* ── Step 0: invite to close ── */
            <>
              <div style={{ background: '#FBF6EE', borderRadius: 12, padding: '14px 16px', fontSize: 15, color: '#7A6A5F', marginBottom: 20 }}>
                Shift #{currentShift.id} is open.
                {!isOwner && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C98B4B' }}>
                    You will be asked to verify your identity before counting cash.
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseClick}
                style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 16, fontWeight: 700, background: '#E8590C', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                {isOwner ? 'Close & Count Cash' : 'Confirm & Close Shift'}
              </button>
            </>

          ) : closeStep === 'count' ? (
            /* ── Step 2: cash count form (shown after auth passes) ── */
            <>
              {/* Who is counting — shown for all */}
              <div style={{ background: '#F0FAF0', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#4F7F4A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={15} />
                Counting cash: <span style={{ color: '#1F1611' }}>{isOwner ? (user?.displayName ?? 'Owner') : verifiedName}</span>
              </div>

              {/* Admin sees expected cash */}
              {isOwner && (
                <div style={{ background: '#FBF6EE', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#7A6A5F' }}>
                  Expected cash in drawer: <strong style={{ color: '#1F1611' }}>{inr(expected)}</strong>
                </div>
              )}

              <label style={{ display: 'block', fontSize: 15, color: '#1F1611', marginBottom: 6 }}>
                Counted Cash (₹)
              </label>
              <input
                autoFocus
                type="number"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="Enter amount physically counted"
                style={{ width: '100%', height: 52, fontSize: 16, padding: '0 14px', border: '1.5px solid #EADFD0', borderRadius: 12, background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
              />

              {/* Shortage/excess shown to EVERYONE once cash is entered */}
              {countedCash && expected > 0 && (
                <div style={{
                  background: diff >= 0 ? '#E8F5E9' : '#FDE5E0',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 14,
                  color: diff >= 0 ? '#4F7F4A' : '#C0392B', fontWeight: 600,
                  border: `1px solid ${diff >= 0 ? '#C8E6C9' : '#FFAB91'}`,
                }}>
                  {diff >= 0
                    ? `↑ Excess: ${inr(Math.abs(diff))} more than expected`
                    : `⚠ Shortage: ${inr(Math.abs(diff))} less than expected — please recount before proceeding`
                  }
                </div>
              )}

              <label style={{ display: 'block', fontSize: 15, color: '#1F1611', marginBottom: 6 }}>
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any notes about this shift…"
                style={{ width: '100%', fontSize: 15, padding: '10px 14px', border: '1.5px solid #EADFD0', borderRadius: 12, background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box', resize: 'vertical', marginBottom: 16, fontFamily: 'inherit' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <button
                  onClick={handleCancelClose}
                  style={{ height: 52, borderRadius: 12, fontSize: 15, fontWeight: 600, background: '#FBF6EE', color: '#7A6A5F', border: '1px solid #EADFD0', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={doCloseShift}
                  disabled={saving || !countedCash}
                  style={{ height: 52, borderRadius: 12, fontSize: 16, fontWeight: 700, background: '#E8590C', color: '#fff', border: 'none', cursor: saving || !countedCash ? 'not-allowed' : 'pointer', opacity: saving || !countedCash ? 0.7 : 1 }}
                >
                  {saving ? 'Closing…' : 'Close Shift'}
                </button>
              </div>
            </>
          ) : null}
        </Card>
      </div>

      {/* Day-end report */}
      {dayEndReport && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ background: '#E3F4F4', borderRadius: 10, padding: 8, display: 'flex' }}>
              <CheckCircle size={20} color="#1E8E94" />
            </span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1F1611', margin: 0 }}>Shift Closed — Summary</h2>
              {dayEndReport.counted_by_name && (
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#7A6A5F' }}>
                  Cash counted by: <strong style={{ color: '#1F1611' }}>{dayEndReport.counted_by_name}</strong>
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {/* Opening Float — always visible */}
            <div style={{ background: '#FBF6EE', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, color: '#7A6A5F', marginBottom: 4 }}>Opening Float</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1F1611', fontVariantNumeric: 'tabular-nums' }}>
                {inr(dayEndReport.opening_float ?? 0)}
              </div>
            </div>

            {/* Expected Cash — always visible */}
            <div style={{ background: '#FBF6EE', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, color: '#7A6A5F', marginBottom: 4 }}>Expected Cash</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1F1611', fontVariantNumeric: 'tabular-nums' }}>
                {inr((dayEndReport.opening_float ?? 0) + (dayEndReport.expected_cash ?? 0))}
              </div>
            </div>

            {/* Counted Cash — always visible */}
            <div style={{ background: '#FBF6EE', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, color: '#7A6A5F', marginBottom: 4 }}>Counted Cash</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1F1611', fontVariantNumeric: 'tabular-nums' }}>
                {inr(dayEndReport.counted_cash ?? 0)}
              </div>
            </div>

            {/* Variance — admin only */}
            {isOwner && (() => {
              const shortage = dayEndReport.shortage ?? 0;
              return (
                <div style={{ background: shortage < 0 ? '#FDE5E0' : '#E8F5E9', borderRadius: 12, padding: '14px 16px', border: `1px solid ${shortage < 0 ? '#FFAB91' : '#C8E6C9'}` }}>
                  <div style={{ fontSize: 13, color: '#7A6A5F', marginBottom: 4 }}>{shortage >= 0 ? 'Excess' : 'Shortage'}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: shortage < 0 ? '#C0392B' : '#4F7F4A', fontVariantNumeric: 'tabular-nums' }}>
                    {shortage < 0 ? '−' : '+'}{inr(Math.abs(shortage))}
                  </div>
                </div>
              );
            })()}
          </div>
        </Card>
      )}
    </>
  );
}

// ─── Shifts History Tab ───────────────────────────────────────────────────────

function ShiftsHistoryTab({ isOwner = false }: { isOwner?: boolean }) {
  const [shifts,   setShifts]   = useState<Shift[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    shiftApi.list().then((r) => setShifts(r.data ?? [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>Loading…</p>;

  return (
    <Card>
      {shifts.length === 0 ? (
        <p style={{ padding: 32, textAlign: 'center', color: '#7A6A5F' }}>No shifts recorded yet</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
            <thead>
              <tr style={{ background: '#FBF6EE', borderBottom: '1px solid #EADFD0' }}>
                {['#', 'Cashier', 'Opened', 'Closed', 'Opening Float', 'Counted Cash', ...(isOwner ? ['Variance'] : []), 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 600, color: '#7A6A5F', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                const variance = (s.shortage ?? 0);
                const isOpen   = s.status === 'open';
                return (
                  <>
                    <tr
                      key={s.id}
                      style={{ borderBottom: '1px solid #F0EAE3', height: 56, cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    >
                      <td style={{ padding: '0 16px', fontFamily: 'monospace', fontSize: 14, color: '#7A6A5F' }}>#{s.id}</td>
                      <td style={{ padding: '0 16px', fontWeight: 600, color: '#1F1611' }}>
                        {s.cashier_name ?? s.cashierName ?? 'Shop Owner'}
                      </td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{formatDateTime(s.opened_at ?? s.openedAt)}</td>
                      <td style={{ padding: '0 16px', color: '#7A6A5F' }}>{isOpen ? '—' : formatDateTime(s.closed_at ?? s.closedAt)}</td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#1F1611' }}>{inr(s.opening_float ?? 0)}</td>
                      <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', color: '#1F1611' }}>
                        {isOpen ? '—' : inr(s.counted_cash ?? 0)}
                      </td>
                      {isOwner && (
                        <td style={{ padding: '0 16px', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: variance < 0 ? '#C0392B' : variance > 0 ? '#4F7F4A' : '#7A6A5F' }}>
                          {isOpen ? '—' : (variance >= 0 ? '+' : '') + inr(variance)}
                        </td>
                      )}
                      <td style={{ padding: '0 16px' }}><StatusPill status={s.status} /></td>
                      <td style={{ padding: '0 12px', color: '#7A6A5F' }}>
                        {expanded === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {expanded === s.id && (
                      <tr key={`exp-${s.id}`} style={{ background: '#FDFAF6' }}>
                        <td colSpan={isOwner ? 9 : 8} style={{ padding: '12px 24px' }}>
                          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 14, color: '#7A6A5F' }}>
                            {s.notes && <span><strong>Notes:</strong> {s.notes}</span>}
                            <span><strong>Opened:</strong> {formatDateTime(s.opened_at ?? s.openedAt)}</span>
                            {!isOpen && <span><strong>Closed:</strong> {formatDateTime(s.closed_at ?? s.closedAt)}</span>}
                            {s.expected_cash != null && <span><strong>Cash Sales:</strong> {inr(s.expected_cash)}</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Access Tab ───────────────────────────────────────────────────────────────

function AccessTab() {
  const roles = [
    {
      role: 'Admin (Owner)',
      color: '#D9822B',
      bg: '#FFF1DC',
      permissions: [
        'Open and close shifts',
        'View all shifts history',
        'Exempt from identity confirmation',
        'Manage all settings',
      ],
    },
    {
      role: 'Manager',
      color: '#1E8E94',
      bg: '#E3F4F4',
      permissions: [
        'Open and close shifts',
        'Must confirm identity before closing',
        'View their own shifts',
      ],
    },
    {
      role: 'Cashier',
      color: '#B0457F',
      bg: '#F8E8F3',
      permissions: [
        'Open and close shifts',
        'Must confirm identity before closing',
        'View their own shifts',
        'Cannot access sensitive reports',
      ],
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
      {roles.map((r) => (
        <Card key={r.role}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ background: r.bg, color: r.color, borderRadius: 9999, padding: '3px 14px', fontSize: 14, fontWeight: 700 }}>
              {r.role}
            </span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 20px', listStyle: 'none' }}>
            {r.permissions.map((p) => (
              <li key={p} style={{ fontSize: 15, color: '#1F1611', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <CheckCircle size={16} color={r.color} style={{ marginTop: 2, flexShrink: 0 }} />
                {p}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { user }  = useAuthStore();
  const [tab, setTab] = useState<Tab>('cash');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'cash',    label: 'Cash Management' },
    { key: 'history', label: 'Shifts History'  },
    { key: 'access',  label: 'Access'           },
  ];

  return (
    <div>
      <PageHeader
        title="Shifts"
        subtitle="Cash reconciliation and shift management"
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              height: 40, padding: '0 18px', borderRadius: 10, fontSize: 15, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: tab === t.key ? '#E8590C' : '#FBF6EE',
              color:      tab === t.key ? '#fff'    : '#7A6A5F',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cash'    && <CashManagementTab user={user} />}
      {tab === 'history' && <ShiftsHistoryTab isOwner={user?.role === 'admin'} />}
      {tab === 'access'  && <AccessTab />}
    </div>
  );
}
