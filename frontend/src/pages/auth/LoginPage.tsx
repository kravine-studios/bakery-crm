/**
 * Login page — two tabs:
 *   "Owner Login"  → only the admin account can sign in here
 *   "Staff Login"  → manager or cashier; role selector required
 *
 * Design: Warm Café (espresso, cream, terracotta). Unchanged layout.
 * Security: generic error messages, show/hide password, Caps Lock warning.
 * Demo mode: shows a notice banner when VITE_DEMO_MODE=true.
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useNavigate }     from 'react-router-dom';
import { CakeSlice, LogIn, Eye, EyeOff, FlaskConical } from 'lucide-react';
import { authApi, settingsApi } from '@/api';
import { IS_DEMO }         from '@/api/client';
import { useAuthStore }    from '@/store/authStore';
import type { Role }       from '@/store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'owner' | 'staff';

// ─── Password field with show/hide + Caps Lock warning ───────────────────────

function PasswordInput({
  value,
  onChange,
  disabled,
  placeholder = 'Password',
  autoComplete = 'current-password',
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show,    setShow]    = useState(false);
  const [capsOn,  setCapsOn]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inputRef.current !== document.activeElement) return;
      if (e.getModifierState) setCapsOn(e.getModifierState('CapsLock'));
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup',   onKey);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
  }, []);

  return (
    <div>
      <label style={{ display: 'block', fontSize: 15, fontWeight: 500, color: '#1F1611', marginBottom: 6 }}>
        {placeholder}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required
          autoComplete={autoComplete}
          placeholder="••••••••••"
          style={{
            width: '100%', height: 56, fontSize: 16,
            padding: '0 52px 0 16px',
            border: '1.5px solid #EADFD0', borderRadius: 12,
            background: '#FBF6EE', color: '#1F1611',
            outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
          onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((v) => !v)}
          style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F',
            display: 'flex', alignItems: 'center',
          }}
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {capsOn && (
        <p style={{ fontSize: 13, color: '#D9822B', marginTop: 4 }}>
          ⚠ Caps Lock is on
        </p>
      )}
    </div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────────

function TextInput({
  label, value, onChange, disabled, autoComplete = 'off',
}: {
  label: string; value: string; onChange: (v: string) => void;
  disabled: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 15, fontWeight: 500, color: '#1F1611', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        autoComplete={autoComplete}
        style={{
          width: '100%', height: 56, fontSize: 16, padding: '0 16px',
          border: '1.5px solid #EADFD0', borderRadius: 12,
          background: '#FBF6EE', color: '#1F1611',
          outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
        onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate    = useNavigate();
  const { setUser } = useAuthStore();

  const [tab,      setTab]     = useState<Tab>('owner');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'manager' | 'cashier'>('cashier');
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(false);
  const [shopLogo, setShopLogo] = useState('');

  useEffect(() => {
    settingsApi.get().then((res) => {
      const logo = (res.data as Record<string, unknown>)?.shopLogo as string | undefined;
      if (logo) setShopLogo(logo);
    }).catch(() => {});
  }, []);

  // Reset fields when switching tabs
  function switchTab(t: Tab) {
    setTab(t);
    setUsername('');
    setPassword('');
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = tab === 'owner'
        ? await authApi.ownerLogin(username, password)
        : await authApi.staffLogin(username, password, staffRole as Role);

      localStorage.setItem('accessToken',  res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      setUser(res.data.user);

      // Post-login redirect based on role
      const role = res.data.user.role;
      navigate(role === 'cashier' ? '/billing' : '/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FBF6EE', padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 440,
          background: '#fff', border: '1px solid #EADFD0', borderRadius: 20,
          boxShadow: '0 4px 20px rgba(43,27,20,0.10)', padding: '40px 36px',
        }}
      >
        {/* ── Brand ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, background: '#E8590C', borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            {shopLogo
              ? <img src={shopLogo} alt="Shop logo" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 12 }} />
              : <CakeSlice size={32} color="#fff" strokeWidth={2} />
            }
          </div>
          <h1 style={{
            fontFamily: '"DM Serif Display", serif',
            fontSize: 28, fontWeight: 700, color: '#1F1611', margin: 0,
          }}>
            Bakery CRM
          </h1>
          <p style={{ marginTop: 4, fontSize: 16, color: '#7A6A5F' }}>
            Sign in to your account
          </p>

          {/* Demo mode notice — only when VITE_DEMO_MODE=true */}
          {IS_DEMO && (
            <div style={{
              marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#FFF1DC', border: '1px solid #F5C88A',
              borderRadius: 9999, padding: '4px 14px',
            }}>
              <FlaskConical size={14} color="#D9822B" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#D9822B' }}>
                PROTOTYPE DEMO — sample data only
              </span>
            </div>
          )}
        </div>

        {/* ── Tab selector ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', background: '#EADFD0', borderRadius: 12, padding: 4, marginBottom: 24,
        }}>
          {(['owner', 'staff'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              style={{
                flex: 1, height: 44, borderRadius: 10, fontSize: 15, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'background 150ms',
                background: tab === t ? '#E8590C' : 'transparent',
                color:      tab === t ? '#fff'     : '#7A6A5F',
              }}
            >
              {t === 'owner' ? 'Owner Login' : 'Staff Login'}
            </button>
          ))}
        </div>

        {/* ── Form ────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TextInput
            label="Username"
            value={username}
            onChange={setUsername}
            disabled={loading}
            autoComplete="username"
          />

          {/* Staff tab: Role dropdown */}
          {tab === 'staff' && (
            <div>
              <label style={{ display: 'block', fontSize: 15, fontWeight: 500, color: '#1F1611', marginBottom: 6 }}>
                Role
              </label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as 'manager' | 'cashier')}
                disabled={loading}
                required
                style={{
                  width: '100%', height: 56, fontSize: 16, padding: '0 16px',
                  border: '1.5px solid #EADFD0', borderRadius: 12,
                  background: '#FBF6EE', color: '#1F1611', outline: 'none',
                  appearance: 'none',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
              >
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
          )}

          <PasswordInput
            value={password}
            onChange={setPassword}
            disabled={loading}
            autoComplete={tab === 'owner' ? 'current-password' : 'current-password'}
          />

          {/* Error */}
          {error && (
            <div style={{
              background: '#FDE5E0', borderRadius: 10, padding: '10px 14px',
              fontSize: 15, color: '#C0392B',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              height: 56, borderRadius: 12, fontSize: 17, fontWeight: 700, color: '#fff',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#F0A580' : '#E8590C',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 4,
            }}
          >
            <LogIn size={20} strokeWidth={2.5} />
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* ── Footer hint ─────────────────────────────────────────── */}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#7A6A5F', marginTop: 20 }}>
          {tab === 'owner'
            ? 'Owner Login is for the admin account only.'
            : 'Select your role and enter your credentials.'}
        </p>

        {IS_DEMO && (
          <div style={{
            marginTop: 16, background: '#FFF1DC', borderRadius: 10,
            padding: '12px 16px', border: '1px solid #F5C88A',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#D9822B', margin: '0 0 4px' }}>
              Demo credentials
            </p>
            <p style={{ fontSize: 13, color: '#1F1611', margin: 0 }}>
              Owner tab: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>admin</span>{' '}
              (any password)
            </p>
            <p style={{ fontSize: 13, color: '#1F1611', margin: '2px 0 0' }}>
              Staff tab: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>manager1</span>,{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>cashier1–3</span>{' '}
              (any password)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
