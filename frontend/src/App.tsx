import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import PageShell from '@/components/common/PageShell';
import type { Role } from '@/store/authStore';

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

/** Wrap a non-billing page in consistent padding + cream background. */
function S({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}

export default function App() {
  const { isAuthenticated, setUser, setHydrating, isHydrating } = useAuthStore();

  /**
   * On mount: if a token exists but user is null (e.g. page refresh),
   * call /me to rehydrate the user object into the auth store.
   * This fixes the empty sidebar / "Guest" bug.
   */
  useEffect(() => {
    if (!isAuthenticated) {
      setHydrating(false);
      return;
    }
    authApi.me()
      .then((res) => {
        // /me returns { user: { ... } } or the user directly depending on mock
        const u = res.data?.user ?? res.data;
        if (u?.id) setUser(u);
        else setHydrating(false);
      })
      .catch(() => {
        // Token invalid / expired — clear and send to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setHydrating(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* ── Print route: NO sidebar, no Layout, no auth guard ── */}
      {/* Load in an iframe; caller calls iframe.contentWindow.print() */}
      <Route path="/bills/:id/print" element={<PrintReceiptPage />} />

      <Route
        element={
          <ProtectedRoute isHydrating={isHydrating}>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Billing: full-screen POS — manages its own layout */}
        <Route path="/billing" element={<BillingPage />} />

        {/* All other pages: wrapped in PageShell */}
        <Route path="/dashboard"     element={<S><DashboardPage /></S>} />
        <Route path="/customers"     element={<S><CustomersPage /></S>} />
        <Route path="/shifts"        element={<S><ShiftsPage /></S>} />
        <Route path="/orders"        element={<ProtectedRoute roles={['admin', 'manager', 'cashier'] as Role[]}><S><OrdersPage /></S></ProtectedRoute>} />

        <Route path="/products"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><ProductsPage /></S></ProtectedRoute>} />
        <Route path="/suppliers"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><SuppliersPage /></S></ProtectedRoute>} />
        <Route path="/raw-materials"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><RawMaterialsPage /></S></ProtectedRoute>} />
        <Route path="/purchases"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><PurchasesPage /></S></ProtectedRoute>} />
        <Route path="/production"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><ProductionPage /></S></ProtectedRoute>} />
        <Route path="/stock"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><StockPage /></S></ProtectedRoute>} />
        <Route path="/expenses"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><ExpensesPage /></S></ProtectedRoute>} />
        <Route path="/reports"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><ReportsPage /></S></ProtectedRoute>} />
        <Route path="/users"
          element={<ProtectedRoute roles={['admin', 'manager'] as Role[]}><S><UsersPage /></S></ProtectedRoute>} />
        <Route path="/settings"
          element={<ProtectedRoute roles={['admin'] as Role[]}><S><SettingsPage /></S></ProtectedRoute>} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
