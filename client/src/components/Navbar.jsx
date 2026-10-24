import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getDashboardPath } from '../utils/helpers.js';
import ErrorBox from './ErrorBox.jsx';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const handleLogout = async () => {
    setErrorMessage('');
    try {
      await logout();
      navigate('/');
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link className="text-xl font-semibold text-gray-900" to="/">
            Fynd
          </Link>
          {!loading && (
            <div className="flex items-center gap-4 text-sm">
              {user ? (
                <>
                  <Link
                    className="text-gray-700 hover:text-gray-900"
                    to={getDashboardPath(user.role)}
                  >
                    Dashboard
                  </Link>
                  <span className="text-gray-700">{user.name}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                    {user.role}
                  </span>
                  <button
                    className="text-gray-700 hover:text-gray-900"
                    onClick={handleLogout}
                    type="button"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link className="text-gray-700 hover:text-gray-900" to="/login">
                    Login
                  </Link>
                  <Link className="text-gray-700 hover:text-gray-900" to="/signup">
                    Signup
                  </Link>
                </>
              )}
            </div>
          )}
        </nav>
      </header>
      {errorMessage && (
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <ErrorBox message={errorMessage} />
        </div>
      )}
    </>
  );
}
