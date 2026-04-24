import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, ScrollText, Gavel, MonitorCheck, Network, Database, Settings as SettingsIcon } from 'lucide-react';
import logo from './assets/i2v-icon.svg';
import Dashboard from './components/Dashboard';
import BrokerManager from './components/BrokerManager';
import Settings from './components/Settings'; // Renamed to "Database System" in UI
import Logs from './components/Logs';
import DataPeek from './components/DataPeek';
import RuleEditor from './components/RuleEditor';
import DeviceManager from './components/DeviceManager';
import Admin from './components/Admin';
import SchemaMapper from './components/SchemaMapper';
import CameraMapping from './components/CameraMapping';
import AdminLayout from './components/AdminLayout'; // The new layout
import SystemConfigWrapper from './components/SystemConfigWrapper'; // The new unified config UI

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const p = location.pathname;
    if (p === '/' || p === '/dashboard') return 'dashboard';
    if (p === '/Live-Logs') return 'logs';
    if (p.startsWith('/admin')) return 'admin';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const handleNav = (id) => {
    switch (id) {
      case 'dashboard': navigate('/dashboard'); break;
      case 'logs': navigate('/Live-Logs'); break;
      case 'admin': navigate('/admin'); break; // Goes to Admin Layout -> redirect to sources
      default: navigate('/');
    }
  };

  const NavItem = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => handleNav(id)}
      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${activeTab === id ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
        }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-background text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-surface border-r border-slate-700 flex flex-col p-4 shadow-lg flex-none">
        <div className="flex items-center space-x-2 px-2 mb-8">
          <img src={logo} alt="I2V Logo" className="w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight">I2V Config<span className="text-primary">.io</span></h1>
        </div>

        <nav className="space-y-2 flex-1">
          <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
          <NavItem id="logs" label="Live Logs" icon={ScrollText} />

          <div className="my-4 border-t border-slate-700/50"></div>
          <div className="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Configuration</div>
          <NavItem id="admin" label="Admin Panel" icon={Gavel} />
        </nav>

        <div className="pt-4 border-t border-slate-700 text-xs text-slate-500">
          v1.0.3 Admin Console
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Global if needed, or per page */}
        {/* We keep a simple header or remove it if sub-pages handle it. Let's keep a minimal one. */}

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-auto bg-slate-900/50 relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/Live-Logs" element={<Logs />} />

            {/* Legacy Routes Redirect to Admin */}
            <Route path="/Device-Monitoring" element={<Navigate to="/admin/devices" replace />} />
            <Route path="/Data-Sources" element={<Navigate to="/admin/sources" replace />} />
            <Route path="/Schema-Mapping" element={<Navigate to="/admin/schema" replace />} />

            {/* Secure Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/sources" replace />} />
              <Route path="sources" element={<SystemConfigWrapper initialTab="mqtt" />} />
              <Route path="devices" element={<DeviceManager />} />
              <Route path="cameras" element={<CameraMapping />} />
              <Route path="schema" element={<SchemaMapper />} />
              <Route path="config" element={<SystemConfigWrapper initialTab="pipeline" />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
