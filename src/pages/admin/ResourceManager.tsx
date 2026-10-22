import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { formatPrice, supabase, type Category, type Resource } from '../../lib/supabase';

interface AdminResource extends Resource { published: boolean; featured: boolean; file_path: string; file_name: string }
interface FormState { title: string; slug: string; description: string; category: string; price: string; version: string; tags: string; published: boolean; featured: boolean }

const PRODUCT_BUCKET = 'supernulled-resources';
const PUBLIC_BUCKET = 'supernulled-public';
const PRODUCT_EXTENSIONS = ['jar', 'zip', 'rar', '7z', 'sk', 'yml', 'yaml', 'json', 'schem', 'schematic', 'mcworld', 'mcpack', 'png', 'jpg', 'webp', 'pdf', 'txt'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
// Standard uploads are limited by the Supabase plan (50 MB on the free plan). Raise after checking the plan.
const MAX_PRODUCT_BYTES = 50 * 1024 * 1024;
const EMPTY_FORM: FormState = { title: '', slug: '', description: '', category: '', price: '0', version: '', tags: '', published: false, featured: false };

const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

async function uploadFile(bucket: string, path: string, file: File) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
    if (error) throw new Error(`Upload failed: ${error.message}`);
}

export default function ResourceManager() {
    const { session } = useAuth();
    const adminId = session?.user.id ?? '';
    const [resources, setResources] = useState<AdminResource[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AdminResource | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [productFile, setProductFile] = useState<File | null>(null);
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [descriptionImages, setDescriptionImages] = useState<File[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    const load = useCallback(async () => {
        const [res, cats] = await Promise.all([
            supabase.from('resources').select('*').order('created_at', { ascending: false }),
            supabase.from('categories').select('*').order('name'),
        ]);
        setResources((res.data as AdminResource[]) ?? []);
        setCategories((cats.data as Category[]) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function openCreate() {
        setEditing(null); setForm(EMPTY_FORM); setProductFile(null); setThumbnail(null); setDescriptionImages([]); setMessage(null); setFormOpen(true);
    }

    function openEdit(resource: AdminResource) {
        setEditing(resource); setProductFile(null); setThumbnail(null); setDescriptionImages([]); setMessage(null); setFormOpen(true);
        setForm({ title: resource.title, slug: resource.slug, description: resource.description, category: resource.category, price: String(resource.price), version: resource.version ?? '', tags: resource.tags.join(', '), published: resource.published, featured: resource.featured });
    }

    async function logAction(action: string, targetId: string, details: object) {
        const { error } = await supabase.from('audit_logs').insert({ admin_id: adminId, action, target_type: 'resource', target_id: targetId, details });
        if (error) console.warn('Audit log failed', error.message);
    }

    function validate(): string | null {
        if (form.title.trim().length < 3) return 'Title must be at least 3 characters.';
        if (!/^[a-z0-9-]+$/.test(form.slug)) return 'Slug may contain only lowercase letters, numbers and dashes.';
        if (!form.category.trim()) return 'Choose or type a category.';
        if (!(Number(form.price) >= 0)) return 'Price must be 0 or more (PHP).';
        if (!editing && !productFile) return 'Choose the product file to upload.';
        if (productFile && !PRODUCT_EXTENSIONS.includes(extensionOf(productFile.name))) return 'That product file type is not allowed.';
        if (productFile && productFile.size > MAX_PRODUCT_BYTES) return 'Product file is larger than the 50 MB upload limit.';
        if (thumbnail && !IMAGE_EXTENSIONS.includes(extensionOf(thumbnail.name))) return 'Thumbnail must be a PNG, JPG, WebP, or GIF image.';
        if (descriptionImages.some((file) => !IMAGE_EXTENSIONS.includes(extensionOf(file.name)))) return 'Description images must be PNG, JPG, WebP, or GIF files.';
        if (descriptionImages.some((file) => file.size > 8 * 1024 * 1024)) return 'Each description image must be 8 MB or smaller.';
        return null;
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        const problem = validate();
        if (problem) { setMessage({ text: problem, ok: false }); return; }
        setBusy(true);
        setMessage(null);
        const id = editing?.id ?? crypto.randomUUID();
        const replacedPath = productFile && editing ? editing.file_path : null;
        try {
            let { file_path, file_name, file_size } = editing ?? { file_path: '', file_name: '', file_size: 0 };
            let thumbnail_path = editing?.thumbnail_path ?? null;
            if (productFile) {
                file_path = `${id}/${Date.now()}-${safeFileName(productFile.name)}`;
                await uploadFile(PRODUCT_BUCKET, file_path, productFile);
                file_name = productFile.name;
                file_size = productFile.size;
            }
            if (thumbnail) {
                thumbnail_path = `thumbnails/${id}-${Date.now()}.${extensionOf(thumbnail.name)}`;
                await uploadFile(PUBLIC_BUCKET, thumbnail_path, thumbnail);
            }
            let description = form.description.trim();
            const descriptionImagePaths: string[] = [];
            for (const image of descriptionImages) {
                const path = `descriptions/${id}/${Date.now()}-${safeFileName(image.name)}`;
                await uploadFile(PUBLIC_BUCKET, path, image);
                descriptionImagePaths.push(path);
            }
            if (descriptionImagePaths.length) description += (description ? '\\n\\n' : '') + descriptionImagePaths.map((path) => `[[description-image:${path}]]`).join('\\n\\n');
            const fields = {
                title: form.title.trim(), slug: form.slug, description, category: form.category.trim(),
                price: Number(form.price), version: form.version.trim() || null,
                tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
                published: form.published, featured: form.featured,
                file_path, file_name, file_size, thumbnail_path, updated_at: new Date().toISOString(),
            };
            const { error } = editing
                ? await supabase.from('resources').update(fields).eq('id', id)
                : await supabase.from('resources').insert({ id, created_by: adminId, ...fields });
            if (error) throw new Error(error.code === '23505' ? 'That slug is already used by another resource.' : error.message);
            if (replacedPath) await supabase.storage.from(PRODUCT_BUCKET).remove([replacedPath]);
            await logAction(editing ? 'resource.update' : 'resource.create', id, { title: fields.title });
            setMessage({ text: 'Resource saved.', ok: true });
            setFormOpen(false);
            await load();
        } catch (err) {
            setMessage({ text: err instanceof Error ? err.message : 'Could not save the resource.', ok: false });
        } finally {
            setBusy(false);
        }
    }

    async function toggleFlag(resource: AdminResource, flag: 'published' | 'featured') {
        const { error } = await supabase.from('resources').update({ [flag]: !resource[flag], updated_at: new Date().toISOString() }).eq('id', resource.id);
        if (error) { setMessage({ text: 'Could not update the resource.', ok: false }); return; }
        await logAction(`resource.${flag}`, resource.id, { value: !resource[flag] });
        await load();
    }

    async function handleDelete(resource: AdminResource) {
        if (!window.confirm(`Permanently delete "${resource.title}" and its files?`)) return;
        const { error } = await supabase.from('resources').delete().eq('id', resource.id);
        if (error) { setMessage({ text: 'Could not delete. A resource with orders cannot be deleted; unpublish it instead.', ok: false }); return; }
        await supabase.storage.from(PRODUCT_BUCKET).remove([resource.file_path]);
        if (resource.thumbnail_path) await supabase.storage.from(PUBLIC_BUCKET).remove([resource.thumbnail_path]);
        await logAction('resource.delete', resource.id, { title: resource.title });
        setMessage({ text: 'Resource deleted.', ok: true });
        await load();
    }

    return (
        <div className="space-y-4">
            {!formOpen && <button type="button" className="btn-primary" onClick={openCreate}>New resource</button>}
            {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-[#C4B5FD]' : 'text-red-400'}>{message.text}</p>}

            {formOpen && (
                <form onSubmit={handleSubmit} className="card grid gap-3 p-4 sm:grid-cols-2" noValidate>
                    <h2 className="font-semibold sm:col-span-2">{editing ? 'Edit resource' : 'New resource'}</h2>
                    <input className="input" placeholder="Title" aria-label="Title" value={form.title} onChange={(e) => { setField('title', e.target.value); if (!editing) setField('slug', slugify(e.target.value)); }} />
                    <input className="input" placeholder="slug-for-url" aria-label="Slug" value={form.slug} onChange={(e) => setField('slug', e.target.value)} />
                    <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-medium" htmlFor="resource-description">Resource description</label>
                        <textarea id="resource-description" className="input w-full" rows={5} placeholder="Describe what this resource does, its main features, requirements, supported versions, installation steps, and anything buyers should know." aria-label="Resource description" value={form.description} onChange={(e) => setField('description', e.target.value)} />
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">Write a description and upload screenshots or infographic images below. Include features, compatibility, dependencies, installation steps, and limitations.</p>
                        <label className="mt-3 block text-sm font-medium">Description images (multiple allowed)
                            <input className="input mt-1 w-full" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={(e) => setDescriptionImages(Array.from(e.target.files ?? []))} />
                        </label>
                        <p className="mt-1 text-xs text-zinc-500">PNG, JPG, WebP, or GIF · maximum 8 MB each. Animated GIFs are supported. New images will appear below your written description after saving.</p>
                        {descriptionImages.length > 0 && <ul className="mt-2 space-y-1 text-xs text-zinc-400">{descriptionImages.map((file, index) => <li key={`${file.name}-${index}`}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>)}</ul>}
                    </div>
                    <input className="input" list="category-options" placeholder="Category" aria-label="Category" value={form.category} onChange={(e) => setField('category', e.target.value)} />
                    <datalist id="category-options">{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</datalist>
                    <input className="input" type="number" min="0" step="0.01" placeholder="Price (PHP, 0 = free)" aria-label="Price in PHP" value={form.price} onChange={(e) => setField('price', e.target.value)} />
                    <input className="input" placeholder="Version (e.g. 1.0.0)" aria-label="Version" value={form.version} onChange={(e) => setField('version', e.target.value)} />
                    <input className="input" placeholder="Tags, comma separated" aria-label="Tags" value={form.tags} onChange={(e) => setField('tags', e.target.value)} />
                    <label className="text-sm">Product file {editing && '(leave empty to keep current)'}<input className="input mt-1" type="file" onChange={(e) => setProductFile(e.target.files?.[0] ?? null)} /></label>
                    <label className="text-sm">Thumbnail image<input className="input mt-1" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setField('published', e.target.checked)} /> Published</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setField('featured', e.target.checked)} /> Featured</label>
                    <div className="flex gap-2 sm:col-span-2">
                        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Uploading and saving…' : 'Save resource'}</button>
                        <button type="button" className="btn-ghost" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</button>
                    </div>
                </form>
            )}

            {loading ? <p className="text-zinc-400">Loading…</p> : resources.length === 0 ? <p className="text-sm text-zinc-400">No resources yet.</p> : (
                <ul className="space-y-2">{resources.map((r) => (
                    <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                        <div><p className="font-medium">{r.title}</p><p className="text-xs text-zinc-400">{formatPrice(r.price)} · {r.published ? 'Published' : 'Draft'}{r.featured ? ' · Featured' : ''} · {r.downloads_count} downloads</p></div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-ghost" onClick={() => openEdit(r)}>Edit</button>
                            <button type="button" className="btn-ghost" onClick={() => toggleFlag(r, 'published')}>{r.published ? 'Unpublish' : 'Publish'}</button>
                            <button type="button" className="btn-ghost" onClick={() => toggleFlag(r, 'featured')}>{r.featured ? 'Unfeature' : 'Feature'}</button>
                            <button type="button" className="btn-ghost" onClick={() => handleDelete(r)}>Delete</button>
                        </div>
                    </li>
                ))}</ul>
            )}
        </div>
    );
}
