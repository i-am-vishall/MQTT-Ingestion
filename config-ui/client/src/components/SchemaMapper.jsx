import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trash2, Save, Database, Code, ArrowRight, AlertTriangle, CheckCircle, Search, Lock, Unlock, Shield, X, AlertOctagon } from 'lucide-react';

// --- Sub-Component: Searchable Select ---
const SearchableSelect = ({ options, value, onChange, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('');

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="relative">
            <div
                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={!value ? "text-slate-500" : ""}>{value || placeholder}</span>
                <span className="text-xs text-slate-500">▼</span>
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded shadow-xl max-h-60 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-700">
                        <div className="flex items-center bg-slate-900 rounded px-2">
                            <Search size={14} className="text-slate-400" />
                            <input
                                type="text"
                                className="w-full bg-transparent p-1 text-xs text-white outline-none"
                                placeholder="Search..."
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <div
                            className="p-2 text-sm text-slate-400 hover:bg-slate-700 cursor-pointer italic"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                        >
                            (None)
                        </div>
                        {filteredOptions.map(opt => (
                            <div
                                key={opt}
                                className={`p-2 text-sm text-white hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 ${value === opt ? 'bg-primary/20' : ''}`}
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                            >
                                {opt}
                            </div>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="p-2 text-xs text-slate-500 text-center">No matches</div>
                        )}
                    </div>
                </div>
            )}
            {isOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            )}
        </div>
    );
};

// --- Sub-Component: Admin Unlock Modal ---
const AdminUnlockModal = ({ isOpen, onClose, onUnlock, error }) => {
    const [password, setPassword] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-red-500/50 rounded-lg p-6 w-96 shadow-2xl transform transition-all scale-100">
                <div className="flex items-center gap-3 mb-4 text-red-500 border-b border-white/10 pb-2">
                    <Shield size={24} />
                    <h3 className="text-xl font-bold">Admin Authorization</h3>
                </div>

                <p className="text-slate-300 text-sm mb-4">
                    This mapping is <strong className="text-white">LOCKED</strong>. <br />
                    Please enter the Admin Password to unlock it.
                </p>

                <input
                    type="password"
                    className="w-full bg-black/50 border border-slate-700 rounded p-3 text-white focus:border-red-500 outline-none mb-4"
                    placeholder="Enter Admin Password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onUnlock(password)}
                    autoFocus
                />

                {error && (
                    <div className="text-red-400 text-xs mb-4 flex items-center gap-2 bg-red-900/20 p-2 rounded">
                        <AlertOctagon size={14} /> {error}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 hover:text-white text-slate-400">Cancel</button>
                    <button
                        onClick={() => onUnlock(password)}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold shadow-lg"
                    >
                        Unlock
                    </button>
                </div>
            </div>
        </div>
    );
};


const SchemaMapper = () => {
    const { isLocked: isGlobalLocked } = useOutletContext();

    // --- State ---
    const [step, setStep] = useState(1); // 1: Upload, 2: Config, 3: Mapping
    const [mappings, setMappings] = useState([]);
    const [columns, setColumns] = useState([]);
    const [availableSources, setAvailableSources] = useState([]);

    // Step 1: Payload
    const [sampleJson, setSampleJson] = useState('{\n  "FaceData": {\n    "Info": { "Name": "John Doe" },\n    "Attributes": { "Age": 30 },\n    "Device": "CAM-01"\n  }\n}');
    const [jsonError, setJsonError] = useState(null);
    const [extractedPaths, setExtractedPaths] = useState([]);
    const [pathValues, setPathValues] = useState({});

    // Step 2: Config (STRICT GOVERNANCE)
    const [selectedTable, setSelectedTable] = useState('frs_event_fact');
    const [selectedSource, setSelectedSource] = useState(''); // The Source ID

    const [formData, setFormData] = useState({
        mapping_name: '',
        event_type: 'frs_event_fact',
        identification_criteria: '{}',
        mapping: {},
        locked: false
    });

    // Edit & Auth State
    const [editId, setEditId] = useState(null);
    const [isLocalLocked, setIsLocalLocked] = useState(false); // UI state for current editing item
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [pendingUnlockId, setPendingUnlockId] = useState(null);
    const [authError, setAuthError] = useState(null);

    // --- Effects ---
    useEffect(() => {
        fetchMappings();
        fetchSources();
    }, []);

    // Strict Table List
    const ALLOWED_TABLES = [
        'frs_event_fact',
        'anpr_event_fact',
        'crowd_event_fact',
        'parking_event_fact'
    ];

    useEffect(() => {
        // Enforce Source Binding: Criteria is ALWAYS just { source_id: ... }
        if (selectedSource) {
            const criteria = { source_id: selectedSource };
            setFormData(prev => ({ ...prev, identification_criteria: JSON.stringify(criteria, null, 2) }));
        }
    }, [selectedSource]);

    useEffect(() => {
        // When entering Step 3 or changing table, fetch columns
        if (step === 3 && selectedTable) fetchColumns(selectedTable);
    }, [step, selectedTable]);

    // --- Actions ---
    const fetchMappings = async () => {
        try {
            const res = await fetch('/api/mappings');
            const data = await res.json();
            setMappings(data.mappings || []);
        } catch (err) { console.error(err); }
    };

    const fetchSources = async () => {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            setAvailableSources(data.brokers || []);
        } catch (err) { console.error(err); }
    };

    const fetchColumns = async (table) => {
        try {
            const res = await fetch(`/api/db/columns/${table}`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            const data = await res.json();
            const cols = (data.columns || []).filter(c => !['id', 'created_at', 'updated_at'].includes(c.column_name));
            setColumns(cols);

            if (Object.keys(formData.mapping).length === 0) {
                autoMapFields(cols, extractedPaths);
            }
        } catch (err) { console.error(err); }
    };

    const autoMapFields = (cols, paths) => {
        const newMapping = {};
        cols.forEach(col => {
            const colName = col.column_name.toLowerCase();
            const bestMatch = paths.find(p => {
                const parts = p.toLowerCase().split('.');
                const lastPart = parts[parts.length - 1];
                return lastPart === colName || lastPart.includes(colName) || colName.includes(lastPart);
            });
            if (bestMatch) newMapping[col.column_name] = bestMatch;

            // Common Overrides
            if (colName === 'camera_id') {
                const m = paths.find(p => p.toLowerCase().includes('device') || p.toLowerCase().includes('cam'));
                if (m) newMapping[col.column_name] = m;
            }
        });
        setFormData(prev => ({ ...prev, mapping: newMapping }));
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure? This cannot be undone.')) return;
        await fetch(`/api/mappings/${id}`, { method: 'DELETE' });
        fetchMappings();
    };

    // --- Edit Flow with Lock Check ---
    const handleEditRequest = (mapping) => {
        if (isGlobalLocked) return; // Should be disabled in UI, but safety check

        if (mapping.locked) {
            setPendingUnlockId(mapping);
            setAuthError(null);
            setShowAuthModal(true);
        } else {
            proceedToEdit(mapping);
        }
    };

    const handleUnlock = async (password) => {
        const encoded = btoa(`admin:${password}`);
        try {
            const res = await fetch(`/api/mappings/${pendingUnlockId.id}/lock`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${encoded}`
                },
                body: JSON.stringify({ locked: false })
            });

            if (res.ok) {
                setShowAuthModal(false);
                setPendingUnlockId(null);
                const updated = { ...pendingUnlockId, locked: false };
                proceedToEdit(updated);
                fetchMappings();
            } else {
                setAuthError("Invalid Admin Password");
            }
        } catch (e) {
            setAuthError(e.message);
        }
    };

    const proceedToEdit = (mapping) => {
        setEditId(mapping.id);
        setIsLocalLocked(mapping.locked);

        // Restore Config
        setFormData({
            mapping_name: mapping.mapping_name,
            event_type: mapping.event_type,
            identification_criteria: mapping.identification_criteria,
            mapping: mapping.mapping_config,
            locked: mapping.locked
        });

        // Restore Source Selection
        try {
            let crit = mapping.identification_criteria;
            if (typeof crit === 'string') {
                crit = JSON.parse(crit);
            }
            if (crit && crit.source_id) setSelectedSource(crit.source_id);
            else {
                console.warn("No source_id found in criteria:", crit);
                setSelectedSource('');
            }
        } catch (e) {
            console.error("Failed to parse criteria during edit:", e);
            setSelectedSource('');
        }

        setSelectedTable(mapping.event_type);
        setStep(2);
    };

    // --- JSON Logic ---
    const flattenJSON = (obj, prefix = '', resPaths = [], resValues = {}) => {
        for (let key in obj) {
            const val = obj[key];
            const newPath = prefix ? `${prefix}.${key}` : key;
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                flattenJSON(val, newPath, resPaths, resValues);
            } else if (Array.isArray(val)) {
                resPaths.push(newPath);
                resValues[newPath] = `[Array existing of ${val.length} items]`;
                if (val.length > 0 && typeof val[0] === 'object') {
                    flattenJSON(val[0], `${newPath}[0]`, resPaths, resValues);
                }
            } else {
                resPaths.push(newPath);
                resValues[newPath] = val;
            }
        }
    };

    const handleParse = () => {
        try {
            const parsed = JSON.parse(sampleJson);
            const paths = [];
            const values = {};
            flattenJSON(parsed, '', paths, values);
            setExtractedPaths(paths);
            setPathValues(values);
            setJsonError(null);
        } catch (e) {
            setJsonError(e.message);
            setExtractedPaths([]);
        }
    };

    // --- Mapping ---
    const updateMapping = (col, path) => {
        setFormData(prev => ({
            ...prev,
            mapping: { ...prev.mapping, [col]: path }
        }));
    };

    const handleSave = async (shouldLock = false) => {
        if (!selectedSource) return alert("Source ID is required.");
        if (!formData.mapping_name) return alert("Mapping Name is required.");

        try {
            const payload = {
                mapping_name: formData.mapping_name,
                event_type: selectedTable,
                identification_criteria: formData.identification_criteria,
                mapping_config: formData.mapping,
                locked: shouldLock
            };

            const url = editId ? `/api/mappings/${editId}` : '/api/mappings';
            const method = editId ? 'PUT' : 'POST';

            await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            fetchMappings();
            // Reset
            setFormData({ ...formData, mapping_name: '', mapping: {} });
            setEditId(null);
            setSelectedSource('');
            setStep(1);
            alert(`Mapping ${editId ? 'Updated' : 'Created'} & ${shouldLock ? 'LOCKED' : 'Saved'}!`);
        } catch (err) {
            alert('Failed to save mapping');
        }
    };

    // --- Preview ---
    const previewObject = useMemo(() => {
        const obj = {};
        Object.entries(formData.mapping).forEach(([col, path]) => {
            if (path && pathValues[path] !== undefined) obj[col] = pathValues[path];
            else if (path) obj[col] = "(null/undefined in sample)";
        });
        return obj;
    }, [formData.mapping, pathValues]);

    const isStep2Valid = formData.mapping_name && selectedSource && selectedTable;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-900 text-slate-100 p-6 animate-fade-in w-full">
            <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
                <AdminUnlockModal
                    isOpen={showAuthModal}
                    onClose={() => setShowAuthModal(false)}
                    onUnlock={handleUnlock}
                    error={authError}
                />

                {/* Header */}
                <div className="flex-none pb-2 border-b border-slate-800 mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <div className="flex items-center space-x-3 mb-1">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Database className="text-primary" /> Schema Mappings
                                </h2>
                                <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider flex items-center gap-1 ${isGlobalLocked ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-green-900/30 text-green-400 border border-green-700'}`}>
                                    {isGlobalLocked ? <><Lock size={12} /> Read Only</> : <><Unlock size={12} /> Editing Enabled</>}
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm">Define how external JSON events map to database tables.</p>
                        </div>

                        <div className="flex items-center space-x-2">
                            <StepIndicator num={1} label="Payload" active={step >= 1} current={step === 1} />
                            <div className="w-8 h-px bg-slate-700"></div>
                            <StepIndicator num={2} label="Config" active={step >= 2} current={step === 2} />
                            <div className="w-8 h-px bg-slate-700"></div>
                            <StepIndicator num={3} label="Mapping" active={step >= 3} current={step === 3} />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">

                    {/* --- STEP 1: Payload --- */}
                    {step === 1 && (
                        <div className="h-full flex flex-col animate-fade-in gap-4">
                            {/* Upload Section - Hidden if Locked & No Mappings? No, we still want to see mappings. */}
                            {/* If Locked, disable Upload/Parse? Or just disable saving new ones? */}
                            {/* User said Read Mode. Parsing JSON is harmless. Saving is not. */}

                            {!isGlobalLocked && (
                                <div className="flex-none bg-surface p-4 rounded-lg border border-slate-700 shadow-sm transition-all">
                                    <h3 className="text-lg font-semibold mb-2">Step 1: Create New Mapping</h3>
                                    <textarea
                                        className={`w-full h-32 bg-slate-900 border ${jsonError ? 'border-red-500' : 'border-slate-700'} rounded p-3 text-slate-300 font-mono text-xs outline-none focus:border-primary resize-none`}
                                        value={sampleJson}
                                        onChange={e => { setSampleJson(e.target.value); setExtractedPaths([]); }}
                                        placeholder='Paste Sample JSON Event here...'
                                    />
                                    {jsonError && (<div className="text-red-400 text-sm mt-2 flex items-center gap-2"><AlertTriangle size={16} /> {jsonError}</div>)}
                                    <div className="mt-4 flex justify-end">
                                        <button onClick={handleParse} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded flex items-center gap-2"> <Code size={16} /> Parse Keys </button>
                                    </div>
                                </div>
                            )}

                            {isGlobalLocked && extractedPaths.length === 0 && mappings.length === 0 && (
                                <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl">
                                    <Database size={48} className="mx-auto text-slate-700 mb-4" />
                                    <h3 className="text-slate-500 font-bold">No Mappings Configured</h3>
                                    <p className="text-slate-600 text-sm">Unlock Admin Panel to create one.</p>
                                </div>
                            )}

                            {extractedPaths.length > 0 && !isGlobalLocked && (
                                <div className="flex-none bg-surface p-3 rounded-lg border border-slate-700 flex justify-between items-center animate-slide-up">
                                    <span className="text-success font-semibold flex items-center gap-2"><CheckCircle size={16} /> Parsed {extractedPaths.length} Keys</span>
                                    <button onClick={() => setStep(2)} className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded shadow-lg flex items-center gap-2"> Next <ArrowRight size={16} /> </button>
                                </div>
                            )}

                            {mappings.length > 0 && (
                                <div className="flex-1 overflow-y-auto bg-slate-900/50 p-4 rounded border border-slate-800">
                                    <h3 className="text-sm font-bold text-slate-300 mb-3">Active Mappings</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {mappings.map(m => (
                                            <div key={m.id} className={`p-4 rounded border flex justify-between items-start group transition-all ${m.locked || isGlobalLocked ? 'bg-slate-900 border-slate-800' : 'bg-slate-800 border-slate-700'}`}>
                                                <div>
                                                    <div className="font-bold text-sm text-white flex items-center gap-2">
                                                        {m.locked && <Lock size={12} className="text-red-500" />}
                                                        {m.mapping_name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">{m.event_type}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-[200px]">
                                                        {typeof m.identification_criteria === 'object' ? JSON.stringify(m.identification_criteria) : m.identification_criteria}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {!isGlobalLocked && (
                                                        <>
                                                            <button onClick={() => handleEditRequest(m)} className={`${m.locked ? 'text-red-500 hover:text-red-400' : 'text-slate-500 hover:text-cyan-400'} transition-colors`} title={m.locked ? "Unlock to Edit" : "Edit"}>
                                                                {m.locked ? <Lock size={14} /> : <Code size={14} />}
                                                            </button>
                                                            {!m.locked && (
                                                                <button onClick={() => handleDelete(m.id)} className="text-slate-500 hover:text-red-400 transition-colors" title="Delete">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- STEP 2: Strict Configuration (Hidden if Locked, but if you are here you shouldn't be loaded) --- */}
                    {step === 2 && !isGlobalLocked && (
                        <div className="h-full bg-surface p-6 rounded-lg border border-slate-700 shadow-lg animate-fade-in flex flex-col">
                            <h3 className="text-xl font-semibold mb-6">Step 2: Source Binding</h3>
                            {/* ... Form Data ... */}
                            <div className="grid grid-cols-2 gap-8 max-w-4xl">
                                {/* Left: Source Identity */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Mapping Name (Friendly)</label>
                                        <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-primary outline-none" placeholder="e.g. North Gate FRS" value={formData.mapping_name} onChange={e => setFormData({ ...formData, mapping_name: e.target.value })} autoFocus />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Select Source (Camera/Broker)</label>
                                        <select
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-primary outline-none"
                                            value={selectedSource}
                                            onChange={e => setSelectedSource(e.target.value)}
                                        >
                                            <option value="">-- Choose Data Source --</option>
                                            {availableSources.map(s => {
                                                let sid = s.id || `SOURCE_${s.id}`;
                                                if (!s.id && s.url) {
                                                    try { sid = `${s.type}_${new URL(s.url.includes('://') ? s.url : 'mqtt://' + s.url).hostname.replace(/\./g, '_')}`; } catch (e) { }
                                                }
                                                return <option key={sid} value={sid}>[{sid}] {s.name || s.url}</option>
                                            })}
                                        </select>
                                        <div className="text-[10px] text-slate-500 mt-2">
                                            This mapping will ONLY apply to events coming from this Source ID.
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-900/50 p-6 rounded border border-slate-800">
                                    <label className="block text-sm font-medium text-slate-400 mb-3">Target Database Table</label>
                                    <div className="space-y-2">
                                        {ALLOWED_TABLES.map(t => (
                                            <div
                                                key={t}
                                                onClick={() => { setSelectedTable(t); setFormData(p => ({ ...p, event_type: t })); }}
                                                className={`p-3 rounded cursor-pointer border flex justify-between items-center transition-all ${selectedTable === t ? 'bg-primary/20 border-primary text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                            >
                                                <span className="font-mono text-sm">{t}</span>
                                                {selectedTable === t && <CheckCircle size={16} className="text-primary" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto flex justify-between pt-6 border-t border-slate-800">
                                <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white px-4">Back</button>
                                <button onClick={() => isStep2Valid && setStep(3)} disabled={!isStep2Valid} className={`px-8 py-2 rounded shadow-lg flex items-center gap-2 ${isStep2Valid ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                                    Next: Map Fields <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- STEP 3: Map & Lock --- */}
                    {step === 3 && !isGlobalLocked && (
                        <div className="h-full flex gap-4 animate-fade-in">
                            <div className="flex-2 w-2/3 bg-surface p-4 rounded-lg border border-slate-700 shadow-lg flex flex-col">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                                    <h3 className="text-lg font-semibold">Map JSON keys to DB Columns</h3>
                                    <div className="text-xs text-slate-400">Target: <span className="text-white font-mono">{selectedTable}</span></div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                                    {columns.map(col => {
                                        const isRequired = ['camera_id', 'event_time', 'person_name'].includes(col.column_name);
                                        return (
                                            <div key={col.column_name} className="flex items-center gap-4 bg-slate-900/40 p-3 rounded border border-slate-800">
                                                <div className="w-1/3">
                                                    <div className="text-sm font-bold text-slate-200 flex items-center gap-2">{col.column_name} {isRequired && <span className="text-red-500 text-[10px] border border-red-500 rounded px-1">REQ</span>}</div>
                                                </div>
                                                <div className="flex-1">
                                                    <SearchableSelect options={extractedPaths} value={formData.mapping[col.column_name] || ''} onChange={(val) => updateMapping(col.column_name, val)} placeholder="Select JSON Path..." />
                                                </div>
                                                <div className="w-1/4 text-right"> <div className="text-xs font-mono text-cyan-400 truncate max-w-[100px] ml-auto">{previewObject[col.column_name]?.toString().substring(0, 15) || '-'}</div> </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-700 flex justify-start">
                                    <button onClick={() => setStep(2)} className="text-slate-400 hover:text-white px-4">Back</button>
                                </div>
                            </div>

                            <div className="flex-1 w-1/3 bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col shadow-inner">
                                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><Code size={14} /> Preview</h4>
                                <pre className="flex-1 overflow-auto text-xs font-mono text-green-400 bg-black/50 p-2 rounded mb-4">{JSON.stringify(previewObject, null, 2)}</pre>
                                <div className="space-y-3">
                                    <button onClick={() => handleSave(true)} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded shadow-lg flex justify-center items-center gap-2 font-bold transition-all">
                                        <Lock size={18} /> {editId ? 'Update & Lock' : 'Activate & Lock'}
                                    </button>
                                    <button onClick={() => handleSave(false)} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex justify-center items-center gap-2 text-sm font-semibold">
                                        <Save size={16} /> Save Draft (Unlocked)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StepIndicator = ({ num, label, active, current }) => (
    <div className={`flex items-center gap-2 ${active ? 'opacity-100' : 'opacity-40'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${current ? 'bg-primary text-white scale-110 shadow-glow' : active ? 'bg-success text-white' : 'bg-slate-700 text-slate-400'}`}>
            {active && !current ? <CheckCircle size={14} /> : num}
        </div>
        <span className="text-xs font-semibold">{label}</span>
    </div>
);

export default SchemaMapper;
