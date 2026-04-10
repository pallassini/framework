import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const clientConfig = path.join(root, "core/client/vite.config.ts");
const vp = path.join(root, "node_modules/vite-plus/bin/vp");

// START CLIENT
const child = Bun.spawn({
  cmd: ["bun", vp, "dev", "-c", clientConfig],
  cwd: root,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});


// Ctrl+C -> STOP CLIENT
for (const sig of [
  "SIGINT",
  "SIGTERM",
  "SIGHUP",
  ...(process.platform === "win32" ? (["SIGBREAK"] as const) : []),
] as const) {
  process.on(sig, () => {
    try {
      child.kill(9);
    } catch {}
    process.exit(0);
  });
}

// ERROR -> STOP CLIENT
process.exit((await child.exited) ?? 0);
