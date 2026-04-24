import { existsSync, type FSWatcher, watch } from "node:fs";
import { join } from "node:path";
import { serverConfig } from "../../../server/config";
import { loadServerRoutes } from "./load";
import { routesState } from "./state";

const extraWatchers: FSWatcher[] = [];

function closeExtraWatchers(): void {
	while (extraWatchers.length) {
		const w = extraWatchers.pop();
		try {
			w?.close();
		} catch {
			/* */
		}
	}
}

/**
 * Hot reload registry quando cambiano i file di progetto.
 * Oltre a `server/routes` osservaiamo tutte le directory "utente" che possono essere
 * importate da una route: `server/` (inclusi `config.ts` e altri file), `db/`, e la root.
 * In più vengono osservate le directory `core/client/` e `core/server/middlewares/`
 * (spesso riesportate nelle route: `v`, `s`, validator, middlewares, ecc.).
 */
export function watchServerRoutes(projectRoot: string): void {
	const routesDir = join(projectRoot, "server", "routes");
	let t: ReturnType<typeof setTimeout> | undefined;

	const schedule = () => {
		if (t != null) clearTimeout(t);
		t = setTimeout(() => {
			void loadServerRoutes(projectRoot).then(() => {
				if (serverConfig.log.registryReload !== false) {
					console.log("[server/routes] registry ricaricato");
				}
			});
		}, 120);
	};

	try {
		routesState.routesWatcher?.close();
	} catch {
		/* */
	}
	closeExtraWatchers();

	if (!existsSync(routesDir)) return;

	routesState.routesWatcher = watch(routesDir, { recursive: true }, () => {
		schedule();
	});

	const watchCandidates = [
		join(projectRoot, "server"),
		join(projectRoot, "db"),
		join(projectRoot, "core", "client"),
		join(projectRoot, "core", "server", "middlewares"),
		join(projectRoot, "core", "server", "error"),
	];

	const isCodeFile = (name: string | null | undefined): boolean =>
		!!name && /\.(tsx?|jsx?|mjs|cjs)$/.test(name);

	for (const dir of watchCandidates) {
		if (!existsSync(dir)) continue;
		try {
			const w = watch(dir, { recursive: true }, (_evt, filename) => {
				if (filename == null) {
					schedule();
					return;
				}
				const name = typeof filename === "string" ? filename : filename.toString();
				if (name.includes("node_modules")) return;
				if (name.endsWith(".generated.ts") || name.endsWith("routes-gen.ts")) return;
				if (!isCodeFile(name)) return;
				schedule();
			});
			extraWatchers.push(w);
		} catch {
			/* */
		}
	}
}
