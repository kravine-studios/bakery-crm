/**
 * EditDrawer — slide-in panel from the right for admin edit forms.
 *
 * Usage:
 *   <EditDrawer
 *     title="Edit Supplier"
 *     open={!!editTarget}
 *     onClose={() => setEditTarget(null)}
 *     onSave={handleSave}
 *     saving={saving}
 *     error={error}
 *   >
 *     <DrawerField label="Name" ... />
 *     ...
 *   </EditDrawer>
 */

import { ReactNode } from 'react';
import { X, Save } from 'lucide-react';

interface EditDrawerProps {
  title:      string;
  open:       boolean;
  onClose:    () => void;
  onSave:     () => void;
  saving?:    boolean;
  error?:     string;
  children:   ReactNode;
}

export default function EditDrawer({
  title, open, onClose, onSave, saving = false, error, children,
}: EditDrawerProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(31,22,17,0.45)',
        }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 'min(480px, 100vw)',
          background: '#fff',
          boxShadow: '-4px 0 24px rgba(43,27,20,0.14)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #EADFD0',
          flexShrink: 0,
        }}>
          <h2 style={{
            fontFamily: '"DM Serif Display", serif',
            fontSize: 22, fontWeight: 700, color: '#1F1611', margin: 0,
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 10,
              background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5F',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#FBF6EE')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div style={{
              background: '#FDE5E0', borderRadius: 10, padding: '10px 14px',
              marginBottom: 20, fontSize: 15, color: '#C0392B',
            }}>
              {error}
            </div>
          )}
          {children}
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0,
          padding: '16px 24px',
          borderTop: '1px solid #EADFD0',
          display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12,
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              height: 48, borderRadius: 12, fontSize: 16, fontWeight: 600,
              background: '#FBF6EE', color: '#7A6A5F', border: '1px solid #EADFD0', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              height: 48, borderRadius: 12, fontSize: 16, fontWeight: 700,
              background: saving ? '#F0A580' : '#E8590C', color: '#fff',
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Save size={18} strokeWidth={2.5} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Reusable form field components ────────────────────────────────────────────

interface FieldProps {
  label:      string;
  required?:  boolean;
  children:   ReactNode;
  hint?:      string;
}

export function DrawerSection({ title }: { title: string }) {
  return (
    <p style={{
      fontSize: 13, fontWeight: 700, color: '#C98B4B',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      margin: '24px 0 12px',
      borderBottom: '1px solid #F0EAE3', paddingBottom: 6,
    }}>
      {title}
    </p>
  );
}

export function DrawerField({ label, required, children, hint }: FieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 15, fontWeight: 500, color: '#1F1611', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: '#C8503A', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 13, color: '#7A6A5F', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

// Common input styles
const baseInput: React.CSSProperties = {
  width: '100%', height: 48, fontSize: 16, padding: '0 14px',
  border: '1.5px solid #EADFD0', borderRadius: 12,
  background: '#FBF6EE', color: '#1F1611', outline: 'none',
  boxSizing: 'border-box',
};

export function DrawerInput({
  value, onChange, type = 'text', placeholder, disabled,
}: {
  value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...baseInput, opacity: disabled ? 0.6 : 1 }}
      onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
      onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
    />
  );
}

export function DrawerSelect({
  value, onChange, options, disabled,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ ...baseInput, appearance: 'none', cursor: 'pointer', opacity: disabled ? 0.6 : 1 }}
      onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
      onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function DrawerTextarea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        ...baseInput, height: 'auto', padding: '12px 14px',
        resize: 'vertical', lineHeight: 1.5,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
      onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
    />
  );
}
