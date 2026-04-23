/**
 * `bun dev:remote [alias]` — avvia `bun dev` con FWDB_REMOTE=<alias> (default: prod).
 * Cross-platform: setta l'env e spawna il processo figlio.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const alias = (process.argv[2] ?? "prod").trim() || "prod";
const entry = path.join(process.cwd(), "core", "cli", "dev", "index.ts");

const child = spawn("bun", [entry], {
	stdio: "inherit",
	env: {
		...process.env,
		FWDB_REMOTE: alias,
	},
});

child.on("exit", (code) => {
	process.exit(code ?? 0);
});
