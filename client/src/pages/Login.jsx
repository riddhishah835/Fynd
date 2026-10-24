import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import ErrorBox from '../components/ErrorBox.jsx';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fieldErrors, getDashboardPath } from '../utils/helpers.js';

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
    <section className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-semibold">Login</h1>
      {errorMessage && <ErrorBox message={errorMessage} />}

      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="email">
          Email
          <input
            autoComplete="email"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          {errors.email && <span className="mt-1 block text-sm text-red-700">{errors.email}</span>}
        </label>

        <label className="block text-sm font-medium" htmlFor="password">
          Password
          <input
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {errors.password && (
            <span className="mt-1 block text-sm text-red-700">{errors.password}</span>
          )}
        </label>

        <button
          className="rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </section>
  );
}
