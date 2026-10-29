import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { customerApi } from '@/api';

export default function CustomersPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerApi.list({ search: search || undefined }).then((res) => { setCustomers(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <PageHeader title="Customers" subtitle="CRM with purchase history and loyalty" actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ Add Customer</button>} />
      <Card>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2" />
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'phone', header: 'Phone' },
              { key: 'loyaltyPoints', header: 'Loyalty Points' },
              { key: 'isCreditCustomer', header: 'Credit', render: (r) => r.isCreditCustomer ? <span className="text-blue-600">Yes</span> : 'No' },
              { key: 'creditBalance', header: 'Credit Balance', render: (r) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(r.creditBalance) },
            ]}
            data={customers}
          />
        )}
      </Card>
    </div>
  );
}
