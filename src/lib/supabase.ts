import { createClient } from '@supabase/supabase-js';

// Both values are public by design: access is enforced by Row Level Security in the database.
const SUPABASE_URL = 'https://kicoznnuwcrldfgagghu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_a83UJfU4WbjvE1Zyc5i79Q_G6UbzMkR';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export interface Resource {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  version: string | null;
  tags: string[];
  thumbnail_path: string | null;
  file_size: number;
  downloads_count: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export const RESOURCE_COLUMNS =
  'id,title,slug,description,category,price,version,tags,thumbnail_path,file_size,downloads_count,created_at,updated_at';

export function formatPrice(price: number): string {
  if (price === 0) return 'Free';
  return `₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export function thumbnailUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('supernulled-public').getPublicUrl(path).data
    .publicUrl;
}
