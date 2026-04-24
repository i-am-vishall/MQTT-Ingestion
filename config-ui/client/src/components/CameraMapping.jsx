import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Save, Loader2, Info, AlertTriangle, Download, Upload, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';

const API_BASE = '/api';

const CameraMapping = () => {
    const { isLocked } = useOutletContext();
    const [cameras, setCameras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(null);
    const [error, setError] = useState(null);
    const [importResult, setImportResult] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchCameras();
    }, []);

    const fetchCameras = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE}/cameras`);
            setCameras(res.data.cameras);
            setError(null);
        } catch (e) {
            setError("Failed to fetch camera registry");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (camId, lat, lon) => {
        try {
            setSaving(camId);
            await axios.post(`${API_BASE}/cameras/${camId}/geodata`, {
                latitude: parseFloat(lat),
                longitude: parseFloat(lon)
            });
            setError(null);
        } catch (e) {
            setError(`Failed to save camera ${camId}`);
        } finally {
            setSaving(null);
        }
    };

    const exportToCSV = () => {
        const headers = ["camera_id", "camera_name", "source_ip", "latitude", "longitude"];
        
        // Helper to escape CSV fields (wraps in quotes and escapes existing quotes)
        const escape = (val) => {
            const str = String(val === null || val === undefined ? '' : val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const rows = cameras.map(c => [
            escape(c.camera_id),
            escape(c.camera_name),
            escape(c.source_ip),
            escape(c.latitude),
            escape(c.longitude)
        ]);
        
        const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `camera_registry_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (lines.length < 2) return;

            const headersLine = lines[0];
            // Split by comma but respect quotes
            const csvSplit = (line) => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

            const headers = csvSplit(headersLine).map(h => h.toLowerCase());
            const idIdx = headers.indexOf("camera_id");
            const latIdx = headers.indexOf("latitude");
            const lonIdx = headers.indexOf("longitude");

            if (idIdx === -1 || latIdx === -1 || lonIdx === -1) {
                setError("Invalid CSV format. Must contain camera_id, latitude, and longitude columns.");
                return;
            }

            const updates = lines.slice(1).map(line => {
                const cols = csvSplit(line);
                return {
                    camera_id: cols[idIdx],
                    latitude: cols[latIdx],
                    longitude: cols[lonIdx]
                };
            }).filter(u => u.camera_id);

            try {
                setLoading(true);
                const res = await axios.post(`${API_BASE}/cameras/bulk`, { updates });
                setImportResult(res.data);
                fetchCameras();
            } catch (err) {
                setError("Bulk import failed: " + (err.response?.data?.error || err.message));
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const updateLocalCoord = (id, field, value) => {
        setCameras(prev => prev.map(c => 
            c.camera_id === id ? { ...c, [field]: value } : c
        ));
    };

    const filtered = cameras.filter(c => 
        (c.camera_id || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.camera_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.source_ip || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-8 h-full flex flex-col animate-fade-in">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <MapPin className="text-primary" size={32} />
                        Camera Geodata Mapping
                    </h2>
                    <p className="text-slate-400 mt-2">Map physical camera IDs to geographic coordinates for spatial analysis.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1 mr-4">
                        <button 
                            onClick={exportToCSV}
                            title="Export to CSV"
                            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-all"
                        >
                            <Download size={14} />
                            Export
                        </button>
                        <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLocked}
                            title="Import from CSV"
                            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-all disabled:opacity-50"
                        >
                            <Upload size={14} />
                            Import
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImport} 
                            accept=".csv" 
                            className="hidden" 
                        />
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text"
                            placeholder="Search by ID, Name or IP..."
                            className="bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg w-72 focus:outline-none focus:border-primary transition-all"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-xl flex items-center gap-3 mb-6 animate-shake">
                    <AlertTriangle size={20} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-xs opacity-50 hover:opacity-100">Dismiss</button>
                </div>
            )}

            {importResult && (
                <div className="bg-emerald-900/20 border border-emerald-900/50 text-emerald-400 p-4 rounded-xl mb-6 animate-fade-in">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle2 size={20} />
                        <span className="font-bold">Import Summary</span>
                        <button onClick={() => setImportResult(null)} className="ml-auto text-xs opacity-50 hover:opacity-100 font-normal">Dismiss</button>
                    </div>
                    <div className="text-xs pl-8">
                        <p>Successfully updated <span className="font-bold text-white">{importResult.success}</span> cameras.</p>
                        {importResult.failed.length > 0 && (
                            <div className="mt-2">
                                <p className="text-orange-400 font-bold mb-1">Failed Records ({importResult.failed.length}):</p>
                                <ul className="list-disc list-inside space-y-1 opacity-80">
                                    {importResult.failed.slice(0, 5).map((f, i) => (
                                        <li key={i}>ID: <span className="text-white">{f.id}</span> - {f.error}</li>
                                    ))}
                                    {importResult.failed.length > 5 && <li>...and {importResult.failed.length - 5} more</li>}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto bg-surface border border-slate-800 rounded-2xl shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/50 text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-800">
                            <th className="px-6 py-4">Camera ID / Name</th>
                            <th className="px-6 py-4">Source IP</th>
                            <th className="px-6 py-4">Latitude</th>
                            <th className="px-6 py-4">Longitude</th>
                            <th className="px-6 py-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-800">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-4 text-slate-500">
                                        <Loader2 className="animate-spin text-primary" size={48} />
                                        <span>Syncing Camera Data...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-20 text-center text-slate-500 italic">
                                    No cameras found matching your search.
                                </td>
                            </tr>
                        ) : (
                            filtered.map(cam => (
                                <tr key={cam.camera_id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-200">{cam.camera_id}</div>
                                        <div className="text-xs text-slate-500">{cam.camera_name || 'Unnamed Camera'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono bg-slate-900 px-2 py-1 rounded text-primary border border-primary/20 text-xs">
                                            {cam.source_ip || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="number"
                                            step="0.00000001"
                                            disabled={isLocked}
                                            value={cam.latitude || ''}
                                            onChange={e => updateLocalCoord(cam.camera_id, 'latitude', e.target.value)}
                                            className="bg-slate-900 border border-slate-700 text-white px-3 py-1.5 rounded w-32 focus:outline-none focus:border-primary disabled:opacity-50 transition-all font-mono text-xs"
                                            placeholder="Ex: 20.2961"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="number"
                                            step="0.00000001"
                                            disabled={isLocked}
                                            value={cam.longitude || ''}
                                            onChange={e => updateLocalCoord(cam.camera_id, 'longitude', e.target.value)}
                                            className="bg-slate-900 border border-slate-700 text-white px-3 py-1.5 rounded w-32 focus:outline-none focus:border-primary disabled:opacity-50 transition-all font-mono text-xs"
                                            placeholder="Ex: 85.8245"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => handleSave(cam.camera_id, cam.latitude, cam.longitude)}
                                            disabled={isLocked || saving === cam.camera_id}
                                            className={`
                                                p-2 rounded-lg transition-all
                                                ${isLocked 
                                                    ? 'text-slate-700 cursor-not-allowed' 
                                                    : 'text-primary hover:bg-primary/10 active:scale-90 bg-slate-900 border border-primary/20 hover:border-primary/50 shadow-lg shadow-primary/5'
                                                }
                                            `}
                                        >
                                            {saving === cam.camera_id ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl flex gap-4 items-start text-blue-300">
                <Info size={20} className="mt-0.5 flex-none" />
                <div className="text-xs space-y-1">
                    <p className="font-bold uppercase tracking-widest">Metadata Sync</p>
                    <p>Coordinates saved here will be automatically projected onto the Grafana Map and Spatial Dashboards. You can use <b>Export</b> and <b>Import</b> to manage massive datasets via Excel.</p>
                </div>
            </div>
        </div>
    );
};

export default CameraMapping;
