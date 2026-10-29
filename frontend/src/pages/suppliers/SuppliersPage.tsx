import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { supplierApi } from '@/api';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supplierApi.list().then((res) => { setSuppliers(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Manage supplier master and ledger" actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ Add Supplier</button>} />
      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'phone', header: 'Phone' },
              { key: 'gstin', header: 'GSTIN' },
              { key: 'paymentTerms', header: 'Payment Terms' },
              { key: 'openingBalance', header: 'Opening Balance', render: (r) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(r.openingBalance) },
            ]}
            data={suppliers}
          />
        )}
      </Card>
    </div>
  );
}

