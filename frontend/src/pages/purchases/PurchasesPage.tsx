import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { purchaseApi } from '@/api';

export default function PurchasesPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    purchaseApi.listReceipts().then((res) => { setReceipts(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div>
      <PageHeader title="Purchases" subtitle="Goods received notes and supplier payments" actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ New GRN</button>} />
      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'grn_number', header: 'GRN No.' },
              { key: 'supplier_name', header: 'Supplier' },
              { key: 'receipt_date', header: 'Date', render: (r) => new Date(r.receipt_date).toLocaleDateString() },
              { key: 'grandTotal', header: 'Total', render: (r) => formatCurrency(r.grandTotal) },
              { key: 'received_by_name', header: 'Received By' },
            ]}
            data={receipts}
          />
        )}
      </Card>
    </div>
  );
}

