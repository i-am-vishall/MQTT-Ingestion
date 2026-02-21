import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { Lock, Unlock, Network, Database, MonitorCheck, Gavel, LogOut, X, Shield } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Auth State (Blocking)
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Lock State (Safety Mode)
    const [isLocked, setIsLocked] = useState(true);

    // Login Form State
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Check for existing session on mount (Optional, but good for UX)
    useEffect(() => {
        const storedAuth = sessionStorage.getItem('admin_token');
        if (storedAuth) {
            axios.defaults.headers.common['Authorization'] = `Basic ${storedAuth}`;
            // Optional: Verify token valid?
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const token = btoa(`admin:${password}`);
            // Verify credentials
            await axios.get(`${API_BASE}/admin/config`, {
                headers: { Authorization: `Basic ${token}` }
            });

            // Set Global Auth & Session
            axios.defaults.headers.common['Authorization'] = `Basic ${token}`;
            sessionStorage.setItem('admin_token', token);

            setIsAuthenticated(true);
            setIsLocked(true); // Default to Read Only safety mode
            setError(null);
            setPassword('');
        } catch (e) {
            setError("Invalid Admin Password");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setIsLocked(true);
        setPassword('');
        delete axios.defaults.headers.common['Authorization'];
        sessionStorage.removeItem('admin_token');
        navigate('/');
    };

    // Toggle Edit Mode (Since we are securely logged in, this is just a safety switch)
    const toggleLock = () => {
        setIsLocked(!isLocked);
    };

    const NavTab = ({ to, icon: Icon, label }) => (
        <NavLink
            to={to}
            className={({ isActive }) => `
                flex items-center gap-2 px-4 py-3 border-b-2 transition-colors
                ${isActive ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'}
            `}
        >
            <Icon size={16} />
            <span className="text-sm font-medium">{label}</span>
        </NavLink>
    );

    // BLOCKING LOGIN SCREEN
    if (!isAuthenticated) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 animate-fade-in relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[128px]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px]"></div>
                </div>

                <div className="bg-surface p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-sm relative z-10 backdrop-blur-xl">
                    <div className="flex flex-col items-center justify-center mb-8 text-white">
                        <div className="bg-slate-800 p-4 rounded-full mb-4 border border-slate-600 shadow-inner">
                            <Shield size={32} className="text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-center tracking-tight">Admin Portal</h2>
                        <p className="text-slate-400 text-sm mt-2">Restricted Access Area</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="w-full bg-slate-900/50 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-center tracking-widest placeholder:tracking-normal"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoFocus
                            />
                        </div>
                        {error && (
                            <div className="bg-red-900/20 border border-red-900/50 text-red-400 text-sm p-3 rounded-lg flex items-center justify-center gap-2 animate-shake">
                                <X size={14} /> {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white p-3.5 rounded-lg font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <>Unlock Panel <Unlock size={18} /></>}
                        </button>
                    </form>

                    <button onClick={() => navigate('/')} className="w-full text-center text-slate-500 hover:text-slate-300 text-xs mt-6 transition-colors">
                        Reference Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // AUTHENTICATED LAYOUT
    return (
        <div className="w-full h-full flex flex-col bg-slate-900">
            {/* Admin Header */}
            <div className="flex-none bg-surface border-b border-slate-800 flex justify-between items-center px-6 shadow-sm z-20">
                <div className="flex overflow-x-auto">
                    <NavTab to="/admin/sources" icon={Network} label="Data Sources" />
                    <NavTab to="/admin/devices" icon={MonitorCheck} label="Device Monitoring" />
                    <NavTab to="/admin/schema" icon={Database} label="Schema Mapping" />
                    <NavTab to="/admin/config" icon={Gavel} label="System Config" />
                </div>

                <div className="flex items-center gap-4">
                    {/* Lock Toggle */}
                    <button
                        onClick={toggleLock}
                        className={`
                            px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all border
                            ${isLocked
                                ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white hover:border-slate-500'
                                : 'bg-red-900/20 text-red-400 border-red-900/50 hover:bg-red-900/30'
                            }
                        `}
                    >
                        {isLocked ? (
                            <><Lock size={12} /> Unlock Editing</>
                        ) : (
                            <><Unlock size={12} /> Editing Enabled</>
                        )}
                    </button>

                    <div className="h-6 w-px bg-slate-800"></div>

                    <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition-colors">
                        <LogOut size={14} /> Logout
                    </button>
                </div>
            </div>

            {/* Read Only Banner (If Locked) */}
            {isLocked && (
                <div className="bg-blue-900/30 border-b border-blue-900/30 px-6 py-1.5 flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-300 select-none">
                    <Lock size={10} /> Read Only Mode Active • Changes Disabled
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <Outlet context={{ isLocked }} />
            </div>
        </div>
    );
};

export default AdminLayout;
