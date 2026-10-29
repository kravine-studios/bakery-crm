import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { productApi, categoryApi } from '@/api';

interface Product {
  id: number;
  name: string;
  productType: 'produced' | 'traded';
  sellingPrice: number;
  costPrice: number;
  gstRate: number;
  sellingUnit: string;
  isActive: boolean;
  sku: string | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await productApi.list({ search: search || undefined, active: true });
        setProducts(res.data);
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [search]);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your product catalog"
        actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ Add Product</button>}
      />
      <Card>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2"
        />
        {loading ? (
          <p className="py-8 text-center text-slate-400">Loading...</p>
        ) : (
          <DataTable
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'productType', header: 'Type', render: (r) => <span className="capitalize">{r.productType}</span> },
              { key: 'sku', header: 'SKU' },
              { key: 'sellingPrice', header: 'Selling Price', render: (r) => formatCurrency(r.sellingPrice) },
              { key: 'costPrice', header: 'Cost Price', render: (r) => formatCurrency(r.costPrice) },
              { key: 'gstRate', header: 'GST %', render: (r) => `${r.gstRate}%` },
              { key: 'sellingUnit', header: 'Unit' },
            ]}
            data={products}
          />
        )}
      </Card>
    </div>
  );
}
