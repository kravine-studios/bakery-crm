import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Standard content card — white, 16px radius, warm shadow */
export function Card({ children, className = '', style }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: '#fff',
        border: '1px solid #EADFD0',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 4px rgba(43,27,20,0.08)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  /** @deprecated — use lucide icon, not emoji */
  icon?: string;
  color?: string;
}

/** @deprecated  Use the new KpiCard in DashboardPage instead */
export function StatCard({ label, value, color = '#1F1611' }: StatCardProps) {
  return (
    <Card>
      <p style={{ fontSize: '16px', color: '#7A6A5F', fontWeight: 500 }}>{label}</p>
      <p
        className="mt-2 tabular"
        style={{
          fontFamily: '"DM Serif Display", serif',
          fontSize: '32px',
          fontWeight: 700,
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
    </Card>
  );
}
