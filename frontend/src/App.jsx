// App.jsx — Phase 7: /docs route added
import { Routes, Route } from 'react-router-dom';
import Home            from './pages/Home';
import Docs            from './pages/Docs';
import ParticipantJoin from './pages/ParticipantJoin';
import MeetingRoom     from './pages/MeetingRoom';
import SessionRecap    from './pages/SessionRecap';
import HostDashboard   from './pages/HostDashboard';
import NotFound        from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/"            element={<Home />} />
      <Route path="/docs"        element={<Docs />} />
      <Route path="/join"        element={<ParticipantJoin />} />
      <Route path="/room"        element={<MeetingRoom />} />
      <Route path="/recap"       element={<SessionRecap />} />
      <Route path="/host-legacy" element={<HostDashboard />} />
      <Route path="*"            element={<NotFound />} />
    </Routes>
  );
}
