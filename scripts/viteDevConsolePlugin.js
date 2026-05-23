import fs from "node:fs";
import path from "node:path";
const LOG_FILE = path.resolve(process.cwd(), ".cursor/dev-console.log");
const MAX_LOG_BYTES = 512_000;
function ensureLogDirectory() {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, "");
    }
}
function trimLogFile() {
    if (!fs.existsSync(LOG_FILE)) {
        return;
    }
    const stats = fs.statSync(LOG_FILE);
    if (stats.size <= MAX_LOG_BYTES) {
        return;
    }
    const contents = fs.readFileSync(LOG_FILE, "utf8");
    const lines = contents.split("\n").filter(Boolean);
    const trimmed = lines.slice(-500).join("\n");
    fs.writeFileSync(LOG_FILE, trimmed.length > 0 ? `${trimmed}\n` : "");
}
function appendLogEntry(entry) {
    ensureLogDirectory();
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
    trimLogFile();
}
function readRecentLogEntries(limit = 200) {
    if (!fs.existsSync(LOG_FILE)) {
        return [];
    }
    const lines = fs.readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean);
    return lines.slice(-limit).map((line) => JSON.parse(line));
}
function sendJson(response, status, body) {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(body));
}
function attachDevConsoleMiddleware(server) {
    server.middlewares.use("/__dev/console", (request, response, next) => {
        if (request.method === "GET") {
            sendJson(response, 200, {
                entries: readRecentLogEntries(),
                logFile: LOG_FILE,
            });
            return;
        }
        if (request.method === "DELETE") {
            ensureLogDirectory();
            fs.writeFileSync(LOG_FILE, "");
            sendJson(response, 200, { cleared: true });
            return;
        }
        if (request.method !== "POST") {
            next();
            return;
        }
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
        });
        request.on("end", () => {
            try {
                const entry = JSON.parse(body);
                appendLogEntry(entry);
                response.statusCode = 204;
                response.end();
            }
            catch {
                sendJson(response, 400, { error: "Invalid JSON payload." });
            }
        });
    });
}
export function viteDevConsolePlugin() {
    return {
        name: "vite-dev-console",
        apply: "serve",
        configureServer(server) {
            attachDevConsoleMiddleware(server);
        },
    };
}
