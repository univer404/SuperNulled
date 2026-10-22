import { useCallback, useEffect, useState } from 'react';
import { formatPrice, supabase } from '../../lib/supabase';

interface OrderRow { id: string; user_id: string; status: string; total_amount: number; created_at: string }
interface RefundRow { id: string; order_id: string; reason: string; created_at: string }

function exportCsv(orders: OrderRow[]) {
    const lines = orders.map((o) => [o.id, o.user_id, o.status, o.total_amount, o.created_at].join(','));
    const blob = new Blob([['order_id,user_id,status,total_php,created_at', ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supernulled-orders.csv';
    link.click();
    URL.revokeObjectURL(url);
}

export default function OrderManager() {
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [refunds, setRefunds] = useState<RefundRow[]>([]);
    const [message, setMessage] = useState<string | null>(null);

    const load = useCallback(async () => {
        const [ordersResult, refundsResult] = await Promise.all([
            supabase.from('orders').select('id,user_id,status,total_amount,created_at').order('created_at', { ascending: false }).limit(500),
            supabase.from('refund_requests').select('id,order_id,reason,created_at').eq('status', 'pending').order('created_at'),
        ]);
        setOrders((ordersResult.data as OrderRow[]) ?? []);
        setRefunds((refundsResult.data as RefundRow[]) ?? []);
    }, []);

    useEffect(() => { load(); }, [load]);

    async function resolve(request: RefundRow, approve: boolean) {
        const question = approve ? 'Approve this refund? Access to the files will be removed. Send the money back from your PayMongo dashboard.' : 'Reject this refund request?';
        if (!window.confirm(question)) return;
        const { error } = await supabase.rpc('resolve_refund', { request_id: request.id, approve });
        setMessage(error ? error.message : null);
        await load();
    }

    return (
        <div className="space-y-6">
            {message && <p role="alert" className="text-red-400">{message}</p>}
            <div>
                <h2 className="mb-2 font-semibold">Pending refund requests</h2>
                {refunds.length === 0 ? <p className="text-sm text-zinc-400">None.</p> : (
                    <ul className="space-y-2">{refunds.map((r) => (
                        <li key={r.id} className="card space-y-2 p-3 text-sm">
                            <p>Order {r.order_id.slice(0, 8)} · {new Date(r.created_at).toLocaleDateString()}</p>
                            <p className="text-zinc-300">{r.reason}</p>
                            <div className="flex gap-2"><button type="button" className="btn-primary" onClick={() => resolve(r, true)}>Approve</button><button type="button" className="btn-ghost" onClick={() => resolve(r, false)}>Reject</button></div>
                        </li>
                    ))}</ul>
                )}
            </div>
            <div>
                <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Orders</h2><button type="button" className="btn-ghost" disabled={orders.length === 0} onClick={() => exportCsv(orders)}>Export CSV</button></div>
                {orders.length === 0 ? <p className="text-sm text-zinc-400">No orders yet.</p> : (
                    <ul className="space-y-2">{orders.map((o) => (
                        <li key={o.id} className="card flex flex-wrap justify-between gap-2 p-3 text-sm"><span>{new Date(o.created_at).toLocaleString()} · {o.id.slice(0, 8)} · <span className="badge">{o.status}</span></span><span>{formatPrice(o.total_amount)}</span></li>
                    ))}</ul>
                )}
            </div>
        </div>
    );
}
