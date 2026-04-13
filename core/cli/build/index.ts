import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWeb } from "./client";
import { generateServerClientTypes } from "./server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// —— SERVER (tipi client da `server/routes/**`)
await generateServerClientTypes(root);

// —— CLIENT (Vite → `build/web`, niente Electrobun)
await buildWeb(root);
