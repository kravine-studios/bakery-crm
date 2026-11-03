import type { Toast } from '@/hooks/useToast';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

const COLORS = {
  success: { bg: '#E8F5E9', color: '#4F7F4A', border: '#A5D6A7', Icon: CheckCircle },
  error:   { bg: '#FDE5E0', color: '#C0392B', border: '#FFAB91', Icon: AlertCircle },
  info:    { bg: '#E3F4F4', color: '#1E8E94', border: '#80DEEA', Icon: Info },
};

interface ToastListProps {
  toasts: Toast[];
}

export default function ToastList({ toasts }: ToastListProps) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      maxWidth: 380, pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const { bg, color, border, Icon } = COLORS[t.type];
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: bg, border: `1px solid ${border}`, color,
            borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
            fontSize: 16, fontWeight: 500,
            animation: 'slideIn 200ms ease',
          }}>
            <Icon size={18} strokeWidth={2} />
            {t.message}
          </div>
        );
      })}
      <style>{`@keyframes slideIn { from { opacity:0; transform: translateX(24px) } to { opacity:1; transform: translateX(0) } }`}</style>
    </div>
  );
}
