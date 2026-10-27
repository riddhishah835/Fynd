import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import OrganizerDashboard from './pages/OrganizerDashboard.jsx';
import EventForm from './pages/EventForm.jsx';
import EventDetail from './pages/EventDetail.jsx';
import Events from './pages/Events.jsx';
import Signup from './pages/Signup.jsx';
import SponsorDashboard from './pages/SponsorDashboard.jsx';
import Proposals from './pages/Proposals.jsx';
import ProposalDetail from './pages/ProposalDetail.jsx';
import Notifications from './pages/Notifications.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
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
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <Events />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id"
            element={
              <ProtectedRoute>
                <EventDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer/events/new"
            element={
              <ProtectedRoute roles={['organizer']}>
                <EventForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer/events/:id/edit"
            element={
              <ProtectedRoute roles={['organizer']}>
                <EventForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/proposals"
            element={
              <ProtectedRoute>
                <Proposals />
              </ProtectedRoute>
            }
          />
          <Route
            path="/proposals/:id"
            element={
              <ProtectedRoute>
                <ProposalDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="mt-auto border-t border-slate-200 bg-white/70">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-slate-500 sm:px-6">
          Fynd · Better partnerships start with the right fit.
        </div>
      </footer>
    </div>
  );
}
