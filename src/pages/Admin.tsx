import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';
import CategoryManager from './admin/CategoryManager';
import Moderation from './admin/Moderation';
import MembershipSettings from './admin/MembershipSettings';
import OrderManager from './admin/OrderManager';
import Overview from './admin/Overview';
import ResourceManager from './admin/ResourceManager';
import SettingsManager from './admin/SettingsManager';
import UserManager from './admin/UserManager';
import VipPaymentManager from './admin/VipPaymentManager';

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'resources', label: 'Resources' },
    { key: 'categories', label: 'Categories' },
    { key: 'users', label: 'Users' },
    { key: 'orders', label: 'Orders & Refunds' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'membership', label: 'Membership' },
    { key: 'vip-payments', label: 'VIP Payments' },
    { key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Admin() {
    const { session, loading, isAdmin } = useAuth();
    const [tab, setTab] = useState<TabKey>('overview');

    if (loading) return <p className="p-8 text-center text-zinc-400">Loading…</p>;
    if (!session) {
        return (
            <div className="p-12 text-center">
                <h1 className="text-2xl font-bold">Sign in required</h1>
                <Link to="/login" className="btn-primary mt-6">Log in</Link>
            </div>
        );
    }
    if (!isAdmin) {
        return (
            <div className="p-12 text-center">
                <h1 className="text-2xl font-bold">Access denied</h1>
                <p className="mt-2 text-zinc-400">Only the site administrator can open this area.</p>
            </div>
        );
    }
    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <Logo />
                <h1 className="text-2xl font-bold">Admin</h1>
            </div>
            <div className="mb-6 flex flex-wrap gap-2" role="tablist">
                {TABS.map((t) => (
                    <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab(t.key)}>{t.label}</button>
                ))}
            </div>
            {tab === 'overview' && <Overview />}
            {tab === 'resources' && <ResourceManager />}
            {tab === 'categories' && <CategoryManager />}
            {tab === 'users' && <UserManager />}
            {tab === 'orders' && <OrderManager />}
            {tab === 'reviews' && <Moderation />}
            {tab === 'membership' && <MembershipSettings />}
            {tab === 'vip-payments' && <VipPaymentManager />}
            {tab === 'settings' && <SettingsManager />}
        </div>
    );
}
