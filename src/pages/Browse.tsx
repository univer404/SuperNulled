import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ResourceCard from '../components/ResourceCard';
import { RESOURCE_COLUMNS, supabase, type Resource } from '../lib/supabase';

const PAGE_SIZE = 12;

const SORT_OPTIONS = {
  latest: { label: 'Latest', column: 'created_at', ascending: false },
  popular: {
    label: 'Most downloaded',
    column: 'downloads_count',
    ascending: false,
  },
  'price-low': { label: 'Lowest price', column: 'price', ascending: true },
  'price-high': { label: 'Highest price', column: 'price', ascending: false },
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const q = params.get('q') ?? '';
  const type = params.get('type') ?? 'all';
  const category = params.get('category') ?? '';
  const sort =
    (params.get('sort') as SortKey) in SORT_OPTIONS
      ? (params.get('sort') as SortKey)
      : 'latest';
  const page = Math.max(1, Number(params.get('page')) || 1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      let request = supabase
        .from('resources')
        .select(RESOURCE_COLUMNS, { count: 'exact' })
        .eq('published', true);
      const term = q.replace(/[%,()]/g, ' ').trim();
      if (term) request = request.ilike('title', `%${term}%`);
      if (type === 'free') request = request.eq('price', 0);
      if (type === 'premium') request = request.gt('price', 0);
      if (category) request = request.eq('category', category);
      const { column, ascending } = SORT_OPTIONS[sort];
      const from = (page - 1) * PAGE_SIZE;
      const {
        data,
        count,
        error: queryError,
      } = await request
        .order(column, { ascending })
        .range(from, from + PAGE_SIZE - 1);
      if (cancelled) return;
      if (queryError) setError('Could not load resources. Please try again.');
      setResources((data as Resource[]) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [q, type, category, sort, page]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }

  const heading =
    type === 'free'
      ? 'Free Resources'
      : type === 'premium'
        ? 'Premium Resources'
        : 'Browse Resources';
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{heading}</h1>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <input
          className="input"
          placeholder="Search by title"
          aria-label="Search by title"
          defaultValue={q}
          key={q}
          onKeyDown={e => {
            if (e.key === 'Enter')
              updateParam('q', e.currentTarget.value.trim());
          }}
        />
        <select
          className="input"
          aria-label="Price filter"
          value={type}
          onChange={e =>
            updateParam('type', e.target.value === 'all' ? '' : e.target.value)
          }
        >
          <option value="all">All prices</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <select
          className="input"
          aria-label="Sort by"
          value={sort}
          onChange={e => updateParam('sort', e.target.value)}
        >
          {Object.entries(SORT_OPTIONS).map(([key, option]) => (
            <option key={key} value={key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-red-400">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-zinc-400">Loading…</p>
      ) : resources.length === 0 ? (
        <div className="card p-10 text-center text-zinc-400">
          No resources found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map(r => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => updateParam('page', String(page - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-ghost"
            disabled={page >= totalPages}
            onClick={() => updateParam('page', String(page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
