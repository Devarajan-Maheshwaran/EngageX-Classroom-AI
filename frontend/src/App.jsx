import { Routes, Route } from 'react-router-dom';
import Home            from './pages/Home';
import HostDashboard   from './pages/HostDashboard';
import ParticipantJoin from './pages/ParticipantJoin';

export default function App() {
  return (
    <Routes>
      <Route path="/"      element={<Home />} />
      <Route path="/host"  element={<HostDashboard />} />
      <Route path="/join"  element={<ParticipantJoin />} />
    </Routes>
  );
}
