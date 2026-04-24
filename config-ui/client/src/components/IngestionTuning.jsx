import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { Settings, Save, RotateCw, CheckCircle, AlertTriangle, Info, Plus, Trash2, Link, Server, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = '/api/env/tuning';

// Meta-info for each key — what it does, limits, type
const KEY_META = {
    // Pipeline Tuning
    BATCH_SIZE: { group: 'Pipeline Tuning', label: 'Batch Size', desc: 'Events pulled from Redis per DB write. Higher = fewer DB writes but uses more RAM per batch. Setting this between 5000-8000 allows for extremely fast ingestion of backlogged data.', min: 100, max: 10000, step: 100, type: 'range', unit: 'events', warning: (v) => v > 7000 ? 'Very large batches may cause limit memory' : null },
    MAX_CONCURRENT_WRITERS: { group: 'Pipeline Tuning', label: 'Concurrent DB Writers', desc: 'Max workers writing to PostgreSQL simultaneously. Maxing this out drastically drops queue time.', min: 1, max: 8, step: 1, type: 'range', unit: 'workers', warning: (v) => v > 5 ? 'High connections active' : null },
    BATCH_TIMEOUT: { group: 'Pipeline Tuning', label: 'Batch Timeout', desc: 'Max ms to wait before forcing a partial batch to DB.', min: 100, max: 5000, step: 100, type: 'range', unit: 'ms' },
    MIN_NODE_WORKERS: { group: 'Pipeline Tuning', label: 'Min Node Workers', desc: 'Auto-scaler: Minimum Node.js ingestion processes to keep alive.', min: 1, max: 8, step: 1, type: 'range', unit: 'workers' },
    MAX_NODE_WORKERS: { group: 'Pipeline Tuning', label: 'Max Node Workers', desc: 'Auto-scaler: Maximum processes spawned during major backlog surges.', min: 4, max: 24, step: 1, type: 'range', unit: 'workers' },
    REDIS_STREAM_MAXLEN: { group: 'Pipeline Tuning', label: 'Redis Retention Size', desc: 'Maximum processed historical events retained in Redis memory before the oldest are dropped. Increase for longer replay windows (default 3,000,000).', type: 'number' },
    
    // MQTT Config
    MQTT_PORT: { group: 'MQTT Configuration', label: 'MQTT Inner Port', desc: 'Aedes inner MQTT port for localized fallback.', type: 'number' },
    
    // Database Config
    DB_USER: { group: 'Database Connection', label: 'Postgres User', desc: 'Database connection username.', type: 'text' },
    DB_PASSWORD: { group: 'Database Connection', label: 'Postgres Password', desc: 'Database connection password.', type: 'text' },
    DB_HOST: { group: 'Database Connection', label: 'Database Host', desc: 'IP Address of PostgreSQL server.', type: 'text' },
    DB_NAME: { group: 'Database Connection', label: 'Database Name', desc: 'Name of the target database.', type: 'text' },
    DB_PORT: { group: 'Database Connection', label: 'Database Port', desc: 'Port for PostgreSQL (default 5441).', type: 'number' },
    DB_RETENTION_DAYS: { group: 'Database Connection', label: 'Data Retention (Days)', desc: 'How many days of mqtt_events data to keep. Monthly partitions older than this window are automatically dropped at startup and every 24 hours. Decrease to free disk space; increase to retain more history. Default: 90 days (3 months).', min: 30, max: 730, step: 30, type: 'range', unit: 'days', warning: (v) => v < 30 ? 'Very short — data may be lost before analysis' : v > 365 ? 'Over 1 year — monitor disk usage' : null },

    
    // System & Debugging
    PORT: { group: 'System & UI', label: 'UI Service Port', desc: 'Port this Config Dashboard runs on.', type: 'number' },
    HEALTH_PORT: { group: 'System & UI', label: 'Health API Port', desc: 'Backend worker metrics endpoint.', type: 'number' },
    ADMIN_USER: { group: 'System & UI', label: 'Admin Username', desc: 'Login username for this Config panel.', type: 'text' },
    ADMIN_PASS: { group: 'System & UI', label: 'Admin Password', desc: 'Login password for this Config panel.', type: 'text' },
    
    LOG_LEVEL: { group: 'System & UI', label: 'Log Level', desc: 'Global logging verbosity.', type: 'select', options: ['error', 'warn', 'info', 'debug'] },
    DEBUG_MODE: { group: 'System & UI', label: 'Global Debug Mode', desc: 'Enables tracing system-wide.', type: 'toggle' },
    DEBUG_MODE_INGESTION: { group: 'System & UI', label: 'Ingestion Debug', desc: 'Pumps verbose logs from data workers.', type: 'toggle' },
    DEBUG_MODE_CONFIG: { group: 'System & UI', label: 'Config UI Debug', desc: 'Trace outputs for this exact portal.', type: 'toggle' },
};

function LabelWithTooltip({ meta }) {
    return (
        <div className="group relative inline-block cursor-help z-10 w-full">
            <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5 w-full">
                {meta.label} 
                <Info size={14} className="text-slate-500 hover:text-cyan-400 transition-colors" />
            </span>
            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-800 text-xs text-slate-200 font-medium rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-slate-600 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-50 transform group-hover:-translate-y-1">
                {meta.desc}
            </div>
        </div>
    );
}

function RangeField({ name, meta, value, onChange, disabled }) {
    const numeric = parseInt(value) || meta.min;
    const warn = meta.warning?.(numeric);

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <LabelWithTooltip meta={meta} />
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        min={meta.min} 
                        max={meta.max} 
                        step={meta.step}
                        value={numeric}
                        disabled={disabled}
                        onChange={e => {
                            let val = parseInt(e.target.value);
                            if (!isNaN(val)) onChange(name, val);
                            else onChange(name, e.target.value);
                        }}
                        className={`w-20 bg-slate-800 border border-slate-600 text-white text-right font-bold text-md rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                </div>
            </div>
            <div className="relative pt-2">
                <input
                    type="range"
                    min={meta.min}
                    max={meta.max}
                    step={meta.step}
                    value={numeric}
                    disabled={disabled}
                    onChange={e => onChange(name, e.target.value)}
                    className={`w-full h-2 bg-slate-800 rounded-lg appearance-none accent-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed cursor-default' : 'cursor-pointer'}`}
                />
            </div>
            {warn && (
                <div className="flex items-start gap-2 text-[10px] text-amber-400">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    {warn}
                </div>
            )}
        </div>
    );
}

function TextField({ name, meta, value, onChange, disabled }) {
    return (
        <div className="space-y-2">
            <LabelWithTooltip meta={meta} />
            <input
                type={meta.type === 'number' ? 'number' : 'text'}
                value={value || ''}
                disabled={disabled}
                onChange={e => onChange(name, e.target.value)}
                className={`w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder={`Enter ${meta.label}...`}
            />
        </div>
    );
}

function SelectField({ name, meta, value, onChange, disabled }) {
    return (
        <div className="space-y-2">
            <LabelWithTooltip meta={meta} />
            <select
                value={value || meta.options[0]}
                disabled={disabled}
                onChange={e => onChange(name, e.target.value)}
                className={`w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {meta.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function ToggleField({ name, meta, value, onChange, disabled }) {
    const isOn = value === 'true' || value === true;
    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex-1 pr-4">
                <LabelWithTooltip meta={meta} />
            </div>
            <button
                disabled={disabled}
                onClick={() => onChange(name, isOn ? 'false' : 'true')}
                className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${isOn ? 'bg-primary' : 'bg-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isOn ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
        </div>
    );
}

function MqttTreeWidget({ values, onChange, disabled }) {
    const urls = (values.MQTT_BROKER_URL || '').split(',').map(s => s.trim()).filter(Boolean);
    const ids = (values.MQTT_BROKER_ID || '').split(',').map(s => s.trim());

    const brokers = urls.map((url, i) => ({
        url,
        id: ids[i] || `Broker${i+1}`
    }));

    const updateBroker = (index, field, val) => {
        const newBrokers = [...brokers];
        newBrokers[index][field] = val;
        onChange('MQTT_BROKER_URL', newBrokers.map(b => b.url).join(','));
        onChange('MQTT_BROKER_ID', newBrokers.map(b => b.id).join(','));
    };

    const addBroker = () => {
        const newBrokers = [...brokers, { url: 'tcp://127.0.0.1:1883', id: `Broker${brokers.length+1}` }];
        onChange('MQTT_BROKER_URL', newBrokers.map(b => b.url).join(','));
        onChange('MQTT_BROKER_ID', newBrokers.map(b => b.id).join(','));
    };

    const removeBroker = (index) => {
        const newBrokers = brokers.filter((_, i) => i !== index);
        onChange('MQTT_BROKER_URL', newBrokers.map(b => b.url).join(','));
        onChange('MQTT_BROKER_ID', newBrokers.map(b => b.id).join(','));
    };

    return (
        <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-6">
            <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-700/50">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Server size={16} className="text-cyan-400"/> Remote Broker Origins</h4>
                        <p className="text-xs text-slate-500 mt-1">Configure exactly which servers this master node connects to.</p>
                    </div>
                    <button onClick={addBroker} disabled={disabled} className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50">
                        <Plus size={14} /> Add Broker
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {brokers.map((b, i) => (
                        <div key={i} className="bg-slate-800/80 p-4 rounded-lg border border-slate-700/80 relative group">
                            <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => removeBroker(i)} disabled={disabled} className="text-slate-500 hover:text-red-400"><Trash2 size={14}/></button>
                            </div>
                            <div className="space-y-3 pr-6">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Broker Core Link (URL)</label>
                                    <div className="flex items-center gap-2">
                                        <Link size={14} className="text-slate-500"/>
                                        <input type="text" value={b.url} onChange={(e) => updateBroker(i, 'url', e.target.value)} disabled={disabled} className="w-full bg-transparent text-sm text-slate-200 outline-none border-b border-transparent focus:border-cyan-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Identification Tag</label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        <input type="text" value={b.id} onChange={(e) => updateBroker(i, 'id', e.target.value)} disabled={disabled} className="w-full bg-transparent text-sm font-mono text-slate-300 outline-none border-b border-transparent focus:border-cyan-500" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-700/50">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-1"><Hash size={16} className="text-violet-400"/> Subscribed Streams (Shared Globally)</h4>
                <p className="text-[11px] text-slate-500 mb-4">These topics are dynamically ingested from EVERY connected broker array. (Use # to ingest perfectly mapping data seamlessly).</p>
                <input 
                    type="text" 
                    value={values.MQTT_TOPICS} 
                    onChange={e => onChange('MQTT_TOPICS', e.target.value)} 
                    disabled={disabled}
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="e.g. alerts/#, anpr/data"
                />
            </div>
        </div>
    );
}

export default function IngestionTuning() {
    const outletContext = useOutletContext();
    const isLocked = outletContext?.isLocked || false;
    const [values, setValues] = useState({});
    const [original, setOriginal] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const fetchTuning = useCallback(async () => {
        try {
            const res = await axios.get(API);
            setValues(res.data.tuning || {});
            setOriginal(res.data.tuning || {});
        } catch (e) {
            setToast({ type: 'error', msg: 'Failed to load config: ' + e.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTuning(); }, [fetchTuning]);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const handleChange = (key, val) => {
        setValues(prev => ({ ...prev, [key]: val }));
    };

    const isDirty = Object.keys(values).some(k => values[k] !== original[k]);

    const handleSave = async (restart = false) => {
        setSaving(true);
        try {
            const changed = {};
            Object.keys(values).forEach(k => {
                if (values[k] !== original[k]) changed[k] = values[k];
            });
            if (Object.keys(changed).length === 0) {
                setToast({ type: 'error', msg: 'No changes to save.' });
                setSaving(false);
                return;
            }
            const res = await axios.patch(API, { updates: changed, restart });
            setOriginal({ ...values });
            setToast({ type: 'success', msg: res.data.message });
        } catch (e) {
            setToast({ type: 'error', msg: e.response?.data?.error || e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setValues({ ...original });
    };

    if (loading) return null;

    // Grouping
    const groups = ['Pipeline Tuning', 'Database Connection', 'MQTT Configuration', 'System & UI'];

    return (
        <div className="glassmorphism rounded-2xl p-4 lg:p-8 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-extrabold flex items-center gap-3">
                    <span className="w-3 h-8 bg-gradient-to-b from-violet-400 to-purple-600 rounded-full shadow-[0_0_15px_rgba(167,139,250,0.5)]" />
                    <Settings size={22} className="text-violet-400" />
                    Complete Infrastructure Config
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
                    <Info size={12} />
                    Auto-Syncs to Deploy Folder & Workspace
                </div>
            </div>

            {/* Config Groups */}
            <div className="space-y-4 mb-6">
                {groups.map(groupName => {
                    const groupKeys = Object.keys(KEY_META).filter(k => KEY_META[k].group === groupName && values[k] !== undefined);
                    if (groupKeys.length === 0) return null;

                    return (
                        <div key={groupName} className="border border-slate-700/40 rounded-xl overflow-hidden">
                            <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 font-semibold text-slate-300 text-sm">
                                {groupName}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 bg-slate-900/30">
                                {groupName === 'MQTT Configuration' && (
                                    <MqttTreeWidget values={values} onChange={handleChange} disabled={isLocked} />
                                )}
                                {groupKeys.map(key => {
                                    const meta = KEY_META[key];
                                    return (
                                        <div key={key} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/40 hover:border-slate-600 transition-colors">
                                            {meta.type === 'range' && (
                                                <RangeField name={key} meta={meta} value={values[key]} onChange={handleChange} disabled={isLocked} />
                                            )}
                                            {(meta.type === 'text' || meta.type === 'number') && (
                                                <TextField name={key} meta={meta} value={values[key]} onChange={handleChange} disabled={isLocked} />
                                            )}
                                            {meta.type === 'select' && (
                                                <SelectField name={key} meta={meta} value={values[key]} onChange={handleChange} disabled={isLocked} />
                                            )}
                                            {meta.type === 'toggle' && (
                                                <ToggleField name={key} meta={meta} value={values[key]} onChange={handleChange} disabled={isLocked} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={() => handleSave(false)}
                    disabled={saving || !isDirty || isLocked}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>

                <button
                    onClick={() => handleSave(true)}
                    disabled={saving || !isDirty || isLocked}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <RotateCw size={16} className={saving ? 'animate-spin' : ''} />
                    Save & Restart Worker Engine
                </button>

                {isDirty && (
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold border border-slate-600 transition-all active:scale-95"
                    >
                        Revert All
                    </button>
                )}

                {isDirty && (
                    <span className="text-xs text-amber-400 flex items-center gap-1 font-bold ml-2">
                        <AlertTriangle size={12} /> Pending Changes Detected
                    </span>
                )}
            </div>

            {/* Toast notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={`absolute bottom-8 right-8 flex items-center gap-2 px-4 py-3 rounded-lg shadow-2xl z-50 overflow-hidden ${
                            toast.type === 'error' ? 'bg-red-500/10 border border-red-500/50 text-red-200' : 'bg-green-500/10 border border-green-500/50 text-green-200'
                        }`}
                    >
                        <div className={`absolute inset-0 opacity-10 ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                        {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                        <span className="text-sm font-medium relative z-10">{toast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
