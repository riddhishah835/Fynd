import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import ErrorBox from '../components/ErrorBox.jsx';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fieldErrors, getDashboardPath } from '../utils/helpers.js';

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20">
        <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path d="M5 18V6l7 7 7-7v12M8 18h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </span>
      <span className="text-xl font-bold tracking-tight text-slate-900">Fynd</span>
    </span>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!loading && user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }
  if (loading) {
    return <Loader />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setErrorMessage('');

    try {
      const loggedInUser = await login(email, password);
      const destination = location.state?.from ?? getDashboardPath(loggedInUser.role);
      navigate(destination, { replace: true });
    } catch (error) {
      const fieldErrorMap = fieldErrors(error);
      setErrors(fieldErrorMap);
      if (Object.keys(fieldErrorMap).length === 0) {
        setErrorMessage(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="-my-8 flex min-h-[calc(100vh-9rem)] items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-violet-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md space-y-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-900/5 sm:p-8">
        <div className="flex justify-center"><BrandMark /></div>
        <h1 className="page-title text-center">Login</h1>
        {errorMessage && <ErrorBox message={errorMessage} />}

        <form className="space-y-5" onSubmit={submit}>
          <label className="label" htmlFor="email">
            Email
            <input
              autoComplete="email"
              className="input"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            {errors.email && <span className="mt-1 block text-sm text-rose-600">{errors.email}</span>}
          </label>

          <label className="label" htmlFor="password">
            Password
            <input
              autoComplete="current-password"
              className="input"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {errors.password && (
              <span className="mt-1 block text-sm text-rose-600">{errors.password}</span>
            )}
          </label>

          <button className="btn-primary w-full" disabled={submitting} type="submit">
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </section>
  );
}
