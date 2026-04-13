import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWeb } from "./client";
import { buildElectrobun } from "./desktop";
import { parseBuildTarget, parseElectrobunEnv } from "./targets";
import { generateServerClientTypes } from "./server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const target = parseBuildTarget(process.argv);

// —— SERVER
await generateServerClientTypes(root);

// —— CLIENT
await buildWeb(root);

// —— DESKTOP
if (target === "desktop") {
	await buildElectrobun(root, parseElectrobunEnv(process.argv));
}
