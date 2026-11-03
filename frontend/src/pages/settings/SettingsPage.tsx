import { useEffect, useRef, useState } from 'react';
import { Save, RefreshCw, AlertTriangle, Upload, X as XIcon, ImageIcon } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Card }   from '@/components/common/Card';
import { settingsApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { IS_MOCK, IS_DEMO } from '@/api/client';
const USE_MOCK = IS_MOCK || IS_DEMO;

/**
 * Bonus Fix 3: Normalise any residual double-encoded UTF-8 characters
 * that may have been stored before the DB client_encoding fix.
 */
function normaliseUtf8(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/â€"/g,  '–')   // en-dash
    .replace(/â€"/g,  '—')   // em-dash
    .replace(/â€™/g, '\u2019') // right single quote
    .replace(/â€œ/g, '\u201C') // left double quote
    .replace(/â€/g,  '\u201D') // right double quote (catch-all)
    .replace(/Ã©/g,  'é')
    .replace(/Ã /g,  'à')
    .replace(/Â£/g,  '£')
    .replace(/â‚¹/g, '₹');
}

// ─── Styled helpers ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', height: 48, fontSize: 16, padding: '0 14px',
  border: '1.5px solid #EADFD0', borderRadius: 12,
  background: '#FBF6EE', color: '#1F1611', outline: 'none',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  width: '100%', fontSize: 16, padding: '12px 14px', lineHeight: 1.5,
  border: '1.5px solid #EADFD0', borderRadius: 12,
  background: '#FBF6EE', color: '#1F1611', outline: 'none',
  boxSizing: 'border-box', resize: 'vertical',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 15, fontWeight: 500, color: '#1F1611', marginBottom: 6,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 700, color: '#C98B4B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, borderBottom: '1px solid #F0EAE3', paddingBottom: 6 }}>
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ─── Logo branding card ───────────────────────────────────────────────────────

const MAX_LOGO_SIZE_KB = 300;
const ACCEPTED_TYPES   = ['image/png', 'image/jpeg', 'image/webp'];

function LogoBrandingCard({
  settings,
  update,
}: {
  settings: Record<string, unknown>;
  update: (key: string, value: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');
  const logoSrc = settings.shopLogo as string | undefined;

  function handleFile(file: File) {
    setLogoError('');
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLogoError('Invalid file type. Please upload PNG, JPG, or WebP.');
      return;
    }
    if (file.size > MAX_LOGO_SIZE_KB * 1024) {
      setLogoError(`File is too large (max ${MAX_LOGO_SIZE_KB}KB). Please compress and try again.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      update('shopLogo', dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <Card>
      <SectionLabel>Shop Logo / Branding</SectionLabel>
      <p style={{ fontSize: 14, color: '#7A6A5F', marginBottom: 16 }}>
        The logo appears in the sidebar, on printed bills, and on the login screen. Accepted formats: PNG, JPG, WebP. Max size: {MAX_LOGO_SIZE_KB}KB.
      </p>

      {/* Preview */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          display: 'flex', alignItems: 'center', gap: 20,
          background: '#FBF6EE', borderRadius: 14, padding: 20,
          border: '2px dashed #EADFD0', marginBottom: 16,
        }}
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt="Shop logo preview"
            style={{ height: 80, maxWidth: 160, objectFit: 'contain', borderRadius: 10, background: '#fff', border: '1px solid #EADFD0', padding: 6 }}
          />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 10, background: '#F0EAE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ImageIcon size={32} color="#C4B5A8" />
          </div>
        )}
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1F1611', marginBottom: 4 }}>
            {logoSrc ? 'Logo uploaded' : 'No logo uploaded'}
          </p>
          <p style={{ fontSize: 13, color: '#7A6A5F' }}>
            {logoSrc ? 'Drag a new image here to replace, or use the buttons below.' : 'Drag & drop an image here, or click Upload Logo.'}
          </p>
        </div>
      </div>

      {logoError && (
        <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '8px 14px', marginBottom: 12, color: '#C0392B', fontSize: 14 }}>
          {logoError}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 44, padding: '0 18px', borderRadius: 12,
            background: '#E8590C', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Upload size={16} />
          {logoSrc ? 'Replace Logo' : 'Upload Logo'}
        </button>

        {logoSrc && (
          <button
            onClick={() => { update('shopLogo', ''); setLogoError(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 44, padding: '0 18px', borderRadius: 12,
              background: '#FDE5E0', color: '#C0392B', border: '1px solid #FFAB91', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <XIcon size={16} />
            Remove Logo
          </button>
        )}
      </div>

      <p style={{ marginTop: 12, fontSize: 13, color: '#A89890' }}>
        Remember to click <strong>Save</strong> at the top to persist the logo.
      </p>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    settingsApi.get()
      .then((res) => {
        const raw = res.data as Record<string, unknown>;
        // Bonus Fix 3: normalise any double-encoded UTF-8 on load
        const clean: Record<string, unknown> = { ...raw };
        for (const key of ['shopName', 'address', 'invoiceFooter', 'phone', 'email'] as const) {
          if (typeof clean[key] === 'string') {
            clean[key] = normaliseUtf8(clean[key] as string);
          }
        }
        setSettings(clean);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const update = (key: string, value: unknown) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await settingsApi.update(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      if (USE_MOCK) {
        const { demoApi } = await import('@/api');
        await demoApi.reset();
        // Reload settings from fresh seed
        const res = await settingsApi.get();
        setSettings(res.data as Record<string, unknown>);
      }
      setShowResetConfirm(false);
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return <p style={{ padding: 40, textAlign: 'center', color: '#7A6A5F', fontSize: 17 }}>Loading…</p>;
  }
  if (!settings) return null;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Shop profile, tax setup, and configuration"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            {isAdmin && USE_MOCK && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={resetting}
                style={{
                  height: 48, padding: '0 18px', borderRadius: 12,
                  background: '#FDE5E0', color: '#C0392B',
                  border: '1px solid #FFAB91', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <RefreshCw size={16} strokeWidth={2.5} />
                Reset Demo Data
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                height: 48, padding: '0 20px', borderRadius: 12,
                background: saved ? '#4F7F4A' : saving ? '#F0A580' : '#E8590C',
                color: '#fff', border: 'none', fontSize: 16, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, transition: 'background 200ms',
              }}
            >
              <Save size={18} strokeWidth={2.5} />
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      />

      {/* Reset confirm dialog */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(31,22,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 400, boxShadow: '0 8px 32px rgba(43,27,20,0.18)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FDE5E0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <AlertTriangle size={26} color="#C8503A" strokeWidth={2} />
            </div>
            <h2 style={{ fontFamily: '"DM Serif Display", serif', fontSize: 22, color: '#1F1611', margin: '0 0 8px' }}>Reset demo data?</h2>
            <p style={{ fontSize: 16, color: '#7A6A5F', marginBottom: 24 }}>
              This will restore all products, customers, suppliers, purchases, stock, and orders to the original demo seed. Your changes will be lost.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ height: 48, borderRadius: 12, background: '#FBF6EE', color: '#7A6A5F', border: '1px solid #EADFD0', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReset} disabled={resetting} style={{ height: 48, borderRadius: 12, background: '#C8503A', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                {resetting ? 'Resetting…' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#FDE5E0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#C0392B', fontSize: 15 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>

        {/* Shop Profile */}
        <Card>
          <SectionLabel>Shop Profile</SectionLabel>
          <Field label="Shop Name">
            <input type="text" value={settings.shopName as string ?? ''} onChange={(e) => update('shopName', e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')} />
          </Field>
          <Field label="Address">
            {/* Bonus Fix 3: address field — rendered with UTF-8 safe value */}
            <textarea
              rows={3}
              value={settings.address as string ?? ''}
              onChange={(e) => update('address', e.target.value)}
              style={textareaStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
            />
          </Field>
          <Field label="Phone">
            <input type="text" value={settings.phone as string ?? ''} onChange={(e) => update('phone', e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')} />
          </Field>
          <Field label="Email">
            <input type="email" value={settings.email as string ?? ''} onChange={(e) => update('email', e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')} />
          </Field>
        </Card>

        {/* Tax & Compliance */}
        <Card>
          <SectionLabel>Tax &amp; Compliance</SectionLabel>
          <Field label="GSTIN">
            <input type="text" value={settings.gstin as string ?? ''} onChange={(e) => update('gstin', e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')} />
          </Field>
          <Field label="FSSAI Number">
            <input type="text" value={settings.fssaiNumber as string ?? ''} onChange={(e) => update('fssaiNumber', e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')} />
          </Field>
          <Field label="Invoice Prefix">
            <input type="text" value={settings.invoicePrefix as string ?? ''} onChange={(e) => update('invoicePrefix', e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')} />
          </Field>
          <Field label="Invoice Footer">
            <textarea rows={2}
              value={settings.invoiceFooter as string ?? ''}
              onChange={(e) => update('invoiceFooter', e.target.value)}
              style={textareaStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <input
              type="checkbox"
              id="taxInclusive"
              checked={settings.taxInclusive as boolean ?? false}
              onChange={(e) => update('taxInclusive', e.target.checked)}
              style={{ width: 20, height: 20, accentColor: '#E8590C', cursor: 'pointer' }}
            />
            <label htmlFor="taxInclusive" style={{ fontSize: 16, color: '#1F1611', cursor: 'pointer' }}>
              Tax-inclusive pricing
            </label>
          </div>
        </Card>

        {/* Receipt & Stock */}
        <Card>
          <SectionLabel>Receipt &amp; Stock</SectionLabel>
          <Field label="Receipt Paper Size">
            <select
              value={settings.receiptPaper as string ?? '80mm'}
              onChange={(e) => update('receiptPaper', e.target.value)}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
            >
              <option value="80mm">80mm Thermal</option>
              <option value="58mm">58mm Thermal</option>
              <option value="A4">A4</option>
            </select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="stockBlock"
              checked={settings.stockBlockZero as boolean ?? false}
              onChange={(e) => update('stockBlockZero', e.target.checked)}
              style={{ width: 20, height: 20, accentColor: '#E8590C', cursor: 'pointer' }}
            />
            <label htmlFor="stockBlock" style={{ fontSize: 16, color: '#1F1611', cursor: 'pointer' }}>
              Block billing when stock is zero
            </label>
          </div>
        </Card>

        {/* Loyalty */}
        <Card>
          <SectionLabel>Loyalty</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <input
              type="checkbox"
              id="loyaltyEnabled"
              checked={settings.loyaltyEnabled as boolean ?? false}
              onChange={(e) => update('loyaltyEnabled', e.target.checked)}
              style={{ width: 20, height: 20, accentColor: '#E8590C', cursor: 'pointer' }}
            />
            <label htmlFor="loyaltyEnabled" style={{ fontSize: 16, color: '#1F1611', cursor: 'pointer' }}>
              Enable loyalty points
            </label>
          </div>
          <Field label="Points per Rupee">
            <input
              type="number"
              step="0.01"
              value={settings.loyaltyPointsPerRupee as number ?? 0}
              onChange={(e) => update('loyaltyPointsPerRupee', parseFloat(e.target.value))}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
            />
          </Field>
          <Field label="Minimum Points to Redeem">
            <input
              type="number"
              value={settings.loyaltyMinRedeem as number ?? 0}
              onChange={(e) => update('loyaltyMinRedeem', parseInt(e.target.value, 10))}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
            />
          </Field>
        </Card>

        {/* Shop Logo / Branding */}
        {isAdmin && <LogoBrandingCard settings={settings} update={update} />}

      </div>
    </div>
  );
}
