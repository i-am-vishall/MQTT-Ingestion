import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Database, Lock } from 'lucide-react';

const API_BASE = '/api';

export default function Settings() {
    const [dbConfig, setDbConfig] = useState({
        host: '', port: '', user: '', pass: '', name: ''
    });

    useEffect(() => {
        axios.get(`${API_BASE}/config`).then(res => {
            const env = res.data.env;
            setDbConfig({
                host: env.DB_HOST || '',
                port: env.DB_PORT || '',
                user: env.DB_USER || '',
                pass: env.DB_PASSWORD || '**HIDDEN**', // Hide actual password
                name: env.DB_NAME || '',
                logLevel: env.LOG_LEVEL || 'error',
            });
        });
    }, []);

    const Field = ({ label, field, type = 'text' }) => (
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{label}</label>
            <div className="relative">
                <input
                    type={type}
                    value={dbConfig[field]}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-700/50 rounded px-3 py-2 text-slate-400 outline-none cursor-default"
                />
                <Lock className="absolute right-3 top-2.5 text-slate-600" size={16} />
            </div>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-surface rounded-xl border border-slate-700 p-8 shadow-lg">
                <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-slate-700">
                    <div className="p-2 bg-slate-800 rounded text-accent">
                        <Database size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Database Connection</h3>
                        <p className="text-sm text-slate-400">Read-only system configuration.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="PostgreSQL Host" field="host" />
                    <Field label="Port" field="port" />
                    <Field label="Database Name" field="name" />
                    <Field label="Username" field="user" />
                </div>

                <div className="mt-6 p-4 bg-yellow-900/10 border border-yellow-700/30 rounded text-yellow-500 text-sm">
                    Note: Database settings are managed by the installer and cannot be changed here to prevent system corruption.
                </div>
            </div>
        </div>
    );
}
