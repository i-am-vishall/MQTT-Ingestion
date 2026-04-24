import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, Square, RotateCw, Activity, Cpu, AlertTriangle, Users, Layers, ArrowRight } from 'lucide-react';

const API_BASE = '/api';

const SERVICE_LABELS = {
    'ingestion': 'MQTT Ingestion Service',
    'db':        'PostgreSQL Database',
    'redis':     'Redis Stream Buffer',
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

    // Redis worker health
    const [redisHealth, setRedisHealth] = useState(null);

    const fetchRedisHealth = async () => {
        try {
            const res = await axios.get(`${API_BASE}/redis/health`);
            setRedisHealth(res.data);
        } catch { setRedisHealth(null); }
    };

    useEffect(() => {
        fetchRedisHealth();
        const p = setInterval(fetchRedisHealth, 5000);
        return () => clearInterval(p);
    }, []);

    const metricBox = (label, value, sub, color = 'text-white') => (
        <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700/50 flex flex-col gap-1">
            <div className={`text-2xl font-bold font-mono ${color}`}>{value ?? '—'}</div>
            <div className="text-xs font-semibold text-slate-300">{label}</div>
            {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
        </div>
    );

    const streamLen   = redisHealth?.streamLength  ?? null;
    const workerCount = redisHealth?.workerCount   ?? null;
    const lag         = redisHealth?.consumerLag   ?? null;
    const mode        = redisHealth?.mode          ?? null;
    const streamColor = streamLen > 500000 ? 'text-red-400' : streamLen > 100000 ? 'text-yellow-400' : 'text-green-400';
    const lagColor    = lag > 10000 ? 'text-red-400' : lag > 1000 ? 'text-yellow-400' : 'text-green-400';

    return (
        <div className="space-y-6 p-6">
            {/* Services Health */}
            <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-lg">
                <h3 className="text-lg font-bold mb-5 flex items-center">
                    <span className="w-1.5 h-7 bg-primary rounded-full mr-3"></span>
                    Services Health &amp; Control
                </h3>
                <div className="grid grid-cols-1 gap-3">
                    <StatusRow id="ingestion" label={SERVICE_LABELS['ingestion']} status={statuses['ingestion']} />
                    <StatusRow id="db"        label={SERVICE_LABELS['db']}        status={statuses['db']} />
                    <StatusRow id="redis"     label={SERVICE_LABELS['redis']}     status={statuses['redis']} />
                </div>
            </div>

            {/* Redis Workers Panel */}
            <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-lg">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold flex items-center">
                        <span className="w-1.5 h-7 bg-purple-500 rounded-full mr-3"></span>
                        Redis Ingestion Workers
                    </h3>
                    <div className="flex items-center gap-2">
                        {mode && (
                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                mode === 'SHOCK_ABSORBER'
                                    ? 'bg-purple-900/30 text-purple-300 border-purple-800/50'
                                    : 'bg-blue-900/30 text-blue-300 border-blue-800/50'
                            }`}>
                                {mode === 'SHOCK_ABSORBER' ? '⚡ Shock Absorber Mode' : '⟳ Direct DB Mode'}
                            </span>
                        )}
                        {!redisHealth && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                <AlertTriangle size={12} /> Redis not connected
                            </span>
                        )}
                    </div>
                </div>

                {redisHealth ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {metricBox('Stream Backlog', streamLen?.toLocaleString(), 'Events queued in Redis stream', streamColor)}
                        {metricBox('Active Workers', workerCount, 'Node.js writer processes', workerCount > 0 ? 'text-green-400' : 'text-red-400')}
                        {metricBox('Consumer Lag', lag?.toLocaleString(), 'Events behind real-time', lagColor)}
                        {metricBox('Throughput', redisHealth.eventsPerSec ? `${redisHealth.eventsPerSec}/s` : '—', 'Events processed per second', 'text-blue-300')}
                    </div>
                ) : (
                    <div className="text-center py-10 text-slate-600">
                        <Layers size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Redis health endpoint not reachable.<br />
                        <span className="text-xs">Start Redis and the ingestion service to see worker stats.</span></p>
                    </div>
                )}
            </div>
        </div>
    );
}
