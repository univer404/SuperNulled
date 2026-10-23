import { Link } from 'react-router-dom';
import { usePublicSettings } from '../lib/settings';

export default function Logo({ large = false }: { large?: boolean }) {
  const { siteName } = usePublicSettings();
  const splitAt = Math.max(1, Math.ceil(siteName.length * 0.55));
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2"
      aria-label={`${siteName} home`}
    >
      <svg
        viewBox="0 0 32 32"
        className={large ? 'h-10 w-10' : 'h-7 w-7'}
        aria-hidden="true"
      >
        <path
          d="M16 2l12 7v14l-12 7-12-7V9z"
          fill="#08080D"
          stroke="#A855F7"
          strokeWidth="2"
        />
        <path d="M11 12h10M11 16h10M11 20h6" stroke="#C4B5FD" strokeWidth="2" />
      </svg>
      <span
        className={`${large ? 'text-3xl' : 'text-xl'} font-extrabold tracking-tight`}
      >
        {siteName.slice(0, splitAt)}
        <span className="text-[#A855F7] [text-shadow:0_0_14px_rgba(168,85,247,0.7)]">{siteName.slice(splitAt)}</span>
      </span>
    </Link>
  );
}
