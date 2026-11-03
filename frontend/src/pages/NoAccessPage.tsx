/**
 * Shown when a cashier navigates to a URL they are not allowed to see.
 * No edit controls, no sensitive data — just a friendly redirect.
 */
import { useNavigate } from 'react-router-dom';
import { ShieldOff }   from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function NoAccessPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const dest     = user?.role === 'cashier' ? '/billing' : '/dashboard';

  return (
    <div
      style={{
        minHeight: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#FBF6EE', padding: 40, textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: 20, marginBottom: 24,
          background: '#FDE5E0', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ShieldOff size={36} color="#C8503A" strokeWidth={1.8} />
      </div>

      <h1
        style={{
          fontFamily: '"DM Serif Display", serif',
          fontSize: 28, fontWeight: 700, color: '#1F1611', margin: '0 0 12px',
        }}
      >
        You don't have access to this page
      </h1>

      <p style={{ fontSize: 17, color: '#7A6A5F', maxWidth: 420, margin: '0 0 32px' }}>
        Your account ({user?.role ?? 'unknown'}) doesn't have permission to view this section.
        Contact the admin if you think this is a mistake.
      </p>

      <button
        onClick={() => navigate(dest)}
        style={{
          height: 52, padding: '0 32px', borderRadius: 12, fontSize: 17, fontWeight: 600,
          background: '#E8590C', color: '#fff', border: 'none', cursor: 'pointer',
        }}
      >
        {user?.role === 'cashier' ? 'Go to Billing' : 'Go to Dashboard'}
      </button>
    </div>
  );
}
