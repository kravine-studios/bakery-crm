import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { shiftApi } from '@/api';

export default function ShiftsPage() {
  const [openingFloat, setOpeningFloat] = useState('0');
  const [countedCash, setCountedCash] = useState('0');
  const [currentShiftId, setCurrentShiftId] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dayEndReport, setDayEndReport] = useState<any | null>(null);
  const [error, setError] = useState('');

  const openShift = async () => {
    try {
      const res = await shiftApi.open(parseFloat(openingFloat));
      setCurrentShiftId(res.data.shiftId);
      setError('');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed');
    }
  };

  const closeShift = async () => {
    if (!currentShiftId) return;
    try {
      const res = await shiftApi.close(currentShiftId, parseFloat(countedCash));
      setDayEndReport(res.data);
      setCurrentShiftId(null);
      setError('');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed');
    }
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div>
      <PageHeader title="Shifts" subtitle="Cash management and reconciliation" />

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Open Shift</h2>
          <label className="mb-1 block text-sm">Opening Cash Float</label>
          <input type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} className="mb-3 w-full rounded border border-slate-300 px-3 py-2" />
          <button onClick={openShift} disabled={!!currentShiftId} className="w-full rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600 disabled:opacity-50">
            {currentShiftId ? 'Shift Open' : 'Open Shift'}
          </button>
          {currentShiftId && <p className="mt-2 text-sm text-green-600">Shift #{currentShiftId} is open</p>}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Close Shift</h2>
          <label className="mb-1 block text-sm">Counted Cash</label>
          <input type="number" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} className="mb-3 w-full rounded border border-slate-300 px-3 py-2" />
          <button onClick={closeShift} disabled={!currentShiftId} className="w-full rounded-md bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50">
            Close & Reconcile
          </button>
        </Card>
      </div>

      {dayEndReport && (
        <Card className="mt-4">
          <h2 className="mb-3 text-lg font-semibold">Day-End Report</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Opening Float:</span><span>{formatCurrency((dayEndReport as { openingFloat: number }).openingFloat)}</span></div>
            <div className="flex justify-between"><span>Expected Cash:</span><span>{formatCurrency((dayEndReport as { expectedCash: number }).expectedCash)}</span></div>
            <div className="flex justify-between"><span>Counted Cash:</span><span>{formatCurrency((dayEndReport as { countedCash: number }).countedCash)}</span></div>
            <div className="flex justify-between font-bold"><span>Shortage/Excess:</span><span>{formatCurrency((dayEndReport as { shortage: number }).shortage)}</span></div>
          </div>
        </Card>
      )}
    </div>
  );
}

