import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Gavel, Plus, Trash } from 'lucide-react';

const API_BASE = '/api';

export default function RuleEditor() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newRule, setNewRule] = useState({
        event_type: 'TRAFFIC',
        condition_field: 'vehicle_count',
        condition_operator: '>',
        condition_value: '',
        resulting_state: 'TRAFFIC_JAM'
    });

    const fetchRules = async () => {
        const res = await axios.get(`${API_BASE}/rules`);
        setRules(res.data.rules || []);
    };

    const addRule = async () => {
        if (!newRule.condition_value) return alert('Value required');
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/rules`, newRule);
            await fetchRules();
            setNewRule({ ...newRule, condition_value: '' }); // Reset value
        } catch (e) {
            alert('Failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteRule = async (id) => {
        if (!confirm('Delete this rule?')) return;
        await axios.delete(`${API_BASE}/rules/${id}`);
        fetchRules();
    };

    useEffect(() => { fetchRules(); }, []);

    return (
        <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-slate-700 p-8 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-slate-800 rounded text-accent">
                        <Gavel size={24} />
                    </div>
                    <h3 className="text-xl font-bold">Rule Engine Classification</h3>
                </div>

                {/* Add Rule Form */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8 bg-slate-900/50 p-4 rounded-lg border border-slate-700 border-dashed">
                    <select className="bg-slate-900 border border-slate-700 rounded px-2 py-2 text-white outline-none"
                        value={newRule.event_type} onChange={e => setNewRule({ ...newRule, event_type: e.target.value })}>
                        <option>TRAFFIC</option>
                        <option>ANPR</option>
                        <option>CROWD</option>
                    </select>

                    <input className="bg-slate-900 border border-slate-700 rounded px-2 py-2 text-white outline-none"
                        placeholder="Field (e.g. vehicle_count)"
                        value={newRule.condition_field} onChange={e => setNewRule({ ...newRule, condition_field: e.target.value })}
                    />

                    <select className="bg-slate-900 border border-slate-700 rounded px-2 py-2 text-white outline-none"
                        value={newRule.condition_operator} onChange={e => setNewRule({ ...newRule, condition_operator: e.target.value })}>
                        <option>{'>'}</option>
                        <option>{'<'}</option>
                        <option>{'='}</option>
                        <option>{'>='}</option>
                    </select>

                    <input className="bg-slate-900 border border-slate-700 rounded px-2 py-2 text-white outline-none"
                        placeholder="Value (e.g. 50)" type="number"
                        value={newRule.condition_value} onChange={e => setNewRule({ ...newRule, condition_value: e.target.value })}
                    />

                    <input className="bg-slate-900 border border-slate-700 rounded px-2 py-2 text-white outline-none"
                        placeholder="Result (e.g. TRAFFIC_JAM)"
                        value={newRule.resulting_state} onChange={e => setNewRule({ ...newRule, resulting_state: e.target.value })}
                    />

                    <button disabled={loading} onClick={addRule} className="bg-primary hover:bg-blue-600 text-white rounded font-bold transition flex items-center justify-center space-x-2">
                        <Plus size={18} /> <span>Add</span>
                    </button>
                </div>

                {/* Rules Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">If Field...</th>
                                <th className="px-4 py-3">Op</th>
                                <th className="px-4 py-3">Value</th>
                                <th className="px-4 py-3">Then Set State To...</th>
                                <th className="px-4 py-3 w-10">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700 bg-slate-900/50">
                            {rules.map((rule) => (
                                <tr key={rule.rule_id} className="hover:bg-slate-800/50 transition">
                                    <td className="px-4 py-3 font-medium text-white">{rule.event_type}</td>
                                    <td className="px-4 py-3 font-mono text-accent">{rule.condition_field}</td>
                                    <td className="px-4 py-3 font-bold text-white">{rule.condition_operator}</td>
                                    <td className="px-4 py-3 font-mono text-white">{rule.condition_value}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded bg-slate-800 text-white border border-slate-600 font-bold text-xs">
                                            {rule.resulting_state}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => deleteRule(rule.rule_id)} className="text-error hover:text-red-400 transition p-1 hover:bg-red-900/20 rounded">
                                            <Trash size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {rules.length === 0 && (
                                <tr><td colSpan="6" className="p-4 text-center italic">No rules defined.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
