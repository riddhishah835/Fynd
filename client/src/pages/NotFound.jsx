import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="flex min-h-[55vh] flex-col items-center justify-center space-y-5 text-center">
      <span aria-hidden="true" className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-8xl font-extrabold tracking-tighter text-transparent sm:text-9xl">404</span>
      <h1 className="page-title">Page not found</h1>
      <Link className="btn-primary" to="/">
        Return to home
      </Link>
    </section>
  );
}
