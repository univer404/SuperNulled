import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="p-16 text-center">
      <p className="text-6xl font-extrabold text-[#A855F7]">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <Link to="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}
