import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

type MembershipRole = 'basic' | 'vip';
type PaymentConfig = { enabled?: boolean; test_mode?: boolean; method_name?: string; account_name?: string; account_details?: string; instructions?: string; subscription_days?: number };
type Submission = { id: string; status: string; submitted_at: string; admin_note: string; is_test?: boolean; risk_flags?: string[] };

function manilaDayStart(): string {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(date + 'T00:00:00+08:00').toISOString();
}

export default function Account() {
  const { session, loading, isAdmin } = useAuth();
  const userId = session?.user.id;
  const [displayName, setDisplayName] = useState('');
  const [membershipRole, setMembershipRole] = useState<MembershipRole>('basic');
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null);
  const [freeDownloadsUsed, setFreeDownloadsUsed] = useState(0);
  const [plan, setPlan] = useState({ basic_daily_free_download_limit: 2, vip_price_php: 199 });
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [testSubmission, setTestSubmission] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function loadAccount() {
    if (!userId) return;
    const [profileResult, membershipResult, planResult, downloadsResult, paymentResult, submissionsResult] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
      supabase.from('user_memberships').select('role,vip_expires_at').eq('user_id', userId).maybeSingle(),
      supabase.from('site_settings').select('value').eq('key', 'public.membership').maybeSingle(),
      supabase.from('downloads').select('resource_id').eq('user_id', userId).gte('downloaded_at', manilaDayStart()),
      supabase.from('site_settings').select('value').eq('key', 'public.vip_payment_config').maybeSingle(),
      supabase.from('vip_payment_submissions').select('id,status,submitted_at,admin_note,is_test,risk_flags').eq('user_id', userId).order('submitted_at', { ascending: false }).limit(10),
    ]);
    setDisplayName(profileResult.data?.display_name ?? '');
    const membership = membershipResult.data;
    const active = membership?.role === 'vip' && (!membership.vip_expires_at || Date.parse(membership.vip_expires_at) > Date.now());
    setMembershipRole(active ? 'vip' : 'basic');
    setVipExpiresAt(active ? membership?.vip_expires_at ?? null : null);
    if (planResult.data?.value && typeof planResult.data.value === 'object') setPlan((current) => ({ ...current, ...(planResult.data!.value as object) }));
    if (paymentResult.data?.value && typeof paymentResult.data.value === 'object') setPaymentConfig(paymentResult.data.value as PaymentConfig);
    setSubmissions((submissionsResult.data as Submission[]) ?? []);
    const ids = (downloadsResult.data ?? []).map((row) => row.resource_id as string);
    if (ids.length) {
      const { data: freeResources } = await supabase.from('resources').select('id').in('id', [...new Set(ids)]).eq('price', 0);
      const freeIds = new Set((freeResources ?? []).map((row) => row.id));
      setFreeDownloadsUsed(ids.filter((id) => freeIds.has(id)).length);
    } else setFreeDownloadsUsed(0);
  }

  useEffect(() => { void loadAccount(); }, [userId]);

  if (loading) return <p className="p-8 text-center text-zinc-400">Loading…</p>;
  if (!session) return <Navigate to="/login" replace />;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (busy || !userId) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.from('profiles').update({ display_name: displayName.trim(), updated_at: new Date().toISOString() }).eq('id', userId);
    setMessage(error ? { text: 'Could not save your profile.', ok: false } : { text: 'Profile saved.', ok: true });
    setBusy(false);
  }

  async function submitReceipt(event: FormEvent) {
    event.preventDefault();
    if (!userId || !receipt || busy) return;
    const isTest = paymentConfig.test_mode === true && testSubmission;
    if (!isTest && !paymentConfig.enabled) {
      setMessage({ text: 'VIP payments are not configured yet. Please check back later.', ok: false });
      return;
    }
    if (!paymentReference.trim() || paymentReference.trim().length < 3) {
      setMessage({ text: 'Enter the payment reference or transaction ID.', ok: false });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(receipt.type) || receipt.size > 5 * 1024 * 1024) {
      setMessage({ text: 'Upload a JPG, PNG, WEBP, or PDF receipt up to 5 MB.', ok: false });
      return;
    }
    setBusy(true); setMessage(null);
    const ext = receipt.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const upload = await supabase.storage.from('vip-payment-receipts').upload(path, receipt, { contentType: receipt.type, upsert: false });
    if (upload.error) {
      setMessage({ text: 'Receipt upload failed. Please try again.', ok: false }); setBusy(false); return;
    }
    const digest = await crypto.subtle.digest('SHA-256', await receipt.arrayBuffer());
    const receiptHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const { error } = await supabase.from('vip_payment_submissions').insert({
      user_id: userId,
      amount_php: Number(plan.vip_price_php) || 199,
      payment_reference: paymentReference.trim(),
      receipt_path: path,
      status: 'pending',
      is_test: isTest,
      receipt_sha256: receiptHash,
      risk_flags: [],
    });
    if (error) {
      await supabase.storage.from('vip-payment-receipts').remove([path]);
      setMessage({ text: 'Could not submit your payment for review. Please try again.', ok: false });
    } else {
      setReceipt(null); setPaymentReference('');
      setMessage({ text: isTest ? 'Test submission created. It cannot grant real VIP access.' : 'Receipt submitted. VIP activates only after the administrator verifies and approves the payment.', ok: true });
      await loadAccount();
    }
    setBusy(false);
  }

  const dailyLimit = Number.isInteger(Number(plan.basic_daily_free_download_limit)) && Number(plan.basic_daily_free_download_limit) > 0 ? Number(plan.basic_daily_free_download_limit) : 2;
  const vipPrice = Number.isFinite(Number(plan.vip_price_php)) && Number(plan.vip_price_php) > 0 ? Number(plan.vip_price_php) : 199;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">Your account</h1>
      <div className="grid grid-cols-3 gap-2 text-center text-sm"><Link to="/library" className="btn-ghost">My Library</Link><Link to="/favorites" className="btn-ghost">Favorites</Link><Link to="/orders" className="btn-ghost">Orders</Link></div>
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Membership</h2><span className="badge">{membershipRole === 'vip' ? 'VIP Member' : 'Basic Member'}{isAdmin ? ' · Administrator' : ''}</span></div>
        {membershipRole === 'vip' ? <div><p className="text-sm text-zinc-300">You have unlimited free downloads.</p>{vipExpiresAt && <p className="mt-1 text-xs text-zinc-500">VIP expires {new Date(vipExpiresAt).toLocaleString()}</p>}</div>
          : <div><p className="text-sm text-zinc-300">Free downloads used today: <strong>{freeDownloadsUsed} / {dailyLimit}</strong></p><p className="mt-1 text-sm text-zinc-400">VIP costs ₱{vipPrice.toLocaleString('en-PH')} and gives unlimited free downloads for the subscription period.</p></div>}
        {membershipRole !== 'vip' && (paymentConfig.enabled || paymentConfig.test_mode) && (
          <div className="rounded-xl border border-[#2a2145] p-4 space-y-3">
            <h3 className="font-semibold">Subscribe to VIP</h3>
            {paymentConfig.test_mode && <p className="rounded-lg border border-amber-500/40 p-3 text-sm text-amber-200">Test mode is enabled. Test submissions can never grant real VIP access.</p>}
            <p className="text-sm text-zinc-300">Plan duration: {paymentConfig.subscription_days || 30} days</p>
            <div className="rounded-lg bg-black/20 p-3 text-sm">
              <p className="font-medium">{paymentConfig.method_name || 'Payment method'}</p>
              {paymentConfig.account_name && <p className="mt-1">Account name: {paymentConfig.account_name}</p>}
              {paymentConfig.account_details && <p className="mt-1 break-words whitespace-pre-wrap">Payment details: {paymentConfig.account_details}</p>}
              <p className="mt-2 whitespace-pre-wrap text-zinc-400">{paymentConfig.instructions || 'Pay the listed amount, then submit your receipt for review.'}</p>
            </div>
            <form onSubmit={submitReceipt} className="space-y-3">
              {paymentConfig.test_mode && <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 p-3 text-sm"><input className="mt-1" type="checkbox" checked={testSubmission} onChange={(event) => setTestSubmission(event.target.checked)} /><span><strong>Submit as a test</strong><span className="block text-xs text-zinc-400">No real payment is checked and no VIP access will be granted.</span></span></label>}
              <label className="block text-sm">Payment reference / transaction ID<input className="input mt-1" maxLength={160} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} required /></label>
              <label className="block text-sm">Upload payment receipt (JPG, PNG, WEBP, or PDF; max 5 MB)<input className="input mt-1" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setReceipt(event.target.files?.[0] ?? null)} required /></label>
              <button type="submit" className="btn-primary w-full" disabled={busy || !receipt}>{busy ? 'Submitting…' : testSubmission && paymentConfig.test_mode ? 'Submit test receipt' : `Submit receipt · ₱${vipPrice.toLocaleString('en-PH')}`}</button>
            </form>
            <p className="text-xs text-amber-300">Automatic checks flag duplicate references, identical files, amount mismatches, and repeated pending submissions. These are warnings, not proof of fraud. Verify real payments in your payment app before approving.</p>
          </div>
        )}
        {membershipRole !== 'vip' && !paymentConfig.enabled && <p className="text-sm text-zinc-500">VIP subscriptions are not available yet while the administrator configures payment details.</p>}
        {submissions.length > 0 && <div><h3 className="text-sm font-semibold">Payment submissions</h3><ul className="mt-2 space-y-2">{submissions.map((item) => <li key={item.id} className="rounded-lg border border-zinc-800 p-3 text-sm"><div className="flex justify-between gap-2"><span>{new Date(item.submitted_at).toLocaleString()}</span><span className="badge">{item.is_test ? 'TEST · ' : ''}{item.status}</span></div>{item.risk_flags && item.risk_flags.length > 0 && <p className="mt-1 text-amber-300">Flagged for review: {item.risk_flags.join(', ').replaceAll('_', ' ')}</p>}{item.admin_note && <p className="mt-1 text-zinc-400">{item.admin_note}</p>}</li>)}</ul></div>}
      </section>
      <form onSubmit={handleSave} className="card space-y-4 p-6">
        <p className="text-sm text-zinc-400">Signed in as {session.user.email} {isAdmin && <span className="badge ml-1">Administrator</span>}</p>
        <label className="block text-sm">Display name<input className="input mt-1" maxLength={60} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-[#C4B5FD]' : 'text-red-400'}>{message.text}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}