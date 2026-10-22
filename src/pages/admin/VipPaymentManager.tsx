import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Submission = { id: string; user_id: string; amount_php: number; payment_reference: string; receipt_path: string; status: string; admin_note: string; submitted_at: string; is_test: boolean; risk_flags: string[] };

export default function VipPaymentManager() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [days, setDays] = useState(30);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [submissions, config] = await Promise.all([
      supabase.from('vip_payment_submissions').select('id,user_id,amount_php,payment_reference,receipt_path,status,admin_note,submitted_at,is_test,risk_flags').order('submitted_at', { ascending: false }).limit(200),
      supabase.from('site_settings').select('value').eq('key', 'public.vip_payment_config').maybeSingle(),
    ]);
    setRows((submissions.data as Submission[]) ?? []);
    const value = config.data?.value as { subscription_days?: number } | undefined;
    setDays(Number.isInteger(value?.subscription_days) && Number(value?.subscription_days) > 0 ? Number(value?.subscription_days) : 30);
    if (submissions.error) setMessage('Could not load VIP payment submissions. Check administrator database permissions.');
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(row: Submission, approve: boolean) {
    if (busyId) return;
    if (approve && !window.confirm(row.is_test ? 'Approve this TEST submission for workflow testing? This will NOT grant VIP.' : 'Confirm that you personally verified this transaction in your payment app and want to activate VIP?')) return;
    setBusyId(row.id); setMessage(null);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) { setMessage('Your session expired. Sign in again.'); setBusyId(null); return; }
    const note = notes[row.id] ?? row.admin_note ?? '';
    const { error } = await supabase.rpc('review_vip_payment_submission', { p_submission_id: row.id, p_approve: approve, p_admin_note: note, p_reviewer_id: userData.user.id, p_subscription_days: days });
    if (error) setMessage(error.message.includes('Administrator') ? 'Administrator access is required.' : error.message.includes('pending') ? 'This submission has already been reviewed.' : 'Could not complete the review. Please retry.');
    else setMessage(row.is_test ? (approve ? 'Test submission approved. No VIP access was granted.' : 'Test submission rejected. No VIP access was granted.') : (approve ? 'Payment approved and VIP activated.' : 'Payment submission rejected.'));
    await load(); setBusyId(null);
  }

  async function viewReceipt(row: Submission) {
    const { data, error } = await supabase.storage.from('vip-payment-receipts').createSignedUrl(row.receipt_path, 120);
    if (error || !data?.signedUrl) { setMessage('Could not open this receipt.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  return <section className="space-y-4">
    <div><h2 className="text-xl font-bold">VIP payment receipts</h2><p className="mt-1 text-sm text-zinc-400">Verify real transactions in your payment app before approving. Approval grants VIP for {days} days. Test submissions never grant VIP.</p></div>
    {message && <p role="status" className="text-sm text-[#C4B5FD]">{message}</p>}
    {rows.length === 0 ? <p className="text-sm text-zinc-400">No submissions yet.</p> : <ul className="space-y-3">{rows.map((row) => <li key={row.id} className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">₱{Number(row.amount_php).toLocaleString('en-PH')} · {row.payment_reference}</span><span className="badge">{row.is_test ? 'TEST · ' : ''}{row.status}</span></div>
      <p className="break-all text-xs text-zinc-500">User: {row.user_id}</p><p className="text-xs text-zinc-500">Submitted {new Date(row.submitted_at).toLocaleString()}</p>
      {row.risk_flags?.length > 0 && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><p className="font-semibold text-amber-200">Automatic screening flags — review carefully</p><ul className="mt-1 list-disc pl-5 text-amber-100">{row.risk_flags.map((flag) => <li key={flag}>{({ amount_mismatch: 'Submitted amount differs from VIP price', duplicate_transaction_reference: 'Transaction reference has been used before', duplicate_receipt_file: 'Identical receipt file submitted before', multiple_pending_submissions: 'User has multiple pending submissions' } as Record<string, string>)[flag] ?? flag.replaceAll('_', ' ')}</li>)}</ul><p className="mt-1 text-xs text-amber-200">Flags are warnings, not proof of fraud.</p></div>}
      <button type="button" className="btn-ghost" onClick={() => void viewReceipt(row)}>View receipt securely</button>
      <label className="block text-sm">Admin note (optional)<textarea className="input mt-1 min-h-16" maxLength={1000} value={notes[row.id] ?? row.admin_note ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} /></label>
      {row.status === 'pending' && <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={busyId === row.id} onClick={() => void review(row, true)}>{busyId === row.id ? 'Saving…' : row.is_test ? 'Approve test (no VIP)' : 'Verify & approve'}</button><button type="button" className="btn-ghost" disabled={busyId === row.id} onClick={() => void review(row, false)}>Reject</button></div>}
    </li>)}</ul>}
  </section>;
}