import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ResourceCard from '../components/ResourceCard';
import RequireLogin from '../components/RequireLogin';
import { useAuth } from '../lib/auth';
import { startDownload } from '../lib/functions';
import { RESOURCE_COLUMNS, formatPrice, supabase, type Resource } from '../lib/supabase';

interface Joined { resources: Resource | null }

function useJoinedResources(table: 'favorites' | 'purchases') {
    const { session } = useAuth();
    const userId = session?.user.id;
    const [items, setItems] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        supabase.from(table).select(`resources(${RESOURCE_COLUMNS})`).eq('user_id', userId).order('created_at', { ascending: false })
            .then(({ data }) => {
                const rows = (data ?? []) as unknown as Joined[];
                setItems(rows.map((row) => row.resources).filter((r): r is Resource => r !== null));
                setLoading(false);
            });
    }, [table, userId]);
    return { items, loading };
}

function FavoritesGrid() {
    const { items, loading } = useJoinedResources('favorites');
    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            <h1 className="mb-6 text-3xl font-bold">Favorites</h1>
            {loading ? <p className="text-zinc-400">Loading…</p> : items.length === 0 ? (
                <div className="card p-10 text-center text-zinc-400">You have not saved any favorites yet.</div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((r) => <ResourceCard key={r.id} resource={r} />)}</div>
            )}
        </div>
    );
}

function LibraryGrid() {
    const { items, loading } = useJoinedResources('purchases');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleDownload(id: string) {
        if (busyId) return;
        setBusyId(id);
        setError(null);
        try { await startDownload(id); } catch (err) { setError(err instanceof Error ? err.message : 'Download failed.'); }
        setBusyId(null);
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            <h1 className="mb-6 text-3xl font-bold">My Library</h1>
            {error && <p role="alert" className="mb-4 text-red-400">{error}</p>}
            {loading ? <p className="text-zinc-400">Loading…</p> : items.length === 0 ? (
                <div className="card p-10 text-center text-zinc-400">You have not purchased any resources yet. Free resources can be downloaded from their page.</div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((r) => (
                    <div key={r.id} className="space-y-2">
                        <ResourceCard resource={r} />
                        <button type="button" className="btn-primary w-full" onClick={() => handleDownload(r.id)} disabled={busyId === r.id}>{busyId === r.id ? 'Preparing…' : `Download${r.version ? ` v${r.version}` : ''}`}</button>
                    </div>
                ))}</div>
            )}
        </div>
    );
}

interface OrderRow { id: string; status: string; total_amount: number; created_at: string }

function OrderList() {
    const { session } = useAuth();
    const userId = session?.user.id;
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [refunds, setRefunds] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    const load = useCallback(async () => {
        if (!userId) return;
        const [ordersResult, refundsResult] = await Promise.all([
            supabase.from('orders').select('id,status,total_amount,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
            supabase.from('refund_requests').select('order_id,status').eq('user_id', userId),
        ]);
        setOrders((ordersResult.data as OrderRow[]) ?? []);
        setRefunds(Object.fromEntries((refundsResult.data ?? []).map((r) => [r.order_id as string, r.status as string])));
        setLoading(false);
    }, [userId]);

    useEffect(() => { load(); }, [load]);

    async function requestRefund(orderId: string) {
        const reason = window.prompt('Tell us why you are requesting a refund (at least 10 characters):')?.trim();
        if (!reason || !userId) return;
        if (reason.length < 10) { setMessage({ text: 'Please give a little more detail.', ok: false }); return; }
        const { error } = await supabase.from('refund_requests').insert({ order_id: orderId, user_id: userId, reason });
        setMessage(error ? { text: 'Could not send the refund request.', ok: false } : { text: 'Refund request sent. We will review it.', ok: true });
        await load();
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <h1 className="mb-6 text-3xl font-bold">Purchase History</h1>
            {message && <p role={message.ok ? 'status' : 'alert'} className={`mb-4 ${message.ok ? 'text-[#C4B5FD]' : 'text-red-400'}`}>{message.text}</p>}
            {loading ? <p className="text-zinc-400">Loading…</p> : orders.length === 0 ? (
                <div className="card p-10 text-center text-zinc-400">No orders yet. <Link to="/browse" className="text-[#C4B5FD] underline">Browse resources</Link></div>
            ) : (
                <ul className="space-y-3">{orders.map((o) => (
                    <li key={o.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
                        <span className="text-sm text-zinc-400">{new Date(o.created_at).toLocaleDateString()} · <span className="badge">{o.status}</span></span>
                        <span className="flex items-center gap-3">
                            <span className="font-bold text-[#A855F7]">{formatPrice(o.total_amount)}</span>
                            {o.status === 'paid' && !refunds[o.id] && <button type="button" className="btn-ghost" onClick={() => requestRefund(o.id)}>Request refund</button>}
                            {refunds[o.id] && <span className="badge">Refund {refunds[o.id]}</span>}
                        </span>
                    </li>
                ))}</ul>
            )}
        </div>
    );
}

export function Library() {
    return <RequireLogin><LibraryGrid /></RequireLogin>;
}

export function Favorites() {
    return <RequireLogin><FavoritesGrid /></RequireLogin>;
}

export function PurchaseHistory() {
    return <RequireLogin><OrderList /></RequireLogin>;
}
