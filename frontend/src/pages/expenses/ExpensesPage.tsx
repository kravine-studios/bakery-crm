import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import DataTable from '@/components/common/DataTable';
import { expenseApi } from '@/api';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    expenseApi.list().then((res) => { setExpenses(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Track expenses for profit calculation" actions={<button className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">+ Add Expense</button>} />
      <Card>
        {loading ? <p className="py-8 text-center text-slate-400">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'expense_date', header: 'Date', render: (r) => new Date(r.expense_date).toLocaleDateString() },
              { key: 'category', header: 'Category', render: (r) => <span className="capitalize">{r.category}</span> },
              { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
              { key: 'payment_mode', header: 'Mode', render: (r) => <span className="capitalize">{r.payment_mode}</span> },
              { key: 'description', header: 'Description' },
              { key: 'created_by_name', header: 'Recorded By' },
            ]}
            data={expenses}
          />
        )}
      </Card>
    </div>
  );
}

