import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link className="text-blue-700 underline" to="/">
        Return to home
      </Link>
    </section>
  );
}
