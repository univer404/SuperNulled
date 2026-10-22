import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function RequireLogin({ children }: { children: ReactNode }) {
    const { session, loading } = useAuth();
    if (loading) return <p className="p-8 text-center text-zinc-400">Loading…</p>;
    if (!session) return <Navigate to="/login" replace />;
    return <>{children}</>;
}
