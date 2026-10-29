import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { productionApi } from '@/api';

export default function ProductionPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productionApi.list().then((res) => { setBatches(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div>
      <PageHeader title="Production" subtitle="Batch tracking with MM-YY-NNN numbering" actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ New Batch</button>} />
      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'batchNumber', header: 'Batch No.' },
              { key: 'productName', header: 'Product' },
              { key: 'plannedQuantity', header: 'Planned', render: (r) => parseFloat(r.plannedQuantity).toFixed(2) },
              { key: 'actualQuantity', header: 'Actual', render: (r) => r.actualQuantity ? parseFloat(r.actualQuantity).toFixed(2) : '—' },
              { key: 'status', header: 'Status', render: (r) => <span className="capitalize rounded bg-slate-100 px-2 py-0.5 text-xs">{r.status.replace('_', ' ')}</span> },
              { key: 'productionCost', header: 'Cost', render: (r) => formatCurrency(r.productionCost) },
              { key: 'supervisorName', header: 'Supervisor' },
              { key: 'productionDate', header: 'Date', render: (r) => new Date(r.productionDate).toLocaleDateString() },
            ]}
            data={batches}
          />
        )}
      </Card>
    </div>
  );
}

