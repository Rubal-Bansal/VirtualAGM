import { Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { AdminDashboard } from './pages/AdminDashboard';
import { RoomPage } from './pages/RoomPage';
import { JoinPage } from './pages/JoinPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/meetings/:meetingId/admin" element={<AdminDashboard />} />
      <Route path="/room/:token" element={<RoomPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
    </Routes>
  );
}
