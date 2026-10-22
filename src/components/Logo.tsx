import { Link } from 'react-router-dom';

export default function Logo({ large = false }: { large?: boolean }) {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2"
      aria-label="SuperNulled home"
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
        Super
        <span className="text-[#A855F7] [text-shadow:0_0_14px_rgba(168,85,247,0.7)]">
          Nulled
        </span>
      </span>
    </Link>
  );
}
