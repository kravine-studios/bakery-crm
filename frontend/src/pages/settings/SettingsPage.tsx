import { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { settingsApi } from '@/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.get().then((res) => { setSettings(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.update(settings!);
      setSaving(false);
    } catch {
      setSaving(false);
    }
  };

  const update = (key: string, value: unknown) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  if (loading) return <p className="py-8 text-center text-slate-400">Loading...</p>;
  if (!settings) return null;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Shop profile, tax setup, and configuration" actions={
        <button onClick={handleSave} disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      } />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Shop Profile</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm">Shop Name</label>
              <input type="text" value={settings.shopName as string} onChange={(e) => update('shopName', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm">Address</label>
              <textarea value={settings.address as string ?? ''} onChange={(e) => update('address', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" rows={2} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Phone</label>
              <input type="text" value={settings.phone as string ?? ''} onChange={(e) => update('phone', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm">Email</label>
              <input type="email" value={settings.email as string ?? ''} onChange={(e) => update('email', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Tax & Compliance</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm">GSTIN</label>
              <input type="text" value={settings.gstin as string ?? ''} onChange={(e) => update('gstin', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm">FSSAI Number</label>
              <input type="text" value={settings.fssaiNumber as string ?? ''} onChange={(e) => update('fssaiNumber', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm">Invoice Prefix</label>
              <input type="text" value={settings.invoicePrefix as string} onChange={(e) => update('invoicePrefix', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm">Invoice Footer</label>
              <input type="text" value={settings.invoiceFooter as string} onChange={(e) => update('invoiceFooter', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="taxInclusive" checked={settings.taxInclusive as boolean} onChange={(e) => update('taxInclusive', e.target.checked)} className="rounded" />
              <label htmlFor="taxInclusive" className="text-sm">Tax-inclusive pricing</label>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Receipt & Stock</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm">Receipt Paper Size</label>
              <select value={settings.receiptPaper as string} onChange={(e) => update('receiptPaper', e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2">
                <option value="80mm">80mm Thermal</option>
                <option value="58mm">58mm Thermal</option>
                <option value="A4">A4</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="stockBlock" checked={settings.stockBlockZero as boolean} onChange={(e) => update('stockBlockZero', e.target.checked)} className="rounded" />
              <label htmlFor="stockBlock" className="text-sm">Block billing when stock is zero</label>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Loyalty</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="loyaltyEnabled" checked={settings.loyaltyEnabled as boolean} onChange={(e) => update('loyaltyEnabled', e.target.checked)} className="rounded" />
              <label htmlFor="loyaltyEnabled" className="text-sm">Enable loyalty points</label>
            </div>
            <div>
              <label className="mb-1 block text-sm">Points per Rupee</label>
              <input type="number" step="0.01" value={settings.loyaltyPointsPerRupee as number} onChange={(e) => update('loyaltyPointsPerRupee', parseFloat(e.target.value))} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm">Minimum Points to Redeem</label>
              <input type="number" value={settings.loyaltyMinRedeem as number} onChange={(e) => update('loyaltyMinRedeem', parseInt(e.target.value, 10))} className="w-full rounded border border-slate-300 px-3 py-2" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
