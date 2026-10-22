import { useEffect, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingCart, X } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cart';
import { usePublicSettings } from '../lib/settings';
import { supabase } from '../lib/supabase';

const NAV_LINKS = [
    { label: 'Home', to: '/' },
    { label: 'Browse Resources', to: '/browse' },
    { label: 'Categories', to: '/categories' },
    { label: 'Free Resources', to: '/browse?type=free' },
    { label: 'Premium Resources', to: '/browse?type=premium' },
];
// Pages that stay reachable during maintenance so the owner can still sign in and switch it off.
const MAINTENANCE_ALLOWED = ['/login', '/admin', '/forgot-password', '/reset-password'];

export default function Layout() {
    const { session, isAdmin, loading } = useAuth();
    const { items } = useCart();
    const settings = usePublicSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname, location.search]);

    function handleSearch(event: FormEvent) {
        event.preventDefault();
        navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
    }

    async function handleSignOut() {
        await supabase.auth.signOut();
        navigate('/');
    }

    const cartLink = (
        <Link to="/cart" className="btn-ghost" aria-label={`Cart, ${items.length} items`}><ShoppingCart className="h-4 w-4" /> {items.length}</Link>
    );
    const accountLinks = session ? (
        <>
            <Link to="/account" className="btn-ghost">Account</Link>
            {isAdmin && <Link to="/admin" className="btn-primary">Admin</Link>}
            <button type="button" onClick={handleSignOut} className="btn-ghost">Log out</button>
        </>
    ) : (
        <>
            <Link to="/login" className="btn-ghost">Login</Link>
            <Link to="/register" className="btn-primary">Register</Link>
        </>
    );
    const underMaintenance = settings.maintenance && !loading && !isAdmin && !MAINTENANCE_ALLOWED.includes(location.pathname);

    return (
        <div className="flex min-h-screen flex-col">
            {settings.announcement && <div className="bg-[#7C3AED] px-4 py-2 text-center text-sm" role="status">{settings.announcement}</div>}
            <header className="sticky top-0 z-20 border-b border-[#2a2145] bg-[#08080D]/85 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
                    <Logo />
                    <nav className="hidden items-center gap-5 text-sm text-zinc-300 lg:flex" aria-label="Main">
                        {NAV_LINKS.map((link) => (
                            <Link key={link.label} to={link.to} className="transition duration-200 hover:text-[#C4B5FD]">{link.label}</Link>
                        ))}
                    </nav>
                    <div className="hidden items-center gap-2 lg:flex">{cartLink}{accountLinks}</div>
                    <div className="flex gap-2 lg:hidden">
                        {cartLink}
                        <button type="button" className="btn-ghost" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
                {menuOpen && (
                    <div className="space-y-3 border-t border-[#2a2145] bg-[#11111B] px-4 py-4 lg:hidden">
                        <form onSubmit={handleSearch} className="flex gap-2" role="search">
                            <input className="input" placeholder="Search resources" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search resources" />
                            <button type="submit" className="btn-primary" aria-label="Search"><Search className="h-4 w-4" /></button>
                        </form>
                        {NAV_LINKS.map((link) => (
                            <Link key={link.label} to={link.to} className="block py-1 text-zinc-200">{link.label}</Link>
                        ))}
                        <div className="flex flex-wrap gap-2 pt-2">{accountLinks}</div>
                    </div>
                )}
            </header>
            <main className="flex-1">
                {underMaintenance ? (
                    <div className="p-16 text-center">
                        <h1 className="text-3xl font-bold">We'll be right back</h1>
                        <p className="mt-2 text-zinc-400">SuperNulled is down for maintenance. Please check back soon.</p>
                    </div>
                ) : <Outlet />}
            </main>
            <footer className="border-t border-[#2a2145] py-6 text-center text-sm text-zinc-500">
                <div className="mb-2 flex flex-wrap justify-center gap-4">
                    <Link to="/about" className="hover:text-[#C4B5FD]">About</Link>
                    <Link to="/support" className="hover:text-[#C4B5FD]">Support</Link>
                    <Link to="/terms" className="hover:text-[#C4B5FD]">Terms of Service</Link>
                    <Link to="/privacy" className="hover:text-[#C4B5FD]">Privacy Policy</Link>
                    <Link to="/refunds" className="hover:text-[#C4B5FD]">Refund Policy</Link>
                </div>
                © {new Date().getFullYear()} SuperNulled — Digital Resource Marketplace
            </footer>
        </div>
    );
}
