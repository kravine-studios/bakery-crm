import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/store/authStore';
import {
  LayoutDashboard, ReceiptText, ClipboardList, ShoppingBag, Users,
  Package, Truck, ShoppingCart, ChefHat, Boxes, Trash2,
  Wallet, Banknote, BarChart3, UserCog, Settings, LogOut,
  CakeSlice, Menu, X,
} from 'lucide-react';

// ─── Nav definition ───────────────────────────────────────────────────────────

type NavEntry = {
  path: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  roles: Role[];
};

type NavGroup = {
  title: string;
  items: NavEntry[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'SALES',
    items: [
      { path: '/dashboard', label: 'Dashboard',  Icon: LayoutDashboard, roles: ['admin','manager','cashier'] },
      { path: '/billing',   label: 'Billing',    Icon: ReceiptText,     roles: ['admin','manager','cashier'] },
      { path: '/orders',    label: 'Orders',     Icon: ClipboardList,   roles: ['admin','manager','cashier'] },
      { path: '/customers', label: 'Customers',  Icon: Users,           roles: ['admin','manager','cashier'] },
    ],
  },
  {
    title: 'STOCK',
    items: [
      { path: '/products',      label: 'Products',      Icon: Package,    roles: ['admin','manager'] },
      { path: '/suppliers',     label: 'Suppliers',     Icon: Truck,      roles: ['admin','manager'] },
      { path: '/purchases',     label: 'Purchases',     Icon: ShoppingCart, roles: ['admin','manager'] },
      { path: '/raw-materials', label: 'Raw Materials', Icon: CakeSlice,  roles: ['admin','manager'] },
      { path: '/production',    label: 'Production',    Icon: ChefHat,    roles: ['admin','manager'] },
      { path: '/stock',         label: 'Stock',         Icon: Boxes,      roles: ['admin','manager'] },
    ],
  },
  {
    title: 'MONEY',
    items: [
      { path: '/shifts',   label: 'Shifts',   Icon: Wallet,  roles: ['admin','manager','cashier'] },
      { path: '/expenses', label: 'Expenses', Icon: Banknote, roles: ['admin','manager'] },
      { path: '/reports',  label: 'Reports',  Icon: BarChart3, roles: ['admin','manager'] },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { path: '/users',    label: 'Users',    Icon: UserCog, roles: ['admin','manager'] },
      { path: '/settings', label: 'Settings', Icon: Settings, roles: ['admin'] },
    ],
  },
];

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const { user, logout, hasRole } = useAuthStore();
  const location = useLocation();

  const initial = user?.displayName?.[0]?.toUpperCase() ?? '?';
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : '';

  return (
    <div className="flex h-full flex-col" style={{ background: '#2B1B14' }}>

      {/* ── Brand ─────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 flex-col px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: '#E8590C' }}
          >
            <CakeSlice size={20} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <p
              className="text-[17px] font-bold leading-tight"
              style={{ fontFamily: '"DM Serif Display", serif', color: '#FBF6EE' }}
            >
              Bakery CRM
            </p>
            <p className="text-[12px] leading-tight" style={{ color: '#C98B4B' }}>
              Bakery &amp; Sweets
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-3 px-3 space-y-4">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => hasRole(...item.roles));
          if (!visible.length) return null;
          return (
            <div key={group.title}>
              <p
                className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: '#C98B4B' }}
              >
                {group.title}
              </p>
              <div className="space-y-0.5">
                {visible.map(({ path, label, Icon }) => {
                  const isActive = location.pathname === path ||
                    (path !== '/dashboard' && location.pathname.startsWith(path));
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={onNav}
                      className="flex items-center gap-3 rounded-[12px] px-3 transition-colors"
                      style={{
                        height: '48px',
                        fontSize: '17px',
                        fontWeight: isActive ? 600 : 400,
                        background: isActive ? '#E8590C' : 'transparent',
                        color: isActive ? '#fff' : 'rgba(251,246,238,0.75)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <Icon size={22} strokeWidth={2} />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User footer ───────────────────────────────────────── */}
      <div
        className="shrink-0 p-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        {user ? (
          <div className="flex items-center gap-2.5">
            {/* Avatar circle */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-bold"
              style={{ background: 'rgba(232,89,12,0.22)', color: '#E8590C' }}
            >
              {initial}
            </div>

            {/* Name + role */}
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[14px] font-semibold leading-tight"
                style={{ color: '#FBF6EE' }}
              >
                {user.displayName}
              </p>
              <span
                className="mt-0.5 inline-block rounded-pill px-2 py-0.5 text-[11px] font-medium capitalize leading-none"
                style={{ background: 'rgba(201,139,75,0.2)', color: '#C98B4B' }}
              >
                {roleLabel}
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              aria-label="Logout"
              className="flex shrink-0 h-10 w-10 items-center justify-center rounded-[10px] transition-colors"
              style={{ color: 'rgba(251,246,238,0.45)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.color = '#FBF6EE';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'rgba(251,246,238,0.45)';
              }}
            >
              <LogOut size={18} strokeWidth={2} />
            </button>
          </div>
        ) : (
          /* Skeleton while hydrating */
          <div className="flex items-center gap-2.5 px-1">
            <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-2.5 w-14 rounded" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Layout shell ─────────────────────────────────────────────────────────────

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#FBF6EE' }}>

      {/* ── Desktop sidebar (≥1024px) ──────────────────────────── */}
      <aside
        className="hidden lg:flex"
        style={{ width: '240px', minWidth: '240px', flexShrink: 0 }}
      >
        <div className="w-full">
          <SidebarContent />
        </div>
      </aside>

      {/* ── Mobile drawer backdrop ─────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile slide-in drawer ─────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex-col lg:hidden
          transition-transform duration-200
          ${drawerOpen ? 'flex translate-x-0' : '-translate-x-full'}
        `}
        style={{ width: '240px' }}
      >
        <div className="relative w-full h-full">
          <button
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ color: 'rgba(251,246,238,0.6)' }}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
          <SidebarContent onNav={() => setDrawerOpen(false)} />
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header
          className="flex h-14 shrink-0 items-center gap-3 px-4 lg:hidden"
          style={{
            background: '#2B1B14',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ color: 'rgba(251,246,238,0.8)' }}
            aria-label="Open navigation"
          >
            <Menu size={22} strokeWidth={2} />
          </button>
          <div className="flex items-center gap-2">
            <CakeSlice size={18} color="#E8590C" strokeWidth={2} />
            <span
              className="text-[16px] font-bold"
              style={{ fontFamily: '"DM Serif Display", serif', color: '#FBF6EE' }}
            >
              Bakery CRM
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
