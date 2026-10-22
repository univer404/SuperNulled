import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cart';
import { invokeFunction } from '../lib/functions';
import { formatPrice } from '../lib/supabase';

export default function Cart() {
    const { items, remove } = useCart();
    const { session } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const total = items.reduce((sum, item) => sum + item.price, 0);

    async function handleCheckout() {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const siteUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
            const { checkout_url } = await invokeFunction<{ checkout_url: string }>('create-checkout', { resource_ids: items.map((i) => i.id), site_url: siteUrl });
            window.location.href = checkout_url;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Checkout failed.');
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <h1 className="mb-6 text-3xl font-bold">Shopping Cart</h1>
            {items.length === 0 ? (
                <div className="card p-10 text-center text-zinc-400">Your cart is empty. <Link to="/browse?type=premium" className="text-[#C4B5FD] underline">Browse premium resources</Link></div>
            ) : (
                <div className="space-y-4">
                    <ul className="space-y-2">{items.map((item) => (
                        <li key={item.id} className="card flex items-center justify-between p-3">
                            <Link to={`/resource/${item.slug}`} className="font-medium hover:text-[#C4B5FD]">{item.title}</Link>
                            <span className="flex items-center gap-3"><span className="text-[#A855F7]">{formatPrice(item.price)}</span><button type="button" className="btn-ghost" onClick={() => remove(item.id)}>Remove</button></span>
                        </li>
                    ))}</ul>
                    <p className="text-right text-lg font-bold">Total: {formatPrice(total)}</p>
                    {error && <p role="alert" className="text-red-400">{error}</p>}
                    {session ? (
                        <button type="button" className="btn-primary w-full" onClick={handleCheckout} disabled={busy}>{busy ? 'Opening secure checkout…' : 'Checkout with PayMongo'}</button>
                    ) : (
                        <Link to="/login" className="btn-primary w-full">Log in to check out</Link>
                    )}
                    <p className="text-xs text-zinc-500">Final prices are confirmed on our server. Access is unlocked only after the payment provider confirms your payment.</p>
                </div>
            )}
        </div>
    );
}
