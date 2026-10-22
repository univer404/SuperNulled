import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../lib/cart';
import { supabase } from '../lib/supabase';

const MAX_CHECKS = 20;

// Visiting this page proves nothing by itself: we ask the database whether the verified webhook marked the order paid.
export default function CheckoutSuccess() {
    const [params] = useSearchParams();
    const orderId = params.get('order');
    const { clear } = useCart();
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId) return;
        let checks = 0;
        let timer: number | undefined;
        async function check() {
            const { data } = await supabase.from('orders').select('status').eq('id', orderId as string).maybeSingle();
            setStatus(data?.status ?? 'unknown');
            checks += 1;
            if (data?.status === 'pending' && checks < MAX_CHECKS) timer = window.setTimeout(check, 3000);
        }
        check();
        return () => window.clearTimeout(timer);
    }, [orderId]);

    useEffect(() => {
        if (status === 'paid') clear();
    }, [status, clear]);

    return (
        <div className="mx-auto max-w-md p-12 text-center">
            {status === 'paid' ? (
                <>
                    <h1 className="text-2xl font-bold">Payment confirmed</h1>
                    <p className="mt-2 text-zinc-400">Your resources are now in your library.</p>
                    <Link to="/library" className="btn-primary mt-6">Open My Library</Link>
                </>
            ) : status === 'pending' || status === null ? (
                <>
                    <h1 className="text-2xl font-bold">Waiting for confirmation…</h1>
                    <p className="mt-2 text-zinc-400">We are waiting for the payment provider to confirm your payment. This can take a minute. You can also check Purchase History later.</p>
                    <Link to="/orders" className="btn-ghost mt-6">Purchase History</Link>
                </>
            ) : (
                <>
                    <h1 className="text-2xl font-bold">Payment not completed</h1>
                    <p className="mt-2 text-zinc-400">This order is {status}. No access was granted.</p>
                    <Link to="/cart" className="btn-primary mt-6">Back to cart</Link>
                </>
            )}
        </div>
    );
}
