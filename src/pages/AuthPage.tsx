import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';

export type AuthMode = 'login' | 'register' | 'forgot';

const TITLES: Record<AuthMode, string> = { login: 'Log in', register: 'Create your account', forgot: 'Reset your password' };

export default function AuthPage({ mode }: { mode: AuthMode }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [turnstileEnabled, setTurnstileEnabled] = useState(false);
    const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileError, setTurnstileError] = useState<string | null>(null);
    const [turnstileReady, setTurnstileReady] = useState(false);
    // This app uses HashRouter, so auth providers must return to a valid hash route.
    const appUrl = `${window.location.origin}${window.location.pathname}`;
    const returnUrl = `${appUrl}#/`;

    useEffect(() => {
        let active = true;
        supabase.from('site_settings').select('key,value').in('key', ['public.turnstile_enabled', 'public.turnstile_site_key']).then(({ data }) => {
            if (!active) return;
            const values = Object.fromEntries((data ?? []).map((row) => [row.key as string, row.value as unknown]));
            const enabled = values['public.turnstile_enabled'] === true;
            const siteKey = typeof values['public.turnstile_site_key'] === 'string' ? values['public.turnstile_site_key'] as string : '';
            setTurnstileEnabled(enabled && Boolean(siteKey));
            setTurnstileSiteKey(siteKey);
            if (enabled && !siteKey) setTurnstileError('Cloudflare verification is enabled but the Site Key is missing.');
        });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!turnstileEnabled || !turnstileSiteKey) return;
        const scriptId = 'cloudflare-turnstile-script';
        let widgetId: string | null = null;
        const render = () => {
            const apiWindow = window as Window & { turnstile?: { render: (container: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void } };
            const container = document.getElementById('turnstile-widget');
            if (!container || !apiWindow.turnstile || widgetId) return;
            widgetId = apiWindow.turnstile.render(container, {
                sitekey: turnstileSiteKey,
                callback: (token: string) => { setTurnstileToken(token); setTurnstileError(null); setTurnstileReady(true); },
                'expired-callback': () => { setTurnstileToken(''); setTurnstileReady(false); },
                'error-callback': () => { setTurnstileToken(''); setTurnstileReady(false); setTurnstileError('Cloudflare verification could not load. Please retry.'); },
                theme: 'dark',
            });
        };
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
        script.addEventListener('load', render);
        render();
        const timer = window.setInterval(render, 250);
        return () => {
            window.clearInterval(timer);
            script?.removeEventListener('load', render);
            const apiWindow = window as Window & { turnstile?: { remove: (id: string) => void } };
            if (widgetId && apiWindow.turnstile) apiWindow.turnstile.remove(widgetId);
        };
    }, [turnstileEnabled, turnstileSiteKey]);

    async function verifyTurnstile() {
        if (!turnstileEnabled) return true;
        if (!turnstileToken) {
            setTurnstileError('Complete the Cloudflare verification before continuing.');
            return false;
        }
        try {
            const response = await fetch('/api/turnstile/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: turnstileToken }),
            });
            const result = await response.json() as { verified?: boolean };
            if (response.ok && result.verified === true) return true;
            setTurnstileError('Cloudflare verification failed. Please try again.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Cloudflare verification failed. Please try again.';
            setTurnstileError(message);
        }
        setTurnstileToken('');
        setTurnstileReady(false);
        return false;
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        setError(null);
        setNotice(null);
        if (mode !== 'forgot' && password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setBusy(true);
        try {
            if (!(await verifyTurnstile())) return;
            if (mode === 'login') {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) throw signInError;
                navigate('/');
            } else if (mode === 'register') {
                const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: returnUrl } });
                if (signUpError) throw signUpError;
                setNotice('Check your email and click the verification link to finish creating your account.');
            } else {
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}?recovery=1#/` });
                if (resetError) throw resetError;
                setNotice('If that email has an account, a reset link is on its way.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    async function handleGoogle() {
        if (busy) return;
        setError(null);
        setBusy(true);
        if (!(await verifyTurnstile())) { setBusy(false); return; }
        const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl } });
        if (oauthError) {
            setError(`Google sign-in is not available yet: ${oauthError.message}`);
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto max-w-md px-4 py-12">
            <div className="mb-6 flex justify-center"><Logo large /></div>
            <form onSubmit={handleSubmit} className="card space-y-4 p-6" noValidate>
                <h1 className="text-xl font-bold">{TITLES[mode]}</h1>
                {mode !== 'forgot' && (
                    <>
                        <button type="button" className="btn-ghost w-full" onClick={handleGoogle} disabled={busy}>Continue with Google</button>
                        <p className="text-center text-xs text-zinc-500">or use email</p>
                    </>
                )}
                <label className="block text-sm">Email
                    <input className="input mt-1" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                {mode !== 'forgot' && (
                    <label className="block text-sm">Password
                        <input className="input mt-1" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </label>
                )}
                {turnstileEnabled && <div className="space-y-2"><div id="turnstile-widget" className="min-h-16" />{turnstileError && <p role="alert" className="text-sm text-red-400">{turnstileError}</p>}{!turnstileReady && !turnstileError && <p className="text-xs text-zinc-500">Complete Cloudflare verification to continue.</p>}</div>}
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                {notice && <p role="status" className="text-sm text-[#C4B5FD]">{notice}</p>}
                <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : TITLES[mode]}</button>
                <div className="flex justify-between text-sm text-zinc-400">
                    {mode === 'login' ? <Link to="/register" className="hover:text-[#C4B5FD]">Create account</Link> : <Link to="/login" className="hover:text-[#C4B5FD]">Back to log in</Link>}
                    {mode !== 'forgot' && <Link to="/forgot-password" className="hover:text-[#C4B5FD]">Forgot password?</Link>}
                </div>
            </form>
        </div>
    );
}
