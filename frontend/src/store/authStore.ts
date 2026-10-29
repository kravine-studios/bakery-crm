import { create } from 'zustand';

export type Role = 'admin' | 'manager' | 'cashier';

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
  displayName: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrating: boolean;   // true while /me is loading on startup
  setUser: (user: AuthUser) => void;
  setHydrating: (v: boolean) => void;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
  hasMinRole: (minRole: Role) => boolean;
}

const ROLE_RANK: Record<Role, number> = {
  admin: 3,
  manager: 2,
  cashier: 1,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isHydrating: !!localStorage.getItem('accessToken'), // start hydrating if token present

  setUser: (user) => {
    set({ user, isAuthenticated: true, isHydrating: false });
  },

  setHydrating: (v) => {
    set({ isHydrating: v });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false, isHydrating: false });
  },

  hasRole: (...roles: Role[]) => {
    const u = get().user;
    return u ? roles.includes(u.role) : false;
  },

  hasMinRole: (minRole: Role) => {
    const u = get().user;
    return u ? ROLE_RANK[u.role] >= ROLE_RANK[minRole] : false;
  },
}));
