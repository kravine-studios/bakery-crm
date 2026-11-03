/**
 * Reusable confirm-delete dialog.
 * Requires a reason (text input) for financial/stock records.
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDeleteDialogProps {
  recordName:    string;          // e.g. "Product: Kaju Katli"
  requireReason?: boolean;        // financial/stock records need a reason
  onConfirm:    (reason?: string) => void;
  onCancel:     () => void;
}

export default function ConfirmDeleteDialog({
  recordName, requireReason = false, onConfirm, onCancel,
}: ConfirmDeleteDialogProps) {
  const [reason, setReason] = useState('');

  const canConfirm = !requireReason || reason.trim().length >= 3;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(31,22,17,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, padding: '32px 28px', width: 420,
          boxShadow: '0 8px 32px rgba(43,27,20,0.18)',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: '#FDE5E0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <AlertTriangle size={26} color="#C8503A" strokeWidth={2} />
        </div>

        <h2 style={{ fontFamily: '"DM Serif Display", serif', fontSize: 22, color: '#1F1611', margin: '0 0 8px' }}>
          Delete record?
        </h2>
        <p style={{ fontSize: 16, color: '#7A6A5F', margin: '0 0 20px' }}>
          You are about to delete: <strong style={{ color: '#1F1611' }}>{recordName}</strong>.
          {requireReason
            ? ' This action is recorded in the audit log. A reason is required.'
            : ' This action is recorded in the audit log.'}
        </p>

        {requireReason && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 15, color: '#1F1611', marginBottom: 6 }}>
              Reason <span style={{ color: '#C8503A' }}>*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being deleted?"
              autoFocus
              style={{
                width: '100%', height: 48, fontSize: 15, padding: '0 14px',
                border: '1.5px solid #EADFD0', borderRadius: 10,
                background: '#FBF6EE', color: '#1F1611', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              height: 48, borderRadius: 12, fontSize: 16, fontWeight: 600,
              background: '#FBF6EE', color: '#7A6A5F', border: '1px solid #EADFD0', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(requireReason ? reason : undefined)}
            disabled={!canConfirm}
            style={{
              height: 48, borderRadius: 12, fontSize: 16, fontWeight: 700,
              background: canConfirm ? '#C8503A' : '#F0A580', color: '#fff',
              border: 'none', cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
