import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { orderApi } from '@/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderApi.list().then((res) => { setOrders(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div>
      <PageHeader title="Orders" subtitle="Custom cakes and bulk orders" actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ New Order</button>} />
      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'orderNumber', header: 'Order No.' },
              { key: 'customerName', header: 'Customer' },
              { key: 'deliveryType', header: 'Type', render: (r) => <span className="capitalize">{r.deliveryType}</span> },
              { key: 'deliveryDate', header: 'Delivery Date' },
              { key: 'totalAmount', header: 'Total', render: (r) => formatCurrency(r.totalAmount) },
              { key: 'balanceDue', header: 'Balance Due', render: (r) => formatCurrency(r.balanceDue) },
              { key: 'status', header: 'Status', render: (r) => <span className="capitalize rounded bg-slate-100 px-2 py-0.5 text-xs">{r.status.replace('_', ' ')}</span> },
            ]}
            data={orders}
          />
        )}
      </Card>
    </div>
  );
}

