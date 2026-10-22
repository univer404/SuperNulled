import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type MembershipRole = 'basic' | 'vip';

interface AdminUser {
    id: string;
    display_name: string | null;
    username: string | null;
    created_at: string;
    is_suspended: boolean;
    membership_role: MembershipRole;
}

export default function UserManager() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [roleChanges, setRoleChanges] = useState<Record<string, MembershipRole>>({});
    const [search, setSearch] = useState('');
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
    const [savingUserId, setSavingUserId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const [profilesResult, membershipsResult] = await Promise.all([
            supabase.from('profiles').select('id,display_name,username,created_at,is_suspended').order('created_at', { ascending: false }).limit(200),
            supabase.from('user_memberships').select('user_id,role'),
        ]);
        if (profilesResult.error) {
            setMessage({ text: 'Could not load users. Check admin database permissions.', ok: false });
            return;
        }
        if (membershipsResult.error) {
            setMessage({ text: 'Could not load membership roles. Verify the user_memberships table is exposed to the Supabase Data API.', ok: false });
            return;
        }
        const roles = new Map((membershipsResult.data ?? []).map((row) => [row.user_id as string, row.role as MembershipRole]));
        setUsers(((profilesResult.data ?? []) as Omit<AdminUser, 'membership_role'>[]).map((user) => ({
            ...user,
            membership_role: roles.get(user.id) === 'vip' ? 'vip' : 'basic',
        })));
        setRoleChanges({});
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function toggleSuspended(user: AdminUser) {
        const action = user.is_suspended ? 'reactivate' : 'suspend';
        if (!window.confirm('Really ' + action + ' ' + (user.display_name ?? user.id) + '?')) return;
        const { error } = await supabase.rpc('set_user_suspended', { target_user: user.id, suspended: !user.is_suspended });
        if (error) { setMessage({ text: error.message, ok: false }); return; }
        setMessage({ text: 'User status updated.', ok: true });
        await load();
    }

    async function saveRole(user: AdminUser) {
        const role = roleChanges[user.id] ?? user.membership_role;
        if (role === user.membership_role) return;
        setSavingUserId(user.id);
        setMessage(null);
        const { error } = await supabase.from('user_memberships').upsert({
            user_id: user.id,
            role,
            // A VIP assigned manually in the admin panel remains active until an admin changes it.
            vip_expires_at: null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) {
            setMessage({ text: 'Could not save membership role. Verify the admin policy on user_memberships.', ok: false });
        } else {
            setMessage({ text: 'Membership role updated.', ok: true });
            await load();
        }
        setSavingUserId(null);
    }

    const term = search.trim().toLowerCase();
    const visible = users.filter((user) => !term || (user.display_name ?? '').toLowerCase().includes(term) || (user.username ?? '').toLowerCase().includes(term) || user.id.toLowerCase().includes(term));

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-bold">Members and roles</h2>
                <p className="mt-1 text-sm text-zinc-400">Basic members get the configured daily free-download allowance. VIP members get unlimited free downloads. Manual VIP assignments do not expire automatically.</p>
            </div>
            <input className="input" placeholder="Search by name or user id" aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} />
            {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-[#C4B5FD]' : 'text-red-400'}>{message.text}</p>}
            {visible.length === 0 ? <p className="text-sm text-zinc-400">No users found.</p> : (
                <ul className="space-y-2">{visible.map((user) => {
                    const selectedRole = roleChanges[user.id] ?? user.membership_role;
                    return (
                        <li key={user.id} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-medium">{user.display_name ?? 'Unnamed'} {user.is_suspended && <span className="badge">Suspended</span>} {user.membership_role === 'vip' && <span className="badge">VIP</span>}</p>
                                <p className="text-xs text-zinc-500">{user.id} · joined {new Date(user.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="text-sm">Role
                                    <select className="input mt-1" value={selectedRole} onChange={(event) => setRoleChanges((current) => ({ ...current, [user.id]: event.target.value === 'vip' ? 'vip' : 'basic' }))}>
                                        <option value="basic">Basic Member</option>
                                        <option value="vip">VIP</option>
                                    </select>
                                </label>
                                <button type="button" className="btn-primary self-end" disabled={savingUserId === user.id || selectedRole === user.membership_role} onClick={() => void saveRole(user)}>{savingUserId === user.id ? 'Saving…' : 'Save role'}</button>
                                <button type="button" className="btn-ghost self-end" onClick={() => void toggleSuspended(user)}>{user.is_suspended ? 'Reactivate' : 'Suspend'}</button>
                            </div>
                        </li>
                    );
                })}</ul>
            )}
        </div>
    );
}
