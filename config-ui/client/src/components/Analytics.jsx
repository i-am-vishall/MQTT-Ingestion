import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, Activity } from 'lucide-react';

const API_BASE = '/api';

export default function Analytics() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/stats/recent`);
            if (res.data.error) throw new Error(res.data.error);
            setData(res.data.stats || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-slate-700 p-8 shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-slate-800 rounded text-accent">
                            <Activity size={24} />
                        </div>
                        <h3 className="text-xl font-bold">Live Traffic Analytics (Last 30 Mins)</h3>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-primary transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span>{loading ? 'Refreshing...' : 'Manual Refresh'}</span>
                    </button>
                </div>

                {error && (
                    <div className="p-4 mb-4 bg-red-900/20 text-red-400 rounded-lg border border-red-900/50">
                        Error loading analytics: {error}
                    </div>
                )}

                <div className="h-[400px] w-full bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="time" stroke="#cbd5e1" fontSize={12} />
                            <YAxis stroke="#cbd5e1" fontSize={12} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="Vehicles" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="Crowd" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 mt-4 text-center">
                    * Data is aggregated into 1-minute buckets to ensure zero database load.
                </p>
            </div>
        </div>
    );
}
