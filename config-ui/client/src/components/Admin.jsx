import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { Save, RefreshCw, Server, AlertTriangle, Lock, Gavel } from 'lucide-react';

const API_BASE = '/api';

export default function Admin() {
    const { isLocked } = useOutletContext();
    const [loading, setLoading] = useState(false);

    // Config State
    const [config, setConfig] = useState({
        UI_PORT: '',
        PG_PORT: '',
        INFLUX_PORT: '',
        INGESTION_MQTT_PORT: ''
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await axios.get(`${API_BASE}/admin/config`);
            setConfig(res.data);
        } catch (e) {
            console.error("Failed to load config", e);
        }
    };

    const handleSave = async () => {
        if (!window.confirm("Saving will restart the services. Continue?")) return;

        try {
            setLoading(true);
            await axios.post(`${API_BASE}/admin/config`, config);

            // Trigger Restart
            await axios.post(`${API_BASE}/admin/restart`, {});

            alert("Configuration Saved. Services are restarting... The UI will be unavailable for a few seconds.");
            setTimeout(() => window.location.reload(), 10000);

        } catch (e) {
            alert(`Error: ${e.response?.data?.error || e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const ConfigField = ({ label, value, field, type = "text" }) => (
        <div className="space-y-2">
            <label className="text-slate-400 text-sm">{label}</label>
            {isLocked ? (
                <div className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-400 p-3 rounded font-mono select-none flex justify-between items-center group">
                    <span>{value || '---'}</span>
                    <Lock size={12} className="opacity-0 group-hover:opacity-50" />
                </div>
            ) : (
                <input
                    type={type}
                    className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    value={value}
                    onChange={e => setConfig({ ...config, [field]: e.target.value })}
                />
            )}
        </div>
    );

    return (
        <div className="h-full overflow-y-auto p-6 animate-fade-in bg-slate-900 text-white w-full">
            <div className="max-w-7xl mx-auto space-y-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Gavel className="text-primary" /> System Configuration
                </h2>

                <div className="bg-surface p-8 rounded-xl border border-slate-700 shadow-xl relative overflow-hidden">
                    {isLocked && (
                        <div className="absolute top-0 right-0 p-4">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest border border-slate-700 px-2 py-1 rounded bg-slate-800/50">
                                Read Only
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="p-3 bg-slate-800 rounded-lg">
                                <Server className="text-primary" size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Service Ports</h3>
                                <p className="text-slate-400 text-sm">Manage internal port bindings</p>
                            </div>
                        </div>
                        {!isLocked && (
                            <div className="px-3 py-1 bg-yellow-900/30 border border-yellow-700/50 rounded flex items-center space-x-2 text-yellow-500 text-sm">
                                <AlertTriangle size={16} />
                                <span>Restart required</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <ConfigField label="PostgreSQL Port (DB)" value={config.PG_PORT} field="PG_PORT" type="number" />
                        <ConfigField label="InfluxDB HTTP Port" value={config.INFLUX_PORT} field="INFLUX_PORT" type="number" />
                        <ConfigField label="Config UI Port (Frontend)" value={config.UI_PORT} field="UI_PORT" type="number" />
                        <ConfigField label="Ingestion MQTT Port" value={config.INGESTION_MQTT_PORT} field="INGESTION_MQTT_PORT" type="number" />
                    </div>

                    {!isLocked && (
                        <div className="mt-10 flex justify-end pt-6 border-t border-slate-700/50">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex items-center space-x-2 bg-success hover:bg-green-400 text-black px-8 py-3 rounded-lg transition-all font-bold shadow-lg hover:shadow-green-900/20 disabled:opacity-50 active:scale-95"
                            >
                                {loading ? <RefreshCw className="animate-spin" /> : <Save />}
                                <span>{loading ? 'Applying Changes...' : 'Save Configuration & Restart'}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="text-center text-slate-500 text-sm mt-6">
                    {isLocked ? 'Unlock the Admin Panel to edit these settings.' : 'Saving will trigger a full service restart.'}
                </div>
            </div>
        </div>
    );
}
