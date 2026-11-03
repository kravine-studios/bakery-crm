import { useEffect }   from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi }      from '@/api';
import { IS_DEMO }      from '@/api/client';
import ProtectedRoute   from '@/components/common/ProtectedRoute';
import Layout           from '@/components/layout/Layout';
import PageShell        from '@/components/common/PageShell';
import NoAccessPage     from '@/pages/NoAccessPage';
import type { Role }    from '@/store/authStore';

// Pages
import LoginPage        from '@/pages/auth/LoginPage';
import DashboardPage    from '@/pages/dashboard/DashboardPage';
import BillingPage      from '@/pages/billing/BillingPage';
import PrintReceiptPage from '@/pages/bills/PrintReceiptPage';
import ProductsPage     from '@/pages/products/ProductsPage';
import SuppliersPage    from '@/pages/suppliers/SuppliersPage';
import RawMaterialsPage from '@/pages/rawMaterials/RawMaterialsPage';
import PurchasesPage    from '@/pages/purchases/PurchasesPage';
import ProductionPage   from '@/pages/production/ProductionPage';
import StockPage        from '@/pages/stock/StockPage';
import CustomersPage    from '@/pages/customers/CustomersPage';
import OrdersPage       from '@/pages/orders/OrdersPage';
import ShiftsPage       from '@/pages/shifts/ShiftsPage';
import ExpensesPage     from '@/pages/expenses/ExpensesPage';
import ReportsPage      from '@/pages/reports/ReportsPage';
import UsersPage        from '@/pages/users/UsersPage';
import SettingsPage     from '@/pages/settings/SettingsPage';

function S({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}

/**
 * Guard that redirects to /no-access for roles not in the allowed list.
 * Used client-side only — server enforces the real 403.
 */
function RoleGuard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/no-access" replace />;
  }
  return <>{children}</>;
}

/**
 * Guard that also checks per-user permission key in addition to role.
 * Admin always passes. Other roles must have the permission enabled.
 */
function PermissionGuard({ roles, permKey, children }: { roles: Role[]; permKey: string; children: React.ReactNode }) {
  const { user, hasPermission } = useAuthStore();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/no-access" replace />;
  }
  if (!hasPermission(permKey)) {
    return <Navigate to="/no-access" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, setUser, setHydrating, isHydrating } = useAuthStore();

  /**
   * On page load: if a token exists but `user` is null (e.g. after a hard refresh),
   * call /auth/me to rehydrate the user object. If that fails (token expired),
   * clear tokens and send to /login.
   */
  useEffect(() => {
    if (!isAuthenticated) {
      setHydrating(false);
      return;
    }
    authApi.me()
      .then((res) => {
        const u = res.data?.user ?? res.data;
        if (u?.id) setUser(u);
        else setHydrating(false);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setHydrating(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Print route — no sidebar, no auth guard needed */}
      <Route path="/bills/:id/print" element={<PrintReceiptPage />} />

      {/* No-access page — authenticated but wrong role */}
      <Route
        path="/no-access"
        element={
          <ProtectedRoute isHydrating={isHydrating}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<S><NoAccessPage /></S>} />
      </Route>

      <Route
        element={
          <ProtectedRoute isHydrating={isHydrating}>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* ── All roles ─────────────────────────────────────────── */}
        <Route path="/billing"    element={<PermissionGuard roles={['admin','manager','cashier']} permKey="billing"><BillingPage /></PermissionGuard>} />
        <Route path="/dashboard"  element={<PermissionGuard roles={['admin','manager','cashier']} permKey="dashboard"><S><DashboardPage /></S></PermissionGuard>} />
        <Route path="/customers"  element={<PermissionGuard roles={['admin','manager','cashier']} permKey="customers"><S><CustomersPage /></S></PermissionGuard>} />
        <Route path="/orders"     element={<PermissionGuard roles={['admin','manager','cashier']} permKey="orders"><S><OrdersPage /></S></PermissionGuard>} />
        <Route path="/shifts"     element={<PermissionGuard roles={['admin','manager','cashier']} permKey="shifts"><S><ShiftsPage /></S></PermissionGuard>} />

        {/* ── Admin + Manager only ──────────────────────────────── */}
        <Route path="/products"
          element={<PermissionGuard roles={['admin','manager']} permKey="products"><S><ProductsPage /></S></PermissionGuard>} />
        <Route path="/suppliers"
          element={<PermissionGuard roles={['admin','manager']} permKey="suppliers"><S><SuppliersPage /></S></PermissionGuard>} />
        <Route path="/raw-materials"
          element={<PermissionGuard roles={['admin','manager']} permKey="rawMaterials"><S><RawMaterialsPage /></S></PermissionGuard>} />
        <Route path="/purchases"
          element={<PermissionGuard roles={['admin','manager']} permKey="purchases"><S><PurchasesPage /></S></PermissionGuard>} />
        <Route path="/production"
          element={<PermissionGuard roles={['admin','manager']} permKey="production"><S><ProductionPage /></S></PermissionGuard>} />
        <Route path="/stock"
          element={<PermissionGuard roles={['admin','manager']} permKey="stock"><S><StockPage /></S></PermissionGuard>} />
        <Route path="/expenses"
          element={<PermissionGuard roles={['admin','manager']} permKey="expenses"><S><ExpensesPage /></S></PermissionGuard>} />
        <Route path="/reports"
          element={<PermissionGuard roles={['admin','manager']} permKey="reports"><S><ReportsPage /></S></PermissionGuard>} />
        <Route path="/users"
          element={<PermissionGuard roles={['admin','manager']} permKey="users"><S><UsersPage /></S></PermissionGuard>} />

        {/* ── Admin only ────────────────────────────────────────── */}
        <Route path="/settings"
          element={<PermissionGuard roles={['admin']} permKey="settings"><S><SettingsPage /></S></PermissionGuard>} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
