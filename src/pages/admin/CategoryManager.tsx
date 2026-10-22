import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

interface CategoryRow { id: string; slug: string; name: string; description: string }

const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function CategoryManager() {
    const { session } = useAuth();
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    const load = useCallback(async () => {
        const { data } = await supabase.from('categories').select('*').order('sort_order').order('name');
        setCategories((data as CategoryRow[]) ?? []);
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleAdd(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        const slug = slugify(name);
        if (name.trim().length < 2 || !slug) { setMessage({ text: 'Enter a category name (2+ characters).', ok: false }); return; }
        setBusy(true);
        const { error } = await supabase.from('categories').insert({ name: name.trim(), slug, description: description.trim() });
        if (error) setMessage({ text: error.code === '23505' ? 'That category already exists.' : 'Could not add the category.', ok: false });
        else {
            await supabase.from('audit_logs').insert({ admin_id: session?.user.id, action: 'category.create', target_type: 'category', target_id: slug });
            setMessage({ text: 'Category added.', ok: true });
            setName(''); setDescription('');
            await load();
        }
        setBusy(false);
    }

    async function handleDelete(category: CategoryRow) {
        if (!window.confirm(`Delete the category "${category.name}"? Resources keep their category text.`)) return;
        const { error } = await supabase.from('categories').delete().eq('id', category.id);
        if (error) { setMessage({ text: 'Could not delete the category.', ok: false }); return; }
        await supabase.from('audit_logs').insert({ admin_id: session?.user.id, action: 'category.delete', target_type: 'category', target_id: category.slug });
        setMessage({ text: 'Category deleted.', ok: true });
        await load();
    }

    return (
        <div className="space-y-6">
            <form onSubmit={handleAdd} className="card grid gap-3 p-4 sm:grid-cols-3">
                <input className="input" placeholder="Name (e.g. Plugins)" aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="input" placeholder="Description" aria-label="Category description" value={description} onChange={(e) => setDescription(e.target.value)} />
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add category'}</button>
            </form>
            {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-[#C4B5FD]' : 'text-red-400'}>{message.text}</p>}
            {categories.length === 0 ? <p className="text-sm text-zinc-400">No categories yet.</p> : (
                <ul className="space-y-2">{categories.map((c) => (
                    <li key={c.id} className="card flex items-center justify-between p-3">
                        <span><strong>{c.name}</strong> <span className="text-xs text-zinc-500">{c.slug}</span></span>
                        <button type="button" className="btn-ghost" onClick={() => handleDelete(c)}>Delete</button>
                    </li>
                ))}</ul>
            )}
        </div>
    );
}
