interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Optional right-side date pill */
  datePill?: string;
}

export default function PageHeader({ title, subtitle, actions, datePill }: PageHeaderProps) {
  return (
    <div className="mb-7 flex items-start justify-between gap-4">
      <div>
        <h1
          className="leading-tight"
          style={{
            fontFamily: '"DM Serif Display", serif',
            fontSize: '32px',
            fontWeight: 700,
            color: '#1F1611',
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5" style={{ fontSize: '17px', color: '#7A6A5F' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {datePill && (
          <span
            className="rounded-pill px-4 py-1.5 text-[14px] font-medium"
            style={{ background: '#EADFD0', color: '#7A6A5F' }}
          >
            {datePill}
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}
