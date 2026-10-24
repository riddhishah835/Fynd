import { useAuth } from '../context/AuthContext.jsx';

export default function SponsorDashboard() {
  const { user } = useAuth();

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p>Organization: {user.organization}</p>
      <p>City: {user.city}</p>
      <p>Role: {user.role}</p>
    </section>
  );
}
