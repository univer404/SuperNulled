import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, Package } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { startDownload } from '../lib/functions';
import { useCart } from '../lib/cart';
import { RESOURCE_COLUMNS, formatPrice, supabase, thumbnailUrl, type Resource } from '../lib/supabase';

export default function ResourceDetail() {
  const { slug } = useParams();
  const { session } = useAuth();
  const { add: addToCart, has: isInCart } = useCart();
  const userId = session?.user.id;
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('resources').select(RESOURCE_COLUMNS).eq('slug', slug ?? '').eq('published', true).maybeSingle();
      setResource((data as Resource | null) ?? null);
      setLoading(false);
    }
    void load();
  }, [slug]);

  useEffect(() => {
    if (!resource || !userId) {
      setFavorited(false);
      return;
    }
    supabase.from('favorites').select('resource_id').eq('user_id', userId).eq('resource_id', resource.id).maybeSingle()
      .then(({ data }) => setFavorited(Boolean(data)));
  }, [resource, userId]);

  async function toggleFavorite() {
    if (!resource || !userId || busy) return;
    setBusy(true);
    setMessage(null);
    const request = favorited
      ? supabase.from('favorites').delete().eq('user_id', userId).eq('resource_id', resource.id)
      : supabase.from('favorites').insert({ user_id: userId, resource_id: resource.id });
    const { error } = await request;
    if (error) setMessage('Could not update favorites. Please try again.');
    else setFavorited(!favorited);
    setBusy(false);
  }

  async function handleDownload() {
    if (!resource || !userId || downloading || resource.price !== 0) return;
    setDownloading(true);
    setDownloadMessage(null);
    try {
      await startDownload(resource.id);
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <p className="p-8 text-center text-zinc-400">Loading…</p>;
  if (!resource) {
    return <div className="p-12 text-center"><h1 className="text-2xl font-bold">Resource not found</h1><Link to="/browse" className="btn-primary mt-6">Browse resources</Link></div>;
  }

  const image = thumbnailUrl(resource.thumbnail_path);
  const isFree = resource.price === 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="card flex aspect-video items-center justify-center overflow-hidden">
          {image ? <img src={image} alt={resource.title} className="h-full w-full object-cover" /> : <Package className="h-16 w-16 text-[#7C3AED]" aria-hidden="true" />}
        </div>
        <h1 className="mt-6 text-3xl font-bold">{resource.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2"><span className="badge">{resource.category}</span>{resource.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}</div>
        <div className="mt-6 space-y-4 text-zinc-300">{resource.description.split(/(\[\[description-image:.*?\]\])/g).map((part, index) => {
          const match = part.match(/^\[\[description-image:(.*?)\]\]$/);
          if (match) {
            const src = thumbnailUrl(match[1]);
            return src ? <img key={index} src={src} alt={`${resource.title} description image ${index + 1}`} loading="lazy" className="h-auto max-w-full rounded-xl border border-white/10" /> : null;
          }
          return part.trim() ? <p key={index} className="whitespace-pre-line">{part}</p> : null;
        })}</div>
      </div>
      <aside className="card h-fit space-y-4 p-5">
        <p className="text-3xl font-extrabold text-[#A855F7]">{formatPrice(resource.price)}</p>
        {isFree ? (
          session ? <button type="button" className="btn-primary w-full" onClick={() => void handleDownload()} disabled={downloading}>{downloading ? 'Preparing download…' : 'Download free resource'}</button>
            : <Link to="/login" className="btn-primary block w-full text-center">Log in to download</Link>
        ) : <button type="button" className="btn-primary w-full" onClick={() => addToCart({ id: resource.id, slug: resource.slug, title: resource.title, price: Number(resource.price) })} disabled={isInCart(resource.id)}>{isInCart(resource.id) ? 'Added to cart' : 'Add paid resource to cart'}</button>}
        {isFree && <p className="text-xs text-zinc-500">Basic Members can download 2 free resources per day. VIP members have unlimited free downloads.</p>}
        {!isFree && <p className="text-xs text-zinc-500">VIP only includes unlimited free-resource downloads. This paid resource must be purchased separately at checkout.</p>}
        {downloadMessage && <p role="alert" className="text-sm text-red-400">{downloadMessage}</p>}
        {session ? <button type="button" className="btn-ghost w-full" onClick={toggleFavorite} disabled={busy}><Heart className={`h-4 w-4 ${favorited ? 'fill-[#A855F7]' : ''}`} />{favorited ? 'Remove from favorites' : 'Add to favorites'}</button>
          : <Link to="/login" className="btn-ghost block w-full text-center">Log in to save favorites</Link>}
        {message && <p role="alert" className="text-sm text-red-400">{message}</p>}
        <dl className="space-y-1 text-sm text-zinc-400">
          {resource.version && <div className="flex justify-between"><dt>Version</dt><dd>{resource.version}</dd></div>}
          <div className="flex justify-between"><dt>Downloads</dt><dd>{resource.downloads_count}</dd></div>
          <div className="flex justify-between"><dt>Updated</dt><dd>{new Date(resource.updated_at).toLocaleDateString()}</dd></div>
        </dl>
      </aside>
    </div>
  );
}