import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { stockApi } from '@/api';

export default function StockPage() {
  const [tab, setTab] = useState<'finished' | 'expired' | 'wastage'>('finished');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetcher = tab === 'finished' ? stockApi.finished()
      : tab === 'expired' ? stockApi.expired()
      : stockApi.listWastage();
    fetcher.then((res) => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [tab]);

  return (
    <div>
      <PageHeader title="Stock" subtitle="Finished goods, expired items, and wastage tracking" />
      <div className="mb-4 flex gap-2">
        {(['finished', 'expired', 'wastage'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-2 text-sm capitalize ${tab === t ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {t === 'finished' ? 'Finished Goods' : t}
          </button>
        ))}
      </div>
      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={tab === 'wastage' ? [
              { key: 'product_name', header: 'Product' },
              { key: 'reason', header: 'Reason', render: (r) => <span className="capitalize">{r.reason.replace('_', ' ')}</span> },
              { key: 'quantity', header: 'Quantity', render: (r) => parseFloat(r.quantity).toFixed(2) },
              { key: 'costValue', header: 'Cost', render: (r) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(r.costValue) },
              { key: 'created_at', header: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
            ] : [
              { key: 'product_name', header: 'Product' },
              { key: 'batch_number', header: 'Batch' },
              { key: 'expiry_date', header: 'Expiry' },
              { key: 'currentStock', header: 'Stock', render: (r) => parseFloat(r.currentStock).toFixed(2) },
              { key: 'production_date', header: 'Produced', render: (r) => r.production_date ? new Date(r.production_date).toLocaleDateString() : '—' },
            ]}
            data={data}
          />
        )}
      </Card>
    </div>
  );
}

