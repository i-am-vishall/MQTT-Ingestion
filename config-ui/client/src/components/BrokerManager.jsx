import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, Edit, Save, Video, Car, ScanFace, Database, Lock, Unlock, X } from 'lucide-react';

const API_BASE = '/api';

const SOURCE_TYPES = [
    { id: 'VMS', label: 'VMS Server', icon: Video, color: 'text-blue-400' },
    { id: 'ANPR', label: 'ANPR Camera', icon: Car, color: 'text-yellow-400' },
    { id: 'FRS', label: 'Face Recognition', icon: ScanFace, color: 'text-purple-400' },
    { id: 'TRAFFIC', label: 'Traffic Sensor', icon: Database, color: 'text-green-400' },
    { id: 'OTHER', label: 'Other MQTT', icon: Database, color: 'text-slate-400' },
];

export default function BrokerManager() {
    const { isLocked } = useOutletContext();
    const [brokers, setBrokers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentBroker, setCurrentBroker] = useState({ id: null, name: '', type: 'VMS', url: 'mqtt://' });

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const res = await axios.get(`${API_BASE}/config`);
            if (res.data.brokers && res.data.brokers.length > 0) {
                setBrokers(res.data.brokers);
            } else {
                const rawUrls = (res.data.env.MQTT_BROKER_URL || '').split(',');
                const migrated = rawUrls.map((url, idx) => ({
                    id: Date.now() + idx,
                    name: `Detected Broker ${idx + 1}`,
                    type: 'OTHER',
                    url: url.trim()
                })).filter(b => b.url.length > 5);
                setBrokers(migrated);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const saveChanges = async (newBrokers) => {
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/config`, {
                brokers: newBrokers,
                db: null
            });
            setBrokers(newBrokers);
            setShowModal(false);
            alert(res.data.message || 'Configuration Saved!');
        } catch (e) {
            alert('Save failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setCurrentBroker({ id: Date.now(), name: '', type: 'VMS', url: 'mqtt://' });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        if (confirm('Are you sure you want to remove this source?')) {
            const updated = brokers.filter(b => b.id !== id);
            saveChanges(updated);
        }
    };

    const handleSaveForm = () => {
        if (!currentBroker.url.startsWith('mqtt')) {
            alert('URL must start with mqtt:// or mqtts://');
            return;
        }
        const updated = [...brokers];
        const idx = updated.findIndex(b => b.id === currentBroker.id);
        if (idx >= 0) updated[idx] = currentBroker;
        else updated.push(currentBroker);

        saveChanges(updated);
    };

    const getTypeIcon = (typeId) => {
        const t = SOURCE_TYPES.find(x => x.id === typeId) || SOURCE_TYPES[4];
        const Icon = t.icon;
        return <Icon className={t.color} size={20} />;
    };

    return (
        <div className="h-full overflow-y-auto p-6 animate-fade-in w-full">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <div className="flex items-center space-x-3 mb-1">
                            <h2 className="text-2xl font-bold">Data Sources</h2>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider flex items-center gap-1 ${isLocked ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-green-900/30 text-green-400 border border-green-700'}`}>
                                {isLocked ? <><Lock size={12} /> Read Only</> : <><Unlock size={12} /> Editing Enabled</>}
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm">Map your VMS, ANPR, and Sensor inputs here.</p>
                    </div>

                    {!isLocked && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center space-x-2 bg-primary hover:bg-blue-600 px-4 py-2 rounded-lg font-semibold transition"
                        >
                            <Plus size={18} />
                            <span>Add New Source</span>
                        </button>
                    )}
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {brokers.map(broker => (
                        <div key={broker.id} className={`bg-surface rounded-xl border p-5 shadow-lg relative overflow-hidden group transition-all ${isLocked ? 'border-slate-800 opacity-90' : 'border-slate-700 hover:border-primary'}`}>
                            {isLocked && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><Lock size={14} className="text-slate-600" /></div>}

                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-slate-900 rounded-lg shadow-inner">
                                        {getTypeIcon(broker.type)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">{broker.name}</h4>
                                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">{broker.type}</span>
                                    </div>
                                </div>

                                {!isLocked && (
                                    <div className="flex space-x-2">
                                        <button onClick={() => { setCurrentBroker(broker); setShowModal(true); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-300">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(broker.id)} className="p-1.5 hover:bg-red-900/50 rounded text-red-400">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded font-mono text-sm text-slate-300 break-all border border-slate-800/50 flex items-center gap-2">
                                <span className="text-slate-600 select-none">URL:</span>
                                {broker.url}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {brokers.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                        <p className="text-slate-500 text-lg">No sources configured.</p>
                        {!isLocked && <button onClick={handleAdd} className="text-primary mt-2 hover:underline font-bold">Add your first source</button>}
                    </div>
                )}

                {/* Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm p-4">
                        <div className="bg-surface border border-slate-600 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
                            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20} /></button>

                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                {currentBroker.id ? <Edit size={20} className="text-primary" /> : <Plus size={20} className="text-primary" />}
                                {currentBroker.id ? 'Edit Source' : 'New Source'}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Friendly Name</label>
                                    <input
                                        type="text"
                                        value={currentBroker.name}
                                        onChange={e => setCurrentBroker({ ...currentBroker, name: e.target.value })}
                                        placeholder="e.g. HQ Building ANPR"
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-primary outline-none"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Source Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {SOURCE_TYPES.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setCurrentBroker({ ...currentBroker, type: t.id })}
                                                className={`flex items-center space-x-2 p-2 rounded border text-sm transition-all ${currentBroker.type === t.id
                                                    ? 'bg-primary/20 border-primary text-primary'
                                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                                                    }`}
                                            >
                                                <t.icon size={16} />
                                                <span>{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Connection URL (MQTT)</label>
                                    <input
                                        type="text"
                                        value={currentBroker.url}
                                        onChange={e => setCurrentBroker({ ...currentBroker, url: e.target.value })}
                                        placeholder="mqtt://192.168.1.50:1883"
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm focus:border-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-3 mt-8 pt-4 border-t border-slate-700">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2 rounded text-slate-400 hover:bg-slate-800 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveForm}
                                    disabled={loading}
                                    className="flex-1 bg-primary hover:bg-blue-600 text-white font-bold py-2 rounded flex justify-center items-center space-x-2 shadow-lg"
                                >
                                    <Save size={18} />
                                    <span>{loading ? 'Saving...' : 'Save Source'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
