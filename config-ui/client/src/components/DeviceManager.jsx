import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Save, Plus, Trash2, RefreshCw, Server, AlertCircle, CheckCircle, Search } from 'lucide-react';

export default function DeviceManager() {
    const { isLocked } = useOutletContext();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // New device form state
    const [newIp, setNewIp] = useState('');
    const [newType, setNewType] = useState('camera');

    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/devices');
            const data = await res.json();
            setDevices(data.devices || []);
        } catch (err) {
            setError('Failed to load devices.');
        } finally {
            setLoading(false);
        }
    };

    const addDevice = () => {
        if (!newIp) return;
        const rawIps = newIp.split(/[,\n\s;]+/);
        const validIps = [];
        let errorMsg = "";
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;

        rawIps.forEach(ip => {
            const cleanIp = ip.trim();
            if (!cleanIp) return;
            if (!ipRegex.test(cleanIp)) { errorMsg = `Invalid IP: ${cleanIp}`; return; }
            if (devices.some(d => d.ip === cleanIp)) return; // Skip duplicates
            validIps.push({ ip: cleanIp, type: newType });
        });

        if (validIps.length === 0 && errorMsg) {
            setError(errorMsg);
            setTimeout(() => setError(null), 3000);
            return;
        }

        setDevices([...devices, ...validIps]);
        setNewIp('');
    };

    const removeDevice = (ip) => {
        setDevices(devices.filter(d => d.ip !== ip));
    };

    const saveConfiguration = async () => {
        setSaving(true);
        setSuccessMsg(null);
        setError(null);
        try {
            const res = await fetch('/api/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ devices })
            });
            const data = await res.json();
            if (data.success) setSuccessMsg(data.message);
            else setError(data.error || 'Failed to save');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-4 p-6 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex justify-between items-center bg-surface p-6 rounded-xl border border-slate-700 shadow-sm flex-none">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Server className="text-primary" />
                        Device Monitoring
                        <span className={`text-xs px-2 py-0.5 rounded border uppercase tracking-wider ${isLocked ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-green-900/30 text-green-400 border-green-800'}`}>
                            {isLocked ? 'Read Only' : 'Editing Mode'}
                        </span>
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Manage IP addresses monitored by Telegraf</p>
                </div>
                {!isLocked && (
                    <button
                        onClick={saveConfiguration}
                        disabled={saving}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-lg transition-all ${saving ? 'bg-slate-600 cursor-not-allowed' : 'bg-primary hover:bg-blue-600 text-white'}`}
                    >
                        {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        {saving ? 'Applying...' : 'Save Changes'}
                    </button>
                )}
            </div>

            {/* Notifications */}
            {error && <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded flex items-center gap-2 text-sm"><AlertCircle size={16} />{error}</div>}
            {successMsg && <div className="bg-green-900/50 border border-green-800 text-green-200 p-3 rounded flex items-center gap-2 text-sm"><CheckCircle size={16} />{successMsg}</div>}

            {/* Main Content */}
            <div className="flex-1 bg-surface rounded-xl border border-slate-700 shadow-sm overflow-hidden flex flex-col">
                {/* Add Bar */}
                {!isLocked && (
                    <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex gap-4 items-center animate-fade-in">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Add IP Address (e.g. 192.168.1.10)"
                                value={newIp}
                                onChange={(e) => setNewIp(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-primary outline-none font-mono"
                                onKeyDown={e => e.key === 'Enter' && addDevice()}
                            />
                        </div>
                        <div className="w-40">
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-primary outline-none"
                            >
                                <option value="camera">Camera</option>
                                <option value="switch">Switch</option>
                                <option value="server">Server</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <button onClick={addDevice} className="bg-green-600 hover:bg-green-500 text-white p-2 rounded shadow-lg transition-transform active:scale-95">
                            <Plus size={20} />
                        </button>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/80 text-slate-400 sticky top-0 backdrop-blur-sm z-10 shadow-sm">
                            <tr>
                                <th className="p-3 font-semibold w-16 text-center">#</th>
                                <th className="p-3 font-semibold">IP Address</th>
                                <th className="p-3 font-semibold">Type</th>
                                {!isLocked && <th className="p-3 font-semibold text-right">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {devices.length === 0 && !loading && (
                                <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No devices configured</td></tr>
                            )}
                            {devices.map((d, i) => (
                                <tr key={d.ip + i} className="hover:bg-slate-800/50 transition-colors group">
                                    <td className="p-3 text-center text-slate-600">{i + 1}</td>
                                    <td className="p-3 font-mono text-slate-200">{d.ip}</td>
                                    <td className="p-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                            ${d.type === 'camera' ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' :
                                                d.type === 'switch' ? 'bg-purple-900/30 text-purple-400 border border-purple-900/50' :
                                                    'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                            {d.type}
                                        </span>
                                    </td>
                                    {!isLocked && (
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => removeDevice(d.ip)}
                                                className="text-slate-600 hover:text-red-400 bg-transparent hover:bg-red-900/20 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 bg-slate-900/50 border-t border-slate-800 text-xs text-slate-500 font-mono flex justify-between">
                    <span>CNT: {devices.length}</span>
                    {!isLocked && <span>Unsaved changes pending</span>}
                </div>
            </div>
        </div>
    );
}
