/**
 * PageShell wraps every page except BillingPage with:
 *  - Cream background
 *  - 32px horizontal + 28px vertical padding
 *  - Max-content-width cap at 1440px
 *
 * BillingPage manages its own full-height layout.
 */
interface PageShellProps {
  children: React.ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <div
      className="min-h-full"
      style={{ background: '#FBF6EE', padding: '28px 32px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box', width: '100%' }}
    >
      {children}
    </div>
  );
}
