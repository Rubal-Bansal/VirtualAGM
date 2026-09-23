import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateEventPage } from './pages/CreateEventPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { RoomPage } from './pages/RoomPage';
import { JoinPage } from './pages/JoinPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/events/new" element={<RequireAuth><CreateEventPage /></RequireAuth>} />
      <Route path="/meetings/:meetingId/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
      {/* Joining a meeting stays public: the invite token is the credential. */}
      <Route path="/room/:token" element={<RoomPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
    </Routes>
  );
}
