export type BuildTarget = "web" | "desktop";

/** Ambiente Electrobun: `dev` = veloce → `build/desktop/dev`; `canary` / `stable` → `build/desktop/prod`. */
export type ElectrobunBuildEnv = "dev" | "canary" | "stable";

const HELP = `Uso: bun run build [web] [desktop [dev|canary|stable]]
     oppure: bun ./core/cli/build/index.ts …

  web (default)     tipi server + Vite → build/web
  desktop           web + electrodun --env=stable → prod/ e prod/packages/ (artifact)
  desktop dev       stesso ma --env=dev → build/desktop/dev (come electrodun dev)
  desktop canary    come desktop, --env=canary
  all | server      alias di desktop | web
`;

export function parseBuildTarget(argv: string[]): BuildTarget {
	const a = argv[2]?.toLowerCase();
	if (a == null || a === "" || a === "web" || a === "server") return "web";
	if (a === "desktop" || a === "all") return "desktop";
	console.error(HELP);
	console.error(`Target non riconosciuto: ${JSON.stringify(argv[2])}`);
	process.exit(1);
}

/** Default stable: pacchetto “vero” in prod; passa \`dev\` per iterazione veloce in build/desktop/dev. */
export function parseElectrobunEnv(argv: string[]): ElectrobunBuildEnv {
	const e = argv[3]?.toLowerCase();
	if (e === "dev") return "dev";
	if (e === "canary") return "canary";
	if (e === "stable") return "stable";
	if (e == null || e === "") return "stable";
	console.error(HELP);
	console.error(`Ambiente electrodun non valido: ${JSON.stringify(argv[3])}`);
	process.exit(1);
}
