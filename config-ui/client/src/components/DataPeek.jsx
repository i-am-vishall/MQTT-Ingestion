import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, RefreshCw, FileJson } from 'lucide-react';

const API_BASE = '/api';

export default function DataPeek() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchEvents = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/data/events?limit=50`);
            if (res.data.error) throw new Error(res.data.error);
            setEvents(res.data.events || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    return (
        <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-slate-700 p-8 shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-slate-800 rounded text-accent">
                            <Database size={24} />
                        </div>
                        <h3 className="text-xl font-bold">Data Inspector (Last 50 Events)</h3>
                    </div>
                    <button
                        onClick={fetchEvents}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-primary transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span>{loading ? 'Refreshing...' : 'Manual Refresh'}</span>
                    </button>
                </div>

                {error && (
                    <div className="p-4 mb-4 bg-red-900/20 text-red-400 rounded-lg border border-red-900/50">
                        Error loading data: {error}
                    </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Camera</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Payload Preview</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700 bg-slate-900/50">
                            {events.map((evt) => (
                                <tr key={evt.event_id} className="hover:bg-slate-800/50 transition">
                                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                        {new Date(evt.event_time).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-white">{evt.camera_id}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${evt.event_type === 'TRAFFIC' ? 'bg-blue-900/50 text-blue-400' :
                                            evt.event_type === 'ANPR' ? 'bg-purple-900/50 text-purple-400' : 'bg-slate-700 text-slate-300'
                                            }`}>
                                            {evt.event_type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs truncate max-w-md" title={JSON.stringify(evt.payload, null, 2)}>
                                        {JSON.stringify(evt.payload)}
                                    </td>
                                </tr>
                            ))}
                            {events.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center italic text-slate-600">
                                        No recent events found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
