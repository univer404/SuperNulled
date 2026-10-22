import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

type Perks = { vip_badge: boolean; early_access: boolean; exclusive_resources: boolean; priority_support: boolean };
const DEFAULT_PERKS: Perks = { vip_badge: true, early_access: true, exclusive_resources: true, priority_support: false };
const PERK_LABELS: { key: keyof Perks; label: string; description: string }[] = [
  { key: 'vip_badge', label: 'VIP profile badge', description: 'Show a VIP badge beside the member name.' },
  { key: 'early_access', label: 'Early access', description: 'Configure early-access perks for future releases.' },
  { key: 'exclusive_resources', label: 'Exclusive resources', description: 'Configure VIP-only resource access.' },
  { key: 'priority_support', label: 'Priority support', description: 'Offer priority support to VIP members.' },
];
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default function MembershipSettings() {
  const [basicLimit, setBasicLimit] = useState(2);
  const [vipPrice, setVipPrice] = useState('199');
  const [perks, setPerks] = useState<Perks>(DEFAULT_PERKS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('site_settings').select('key,value').in('key', ['membership.config']);
      if (error) {
        setMessage({ text: 'Could not load membership settings. Check site_settings permissions.', ok: false });
        setLoading(false);
        return;
      }
      const config = asRecord(data?.find((item) => item.key === 'membership.config')?.value);
      const savedPerks = asRecord(config.perks);
      const limit = Number(config.basic_daily_free_download_limit ?? 2);
      const price = Number(config.vip_price_php ?? 199);
      setBasicLimit(Number.isInteger(limit) && limit >= 1 && limit <= 1000 ? limit : 2);
      setVipPrice(String(Number.isFinite(price) && price > 0 ? price : 199));
      setPerks({
        vip_badge: typeof savedPerks.vip_badge === 'boolean' ? savedPerks.vip_badge : DEFAULT_PERKS.vip_badge,
        early_access: typeof savedPerks.early_access === 'boolean' ? savedPerks.early_access : DEFAULT_PERKS.early_access,
        exclusive_resources: typeof savedPerks.exclusive_resources === 'boolean' ? savedPerks.exclusive_resources : DEFAULT_PERKS.exclusive_resources,
        priority_support: typeof savedPerks.priority_support === 'boolean' ? savedPerks.priority_support : DEFAULT_PERKS.priority_support,
      });
      setLoading(false);
    }
    void load();
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const price = Number(vipPrice);
    if (!Number.isInteger(basicLimit) || basicLimit < 1 || basicLimit > 1000) {
      setMessage({ text: 'The daily free-download limit must be between 1 and 1000.', ok: false }); return;
    }
    if (!Number.isFinite(price) || price <= 0 || price > 100000) {
      setMessage({ text: 'Enter a valid VIP price between ₱1 and ₱100,000.', ok: false }); return;
    }
    setBusy(true); setMessage(null);
    const now = new Date().toISOString();
    const config = { basic_daily_free_download_limit: basicLimit, vip_price_php: price, perks };
    const { error } = await supabase.from('site_settings').upsert([
      { key: 'membership.config', value: config, updated_at: now },
      { key: 'public.membership', value: config, updated_at: now },
    ]);
    setMessage(error ? { text: 'Could not save membership settings. Verify admin database permissions.', ok: false } : { text: 'Membership settings saved.', ok: true });
    setBusy(false);
  }

  if (loading) return <p className="text-sm text-zinc-400">Loading membership settings…</p>;
  return <form onSubmit={handleSave} className="space-y-5">
    <section className="card max-w-3xl space-y-4 p-5">
      <div><h2 className="text-xl font-bold">Membership plans</h2><p className="mt-1 text-sm text-zinc-400">Basic members have a daily free-download limit. VIP members get unlimited free downloads during their active subscription.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Basic Member free downloads per day<input className="input mt-1" type="number" min={1} max={1000} step={1} value={basicLimit} onChange={(event) => setBasicLimit(Number(event.target.value))} required /></label>
        <label className="block text-sm">VIP subscription price (PHP)<div className="mt-1 flex items-center gap-2"><span className="text-zinc-400">₱</span><input className="input" type="number" min={1} max={100000} step="1" value={vipPrice} onChange={(event) => setVipPrice(event.target.value)} required /></div></label>
      </div>
      <div className="rounded-xl border border-[#2a2145] p-4"><h3 className="font-semibold">VIP plan perks</h3><div className="mt-3 space-y-3">{PERK_LABELS.map((perk) => <label key={perk.key} className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={perks[perk.key]} onChange={(event) => setPerks((current) => ({ ...current, [perk.key]: event.target.checked }))} /><span><span className="font-medium">{perk.label}</span><span className="mt-0.5 block text-xs text-zinc-400">{perk.description}</span></span></label>)}</div><p className="mt-3 text-xs text-zinc-500">VIP downloads and the VIP badge are active. Other perks require their respective features to be implemented before being advertised.</p></div>
    </section>
    {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-[#C4B5FD]' : 'text-red-400'}>{message.text}</p>}
    <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save membership setup'}</button>
  </form>;
}