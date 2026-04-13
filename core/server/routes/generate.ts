/**
 * Rigenera `core/client/server/routes-gen.ts` da `server/routes/**`.
 * In dev viene chiamato dal plugin Vite; da CLI: `bun core/server/routes/generate.ts`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathFromExport, walkRouteFiles } from "./route-fs";

const EXPORT_CONST_RE = /export const (\w+)(?::[^=]+)?\s*=\s*s\s*\(/g;
const EXPORT_DEFAULT_RE = /export\s+default\s+s\s*\(/;

type GenEntry = { rpcPath: string; file: string; exportName: string };

function safeAlias(rpcPath: string): string {
	let s = rpcPath.replace(/\./g, "_").replace(/[^a-zA-Z0-9_]/g, "_");
	if (!/^[_a-zA-Z]/.test(s)) s = `_${s}`;
	return s || "_route";
}

function tsKey(rpcPath: string): string {
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(rpcPath) ? rpcPath : JSON.stringify(rpcPath);
}

function writeGenTsFile(entries: GenEntry[], genPath: string): void {
	const relImport = (absFile: string) => {
		let r = relative(dirname(genPath), absFile).replace(/\\/g, "/");
		if (!r.startsWith(".")) r = `./${r}`;
		return r.replace(/\.(tsx?)$/, "");
	};

	const byFile = new Map<string, GenEntry[]>();
	for (const e of entries) {
		const list = byFile.get(e.file) ?? [];
		list.push(e);
		byFile.set(e.file, list);
	}

	const importLines: string[] = [];
	for (const file of [...byFile.keys()].sort((a, b) => a.localeCompare(b))) {
		const list = byFile.get(file)!;
		const specs = list
			.map((e) => {
				const alias = safeAlias(e.rpcPath);
				if (e.exportName === "default") return `default as ${alias}`;
				return alias === e.exportName ? e.exportName : `${e.exportName} as ${alias}`;
			})
			.sort();
		importLines.push(`import { ${specs.join(", ")} } from "${relImport(file)}";`);
	}

	const typeLines = entries
		.sort((a, b) => a.rpcPath.localeCompare(b.rpcPath))
		.map((e) => `\t${tsKey(e.rpcPath)}: InferRoute<typeof ${safeAlias(e.rpcPath)}>;`);

	const header = `/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

`;

	const importsBlock = importLines.length ? `${importLines.join("\n")}\n\n` : "";
	const body = `${importsBlock}type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
${typeLines.length ? `${typeLines.join("\n")}\n` : ""}};

export type ServerPath = keyof ServerRoutes & string;
`;

	writeFileSync(genPath, `${header}${body}`, "utf8");
}

function defaultProjectRoot(): string {
	return resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
}

export function writeServerRoutesGen(projectRoot?: string): void {
	const root = projectRoot ?? defaultProjectRoot();
	const routesDir = join(root, "server", "routes");
	const genPath = join(root, "core", "client", "server", "routes-gen.ts");
	const entries: GenEntry[] = [];

	if (!existsSync(routesDir)) {
		writeGenTsFile([], genPath);
		return;
	}

	const byPath = new Map<string, string>();

	for (const file of walkRouteFiles(routesDir)) {
		let src: string;
		try {
			src = readFileSync(file, "utf8");
		} catch {
			continue;
		}

		if (EXPORT_DEFAULT_RE.test(src)) {
			const rpcPath = pathFromExport(routesDir, file, "default");
			const prev = byPath.get(rpcPath);
			if (prev) {
				throw new Error(`[server routes gen] path duplicato "${rpcPath}" (${prev} vs ${file}#default)`);
			}
			byPath.set(rpcPath, `${file}#default`);
			entries.push({ rpcPath, file, exportName: "default" });
		}

		EXPORT_CONST_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = EXPORT_CONST_RE.exec(src)) != null) {
			const exportName = m[1]!;
			const rpcPath = pathFromExport(routesDir, file, exportName);
			if (!rpcPath) continue;
			const prev = byPath.get(rpcPath);
			if (prev) {
				throw new Error(`[server routes gen] path duplicato "${rpcPath}" (${prev} vs ${file}#${exportName})`);
			}
			byPath.set(rpcPath, `${file}#${exportName}`);
			entries.push({ rpcPath, file, exportName });
		}
	}

	writeGenTsFile(entries, genPath);
}

if (import.meta.main) {
	writeServerRoutesGen(defaultProjectRoot());
}
