const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const getLatestLogFile = require("../utils/getLatestLogFile");

function startLogWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    console.log("✅ WebSocket Log Server Started");

    wss.on("connection", (ws, req) => {
        let service = "ingestion";
        try {
            const url = new URL(req.url, "http://localhost");
            service = url.searchParams.get("service") || "ingestion";
        } catch (e) {
            console.error("Error parsing WS URL", e);
        }

        let currentFile = getLatestLogFile(service);

        if (!currentFile) {
            ws.send(JSON.stringify({
                system: true,
                msg: `⚠️ No active log file found for ${service}. Searching...`
            }));
            // We still proceed to poll, in case file appears.
        } else {
            ws.send(JSON.stringify({
                system: true,
                msg: `Streaming logs from ${currentFile}`
            }));

            // ✅ UX: Send last 5KB immediately (Initial Tail)
            try {
                const stats = fs.statSync(currentFile);
                const initialSize = 5000; // ~50 lines
                const startPos = Math.max(0, stats.size - initialSize);

                if (startPos < stats.size) {
                    const stream = fs.createReadStream(currentFile, {
                        start: startPos,
                        end: stats.size
                    });

                    stream.on('data', chunk => {
                        const lines = chunk.toString().split('\n');
                        // Skip first partial line if we started in middle
                        if (startPos > 0) lines.shift();
                        lines.forEach(line => {
                            if (line.trim()) ws.send(line);
                        });
                    });
                }
            } catch (e) {
                console.error("Initial tail failed", e);
            }
        }

        let fileSize = currentFile ? fs.statSync(currentFile).size : 0;

        const interval = setInterval(() => {
            // ✅ Detect log rotation or new file appearing
            const newestFile = getLatestLogFile(service);

            // Case 1: Switched file
            if (newestFile && newestFile !== currentFile) {
                currentFile = newestFile;
                fileSize = 0; // reset pointer

                ws.send(JSON.stringify({
                    system: true,
                    msg: `🔄 Switched to new log file: ${path.basename(currentFile)}`
                }));

                // Case 2: File appeared (was null)
            } else if (newestFile && !currentFile) {
                currentFile = newestFile;
                fileSize = 0;
                ws.send(JSON.stringify({
                    system: true,
                    msg: `✅ Found log file: ${path.basename(currentFile)}`
                }));
            }

            if (!currentFile) return;

            // ✅ Tail new content
            try {
                const stats = fs.statSync(currentFile);
                const newSize = stats.size;

                if (newSize > fileSize) {
                    const stream = fs.createReadStream(currentFile, {
                        start: fileSize,
                        end: newSize
                    });

                    stream.on("data", chunk => {
                        const lines = chunk.toString().split("\n");
                        lines.forEach(line => {
                            if (line.trim()) ws.send(line);
                        });
                    });

                    fileSize = newSize;
                } else if (newSize < fileSize) {
                    // File truncated? Reset.
                    fileSize = newSize;
                }
            } catch (err) {
                // File might be locked or deleted
            }
        }, 500);

        ws.on("close", () => {
            clearInterval(interval);
        });
    });
}

module.exports = startLogWebSocket;
