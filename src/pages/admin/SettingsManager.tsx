import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '@appdeploy/client';

const KEYS = { announcement: 'public.announcement', support: 'public.support_contact', maintenance: 'public.maintenance', turnstileEnabled: 'public.turnstile_enabled', turnstileSiteKey: 'public.turnstile_site_key', payment: 'public.vip_payment_config' } as const;
const MAX_TEXT_LENGTH = 300;
type PaymentConfig = { enabled: boolean; test_mode: boolean; method_name: string; account_name: string; account_details: string; instructions: string; subscription_days: number };

const DEFAULT_PAYMENT: PaymentConfig = { enabled: false, test_mode: false, method_name: 'Manual payment', account_name: '', account_details: '', instructions: 'Complete payment using the details shown, then upload your receipt for administrator review.', subscription_days: 30 };

export default function SettingsManager() {
  const [announcement, setAnnouncement] = useState('');
  const [supportContact, setSupportContact] = useState('');
  const [maintenance, setMaintenance] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [payment, setPayment] = useState<PaymentConfig>(DEFAULT_PAYMENT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    supabase.from('site_settings').select('key,value').like('key', 'public.%').then(({ data }) => {
      const values = Object.fromEntries((data ?? []).map((row) => [row.key as string, row.value as unknown]));
      setAnnouncement(typeof values[KEYS.announcement] === 'string' ? values[KEYS.announcement] as string : '');
      setSupportContact(typeof values[KEYS.support] === 'string' ? values[KEYS.support] as string : '');
      setMaintenance(values[KEYS.maintenance] === true);
      setTurnstileEnabled(values[KEYS.turnstileEnabled] === true);
      setTurnstileSiteKey(typeof values[KEYS.turnstileSiteKey] === 'string' ? values[KEYS.turnstileSiteKey] as string : '');
      const saved = values[KEYS.payment] as Partial<PaymentConfig> | undefined;
      if (saved) setPayment({ ...DEFAULT_PAYMENT, ...saved });
    });
    api.get('/api/turnstile/status').then(({ data }) => {
      if (data && typeof data.secretConfigured === 'boolean') setSecretConfigured(data.secretConfigured);
    }).catch(() => setSecretConfigured(false));
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (announcement.length > MAX_TEXT_LENGTH || supportContact.length > MAX_TEXT_LENGTH) {
      setMessage({ text: `Keep each text under ${MAX_TEXT_LENGTH} characters.`, ok: false }); return;
    }
    if (turnstileSiteKey && !/^[0-9A-Za-z_-]{10,100}$/.test(turnstileSiteKey.trim())) {
      setMessage({ text: 'Enter a valid Cloudflare Turnstile site key.', ok: false }); return;
    }
    if (turnstileEnabled && (!turnstileSiteKey.trim() || !secretConfigured)) {
      setMessage({ text: 'Add the Site Key and configure TURNSTILE_SECRET_KEY in AppDeploy backend secrets before enabling verification.', ok: false }); return;
    }
    if (!Number.isInteger(payment.subscription_days) || payment.subscription_days < 1 || payment.subscription_days > 365) {
      setMessage({ text: 'Subscription duration must be between 1 and 365 days.', ok: false }); return;
    }
    if (payment.enabled && (!payment.method_name.trim() || !payment.account_details.trim() || !payment.instructions.trim())) {
      setMessage({ text: 'Fill in the payment method, payment details, and instructions before enabling VIP subscriptions.', ok: false }); return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('site_settings').upsert([
      { key: KEYS.announcement, value: announcement.trim(), updated_at: now },
      { key: KEYS.support, value: supportContact.trim(), updated_at: now },
      { key: KEYS.maintenance, value: maintenance, updated_at: now },
      { key: KEYS.turnstileEnabled, value: turnstileEnabled, updated_at: now },
      { key: KEYS.turnstileSiteKey, value: turnstileSiteKey.trim(), updated_at: now },
      { key: KEYS.payment, value: payment, updated_at: now },
    ]);
    setMessage(error ? { text: 'Could not save settings.', ok: false } : { text: 'Settings saved.', ok: true });
    setBusy(false);
  }

  function updatePayment<K extends keyof PaymentConfig>(key: K, value: PaymentConfig[K]) {
    setPayment((current) => ({ ...current, [key]: value }));
  }

  return (
    <form onSubmit={handleSave} className="card max-w-xl space-y-4 p-4">
      <label className="block text-sm">Announcement banner (leave empty to hide)<input className="input mt-1" maxLength={MAX_TEXT_LENGTH} value={announcement} onChange={(e) => setAnnouncement(e.target.value)} /></label>
      <label className="block text-sm">Support contact (shown on the Support page)<input className="input mt-1" maxLength={MAX_TEXT_LENGTH} value={supportContact} onChange={(e) => setSupportContact(e.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} /> Maintenance mode (visitors see a notice; you can still log in)</label>
      <section className="space-y-4 rounded-xl border border-[#2a2145] p-4">
        <div><h2 className="font-semibold">Cloudflare Turnstile login protection</h2><p className="mt-1 text-xs text-zinc-400">The Site Key is public; the Secret Key must stay server-side.</p></div>
        <label className="block text-sm">Cloudflare Turnstile Site Key<input className="input mt-1" autoComplete="off" value={turnstileSiteKey} onChange={(e) => setTurnstileSiteKey(e.target.value.trim())} placeholder="0x4AAAA..." /></label>
        <div className="rounded-lg border border-zinc-700 p-3 text-xs text-zinc-300"><p>Secret Key status: <strong className={secretConfigured ? 'text-emerald-400' : 'text-amber-300'}>{secretConfigured ? 'Configured' : 'Not configured'}</strong></p><p className="mt-1">Configure the Cloudflare Secret Key as an AppDeploy backend secret named <code>TURNSTILE_SECRET_KEY</code>.</p></div>
        <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={turnstileEnabled} onChange={(e) => setTurnstileEnabled(e.target.checked)} /><span>Require Cloudflare verification on login and signup</span></label>
      </section>
      <section className="space-y-4 rounded-xl border border-[#2a2145] p-4">
        <div><h2 className="font-semibold">VIP subscription payment setup</h2><p className="mt-1 text-xs text-zinc-400">Configure your preferred payment details now or leave subscriptions disabled until ready. Users upload receipts; you review them before VIP is activated.</p></div>
        <label className="block text-sm">Payment method name<input className="input mt-1" maxLength={80} value={payment.method_name} onChange={(e) => updatePayment('method_name', e.target.value)} placeholder="GCash, Maya, bank transfer, etc." /></label>
        <label className="block text-sm">Account / recipient name<input className="input mt-1" maxLength={120} value={payment.account_name} onChange={(e) => updatePayment('account_name', e.target.value)} /></label>
        <label className="block text-sm">Payment details<textarea className="input mt-1 min-h-24" maxLength={1000} value={payment.account_details} onChange={(e) => updatePayment('account_details', e.target.value)} placeholder="Account number, payment link, or QR image URL (never put a PIN or password here)" /></label>
        <label className="block text-sm">Instructions shown to subscribers<textarea className="input mt-1 min-h-24" maxLength={1200} value={payment.instructions} onChange={(e) => updatePayment('instructions', e.target.value)} /></label>
        <label className="block text-sm">Subscription duration (days)<input className="input mt-1" type="number" min={1} max={365} value={payment.subscription_days} onChange={(e) => updatePayment('subscription_days', Number(e.target.value))} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={payment.enabled} onChange={(e) => updatePayment('enabled', e.target.checked)} /> Enable real VIP payment submissions</label>
        <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 p-3 text-sm"><input className="mt-1" type="checkbox" checked={payment.test_mode} onChange={(e) => updatePayment('test_mode', e.target.checked)} /><span><strong>Enable isolated test mode</strong><span className="mt-1 block text-xs text-zinc-400">Allows test submissions to exercise the review workflow. Test submissions are labelled and can never grant VIP access, even if approved.</span></span></label>
        <p className="text-xs text-amber-300">Automatic screening flags duplicate transaction references, identical receipt files, mismatched amounts, and repeated pending submissions. These warnings do not prove fraud. Verify every real payment in your payment app.</p>
      </section>
      {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-[#C4B5FD]' : 'text-red-400'}>{message.text}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
    </form>
  );
}