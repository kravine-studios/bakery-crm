import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { rawMaterialApi } from '@/api';

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rawMaterialApi.list().then((res) => { setMaterials(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Raw Materials" subtitle="Manage raw material inventory and stock levels" actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ Add Material</button>} />
      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'baseUnit', header: 'Unit' },
              { key: 'currentStock', header: 'Current Stock', render: (r) => parseFloat(r.currentStock).toFixed(2) },
              { key: 'minStockLevel', header: 'Min Level', render: (r) => parseFloat(r.minStockLevel).toFixed(2) },
              { key: 'earliestExpiry', header: 'Earliest Expiry' },
              { key: 'costMethod', header: 'Costing', render: (r) => <span className="uppercase">{r.costMethod}</span> },
            ]}
            data={materials}
          />
        )}
      </Card>
    </div>
  );
}

