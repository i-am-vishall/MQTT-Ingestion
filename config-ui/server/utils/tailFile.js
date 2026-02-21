const fs = require("fs");

function tailFile(filePath, maxLines = 200) {
    if (!filePath) return [];

    const stats = fs.statSync(filePath);
    const fd = fs.openSync(filePath, "r");

    let bufferSize = 8192;
    let buffer = Buffer.alloc(bufferSize);

    let position = stats.size;
    let lines = [];
    let leftover = "";

    while (position > 0 && lines.length < maxLines) {
        position = Math.max(0, position - bufferSize);

        fs.readSync(fd, buffer, 0, bufferSize, position);

        const chunk = buffer.toString("utf8") + leftover;
        const parts = chunk.split("\n");

        leftover = parts.shift();
        lines = parts.concat(lines);

        if (position === 0) break;
    }

    fs.closeSync(fd);

    return lines.slice(-maxLines);
}

module.exports = tailFile;
