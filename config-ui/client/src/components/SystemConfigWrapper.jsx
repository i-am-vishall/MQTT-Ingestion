import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import {
    Settings, Save, RotateCw, CheckCircle, AlertTriangle, Info,
    Plus, Trash2, Link, Server, Hash, Database, Zap, Bug,
    Network, Shield, ChevronDown, ChevronUp, Lock, RefreshCw,
    Edit2, Car, ScanFace, Video
} from 'lucide-react';

const API = '/api/env/tuning';

// ─── Config Metadata ─────────────────────────────────────────────────────────
const KEY_META = {
    // Pipeline
    BATCH_SIZE: { tab: 'pipeline', label: 'Batch Size', desc: 'Events pulled from Redis per DB write cycle. Higher = fewer writes, more RAM per batch.', min: 100, max: 10000, step: 100, type: 'range', unit: 'events', warning: v => v > 7000 ? 'Very large batches may strain memory' : null },
    MAX_CONCURRENT_WRITERS: { tab: 'pipeline', label: 'Concurrent DB Writers', desc: 'Parallel workers writing to PostgreSQL simultaneously. Bounded by DB_POOL_MAX=20 in pool config — do not exceed 20 or writers will queue for connections.', min: 1, max: 20, step: 1, type: 'range', unit: 'workers', warning: v => v > 16 ? 'Near pool limit (max=20). Monitor connection wait times.' : null },
    BATCH_TIMEOUT: { tab: 'pipeline', label: 'Batch Timeout', desc: 'Max wait (ms) before forcing a partial batch to DB.', min: 100, max: 5000, step: 100, type: 'range', unit: 'ms' },
    MIN_NODE_WORKERS: { tab: 'pipeline', label: 'Min Node Workers', desc: 'Minimum Node.js ingestion processes to keep alive.', min: 1, max: 8, step: 1, type: 'range', unit: 'workers' },
    MAX_NODE_WORKERS: { tab: 'pipeline', label: 'Max Node Workers', desc: 'Maximum processes spawned during backlog surges.', min: 4, max: 24, step: 1, type: 'range', unit: 'workers' },
    REDIS_STREAM_MAXLEN: { tab: 'pipeline', label: 'Redis Retention Count', desc: 'Max events retained in Redis stream before dropping oldest.', type: 'number' },
    SHOCK_ABSORBER_MODE: { tab: 'pipeline', label: 'Shock Absorber Mode', desc: 'If enabled, buffers events via Redis Stream. If disabled, writes directly to DB.', type: 'toggle' },

    // Database
    DB_HOST: { tab: 'database', label: 'Host', desc: 'IP address of PostgreSQL server.', type: 'text' },
    DB_PORT: { tab: 'database', label: 'Port', desc: 'Port for PostgreSQL (default 5441).', type: 'number' },
    DB_NAME: { tab: 'database', label: 'Database Name', desc: 'Name of the target database.', type: 'text' },
    DB_USER: { tab: 'database', label: 'Username', desc: 'Database connection username.', type: 'text' },
    DB_PASSWORD: { tab: 'database', label: 'Password', desc: 'Database connection password.', type: 'password' },
    DB_RETENTION_DAYS: { tab: 'database', label: 'Data Retention', desc: 'Days of mqtt_events to keep. Older monthly partitions are dropped automatically.', min: 30, max: 730, step: 30, type: 'range', unit: 'days', warning: v => v < 30 ? 'Very short — data may be lost' : v > 365 ? 'Over 1 year — watch disk usage' : null },

    // MQTT
    MQTT_PORT: { tab: 'mqtt', label: 'Inner MQTT Port', desc: 'Aedes local MQTT port for fallback ingestion.', type: 'number' },
    // MQTT_BROKER_URL and MQTT_BROKER_ID handled by MqttWidget
    MQTT_TOPICS: { tab: 'mqtt', label: 'Subscribed Topics', desc: 'Topics ingested from all connected brokers. Use # for wildcard.', type: 'text' },

    // System
    PORT: { tab: 'system', label: 'Config UI Port', desc: 'Port this Config Dashboard runs on.', type: 'number' },
    HEALTH_PORT: { tab: 'system', label: 'Health API Port', desc: 'Worker metrics & health endpoint port.', type: 'number' },
    ADMIN_USER: { tab: 'system', label: 'Admin Username', desc: 'Login username for this portal.', type: 'text' },
    ADMIN_PASS: { tab: 'system', label: 'Admin Password', desc: 'Login password for this portal.', type: 'password' },
    LOG_LEVEL: { tab: 'system', label: 'Log Level', desc: 'Global logging verbosity.', type: 'select', options: ['error', 'warn', 'info', 'debug'] },
    DEBUG_MODE: { tab: 'system', label: 'Global Debug', desc: 'Enables system-wide tracing.', type: 'toggle' },
    DEBUG_MODE_INGESTION: { tab: 'system', label: 'Ingestion Debug', desc: 'Verbose logs from data workers.', type: 'toggle' },
    DEBUG_MODE_CONFIG: { tab: 'system', label: 'Config UI Debug', desc: 'Trace logs for this portal.', type: 'toggle' },
};

const TABS = [
    { id: 'pipeline', label: 'Pipeline', icon: Zap, color: 'violet' },
    { id: 'database', label: 'Database', icon: Database, color: 'blue' },
    { id: 'mqtt', label: 'MQTT Brokers', icon: Network, color: 'cyan' },
    { id: 'system', label: 'System & Auth', icon: Shield, color: 'emerald' },
];

const SOURCE_TYPES = [
    { id: 'VMS', label: 'VMS Server', icon: Video, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'ANPR', label: 'ANPR Camera', icon: Car, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { id: 'FRS', label: 'Face Recognition', icon: ScanFace, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'TRAFFIC', label: 'Traffic Sensor', icon: Database, color: 'text-green-400', bg: 'bg-green-500/10' },
    { id: 'OTHER', label: 'Other MQTT', icon: Database, color: 'text-slate-400', bg: 'bg-slate-500/10' },
];

function Tooltip({ text }) {
    return (
        <div className="group relative inline-flex items-center ml-1.5 cursor-help shrink-0">
            <Info size={12} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            <div className="absolute left-0 bottom-full mb-2 w-60 p-2.5 bg-slate-900 text-xs text-slate-300 rounded-lg shadow-xl border border-slate-700 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 leading-relaxed">
                {text}
            </div>
        </div>
    );
}

function RangeField({ name, meta, value, onChange, disabled }) {
    const numeric = parseInt(value) || meta.min || 0;
    const warn = meta.warning?.(numeric);
    const pct = Math.min(100, Math.max(0, ((numeric - meta.min) / (meta.max - meta.min)) * 100));
    return (
        <div className="space-y-3">
            {/* Row 1: Label + value badge */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200 flex items-center">
                    {meta.label}
                    <Tooltip text={meta.desc} />
                </span>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                    {meta.unit && <span className="text-[11px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{meta.unit}</span>}
                    <input
                        type="number" min={meta.min} max={meta.max} step={meta.step}
                        value={numeric} disabled={disabled}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange(name, v); }}
                        className="w-20 bg-slate-950 border border-slate-600 text-white text-right text-sm font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                    />
                </div>
            </div>
            {/* Row 2: Slider track */}
            <div className="relative h-2 rounded-full overflow-hidden bg-slate-700/60">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                <input
                    type="range" min={meta.min} max={meta.max} step={meta.step}
                    value={numeric} disabled={disabled}
                    onChange={e => onChange(name, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
            </div>
            {/* Row 3: Min/max labels */}
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                <span>{meta.min.toLocaleString()}</span>
                <span>{meta.max.toLocaleString()}</span>
            </div>
            {warn && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-md">
                    <AlertTriangle size={11} className="shrink-0" />{warn}
                </p>
            )}
        </div>
    );
}

function TextField({ name, meta, value, onChange, disabled }) {
    return (
        <div>
            <label className="flex items-center text-sm font-semibold text-slate-200 mb-2">
                {meta.label}<Tooltip text={meta.desc} />
            </label>
            <input
                type={meta.type === 'password' ? 'password' : meta.type === 'number' ? 'number' : 'text'}
                value={value || ''} disabled={disabled}
                onChange={e => onChange(name, e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 disabled:opacity-40 font-mono placeholder-slate-600"
                placeholder={meta.type === 'number' ? String(meta.min || '') : `Enter ${meta.label}`}
            />
        </div>
    );
}

function SelectField({ name, meta, value, onChange, disabled }) {
    return (
        <div>
            <label className="flex items-center text-sm font-semibold text-slate-200 mb-2">
                {meta.label}<Tooltip text={meta.desc} />
            </label>
            <select
                value={value || meta.options[0]} disabled={disabled}
                onChange={e => onChange(name, e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
            >
                {meta.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );
}

function ToggleField({ name, meta, value, onChange, disabled }) {
    const on = value === 'true' || value === true;
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-slate-200 flex items-center leading-snug">
                {meta.label}<Tooltip text={meta.desc} />
            </span>
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(name, on ? 'false' : 'true')}
                className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    on ? 'bg-indigo-500' : 'bg-slate-600'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
                <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-md transition-transform duration-200 ${
                    on ? 'translate-x-6' : 'translate-x-0'
                }`} />
            </button>
        </div>
    );
}

function MqttWidget({ brokers, setBrokers, disabled }) {
    const [showModal, setShowModal] = useState(false);
    const [current, setCurrent] = useState(null);

    const handleAdd = () => {
        setCurrent({ id: Date.now(), name: '', type: 'VMS', url: 'mqtt://' });
        setShowModal(true);
    };

    const handleEdit = (b) => {
        setCurrent({ ...b });
        setShowModal(true);
    };

    const handleRemove = (id) => {
        if (confirm('Remove this data source?')) {
            setBrokers(prev => prev.filter(x => x.id !== id));
        }
    };

    const handleSave = () => {
        if (!current.url.startsWith('mqtt')) {
            alert('URL must start with mqtt:// or mqtts://');
            return;
        }
        setBrokers(prev => {
            const idx = prev.findIndex(x => x.id === current.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = current;
                return next;
            }
            return [...prev, current];
        });
        setShowModal(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Server size={14} className="text-cyan-400" />
                    Connected Data Sources
                    <span className="px-2.5 py-0.5 text-[11px] font-bold bg-slate-800 border border-slate-700 rounded-full text-slate-400">
                        {brokers.length}
                    </span>
                </span>
                {!disabled && (
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/15 hover:bg-cyan-600/25 text-cyan-400 border border-cyan-600/30 rounded-lg text-xs font-semibold transition-colors"
                    >
                        <Plus size={13} /> Add Source
                    </button>
                )}
            </div>

            {brokers.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500 border border-dashed border-slate-700/60 bg-slate-900/30 rounded-xl">
                    No data sources configured. Click <span className="text-cyan-400">Add Source</span> to begin.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {brokers.map((b) => {
                        const type = SOURCE_TYPES.find(t => t.id === b.type) || SOURCE_TYPES[4];
                        const Icon = type.icon;
                        return (
                            <div
                                key={b.id}
                                className="group relative bg-slate-900/80 border border-slate-700/60 hover:border-cyan-500/40 rounded-xl p-4 transition-all"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${type.bg}`}>
                                            <Icon size={18} className={type.color} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-200">{b.name || 'Untitled Source'}</h4>
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{type.label}</span>
                                        </div>
                                    </div>
                                    {!disabled && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(b)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
                                                <Edit2 size={13} />
                                            </button>
                                            <button onClick={() => handleRemove(b.id)} className="p-1.5 hover:bg-red-900/20 rounded text-slate-400 hover:text-red-400 transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-950/50 border border-slate-800/50 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-400 truncate">
                                    {b.url}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {current?.id ? 'Edit Data Source' : 'New Data Source'}
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Friendly Name</label>
                                <input
                                    type="text"
                                    value={current.name}
                                    onChange={e => setCurrent({ ...current, name: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 outline-none transition-colors"
                                    placeholder="e.g. HQ Building ANPR"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Source Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {SOURCE_TYPES.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setCurrent({ ...current, type: t.id })}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                                                current.type === t.id
                                                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                                            }`}
                                        >
                                            <t.icon size={14} />
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Endpoint URL</label>
                                <input
                                    type="text"
                                    value={current.url}
                                    onChange={e => setCurrent({ ...current, url: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:border-cyan-500 outline-none transition-colors"
                                    placeholder="mqtt://127.0.0.1:1883"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-900/20 transition-all"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SystemConfigWrapper({ initialTab = 'pipeline' }) {
    const outletContext = useOutletContext();
    const isLocked = outletContext?.isLocked ?? false;

    const [activeTab, setActiveTab] = useState(initialTab);
    const [values, setValues] = useState({});
    const [original, setOriginal] = useState({});
    const [brokers, setBrokers] = useState([]);
    const [originalBrokers, setOriginalBrokers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(API);
            setValues(res.data.tuning || {});
            setOriginal(res.data.tuning || {});
            setBrokers(res.data.brokers || []);
            setOriginalBrokers(res.data.brokers || []);
        } catch (e) {
            setToast({ type: 'error', msg: 'Failed to load config: ' + e.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        if (toast) { const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }
    }, [toast]);

    const handleChange = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

    const isDirty = 
        Object.keys(values).some(k => String(values[k]) !== String(original[k])) ||
        JSON.stringify(brokers) !== JSON.stringify(originalBrokers);

    const changedCount = 
        Object.keys(values).filter(k => String(values[k]) !== String(original[k])).length +
        (JSON.stringify(brokers) !== JSON.stringify(originalBrokers) ? 1 : 0);

    const handleSave = async (restart = false) => {
        const changed = {};
        Object.keys(values).forEach(k => { if (String(values[k]) !== String(original[k])) changed[k] = values[k]; });
        
        const brokersChanged = JSON.stringify(brokers) !== JSON.stringify(originalBrokers);
        
        if (Object.keys(changed).length === 0 && !brokersChanged) { 
            setToast({ type: 'error', msg: 'No changes to save.' }); 
            return; 
        }

        setSaving(true);
        try {
            const payload = {
                updates: changed,
                brokers: brokersChanged ? brokers : null,
                restart
            };
            const res = await axios.patch(API, payload);
            setOriginal({ ...values });
            setToast({ type: 'success', msg: res.data.message || 'Saved!' });
        } catch (e) {
            setToast({ type: 'error', msg: e.response?.data?.error || e.message });
        } finally {
            setSaving(false);
        }
    };

    const renderField = (key) => {
        const meta = KEY_META[key];
        if (!meta || values[key] === undefined) return null;
        const props = { name: key, meta, value: values[key], onChange: handleChange, disabled: isLocked };
        if (meta.type === 'range') return <RangeField key={key} {...props} />;
        if (meta.type === 'text' || meta.type === 'number' || meta.type === 'password') return <TextField key={key} {...props} />;
        if (meta.type === 'select') return <SelectField key={key} {...props} />;
        if (meta.type === 'toggle') return <ToggleField key={key} {...props} />;
        return null;
    };

    const tabKeys = (tabId) => Object.keys(KEY_META).filter(k => KEY_META[k].tab === tabId && values[k] !== undefined);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-sm">Loading configuration...</span>
            </div>
        );
    }

    const activeTabMeta = TABS.find(t => t.id === activeTab);

    return (
        <div className="flex flex-col gap-4 min-h-0 flex-1">
            {/* ── Header ── */}
            <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-xl px-5 py-4 shrink-0">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-400" />
                        System Configuration
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                        {isLocked
                            ? 'Read-only mode. Unlock editing in the top bar to make changes.'
                            : 'Changes are saved to .env and applied to all running services.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchConfig} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors" title="Reload from server">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Toast ── */}
            {toast && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border shrink-0 ${toast.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                    {toast.msg}
                </div>
            )}

            {/* ── Tab Bar ── */}
            <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1 shrink-0">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const keys = tabKeys(tab.id);
                    const dirtyCount = keys.filter(k => String(values[k]) !== String(original[k])).length;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${activeTab === tab.id ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            {dirtyCount > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" title={`${dirtyCount} unsaved changes`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 min-h-0 overflow-auto pt-2">
                <div className="w-full max-w-5xl mx-auto space-y-4 pb-12">
                    {activeTab === 'mqtt' ? (
                        /* MQTT tab */
                        <div className="space-y-4">
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
                                <MqttWidget brokers={brokers} setBrokers={setBrokers} disabled={isLocked} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                                    <label className="flex items-center text-sm font-medium text-slate-300 mb-2 gap-1.5">
                                        <Hash size={14} className="text-violet-400" /> Subscribed Topics
                                        <Tooltip text="Topics ingested from ALL connected brokers. Use # for wildcard." />
                                    </label>
                                    <input
                                        type="text"
                                        value={values.MQTT_TOPICS || ''}
                                        disabled={isLocked}
                                        onChange={e => handleChange('MQTT_TOPICS', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 disabled:opacity-50 font-mono"
                                        placeholder="e.g. alerts/#, anpr/data"
                                    />
                                    {values.MQTT_TOPICS && <p className="text-xs text-slate-500 mt-2">Applied to all {((values.MQTT_BROKER_URL || '').split(',').filter(Boolean).length)} connected brokers</p>}
                                </div>
                                {tabKeys('mqtt').filter(k => k !== 'MQTT_TOPICS').map(key => (
                                    <div key={key} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 flex flex-col justify-center">
                                        {renderField(key)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : activeTab === 'pipeline' ? (
                        /* Pipeline */
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                {tabKeys('pipeline').map(key => (
                                    <div key={key} className={`relative p-1 rounded-lg ${String(values[key]) !== String(original[key]) ? 'after:absolute after:-left-3 after:top-1/2 after:-translate-y-1/2 after:w-1 after:h-full after:max-h-8 after:bg-amber-500 after:rounded-full' : ''}`}>
                                        {renderField(key)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : activeTab === 'database' ? (
                        /* Database: split into Connection & Storage */
                        <div className="space-y-4">
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                                    <Server size={16} className="text-blue-400" /> PostgreSQL Connection
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                                    {['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].map(key => (
                                        values[key] !== undefined && (
                                            <div key={key} className={`relative p-1 rounded-lg ${String(values[key]) !== String(original[key]) ? 'after:absolute after:-left-3 after:top-1/2 after:-translate-y-1/2 after:w-1 after:h-full after:max-h-8 after:bg-amber-500 after:rounded-full' : ''}`}>
                                                {renderField(key)}
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                            {values.DB_RETENTION_DAYS !== undefined && (
                                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
                                    <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                                        <Database size={16} className="text-blue-400" /> Storage Rules
                                    </h3>
                                    <div className={`relative p-1 rounded-lg ${String(values.DB_RETENTION_DAYS) !== String(original.DB_RETENTION_DAYS) ? 'after:absolute after:-left-3 after:top-1/2 after:-translate-y-1/2 after:w-1 after:h-full after:max-h-8 after:bg-amber-500 after:rounded-full' : ''}`}>
                                       {renderField('DB_RETENTION_DAYS')}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* System: text/select fields then separate debug toggles section */
                        <div className="space-y-4">
                            {/* Ports & Auth */}
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                                    <Shield size={16} className="text-emerald-400" /> Ports & Authentication
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                                    {['PORT', 'HEALTH_PORT', 'ADMIN_USER', 'ADMIN_PASS', 'LOG_LEVEL'].map(key =>
                                        values[key] !== undefined && (
                                            <div key={key} className={`relative ${String(values[key]) !== String(original[key]) ? 'pl-3 border-l-2 border-amber-500' : ''}`}>
                                                {renderField(key)}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                            {/* Debug toggles */}
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                                    <Bug size={16} className="text-amber-400" /> Debug Controls
                                </h3>
                                <div className="divide-y divide-slate-700/50">
                                    {['DEBUG_MODE', 'DEBUG_MODE_INGESTION', 'DEBUG_MODE_CONFIG'].map(key =>
                                        values[key] !== undefined && (
                                            <div key={key} className={`py-3 first:pt-0 last:pb-0 ${String(values[key]) !== String(original[key]) ? 'pl-3 border-l-2 border-amber-500' : ''}`}>
                                                {renderField(key)}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Action Bar (sticky at bottom) ── */}
            <div className="shrink-0 bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
                {isLocked ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Lock className="w-4 h-4" />
                        Unlock editing in the top bar to save changes.
                    </div>
                ) : (
                    <>
                        {isDirty ? (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {changedCount} unsaved change{changedCount !== 1 ? 's' : ''}
                            </div>
                        ) : (
                            <span className="text-xs text-slate-500">No pending changes</span>
                        )}

                        <div className="ml-auto flex items-center gap-2 flex-wrap">
                            {isDirty && (
                                <button
                                    onClick={() => setValues({ ...original })}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-600 transition-colors"
                                >
                                    Revert
                                </button>
                            )}
                            <button
                                onClick={() => handleSave(false)}
                                disabled={saving || !isDirty}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
                            >
                                <Save size={15} />
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={() => handleSave(true)}
                                disabled={saving || !isDirty}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
                            >
                                <RotateCw size={15} className={saving ? 'animate-spin' : ''} />
                                Save & Restart Engine
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
