import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { killViteProc, startClient } from "./client";
import { killDesktop, startDesktop } from "./desktop";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

process.on("exit", () => {
  killViteProc();
  killDesktop();
});

// CLIENT START
const { client } = await startClient(root);

// STOP
const stop = async () => {
  killDesktop();
  await client.close().catch(() => {});
  process.exit(0);
};

// WINDOWS BREAK -> STOP
for (const s of [
  "SIGINT",
  "SIGTERM",
  "SIGHUP",
  ...(process.platform === "win32" ? ["SIGBREAK"] : []),
] as const) {
  process.on(s, () => void stop());
}

// Ctrl+C → STOP
// D → START DESKTOP
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on("keypress", (ch, k) => {
    if (k?.ctrl && k?.name === "c") void stop();
    // START DESKTOP
    else if (ch === "d" || ch === "D") void startDesktop(root, client.url);
  });
}
