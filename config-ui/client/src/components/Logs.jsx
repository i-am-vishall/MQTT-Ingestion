import { useState, useEffect, useRef } from "react";

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [isLive, setIsLive] = useState(false);

    // Default to ingestion service
    const [service, setService] = useState("ingestion");

    // ✅ Filter mode
    const [filter, setFilter] = useState("ALL");

    const socketRef = useRef(null);
    const logEndRef = useRef(null);

    // ✅ Auto-scroll flag
    const [autoScroll, setAutoScroll] = useState(true);

    // ✅ Start WebSocket Streaming
    useEffect(() => {
        if (!isLive) return;

        // Determine WS URL (auto-detect host)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        // Assume backend is on port 3001 as per config
        // Actually, in dev it might be different, but typically it's 3001 for backend.
        // Let's use the explicit backend port 3001 as established in server/index.js
        const wsUrl = `${protocol}//${host}:3001?service=${service}`;

        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onopen = () => {
            console.log("WS Connected");
        };

        socketRef.current.onmessage = (event) => {
            let parsed;

            try {
                parsed = JSON.parse(event.data);
            } catch {
                parsed = { raw: event.data }; // Fallback for raw text
            }

            setLogs((prev) => [...prev.slice(-500), parsed]);
        };

        socketRef.current.onerror = (e) => console.error("WS Error", e);
        socketRef.current.onclose = () => console.log("WS Closed");

        return () => {
            socketRef.current?.close();
        };
    }, [isLive, service]);

    // ✅ Auto-stop if tab hidden
    useEffect(() => {
        const stopIfHidden = () => {
            if (document.hidden) {
                setIsLive(false);
            }
        };

        document.addEventListener("visibilitychange", stopIfHidden);

        return () =>
            document.removeEventListener("visibilitychange", stopIfHidden);
    }, []);

    // ✅ Auto-scroll to bottom when logs update
    useEffect(() => {
        if (autoScroll) {
            logEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, autoScroll]);

    const resolveLevel = (log) => {
        if (log.level) return String(log.level).toLowerCase();
        const raw = String(log.raw || log.message || log.msg || "");
        if (raw.toLowerCase().includes("fatal")) return "fatal";
        if (raw.toLowerCase().includes("error")) return "error";
        if (raw.toLowerCase().includes("warn")) return "warn";
        if (raw.toLowerCase().includes("debug")) return "debug";
        return "info";
    };

    // ✅ Apply Filter
    const filteredLogs = logs.filter((log) => {
        if (log.system) return true;

        const lvl = resolveLevel(log);

        if (filter === "ERROR") return lvl === "error" || lvl === "fatal";
        if (filter === "WARN") return lvl === "warn" || lvl === "error" || lvl === "fatal";
        if (filter === "INFO") return lvl === "info";
        if (filter === "DEBUG") return lvl === "debug";
        return true;
    });

    return (
        <div className="p-4" style={{ height: 'calc(100vh - 100px)' }}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">✅ Live Logs Console (WebSocket)</h2>
            </div>

            {/* ✅ Controls */}
            <div className="flex flex-wrap gap-4 mb-4 items-center bg-gray-100 p-3 rounded shadow-sm text-black">
                {/* Service Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Service:</span>
                    <select
                        value={service}
                        onChange={(e) => {
                            setService(e.target.value);
                            setLogs([]); // Clear on switch
                        }}
                        className="border p-2 rounded bg-white min-w-[150px]"
                    >
                        <option value="ingestion">Ingestion Service</option>
                        <option value="config">Config Service</option>
                        <option value="db">PostgreSQL (DB)</option>
                        <option value="telegraf">Telegraf</option>
                        <option value="influxdb">InfluxDB</option>
                    </select>
                </div>

                {/* Filter Dropdown */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Filter:</span>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="border p-2 rounded bg-white min-w-[120px]"
                    >
                        <option value="ALL">All Levels</option>
                        <option value="DEBUG">Debug</option>
                        <option value="INFO">Info</option>
                        <option value="WARN">Warnings</option>
                        <option value="ERROR">Errors</option>
                    </select>
                </div>

                {/* Start/Stop Button */}
                <button
                    onClick={() => setIsLive(!isLive)}
                    className={`px-4 py-2 rounded text-white font-bold ml-auto ${isLive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                >
                    {isLive ? "⏸ Stop Logging" : "▶ Start Logging"}
                </button>

                {/* Auto-scroll toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none border-l pl-4 border-gray-300">
                    <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={() => setAutoScroll(!autoScroll)}
                        className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm">Auto-scroll</span>
                </label>

                <span className="text-xs font-semibold ml-4">
                    {isLive ? <span className="text-green-600">🟢 Live Connection</span> : <span className="text-red-500">🔴 Disconnected</span>}
                </span>
            </div>

            {/* ✅ Log Window */}
            <div
                style={{
                    background: "#1e1e1e",
                    color: "#0f0", // Matrix Green
                    padding: 10,
                    height: '100%',
                    overflowY: "auto",
                    fontFamily: "Consolas, Monaco, monospace",
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1px solid #333',
                }}
            >
                {filteredLogs.length === 0 && (
                    <div className="text-gray-500 text-center mt-10 italic">
                        {isLive ? 'Waiting for logs...' : 'Click "Start Logging" to connect.'}
                    </div>
                )}

                {filteredLogs.map((log, i) => {
                    const msgContent = log.message || log.msg;
                    const safeMsg = typeof msgContent === 'object' ? JSON.stringify(msgContent, null, 2) : msgContent;

                    return (
                        <div key={i} className="whitespace-pre-wrap break-all border-b border-gray-800 py-1 hover:bg-gray-800">
                            {log.system ? (
                                <div style={{ color: "cyan", fontWeight: 'bold' }}>⚙ {typeof log.msg === 'object' ? JSON.stringify(log.msg) : log.msg}</div>
                            ) : log.timestamp ? (
                                <div>
                                    <span className="text-gray-400">[{log.timestamp}]</span>{" "}
                                    <strong style={{
                                        color: log.level?.toLowerCase() === 'error' ? '#ff5555' :
                                            log.level?.toLowerCase() === 'warn' ? '#ffaa00' :
                                                '#55ff55'
                                    }}>
                                        {log.level?.toUpperCase()}
                                    </strong>
                                    {" "}—{" "}
                                    <span className="text-gray-300">{safeMsg}</span>
                                </div>
                            ) : (
                                // Raw / Fallback
                                <div className="text-gray-300">{log.raw || JSON.stringify(log)}</div>
                            )}
                        </div>
                    );
                })}

                {/* ✅ Scroll Anchor */}
                <div ref={logEndRef} />
            </div>
        </div>
    );
}
