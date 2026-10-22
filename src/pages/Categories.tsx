import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Category } from '../lib/supabase';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setCategories((data as Category[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Categories</h1>
      {loading ? (
        <p className="text-zinc-400">Loading…</p>
      ) : categories.length === 0 ? (
        <div className="card p-10 text-center text-zinc-400">
          No categories have been created yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(category => (
            <Link
              key={category.id}
              to={`/browse?category=${category.slug}`}
              className="card block p-5 hover:border-[#A855F7]"
            >
              <h2 className="font-semibold">{category.name}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {category.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
