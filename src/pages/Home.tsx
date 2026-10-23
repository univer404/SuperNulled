import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import ResourceCard from '../components/ResourceCard';
import { usePublicSettings } from '../lib/settings';
import {
  RESOURCE_COLUMNS,
  supabase,
  type Category,
  type Resource,
} from '../lib/supabase';

export default function Home() {
  const { siteDescription } = usePublicSettings();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [latest, setLatest] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [resourceCount, setResourceCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [resources, cats, resCount, memCount] = await Promise.all([
        supabase
          .from('resources')
          .select(RESOURCE_COLUMNS)
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('categories').select('*').order('sort_order').limit(8),
        supabase
          .from('resources')
          .select('id', { count: 'exact', head: true })
          .eq('published', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      setLatest((resources.data as Resource[]) ?? []);
      setCategories((cats.data as Category[]) ?? []);
      setResourceCount(resCount.count ?? 0);
      setMemberCount(memCount.count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div>
      <section className="bg-[radial-gradient(ellipse_at_top,#3b1d6e55,transparent_65%)] px-4 py-16 text-center sm:py-24">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold sm:text-6xl">
          Digital resources for{' '}
          <span className="text-[#A855F7] [text-shadow:0_0_24px_rgba(168,85,247,0.6)]">
            your server
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400">
          {siteDescription}
        </p>
        <form
          onSubmit={handleSearch}
          className="mx-auto mt-8 flex max-w-xl gap-2"
          role="search"
        >
          <input
            className="input"
            placeholder="Search resources…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search resources"
          />
          <button type="submit" className="btn-primary">
            <Search className="h-4 w-4" /> Search
          </button>
        </form>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/browse?type=free" className="btn-ghost">
            Free Resources
          </Link>
          <Link to="/browse?type=premium" className="btn-ghost">
            Premium Resources
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-10">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-[#A855F7]">{resourceCount}</p>
          <p className="text-sm text-zinc-400">Published resources</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-[#A855F7]">{memberCount}</p>
          <p className="text-sm text-zinc-400">Members</p>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <h2 className="mb-4 text-xl font-bold">Categories</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map(category => (
              <Link
                key={category.id}
                to={`/browse?category=${category.slug}`}
                className="card p-4 text-center font-medium hover:border-[#A855F7]"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-4 text-xl font-bold">Latest resources</h2>
        {loading ? (
          <p className="text-zinc-400">Loading…</p>
        ) : latest.length === 0 ? (
          <div className="card p-8 text-center text-zinc-400">
            No resources have been published yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map(r => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
