import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BunPlugin } from "bun";

const frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Stessi entry di `tsconfig.json` `paths`, per il `Bun.build` usato da Electrobun. */
const aliasToFile: Record<string, string> = {
	desktop: path.join(frameworkRoot, "core/desktop.ts"),
	client: path.join(frameworkRoot, "core/client.ts"),
	server: path.join(frameworkRoot, "core/server.ts"),
};

/**
 * Pass-through ufficiale Electrobun: `build.bun.plugins`.
 * @see https://blackboard.sh/electrobun/docs/apis/cli/build-configuration/
 */
export function electrobunPathAliasesPlugin(): BunPlugin {
	return {
		name: "framework-path-aliases",
		setup(build) {
			for (const [name, target] of Object.entries(aliasToFile)) {
				build.onResolve({ filter: new RegExp(`^${name}$`) }, () => ({ path: target }));
			}
		},
	};
}
