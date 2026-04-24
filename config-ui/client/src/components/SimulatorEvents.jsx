import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Clock, MapPin, Navigation, TrendingUp } from 'lucide-react';

const SimulatorEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEvents = async () => {
        try {
            // Predict engine API is exposed on Port 8000
            const hostname = window.location.hostname;
            const response = await axios.get(`http://${hostname}:8000/api/v1/booking/recent`);
            if (response.data && response.data.bookings) {
                setEvents(response.data.bookings);
                setError(null);
            }
        } catch (err) {
            console.error("Failed to fetch simulator events:", err);
            setError("Simulation Data Engine Not Reachable (Ensure Python API is running on Port 8000)");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
        const interval = setInterval(fetchEvents, 2500); // refresh every 2.5s for live feel
        return () => clearInterval(interval);
    }, []);

    const getModeIcon = (mode) => {
        switch (mode.toLowerCase()) {
            case 'flight': return '✈️';
            case 'train': return '🚆';
            case 'bus': return '🚌';
            default: return '🚗';
        }
    };

    return (
        <div className="p-6 h-full flex flex-col space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="text-primary" /> Live Simulator Stream
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Real-time booking ingestion events from the simulation engine.</p>
                </div>
                {loading && events.length === 0 && (
                    <div className="flex items-center gap-2 text-slate-400">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>Connecting...</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-lg text-red-400 flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-auto bg-surface rounded-xl border border-slate-700 shadow-xl relative">
                {events.length === 0 && !loading && !error && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                        No Simulator Events Found in Database.
                    </div>
                )}

                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-slate-700/50 bg-slate-800/50 sticky top-0 backdrop-blur-md z-10">
                            <th className="p-4 font-semibold text-slate-300">Timestamp</th>
                            <th className="p-4 font-semibold text-slate-300">Target Date</th>
                            <th className="p-4 font-semibold text-slate-300">Mode</th>
                            <th className="p-4 font-semibold text-slate-300">Feeder City</th>
                            <th className="p-4 font-semibold text-slate-300">Arrival Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((ev, i) => (
                            <tr key={ev.id || i} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                                <td className="p-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                                    {new Date(ev.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </td>
                                <td className="p-4 text-emerald-400 font-medium">
                                    {new Date(ev.target_date).toLocaleDateString()}
                                </td>
                                <td className="p-4 text-slate-300 flex items-center gap-2">
                                    {getModeIcon(ev.mode)} <span className="capitalize">{ev.mode}</span>
                                </td>
                                <td className="p-4">
                                    <div className="font-medium text-slate-200">{ev.origin_city}</div>
                                    <div className="text-xs text-slate-500">{ev.state}</div>
                                </td>
                                <td className="p-4 font-bold text-white">
                                    +{ev.arrival_count.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SimulatorEvents;
