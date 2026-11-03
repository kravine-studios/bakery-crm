/**
 * Small "View only" badge shown on pages where the current user
 * has read access but no edit / delete rights (Manager and Cashier).
 * Rendered by the page itself — does not appear for Admin.
 */
import { Eye } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function ViewOnlyBadge() {
  const { user } = useAuthStore();
  if (user?.role === 'admin') return null;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: '#E3F4F4', color: '#1E8E94',
        borderRadius: 9999, padding: '4px 14px',
        fontSize: 14, fontWeight: 600, marginBottom: 16,
        userSelect: 'none',
      }}
    >
      <Eye size={14} strokeWidth={2} />
      View only
    </span>
  );
}
