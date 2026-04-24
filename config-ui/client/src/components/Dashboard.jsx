import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, Square, RotateCw, Activity, Server, Database, Layers } from 'lucide-react';

const API_BASE = '/api';

const SERVICE_LABELS = {
    'ingestion': 'MQTT Ingestion Service',
    'db': 'PostgreSQL Database',
    'telegraf': 'Telegraf Monitoring',
    'influxdb': 'InfluxDB 3.0',
    'redis': 'Redis Stream Buffer'
};

export default function Dashboard() {
    const [statuses, setStatuses] = useState({});
    const [ports, setPorts] = useState({});
    const [loadingAction, setLoadingAction] = useState(null);

    const fetchStatus = async () => {
        try {
            const res = await axios.get(`${API_BASE}/services`);
            if (res.data.services) {
                setStatuses(res.data.services);
                if (res.data.ports) setPorts(res.data.ports);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const controlService = async (serviceKey, action) => {
        setLoadingAction(serviceKey);
        try {
            await axios.post(`${API_BASE}/service/${action}`, { service: serviceKey });
            setTimeout(fetchStatus, 3000);
            setTimeout(fetchStatus, 6000);
            // Simulate 8s delay for UI feedback
            setTimeout(() => setLoadingAction(null), 8000);
        } catch (e) {
            alert('Command failed: ' + e.message);
            setLoadingAction(null);
        }
    };

    useEffect(() => {
        fetchStatus();
        const poller = setInterval(fetchStatus, 5000);
        return () => clearInterval(poller);
    }, []);

    const StatusRow = ({ id, label, status }) => (
        <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:bg-slate-900/80 transition-colors">
            <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-full ${status === 'RUNNING' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    <Activity size={20} />
                </div>
                <div>
                    <h4 className="font-semibold text-white">{label}</h4>
                    <div className="flex items-center space-x-2">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${status === 'RUNNING' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                            {status || 'UNKNOWN'}
                        </span>
                        {ports[id] && ports[id] !== 'N/A' && (
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                Port: {ports[id]}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex space-x-2">
                {status !== 'RUNNING' && (
                    <button
                        onClick={() => controlService(id, 'start')}
                        disabled={loadingAction === id}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded shadow disabled:opacity-50"
                        title="Start Service"
                    >
                        <Play size={16} fill="currentColor" />
                    </button>
                )}
                {status === 'RUNNING' && (
                    <button
                        onClick={() => controlService(id, 'stop')}
                        disabled={loadingAction === id}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded shadow disabled:opacity-50"
                        title="Stop Service"
                    >
                        <Square size={16} fill="currentColor" />
                    </button>
                )}
                <button
                    onClick={() => controlService(id, 'stop').then(() => controlService(id, 'start'))}
                    disabled={loadingAction === id}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow disabled:opacity-50"
                    title="Restart Service"
                >
                    <RotateCw size={16} className={loadingAction === id ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface rounded-xl border border-slate-700 p-8 shadow-lg md:col-span-2">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                        <span className="w-2 h-8 bg-primary rounded-full mr-3"></span>
                        Services Health & Control
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        <StatusRow id="ingestion" label={SERVICE_LABELS['ingestion']} status={statuses['ingestion']} />
                        <StatusRow id="db" label={SERVICE_LABELS['db']} status={statuses['db']} />
                        <StatusRow id="redis" label={SERVICE_LABELS['redis']} status={statuses['redis']} />
                        <StatusRow id="telegraf" label={SERVICE_LABELS['telegraf']} status={statuses['telegraf']} />
                        <StatusRow id="influxdb" label={SERVICE_LABELS['influxdb']} status={statuses['influxdb']} />
                    </div>
                </div>
            </div>
        </div>
    );
}
