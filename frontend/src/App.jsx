// App.jsx — Phase 7: /docs route added
import { Routes, Route } from 'react-router-dom';
import Home            from './pages/Home';
import Docs            from './pages/Docs';
import HostDashboard   from './pages/HostDashboard';
import ParticipantJoin from './pages/ParticipantJoin';
import SessionRecap    from './pages/SessionRecap';
import NotFound        from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/"      element={<Home />} />
      <Route path="/docs"  element={<Docs />} />
      <Route path="/host"  element={<HostDashboard />} />
      <Route path="/join"  element={<ParticipantJoin />} />
      <Route path="/recap" element={<SessionRecap />} />
      <Route path="*"      element={<NotFound />} />
    </Routes>
  );
}
