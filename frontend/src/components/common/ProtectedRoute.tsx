import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
  /** True while /me is loading on page refresh — show skeleton instead of redirect */
  isHydrating?: boolean;
}

export default function ProtectedRoute({ children, roles, isHydrating }: ProtectedRouteProps) {
  const { isAuthenticated, hasRole, isHydrating: storeHydrating } = useAuthStore();
  const hydrating = isHydrating ?? storeHydrating;

  // While we're loading the user, show a blank espresso screen (not a flash to /login)
  if (hydrating) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center"
        style={{ background: '#2B1B14' }}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Pulsing skeleton */}
          <div className="h-10 w-10 animate-pulse rounded-full" style={{ background: '#E8590C33' }} />
          <div className="h-3 w-32 animate-pulse rounded" style={{ background: '#ffffff15' }} />
          <div className="h-2 w-20 animate-pulse rounded" style={{ background: '#ffffff10' }} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(...roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
