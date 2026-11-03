/**
 * OwnerActions — Edit (pencil) and Delete (trash) icon buttons.
 * Renders ONLY for the admin role. Completely absent from the DOM for
 * manager and cashier — not greyed out, not disabled, just not rendered.
 *
 * Usage:
 *   <OwnerActions
 *     onEdit={() => openEditDrawer(record)}
 *     onDelete={() => confirmDelete(record)}
 *   />
 */

import { Pencil, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface OwnerActionsProps {
  onEdit?:   () => void;
  onDelete?: () => void;
  editLabel?:   string;
  deleteLabel?: string;
  disabled?: boolean;
}

export default function OwnerActions({
  onEdit,
  onDelete,
  editLabel   = 'Edit',
  deleteLabel = 'Delete',
  disabled    = false,
}: OwnerActionsProps) {
  const { user } = useAuthStore();

  // Hard gate — absolutely nothing renders for non-admin
  if (user?.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {onEdit && (
        <button
          onClick={onEdit}
          disabled={disabled}
          aria-label={editLabel}
          title={editLabel}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:  40, height: 40,
            borderRadius: 8,
            border: 'none',
            background: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: disabled ? '#C4B5A8' : '#7A6A5F',
            transition: 'background 120ms',
          }}
          onMouseEnter={(e) => {
            if (!disabled) (e.currentTarget as HTMLElement).style.background = '#FBF6EE';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'none';
          }}
        >
          <Pencil size={17} strokeWidth={2} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={disabled}
          aria-label={deleteLabel}
          title={deleteLabel}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:  40, height: 40,
            borderRadius: 8,
            border: 'none',
            background: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: disabled ? '#C4B5A8' : '#C8503A',
            transition: 'background 120ms',
          }}
          onMouseEnter={(e) => {
            if (!disabled) (e.currentTarget as HTMLElement).style.background = '#FDE5E0';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'none';
          }}
        >
          <Trash2 size={17} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
