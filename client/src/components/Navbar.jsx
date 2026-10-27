import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getDashboardPath } from '../utils/helpers.js';
import ErrorBox from './ErrorBox.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const linkClass = ({ isActive }) => (
  `rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`
);

function Logo({ small = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${small ? 'h-8 w-8' : 'h-9 w-9'} flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm`}>
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
          <path d="M5 18V6l7 7 7-7v12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
          <path d="M8 18h8" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
        </svg>
      </span>
      <span className="text-xl font-bold tracking-tight text-slate-900">Fynd</span>
    </span>
  );
}

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [errorMessage, setErrorMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setErrorMessage('');
    try {
      await logout();
      setMenuOpen(false);
      navigate('/');
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const initials = user?.name
    ?.split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link aria-label="Fynd home" onClick={() => setMenuOpen(false)} to="/">
            <Logo />
          </Link>
          {!loading && (
            <>
              <div className="hidden items-center gap-1 lg:flex">
                {user ? (
                  <>
                    <NavLink className={linkClass} to={getDashboardPath(user.role)}>Dashboard</NavLink>
                    <NavLink className={linkClass} to="/events">
                      {user.role === 'organizer' ? 'Browse events' : 'Discover'}
                    </NavLink>
<NavLink className={linkClass} to="/proposals">
                    {user.role === 'organizer' ? 'Proposals' : 'My proposals'}
                  </NavLink>
                  <NavLink className={linkClass} to="/assistant">Assistant</NavLink>
                  <NavLink className={linkClass} to="/notifications">
                      <span className="inline-flex items-center gap-2">
                        Notifications
                        {unreadCount > 0 && (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700">
                            {unreadCount}
                          </span>
                        )}
                      </span>
                    </NavLink>
                  </>
                ) : (
                  <>
                    <NavLink className={linkClass} to="/login">Login</NavLink>
                    <NavLink className={linkClass} to="/signup">Signup</NavLink>
                  </>
                )}
              </div>
              <div className="hidden items-center gap-3 lg:flex">
                {user && (
                  <>
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white">
                        {initials}
                      </span>
                      <span className="max-w-36 truncate">{user.name}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                      user.role === 'organizer'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {user.role}
                    </span>
                    <button className="btn-ghost min-h-9 px-3" onClick={handleLogout} type="button">
                      Logout
                    </button>
                  </>
                )}
                {!user && (
                  <Link className="btn-primary min-h-9 px-4" to="/signup">Get started</Link>
                )}
              </div>
              <button
                aria-expanded={menuOpen}
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                className="btn-ghost h-10 w-10 p-2 lg:hidden"
                onClick={() => setMenuOpen((open) => !open)}
                type="button"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  {menuOpen
                    ? <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />}
                </svg>
              </button>
            </>
          )}
        </nav>
        {!loading && menuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 shadow-lg lg:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 sm:px-2">
              {user ? (
                <>
                  <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white">
                      {initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
                      <span className="text-xs capitalize text-slate-500">{user.role}</span>
                    </span>
                    {unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <NavLink className={linkClass} onClick={() => setMenuOpen(false)} to={getDashboardPath(user.role)}>Dashboard</NavLink>
                  <NavLink className={linkClass} onClick={() => setMenuOpen(false)} to="/events">
                    {user.role === 'organizer' ? 'Browse events' : 'Discover'}
                  </NavLink>
                  <NavLink className={linkClass} onClick={() => setMenuOpen(false)} to="/proposals">
                    {user.role === 'organizer' ? 'Proposals' : 'My proposals'}
                  </NavLink>
                  <NavLink className={linkClass} onClick={() => setMenuOpen(false)} to="/assistant">Assistant</NavLink>
                  <NavLink className={linkClass} onClick={() => setMenuOpen(false)} to="/notifications">
                    Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
                  </NavLink>
                  <button className="btn-ghost justify-start" onClick={handleLogout} type="button">Logout</button>
                </>
              ) : (
                <>
                  <NavLink className={linkClass} onClick={() => setMenuOpen(false)} to="/login">Login</NavLink>
                  <NavLink className={linkClass} onClick={() => setMenuOpen(false)} to="/signup">Signup</NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      {errorMessage && (
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
          <ErrorBox message={errorMessage} />
        </div>
      )}
    </>
  );
}
