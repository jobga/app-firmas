/**
 * Rutas de la aplicación.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { InstallGate } from './components/InstallGate';
import { RequireAdmin } from './components/RequireAdmin';
import { PublicSign } from './pages/PublicSign';
import { Receipt } from './pages/Receipt';
import { AdminLogin } from './pages/AdminLogin';
import { Dashboard } from './pages/Dashboard';
import { Events } from './pages/Events';
import { EventConfig } from './pages/EventConfig';
import { Settings } from './pages/Settings';

const admin = (el: ReactNode) => <RequireAdmin>{el}</RequireAdmin>;

export function App() {
  return (
    <InstallGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicSign />} />
          <Route path="/firma/:slug" element={<PublicSign />} />
          <Route path="/comprobante/:token" element={<Receipt />} />
          <Route path="/admin/acceso" element={<AdminLogin />} />
          <Route path="/admin" element={admin(<Dashboard />)} />
          <Route path="/admin/eventos" element={admin(<Events />)} />
          <Route path="/admin/eventos/:id" element={admin(<EventConfig />)} />
          <Route path="/admin/ajustes" element={admin(<Settings />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </InstallGate>
  );
}
