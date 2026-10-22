import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { formatPrice, thumbnailUrl, type Resource } from '../lib/supabase';

export default function ResourceCard({ resource }: { resource: Resource }) {
    const descriptionImagePath = resource.description.match(/\[\[description-image:(.*?)\]\]/)?.[1] ?? null;
  const image = thumbnailUrl(resource.thumbnail_path) ?? thumbnailUrl(descriptionImagePath);
    const previewDescription = resource.description.replace(/\\n/g, ' ').replace(/\\r/g, '').replace(/\[\[description-image:.*?\]\]/g, '').trim();
  return (
    <Link
      to={`/resource/${resource.slug}`}
      className="card group block overflow-hidden hover:border-[#A855F7] hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
    >
      <div className="flex aspect-video items-center justify-center bg-[#11111B]">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-10 w-10 text-[#7C3AED]" aria-hidden="true" />
        )}
      </div>
      <div className="space-y-2 p-4">
        <span className="badge">{resource.category}</span>
        <h3 className="font-semibold group-hover:text-[#C4B5FD]">
          {resource.title}
        </h3>
        <p className="line-clamp-2 text-sm text-zinc-400">
          {previewDescription}
        </p>
        <p className="font-bold text-[#A855F7]">
          {formatPrice(resource.price)}
        </p>
      </div>
    </Link>
  );
}
