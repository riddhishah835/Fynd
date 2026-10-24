import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import OrganizerDashboard from './pages/OrganizerDashboard.jsx';
import Signup from './pages/Signup.jsx';
import SponsorDashboard from './pages/SponsorDashboard.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/organizer"
            element={
              <ProtectedRoute roles={['organizer']}>
                <OrganizerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sponsor"
            element={
              <ProtectedRoute roles={['sponsor']}>
                <SponsorDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
