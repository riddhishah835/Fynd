import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SponsorDashboard() {
  const { user } = useAuth();

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p>Organization: {user.organization}</p>
      <p>City: {user.city}</p>
      <p>Role: {user.role}</p>
      <Link className="inline-block rounded bg-blue-700 px-4 py-2 font-medium text-white" to="/events">
        Browse events
      </Link>
    </section>
  );
}
