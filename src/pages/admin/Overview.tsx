import { useEffect, useState } from 'react';
import { formatPrice, supabase } from '../../lib/supabase';

interface Stats { users: number; resources: number; published: number; purchases: number; downloads: number; revenue: number }
interface RecentOrder { id: string; status: string; total_amount: number; created_at: string }

export default function Overview() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [recent, setRecent] = useState<RecentOrder[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const count = (table: string) => supabase.from(table).select('*', { count: 'exact', head: true });
            const [users, resources, published, purchases, downloads, paid, orders] = await Promise.all([
                count('profiles'),
                count('resources'),
                supabase.from('resources').select('*', { count: 'exact', head: true }).eq('published', true),
                count('purchases'),
                count('downloads'),
                supabase.from('orders').select('total_amount').eq('status', 'paid'),
                supabase.from('orders').select('id,status,total_amount,created_at').order('created_at', { ascending: false }).limit(5),
            ]);
            if (users.error || resources.error || paid.error) { setError('Could not load statistics.'); return; }
            const revenue = (paid.data ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0);
            setStats({ users: users.count ?? 0, resources: resources.count ?? 0, published: published.count ?? 0, purchases: purchases.count ?? 0, downloads: downloads.count ?? 0, revenue });
            setRecent((orders.data as RecentOrder[]) ?? []);
        }
        load();
    }, []);

    if (error) return <p role="alert" className="text-red-400">{error}</p>;
    if (!stats) return <p className="text-zinc-400">Loading…</p>;

    const cards: [string, string][] = [
        ['Users', String(stats.users)], ['Resources', `${stats.resources} (${stats.published} published)`],
        ['Purchases', String(stats.purchases)], ['Downloads', String(stats.downloads)], ['Revenue', formatPrice(stats.revenue) === 'Free' ? '₱0.00' : formatPrice(stats.revenue)],
    ];
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {cards.map(([label, value]) => <div key={label} className="card p-4"><p className="text-xs text-zinc-400">{label}</p><p className="mt-1 text-lg font-bold text-[#A855F7]">{value}</p></div>)}
            </div>
            <div>
                <h2 className="mb-2 font-semibold">Recent transactions</h2>
                {recent.length === 0 ? <p className="text-sm text-zinc-400">No transactions yet.</p> : (
                    <ul className="space-y-2">{recent.map((o) => <li key={o.id} className="card flex justify-between p-3 text-sm"><span>{new Date(o.created_at).toLocaleString()} · {o.status}</span><span>{formatPrice(o.total_amount)}</span></li>)}</ul>
                )}
            </div>
        </div>
    );
}
