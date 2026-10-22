import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
    const { session, loading } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setBusy(true);
        setError(null);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (updateError) setError(updateError.message);
        else navigate('/account');
    }

    if (loading) return <p className="p-8 text-center text-zinc-400">Loading…</p>;
    if (!session) {
        return (
            <div className="p-12 text-center">
                <h1 className="text-2xl font-bold">Reset link needed</h1>
                <p className="mt-2 text-zinc-400">Open the reset link from your email, or request a new one.</p>
                <Link to="/forgot-password" className="btn-primary mt-6">Request reset link</Link>
            </div>
        );
    }
    return (
        <div className="mx-auto max-w-md px-4 py-12">
            <form onSubmit={handleSubmit} className="card space-y-4 p-6" noValidate>
                <h1 className="text-xl font-bold">Choose a new password</h1>
                <label className="block text-sm">New password
                    <input className="input mt-1" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
            </form>
        </div>
    );
}
