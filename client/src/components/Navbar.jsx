import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link className="text-xl font-semibold text-gray-900" to="/">
          Fynd
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link className="text-gray-700 hover:text-gray-900" to="/login">
            Login
          </Link>
          <Link className="text-gray-700 hover:text-gray-900" to="/signup">
            Signup
          </Link>
        </div>
      </nav>
    </header>
  );
}
