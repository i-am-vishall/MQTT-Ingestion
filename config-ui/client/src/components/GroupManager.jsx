import React, { useState, useEffect, useMemo } from 'react';
import {
    Network, Search, Link as LinkIcon, Trash2, Camera, Layers,
    RefreshCw, Plus, Pencil, X, Check, Unlink, AlertTriangle, ChevronDown
} from 'lucide-react';
import axios from 'axios';

const API_CAMERAS      = '/api/cameras';
const API_ZONES        = '/api/camera-zones';
const API_ZONES_ASSIGN = '/api/camera-zones/assign';

export default function GroupManager() {
    const [cameras, setCameras] = useState([]);
    const [groups, setGroups] = useState([]);   // list of group_name strings
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);

    const [newGroupName, setNewGroupName] = useState('');
    const [editingGroup, setEditingGroup] = useState(null);
    const [editName, setEditName] = useState('');
    const [showGroupPanel, setShowGroupPanel] = useState(false);

    const [selectedCameraIds, setSelectedCameraIds] = useState(new Set());
    const [actionGroupTarget, setActionGroupTarget] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // ─── Data Fetching ───────────────────────────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            const [cRes, gRes] = await Promise.all([
                axios.get(API_CAMERAS),
                axios.get(API_ZONES)
            ]);
            setCameras(cRes.data.cameras || []);
            // Build flat group name list from zones response
            const groupNames = (gRes.data.groups || []).map(g => g.group_name);
            setGroups(groupNames);
        } catch (err) {
            showNotification('Failed to load: ' + (err.response?.data?.error || err.message), 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // ─── Group CRUD ──────────────────────────────────────────────────────────
    const handleCreateGroup = () => {
        const name = newGroupName.trim();
        if (!name) return;
        if (groups.some(g => g.toLowerCase() === name.toLowerCase())) {
            showNotification('Group already exists', 'error');
            return;
        }
        setGroups(prev => [...prev, name].sort());
        setNewGroupName('');
        showNotification(`Group "${name}" created`);
    };

    const handleRenameGroup = async () => {
        const newName = editName.trim();
        if (!newName || !editingGroup || newName === editingGroup) { setEditingGroup(null); return; }
        try {
            // Reassign all cameras in old group → new group name
            const oldCamIds = cameras
                .filter(c => c.group_name === editingGroup)
                .map(c => c.camera_id);
            if (oldCamIds.length > 0) {
                await axios.post(API_ZONES_ASSIGN, { camera_ids: oldCamIds, group_name: newName });
            }
            // Delete old group entry
            await axios.delete(`${API_ZONES}/${encodeURIComponent(editingGroup)}`);
            setEditingGroup(null);
            await fetchData();
            showNotification(`Renamed "${editingGroup}" → "${newName}"`);
        } catch (err) {
            showNotification('Rename failed: ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    const handleDeleteGroup = async (groupName) => {
        if (!window.confirm(`Delete group "${groupName}" and unmap all its cameras?`)) return;
        try {
            await axios.delete(`${API_ZONES}/${encodeURIComponent(groupName)}`);
            await fetchData();
            showNotification(`Deleted "${groupName}"`);
        } catch (err) {
            showNotification('Delete failed: ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    // ─── Camera Selection ─────────────────────────────────────────────────────
    const handleToggle = (cameraId) => {
        setSelectedCameraIds(prev => {
            const next = new Set(prev);
            if (next.has(cameraId)) next.delete(cameraId);
            else next.add(cameraId);
            return next;
        });
    };

    const filteredCameras = useMemo(() => {
        if (!searchQuery) return cameras;
        const q = searchQuery.toLowerCase();
        return cameras.filter(c =>
            (c.camera_name || '').toLowerCase().includes(q) ||
            (c.camera_id || '').toLowerCase().includes(q) ||
            (c.camera_ip || '').toLowerCase().includes(q) ||
            (c.group_name || '').toLowerCase().includes(q)
        );
    }, [cameras, searchQuery]);

    const allVisible = filteredCameras.length > 0 && filteredCameras.every(c => selectedCameraIds.has(c.camera_id));
    const handleSelectAll = () => {
        if (allVisible) setSelectedCameraIds(new Set());
        else setSelectedCameraIds(new Set(filteredCameras.map(c => c.camera_id)));
    };

    // ─── Derived Conflict Check ───────────────────────────────────────────────
    const selectedConflicts = useMemo(() => {
        return Array.from(selectedCameraIds)
            .map(id => cameras.find(c => c.camera_id === id))
            .filter(c => c && c.group_name);
    }, [selectedCameraIds, cameras]);

    const hasMappingConflict = selectedConflicts.length > 0;

    // ─── Mapping Actions ──────────────────────────────────────────────────────
    const handleAssign = async () => {
        if (!actionGroupTarget || selectedCameraIds.size === 0 || hasMappingConflict) return;
        try {
            await axios.post(API_ZONES_ASSIGN, {
                camera_ids: Array.from(selectedCameraIds),
                group_name: actionGroupTarget
            });
            showNotification(`Assigned ${selectedCameraIds.size} camera(s) → "${actionGroupTarget}"`);
            setSelectedCameraIds(new Set());
            setActionGroupTarget('');
            await fetchData();
        } catch (err) {
            showNotification(err.response?.data?.error || err.message, 'error');
        }
    };

    const handleUnmap = async () => {
        if (selectedCameraIds.size === 0) return;
        try {
            await axios.post(API_ZONES_ASSIGN, {
                camera_ids: Array.from(selectedCameraIds),
                group_name: ''
            });
            showNotification(`Unmapped ${selectedCameraIds.size} camera(s)`);
            setSelectedCameraIds(new Set());
            await fetchData();
        } catch (err) {
            showNotification(err.response?.data?.error || err.message, 'error');
        }
    };

    // ─── Group counts ─────────────────────────────────────────────────────────
    const groupCounts = useMemo(() => {
        const c = {};
        cameras.forEach(cam => { if (cam.group_name) c[cam.group_name] = (c[cam.group_name] || 0) + 1; });
        return c;
    }, [cameras]);

    // ─── Group badge colors (cycle) ───────────────────────────────────────────
    const BADGE_COLORS = [
        'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
        'bg-violet-500/15 text-violet-300 border-violet-500/25',
        'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
        'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
        'bg-amber-500/15 text-amber-300 border-amber-500/25',
        'bg-rose-500/15 text-rose-300 border-rose-500/25',
    ];
    const groupColor = useMemo(() => {
        const map = {};
        groups.forEach((g, i) => { map[g] = BADGE_COLORS[i % BADGE_COLORS.length]; });
        return map;
    }, [groups]);

    const selCount = selectedCameraIds.size;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full min-h-0 gap-4">
            {/* ── Header ── */}
            <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-xl px-5 py-4 shrink-0">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-400" />
                        Zone &amp; Group Manager
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">Select cameras below, then assign them to a group.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowGroupPanel(p => !p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${showGroupPanel ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-white'}`}
                    >
                        <Network className="w-4 h-4" />
                        Manage Groups
                    </button>
                    <button onClick={fetchData} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors" title="Refresh">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Notification ── */}
            {notification && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border shrink-0 ${notification.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {notification.type === 'error' ? <X className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                    {notification.msg}
                </div>
            )}

            {/* ── Group Management Panel (collapsible) ── */}
            {showGroupPanel && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 shrink-0">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Network className="w-4 h-4 text-violet-400" /> Groups
                        <span className="ml-auto text-xs text-slate-500 font-normal">{groups.length} total</span>
                    </h3>
                    {/* Create */}
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                            placeholder="New group name..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button onClick={handleCreateGroup} disabled={!newGroupName.trim()}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm transition-colors flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Create
                        </button>
                    </div>
                    {/* Group chips */}
                    <div className="flex flex-wrap gap-2">
                        {groups.length === 0 ? (
                            <span className="text-slate-500 text-sm italic">No groups yet.</span>
                        ) : groups.map(g => (
                            <div key={g} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${groupColor[g] || BADGE_COLORS[0]}`}>
                                {editingGroup === g ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(); if (e.key === 'Escape') setEditingGroup(null); }}
                                            autoFocus
                                            className="bg-transparent border-b border-current focus:outline-none w-24"
                                        />
                                        <button onClick={handleRenameGroup}><Check className="w-3 h-3" /></button>
                                        <button onClick={() => setEditingGroup(null)}><X className="w-3 h-3" /></button>
                                    </>
                                ) : (
                                    <>
                                        <span>{g}</span>
                                        <span className="opacity-60">({groupCounts[g] || 0})</span>
                                        <button onClick={() => { setEditingGroup(g); setEditName(g); }} className="opacity-60 hover:opacity-100 ml-1"><Pencil className="w-3 h-3" /></button>
                                        <button onClick={() => handleDeleteGroup(g)} className="opacity-60 hover:opacity-100 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Camera Table ── */}
            <div className="flex-1 min-h-0 bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
                {/* Search + count */}
                <div className="flex gap-3 items-center px-4 py-3 border-b border-slate-700/50 bg-slate-800/50 shrink-0">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by name, IP, ID, or group..."
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                        {selCount > 0 ? <span className="text-indigo-400 font-medium">{selCount} selected</span> : `${filteredCameras.length} cameras`}
                    </span>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm table-fixed">
                        <thead className="bg-slate-900/70 text-slate-400 sticky top-0 z-10">
                            <tr>
                                <th className="w-10 p-3 border-b border-slate-700">
                                    <input type="checkbox" checked={allVisible} onChange={handleSelectAll}
                                        className="rounded border-slate-600 bg-slate-900 cursor-pointer accent-indigo-500" />
                                </th>
                                <th className="p-3 border-b border-slate-700 text-left font-medium">Camera Name</th>
                                <th className="p-3 border-b border-slate-700 text-left font-medium w-40 hidden md:table-cell">Camera IP</th>
                                <th className="p-3 border-b border-slate-700 text-left font-medium w-36 hidden lg:table-cell">Camera ID</th>
                                <th className="p-3 border-b border-slate-700 text-left font-medium w-40">Mapped Group</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && cameras.length === 0 ? (
                                <tr><td colSpan="5" className="p-12 text-center text-slate-500">Loading cameras...</td></tr>
                            ) : filteredCameras.length === 0 ? (
                                <tr><td colSpan="5" className="p-12 text-center text-slate-500">
                                    {cameras.length === 0
                                        ? 'No cameras in database. Ingestion service will auto-discover cameras from MQTT.'
                                        : 'No cameras match your search.'}
                                </td></tr>
                            ) : filteredCameras.map(cam => {
                                const checked = selectedCameraIds.has(cam.camera_id);
                                const isConflicting = checked && !!cam.group_name;
                                return (
                                    <tr
                                        key={cam.camera_id}
                                        onClick={() => handleToggle(cam.camera_id)}
                                        className={`border-b border-slate-700/20 cursor-pointer transition-colors
                                            ${checked
                                                ? isConflicting
                                                    ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                                    : 'bg-indigo-500/8 hover:bg-indigo-500/12'
                                                : 'hover:bg-slate-700/20'
                                            }`}
                                    >
                                        <td className="p-3">
                                            <input type="checkbox" checked={checked} readOnly
                                                className={`rounded border-slate-600 bg-slate-900 cursor-pointer ${isConflicting ? 'accent-amber-500' : 'accent-indigo-500'}`} />
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Camera className={`w-4 h-4 shrink-0 ${isConflicting ? 'text-amber-500/70' : 'text-slate-500'}`} />
                                                <span className="text-slate-200 font-medium truncate">{cam.camera_name || 'UNKNOWN'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 hidden md:table-cell">
                                            <span className="text-slate-400 font-mono text-xs">{cam.camera_ip || '—'}</span>
                                        </td>
                                        <td className="p-3 hidden lg:table-cell">
                                            <span className="text-slate-500 font-mono text-xs">{cam.camera_id}</span>
                                        </td>
                                        <td className="p-3">
                                            {cam.group_name ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${groupColor[cam.group_name] || BADGE_COLORS[0]}`}>
                                                    <Network className="w-3 h-3" />
                                                    {cam.group_name}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Floating Action Bar (appears when cameras selected) ── */}
            {selCount > 0 && (
                <div className="shrink-0 bg-slate-900 border border-slate-600/60 rounded-xl px-4 py-3 shadow-2xl flex flex-wrap items-center gap-3">
                    {/* Left: selection summary */}
                    <div className="flex items-center gap-2 text-sm shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {selCount}
                        </div>
                        <span className="text-slate-300 font-medium">camera{selCount !== 1 ? 's' : ''} selected</span>
                    </div>

                    {/* Conflict warning */}
                    {hasMappingConflict && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span><b>{selectedConflicts.length}</b> already mapped — unmap first before re-assigning</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
                        {/* Unmap */}
                        <button
                            onClick={handleUnmap}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 text-sm rounded-lg border border-slate-600 transition-colors"
                        >
                            <Unlink className="w-4 h-4" />
                            Unmap
                        </button>

                        {/* Separator */}
                        {!hasMappingConflict && <div className="w-px h-6 bg-slate-700" />}

                        {/* Assign to group — only shown when no conflict */}
                        {!hasMappingConflict && (
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">→ Assign to:</span>
                                <div className="relative">
                                    <select
                                        value={actionGroupTarget}
                                        onChange={e => setActionGroupTarget(e.target.value)}
                                        className="appearance-none bg-slate-800 border border-slate-600 rounded-lg pl-3 pr-8 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="">Select group...</option>
                                        {groups.map(g => <option key={g} value={g}>{g} ({groupCounts[g] || 0})</option>)}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                                <button
                                    onClick={handleAssign}
                                    disabled={!actionGroupTarget}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                    Assign
                                </button>
                            </div>
                        )}

                        {/* Clear selection */}
                        <button onClick={() => setSelectedCameraIds(new Set())} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-700 transition-colors" title="Clear selection">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
