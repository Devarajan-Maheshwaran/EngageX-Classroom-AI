// App.jsx — Phase 6: complete route table
// Routes:
//   /           → Home           (landing + create session)
//   /host       → HostDashboard  (live teacher view)
//   /join       → ParticipantJoin (student join + chat)
//   /recap      → SessionRecap   (post-session summary)
//   *           → NotFound
import { Routes, Route } from 'react-router-dom';
import Home            from './pages/Home';
import HostDashboard   from './pages/HostDashboard';
import ParticipantJoin from './pages/ParticipantJoin';
import SessionRecap    from './pages/SessionRecap';
import NotFound        from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/"      element={<Home />} />
      <Route path="/host"  element={<HostDashboard />} />
      <Route path="/join"  element={<ParticipantJoin />} />
      <Route path="/recap" element={<SessionRecap />} />
      <Route path="*"      element={<NotFound />} />
    </Routes>
  );
}
