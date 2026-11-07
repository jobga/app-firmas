import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { EventProvider } from './data/event';
import { PublicSign } from './pages/PublicSign';
import { AdminLogin } from './pages/AdminLogin';
import { Dashboard } from './pages/Dashboard';
import { EventConfig } from './pages/EventConfig';

export function App() {
  return (
    <EventProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicSign />} />
          <Route path="/admin/acceso" element={<AdminLogin />} />
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/eventos" element={<EventConfig />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </EventProvider>
  );
}
