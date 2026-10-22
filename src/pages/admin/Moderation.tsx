import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ReportRow { id: string; review_id: string; reason: string; created_at: string }
interface ReviewPreview { id: string; rating: number; body: string | null }

export default function Moderation() {
    const [reports, setReports] = useState<ReportRow[]>([]);
    const [reviews, setReviews] = useState<Record<string, ReviewPreview>>({});
    const [message, setMessage] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data } = await supabase.from('review_reports').select('id,review_id,reason,created_at').order('created_at', { ascending: false });
        const rows = (data as ReportRow[]) ?? [];
        setReports(rows);
        if (rows.length === 0) return;
        const { data: reviewRows } = await supabase.from('reviews').select('id,rating,body').in('id', rows.map((r) => r.review_id));
        setReviews(Object.fromEntries(((reviewRows as ReviewPreview[]) ?? []).map((r) => [r.id, r])));
    }, []);

    useEffect(() => { load(); }, [load]);

    async function deleteReview(report: ReportRow) {
        if (!window.confirm('Delete this review permanently?')) return;
        const { error } = await supabase.from('reviews').delete().eq('id', report.review_id);
        setMessage(error ? 'Could not delete the review.' : null);
        await load();
    }

    async function dismiss(report: ReportRow) {
        const { error } = await supabase.from('review_reports').delete().eq('id', report.id);
        setMessage(error ? 'Could not dismiss the report.' : null);
        await load();
    }

    return (
        <div className="space-y-3">
            {message && <p role="alert" className="text-red-400">{message}</p>}
            {reports.length === 0 ? <p className="text-sm text-zinc-400">No reported reviews.</p> : reports.map((r) => (
                <div key={r.id} className="card space-y-2 p-3 text-sm">
                    <p className="text-zinc-400">Reported {new Date(r.created_at).toLocaleDateString()}: {r.reason}</p>
                    <p>{reviews[r.review_id] ? `${'★'.repeat(reviews[r.review_id].rating)} ${reviews[r.review_id].body ?? ''}` : 'Review no longer exists.'}</p>
                    <div className="flex gap-2">{reviews[r.review_id] && <button type="button" className="btn-primary" onClick={() => deleteReview(r)}>Delete review</button>}<button type="button" className="btn-ghost" onClick={() => dismiss(r)}>Dismiss report</button></div>
                </div>
            ))}
        </div>
    );
}
