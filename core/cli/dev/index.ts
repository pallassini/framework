import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { killViteProc, startClient } from "./client";
import { killDesktop, startDesktop } from "./desktop";
import { killRpcServer, startRpcServer } from "./server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// —— cleanup su exit del processo dev ——
process.on("exit", () => {
	killViteProc();
	killRpcServer();
	killDesktop();
});

// —— SERVER
await startRpcServer(root);

// —— CLIENT 
const { client } = await startClient(root);

// —— STOP 
const stop = async () => {
	killDesktop();
	killRpcServer();
	await client.close().catch(() => {});
	process.exit(0);
};

// —— OS error → STOP 
for (const s of [
	"SIGINT",
	"SIGTERM",
	"SIGHUP",
	...(process.platform === "win32" ? ["SIGBREAK"] : []),
] as const) {
	process.on(s, () => void stop());
}

// Ctrl+C → STOP 
// d → DESKTOP (Electrobun)
if (process.stdin.isTTY) {
	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);
	process.stdin.on("keypress", (ch, k) => {
		if (k?.ctrl && k?.name === "c") void stop();
		else if (ch === "d" || ch === "D") void startDesktop(root, client.url);
	});
}
