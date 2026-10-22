import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface ReviewRow { id: string; user_id: string; rating: number; body: string | null; created_at: string }

export default function Reviews({ resourceId }: { resourceId: string }) {
    const { session } = useAuth();
    const userId = session?.user.id;
    const [reviews, setReviews] = useState<ReviewRow[]>([]);
    const [names, setNames] = useState<Record<string, string>>({});
    const [rating, setRating] = useState(5);
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    const load = useCallback(async () => {
        const { data } = await supabase.from('reviews').select('id,user_id,rating,body,created_at').eq('resource_id', resourceId).order('created_at', { ascending: false });
        const rows = (data as ReviewRow[]) ?? [];
        setReviews(rows);
        if (rows.length === 0) return;
        const { data: profiles } = await supabase.from('profiles').select('id,display_name').in('id', rows.map((r) => r.user_id));
        setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? 'Member'])));
    }, [resourceId]);

    useEffect(() => { load(); }, [load]);

    const mine = reviews.find((r) => r.user_id === userId);
    const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (busy || !userId) return;
        setBusy(true);
        setMessage(null);
        const { error } = await supabase.from('reviews').insert({ user_id: userId, resource_id: resourceId, rating, body: body.trim() || null });
        if (error) setMessage({ text: error.code === '42501' ? 'Download this resource before reviewing it.' : 'Could not post your review.', ok: false });
        else { setBody(''); setMessage({ text: 'Review posted.', ok: true }); await load(); }
        setBusy(false);
    }

    async function handleDelete(id: string) {
        if (!window.confirm('Delete your review?')) return;
        const { error } = await supabase.from('reviews').delete().eq('id', id);
        if (error) setMessage({ text: 'Could not delete the review.', ok: false });
        else await load();
    }

    async function handleReport(id: string) {
        const reason = window.prompt('Why are you reporting this review?')?.trim();
        if (!reason || reason.length < 3 || !userId) return;
        const { error } = await supabase.from('review_reports').insert({ review_id: id, user_id: userId, reason });
        setMessage(error ? { text: error.code === '23505' ? 'You already reported this review.' : 'Could not send the report.', ok: false } : { text: 'Report sent to the moderators.', ok: true });
    }

    return (
        <section className="mt-10">
            <h2 className="text-xl font-bold">Reviews {reviews.length > 0 && <span className="text-sm font-normal text-zinc-400">★ {average.toFixed(1)} ({reviews.length})</span>}</h2>
            {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${message.ok ? 'text-[#C4B5FD]' : 'text-red-400'}`}>{message.text}</p>}
            {userId && !mine && (
                <form onSubmit={handleSubmit} className="card mt-4 space-y-3 p-4">
                    <label className="block text-sm">Rating
                        <select className="input mt-1" value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</select>
                    </label>
                    <textarea className="input" rows={3} maxLength={1000} placeholder="Write a review (optional)" aria-label="Review text" value={body} onChange={(e) => setBody(e.target.value)} />
                    <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post review'}</button>
                </form>
            )}
            {!userId && <p className="mt-3 text-sm text-zinc-400"><Link to="/login" className="text-[#C4B5FD] underline">Log in</Link> to review this resource after downloading it.</p>}
            {reviews.length === 0 ? <p className="mt-4 text-sm text-zinc-400">No reviews yet.</p> : (
                <ul className="mt-4 space-y-3">{reviews.map((r) => (
                    <li key={r.id} className="card p-4">
                        <p className="text-sm"><strong>{names[r.user_id] ?? 'Member'}</strong> <span className="badge">Verified download</span> <span className="text-[#A855F7]">{'★'.repeat(r.rating)}</span></p>
                        {r.body && <p className="mt-1 whitespace-pre-line text-sm text-zinc-300">{r.body}</p>}
                        <div className="mt-2 flex gap-3 text-xs text-zinc-500">
                            <span>{new Date(r.created_at).toLocaleDateString()}</span>
                            {r.user_id === userId ? <button type="button" className="hover:text-[#C4B5FD]" onClick={() => handleDelete(r.id)}>Delete</button> : userId && <button type="button" className="hover:text-[#C4B5FD]" onClick={() => handleReport(r.id)}>Report</button>}
                        </div>
                    </li>
                ))}</ul>
            )}
        </section>
    );
}
