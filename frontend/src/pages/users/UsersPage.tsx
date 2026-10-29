import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { userApi } from '@/api';
import { useAuthStore } from '@/store/authStore';

export default function UsersPage() {
  const { hasRole, hasMinRole } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userApi.list(true).then((res) => { setUsers(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={hasRole('admin') ? 'Manage admin, manager, and cashier accounts' : 'Manage cashier accounts'}
        actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ Add User</button>}
      />
      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'username', header: 'Username' },
              { key: 'displayName', header: 'Display Name' },
              { key: 'role', header: 'Role', render: (r) => <span className="capitalize rounded bg-slate-100 px-2 py-0.5 text-xs">{r.role}</span> },
              { key: 'discountLimit', header: 'Discount Limit', render: (r) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(r.discountLimit) },
              { key: 'isActive', header: 'Active', render: (r) => r.isActive ? <span className="text-green-600">✓</span> : <span className="text-red-500">✕</span> },
            ]}
            data={users}
          />
        )}
      </Card>
    </div>
  );
}

